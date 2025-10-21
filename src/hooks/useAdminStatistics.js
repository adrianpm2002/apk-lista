import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import * as SQLiteCache from '../utils/sqliteCache';

/**
 * Función para agrupar datos por estructura jerárquica: Colectores -> Listeros -> Jugadas
 * El admin ve su banco con datos agrupados por colector, cada colector tiene listeros, 
 * y cada listero tiene sus jugadas.
 */
const groupDataForAdmin = (rawData) => {
  try {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      return [];
    }

    // Agrupar directamente por colector (el admin solo ve su banco)
    const collectorGroups = {};
    
    rawData.forEach(record => {
      if (!record) {
        return;
      }

      const collectorId = record.id_colector;
      const collectorName = record.colector_username || `Colector ${collectorId}`;
      
      if (!collectorGroups[collectorId]) {
        collectorGroups[collectorId] = {
          id: collectorId,
          collector_name: collectorName,
          listeros: {},
          total_bruto: 0,
          total_premio: 0,
          total_ganancia_colector: 0,
          balance_colector: 0,
          raw_plays: []
        };
      }
      
      collectorGroups[collectorId].raw_plays.push(record);
      
      // Agrupar por listero dentro del colector
      const listeroId = record.id_listero;
      const listeroName = record.listero_username || `Listero ${listeroId}`;
      
      if (!collectorGroups[collectorId].listeros[listeroId]) {
        collectorGroups[collectorId].listeros[listeroId] = {
          id: listeroId,
          listero_name: listeroName,
          plays: [],
          total_bruto: 0,
          total_premio: 0,
          total_ganancia_listero: 0,
          total_ganancia_colector: 0,
          total_balance_listero: 0,
          balance_colector: 0
        };
      }
      
      collectorGroups[collectorId].listeros[listeroId].plays.push(record);
    });

    // Procesar cada colector
    Object.values(collectorGroups).forEach(collector => {
      // Procesar cada listero del colector
      Object.values(collector.listeros).forEach(listero => {
        // Calcular totales del listero
        listero.total_bruto = listero.plays.reduce((sum, play) => sum + (Number(play.monto_total) || 0), 0);
        listero.total_premio = listero.plays.reduce((sum, play) => sum + (Number(play.monto_a_pagar) || 0), 0);
        listero.total_ganancia_listero = listero.plays.reduce((sum, play) => sum + (Number(play.ganancia_listero) || 0), 0);
        listero.total_ganancia_colector = listero.plays.reduce((sum, play) => sum + (Number(play.ganancia_colector) || 0), 0);
        listero.total_balance_listero = listero.plays.reduce((sum, play) => sum + (Number(play.balance_listero) || 0), 0);
        listero.balance_colector = listero.plays.reduce((sum, play) => sum + (Number(play.balance_colector) || 0), 0);
      });
      
      // Convertir object de listeros a array
      collector.listeros = Object.values(collector.listeros);
      
      // Calcular totales del colector
      collector.total_bruto = collector.raw_plays.reduce((sum, play) => sum + (Number(play.monto_total) || 0), 0);
      collector.total_premio = collector.raw_plays.reduce((sum, play) => sum + (Number(play.monto_a_pagar) || 0), 0);
      collector.total_ganancia_listero = collector.raw_plays.reduce((sum, play) => sum + (Number(play.ganancia_listero) || 0), 0);
      collector.total_ganancia_colector = collector.raw_plays.reduce((sum, play) => sum + (Number(play.ganancia_colector) || 0), 0);
      collector.balance_colector = collector.raw_plays.reduce((sum, play) => sum + (Number(play.balance_colector) || 0), 0);
    });

    const result = Object.values(collectorGroups);
    return result;
  } catch (error) {
    return [];
  }
};

/**
 * Formatear fecha para Supabase en formato timestamp LOCAL (NO UTC)
 * Supabase usa: "YYYY-MM-DD HH:MM:SS" (timestamp sin timezone)
 * NO usar toISOString() porque agrega "Z" y convierte a UTC
 */
const formatDateForSupabase = (date) => {
  if (typeof date === 'string') return date;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  // Formato: "2025-10-15 16:34:10"
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const CACHE_DAYS = 30; // Cachear últimos 30 días

export const useAdminStatistics = (options = {}) => {
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
  
  // Estado para debug info
  const [debugInfo, setDebugInfo] = useState({
    source: '', // 'CACHE' | 'SUPABASE'
    totalBeforeFilter: 0,
    totalAfterFilter: 0,
    cacheOldestDate: null,
    rangeRequested: ''
  });
  
  // Ref para evitar múltiples cargas simultáneas
  const loadingRef = useRef(false);
  
  // 🎯 FIX: Token de cancelación para race conditions
  const loadTokenRef = useRef(0);

  // Detectar userId y auto-cargar datos (se ejecuta cuando enabled cambia)
  useEffect(() => {
    const initializeData = async () => {
      if (!enabled) {
        setUserId(null);
        return;
      }
      
      if (loadingRef.current) {
        return;
      }
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUserId(user.id);
          
          // 🎯 FIX: Cargar solo HOY en la primera carga, no 30 días
          const today = new Date();
          const startDate = new Date(today);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(today);
          endDate.setHours(23, 59, 59, 999);
                    
          // 🎯 CAMBIO: Primera carga siempre desde Supabase para poblar caché
          // Pasar userId explícitamente porque setUserId es asíncrono
          loadPlaysData({ 
            startDate, 
            endDate, 
            forceRefresh: true // ✅ Forzar carga desde Supabase en primera carga
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
      // Formatear fechas para Supabase (timestamp local, NO UTC)
      const startStr = formatDateForSupabase(startDate);
      const endStr = formatDateForSupabase(endDate);

      let allPlaysData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: playsData, error } = await supabase
          .from('v_estadisticas')
          .select('*')
          .eq('id_banco', userId)
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
        if (page > 250) {
          break;
        }
      }

      return allPlaysData || [];
    } catch (error) {
      throw error;
    }
  };

  /**
   * Cargar datos desde views específicas (v_estadisticas_hoy o v_estadisticas_ayer)
  /**
   * Cargar datos con estrategia optimizada de 3 niveles
   */
  const loadPlaysData = async (filters = {}, userIdOverride = null) => {
    const effectiveUserId = userIdOverride || userId;
    
    if (!effectiveUserId || !enabled) {
      return;
    }
    
    // 🎯 FIX: Si ya está cargando, ignorar nueva petición (prevenir race conditions)
    if (loadingRef.current) {
      return;
    }
    
    // 🎯 FIX: Cancelar cargas anteriores incrementando el token
    loadTokenRef.current += 1;
    const currentToken = loadTokenRef.current;
    
    loadingRef.current = true;
    setIsLoading(true);

    try {
      // Extraer parámetros
      let {
        startDate = null,
        endDate = null,
        forceRefresh = false
      } = filters;
      
      // Si no hay fechas, usar HOY por defecto
      if (!startDate || !endDate) {
        const now = new Date();
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
      }

      // ========================================
      // ESTRATEGIA CACHE-FIRST SIMPLIFICADA
      // ========================================
      
      if (forceRefresh) {
        // PULL-TO-REFRESH: Cargar desde Supabase y actualizar caché
        
        const freshPlays = await loadFromSupabase(effectiveUserId, startDate, endDate);
        
        // Reemplazar caché con datos frescos para este rango
        await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'admin', freshPlays, startDate, endDate);
        
        // Verificar token antes de setear datos
        if (currentToken !== loadTokenRef.current) {
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
        
        const groupedData = groupDataForAdmin(freshPlays);
        setTableData({ plays: groupedData });
        
        setDebugInfo({
          source: 'SUPABASE (pull-to-refresh)',
          totalBeforeFilter: freshPlays.length,
          totalAfterFilter: freshPlays.length,
          cacheOldestDate: 'Actualizado',
          rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        });
        
        // Limpiar loading state y salir
        setIsLoading(false);
        loadingRef.current = false;
        return;
        
      } else {
        // CARGA NORMAL: Solo desde caché
        
        let cachedPlays = [];
        try {
          // 🎯 FIX: Pasar filtros de fecha para optimizar query SQL
          cachedPlays = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'admin', {
            startDate,
            endDate
          });
        } catch (cacheError) {
          console.error('[useAdminStatistics] ⚠️ Error leyendo caché:', cacheError);
          cachedPlays = [];
        }
        
        // 🎯 FIX: Si caché está vacío, forzar carga desde Supabase
        if (cachedPlays.length === 0) {
          
          const freshPlays = await loadFromSupabase(effectiveUserId, startDate, endDate);
          
          try {
            await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'admin', freshPlays, startDate, endDate);
          } catch (cacheError) {
          }
          
          if (currentToken !== loadTokenRef.current) {
            setIsLoading(false);
            loadingRef.current = false;
            return;
          }
          
          const groupedData = groupDataForAdmin(freshPlays);
          setTableData({ plays: groupedData });
          
          setDebugInfo({
            source: 'SUPABASE (caché vacío - fallback)',
            totalBeforeFilter: freshPlays.length,
            totalAfterFilter: freshPlays.length,
            cacheOldestDate: 'N/A',
            rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
          });
          
          try {
            await SQLiteCache.cleanOldRecords(effectiveUserId, 'admin');
          } catch (cacheError) {}
          
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
        
        // Encontrar fecha más antigua en caché (para debugging)
        const oldestCached = cachedPlays.length > 0
          ? new Date(Math.min(...cachedPlays.map(p => new Date(p.fecha_jugada).getTime())))
          : null;
        
        // Verificar token antes de setear datos
        if (currentToken !== loadTokenRef.current) {
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
        
        const groupedData = groupDataForAdmin(cachedPlays);
        setTableData({ plays: groupedData });
        
        setDebugInfo({
          source: 'CACHE',
          totalBeforeFilter: cachedPlays.length,
          totalAfterFilter: cachedPlays.length, // Ya filtrado por SQL
          cacheOldestDate: oldestCached?.toLocaleDateString() || 'Sin datos',
          rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        });
      }

      // Limpiar registros muy antiguos (>60 días)
      try {
        await SQLiteCache.cleanOldRecords(effectiveUserId, 'admin');
      } catch (cacheError) {
        // Error silencioso
      }

    } catch (error) {
      console.error('[useAdminStatistics] ❌ Error en loadPlaysData:', error);
      
      // Verificar token antes de limpiar datos
      if (currentToken !== loadTokenRef.current) {
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }
      
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
      
      const updateStart = new Date(todayStart);
      updateStart.setHours(updateStart.getHours() - 5);
      
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const todayPlays = await loadFromSupabase(userId, updateStart, todayEnd);

      if (todayPlays.length > 0) {
        try {
          await SQLiteCache.savePlaysToCache(userId, 'admin', todayPlays);
          await SQLiteCache.updateIncrementalTimestamp(userId, 'admin');
        } catch (cacheError) {
          console.error('[useAdminStatistics] ⚠️ Error in incremental update cache save:', cacheError);
          return;
        }
        
        const { startDate, endDate } = dateRange;
        const isViewingToday = 
          startDate.getDate() === today.getDate() &&
          startDate.getMonth() === today.getMonth() &&
          startDate.getFullYear() === today.getFullYear();

        if (isViewingToday) {
          try {
            const cachedPlays = await SQLiteCache.readPlaysFromCache(userId, 'admin', {
              startDate,
              endDate
            });
            
            const groupedData = groupDataForAdmin(cachedPlays);
            setTableData({ plays: groupedData });
          } catch (cacheError) {
            // Error silencioso
          }
        }
      }

      try {
        await SQLiteCache.cleanOldRecords(userId, 'admin');
      } catch (cacheError) {
        // Error silencioso
      }
    } catch (error) {
      // Error silencioso
    }
  };

  /**
   * Aplicar filtros
   */
  const applyFilters = async (filters = {}) => {
    const {
      startDate,
      endDate,
      forceRefresh = false,
      periodType = 'custom' // Aceptar el tipo de período
    } = filters;

    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }

    const finalStartDate = startDate || dateRange.startDate;
    const finalEndDate = endDate || dateRange.endDate;

    await loadPlaysData({
      startDate: finalStartDate,
      endDate: finalEndDate,
      forceRefresh
    });
  };

  /**
   * Refrescar datos (pull-to-refresh)
   */
  const refresh = async () => {
    await loadPlaysData({ 
      ...dateRange, 
      forceRefresh: true
    });
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
    dateRange,
    debugInfo
  };
};

export default useAdminStatistics;
