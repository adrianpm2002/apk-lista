import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import * as SQLiteCache from '../utils/sqliteCache';

// Helper para convertir fecha local a string para consultas de base de datos
const formatDateForQuery = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const CACHE_DAYS = 30; // Cachear últimos 30 días

export const useListeroStatistics = (options = {}) => {
  const { enabled = true } = options;
  
  // Estados básicos
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [tableData, setTableData] = useState({
    plays: []
  });
  
  // Estado para el rango de fechas (hoy por defecto)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setHours(23, 59, 59, 999))
  });
  
  // Ref para evitar múltiples cargas simultáneas
  const loadingRef = useRef(false);

  // Detectar userId y auto-cargar datos (se ejecuta cuando enabled cambia)
  useEffect(() => {
    const initializeData = async () => {
      if (!enabled) {
        setUserId(null); // Limpiar userId si se deshabilita
        return;
      }
      
      if (loadingRef.current) {
        return;
      }
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUserId(user.id);
          
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);
          
          // Pasar userId explícitamente porque setUserId es asíncrono
          loadPlaysData({ 
            startDate, 
            endDate, 
            forceRefresh: false 
          }, user.id);
        }
      } catch (error) {
        // Error silencioso
      }
    };

    initializeData();
  }, [enabled]);

  /**
   * Cargar datos desde Supabase
   */
  const loadFromSupabase = async (userId, startDate, endDate) => {
    try {
      const startStr = formatDateForQuery(startDate);
      const endStr = formatDateForQuery(endDate);

      let allPlaysData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: playsData, error } = await supabase
          .from('v_estadisticas')
          .select('*')
          .eq('id_listero', userId)
          .gte('fecha_jugada', startStr)
          .lte('fecha_jugada', endStr)
          .order('fecha_jugada', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          throw error;
        }
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
          hasMore = playsData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
        
        // Límite de seguridad
        if (page > 250) break;
      }

      return allPlaysData || [];
    } catch (error) {
      throw error;
    }
  };

  /**
   * Cargar datos con estrategia de caché inteligente
   */
  const loadPlaysData = async (filters = {}, userIdOverride = null) => {
    const effectiveUserId = userIdOverride || userId;
    
    if (!effectiveUserId || !enabled) {
      return;
    }
    
    if (loadingRef.current) {
      return; // Evitar cargas simultáneas
    }

    loadingRef.current = true;
    setIsLoading(true);

    try {
      const {
        startDate = dateRange.startDate,
        endDate = dateRange.endDate,
        forceRefresh = false
      } = filters;

      // 1. Intentar leer del caché SQLite primero
      let cachedPlays = [];
      try {
        cachedPlays = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'listero', {
          startDate,
          endDate
        });
      } catch (cacheError) {
        cachedPlays = [];
      }

      if (cachedPlays.length > 0 && !forceRefresh) {
        // 🔧 FIX: Filtrar datos del caché por el rango solicitado
        const filteredCachedPlays = cachedPlays.filter(play => {
          const playDate = new Date(play.fecha_jugada);
          return playDate >= startDate && playDate <= endDate;
        });
        
        setTableData({ plays: filteredCachedPlays });

        // Verificar si necesita actualización incremental (solo HOY)
        let needsUpdate = false;
        try {
          needsUpdate = await SQLiteCache.needsIncrementalUpdate(effectiveUserId, 'listero');
        } catch (cacheError) {
          // Error silencioso
        }
        
        if (needsUpdate) {
          updateTodayInBackground(effectiveUserId);
        }

        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // 2. No hay caché o forceRefresh: cargar desde Supabase
      // 🎯 OPTIMIZACIÓN: Consultar SOLO el rango solicitado, no siempre 30 días
      const playsData = await loadFromSupabase(effectiveUserId, startDate, endDate);

      // 3. Guardar en caché SQLite
      if (playsData.length > 0) {
        try {
          await SQLiteCache.savePlaysToCache(effectiveUserId, 'listero', playsData);
          await SQLiteCache.updateIncrementalTimestamp(effectiveUserId, 'listero');
        } catch (cacheError) {
          // Error silencioso
        }
      }

      // 4. Mostrar datos (ya están filtrados por el rango)
      setTableData({ plays: playsData });

      // 5. Limpiar registros antiguos
      try {
        await SQLiteCache.cleanOldRecords(effectiveUserId, 'listero');
      } catch (cacheError) {
        // Error silencioso
      }

    } catch (error) {
      setTableData({ plays: [] });
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  };

  /**
   * Actualización incremental en background (solo HOY)
   */
  const updateTodayInBackground = async (userId) => {
    try {
      const today = new Date();
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      
      // Ventana de 5 horas hacia atrás para capturar horarios que cierran tarde
      const updateStart = new Date(todayStart);
      updateStart.setHours(updateStart.getHours() - 5);
      
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const todayPlays = await loadFromSupabase(userId, updateStart, todayEnd);

      if (todayPlays.length > 0) {
        try {
          await SQLiteCache.savePlaysToCache(userId, 'listero', todayPlays);
          await SQLiteCache.updateIncrementalTimestamp(userId, 'listero');
        } catch (cacheError) {
          return;
        }
        
        // Refrescar datos si está viendo hoy
        const { startDate, endDate } = dateRange;
        const isViewingToday = 
          startDate.getDate() === today.getDate() &&
          startDate.getMonth() === today.getMonth() &&
          startDate.getFullYear() === today.getFullYear();

        if (isViewingToday) {
          try {
            const cachedPlays = await SQLiteCache.readPlaysFromCache(userId, 'listero', {
              startDate,
              endDate
            });
            setTableData({ plays: cachedPlays });
          } catch (cacheError) {
            // Error silencioso
          }
        }
      }

      // Limpiar registros antiguos
      try {
        await SQLiteCache.cleanOldRecords(userId, 'listero');
      } catch (cacheError) {
        // Error silencioso
      }
    } catch (error) {
      // Error silencioso
    }
  };

  /**
   * Aplicar filtros (cambia el rango de fechas y recarga)
   */
  const applyFilters = async (filters = {}) => {
    const {
      startDate,
      endDate,
      forceRefresh = false
    } = filters;

    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
    
    await loadPlaysData({
      startDate: startDate || dateRange.startDate,
      endDate: endDate || dateRange.endDate,
      forceRefresh
    });
  };  /**
   * Refrescar datos (pull-to-refresh)
   */
  const refresh = async () => {
    await loadPlaysData({ forceRefresh: true });
  };

  // ❌ ELIMINADO: Carga automática causaba double-loading y race conditions
  // StatisticsScreen controla cuándo cargar vía applyPeriodFilter('today')
  // useEffect(() => {
  //   if (userId && enabled) {
  //     loadPlaysData();
  //   }
  // }, [userId, enabled]);

  return {
    tableData,
    loading: isLoading,
    error: null,
    loadPlaysData,
    applyFilters,
    refresh,
    dateRange
  };
};

export default useListeroStatistics;
