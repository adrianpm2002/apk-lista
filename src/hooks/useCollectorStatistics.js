import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import * as SQLiteCache from '../utils/sqliteCache';

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

const CACHE_DAYS = 60; // Cachear últimos 60 días

/**
 * Agrupar datos para vista de colector
 * Los datos vienen planos de la tabla estadisticas, necesitamos agruparlos por listero
 */
const groupDataForCollector = (rawData) => {
  try {
    if (!rawData || !Array.isArray(rawData)) {
      return [];
    }
    
    if (rawData.length === 0) {
      return [];
    }

    // Agrupar por listero
    const listeroGroups = {};
    
    rawData.forEach(record => {
      if (!record) {
        return;
      }

      const listeroId = record.id_listero;
      const listeroName = record.listero_username || `Listero ${listeroId}`;
      
      if (!listeroGroups[listeroId]) {
        listeroGroups[listeroId] = {
          id: listeroId,
          listero_name: listeroName,
          plays: [],
          total_bruto: 0,
          total_premio: 0,
          total_ganancia_listero: 0,
          total_ganancia_colector: 0,
          balance_colector: 0
        };
      }
      
      listeroGroups[listeroId].plays.push(record);
    });

    // Calcular totales por listero
    Object.values(listeroGroups).forEach(group => {
      group.total_bruto = group.plays.reduce((sum, play) => sum + (Number(play.monto_total) || 0), 0);
      group.total_premio = group.plays.reduce((sum, play) => sum + (Number(play.monto_a_pagar) || 0), 0);
      group.total_ganancia_listero = group.plays.reduce((sum, play) => sum + (Number(play.ganancia_listero) || 0), 0);
      group.total_ganancia_colector = group.plays.reduce((sum, play) => sum + (Number(play.ganancia_colector) || 0), 0);
      group.balance_colector = group.plays.reduce((sum, play) => sum + (Number(play.balance_colector) || 0), 0);
    });

    const result = Object.values(listeroGroups);
    return result;
  } catch (error) {
    console.error('[useCollectorStatistics] ❌ ERROR FATAL en groupDataForCollector:', error);
    console.error('[useCollectorStatistics] Stack:', error.stack);
    return [];
  }
};

export const useCollectorStatistics = (options = {}) => {
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
   * Cargar datos desde Supabase (tabla estadisticas)
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
          .from('estadisticas')
          .select('*')
          .eq('id_colector', userId)
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
   * Verificar si una fecha está dentro de los últimos CACHE_DAYS días
   */
  const isWithinCacheDays = (date) => {
    const now = new Date();
    const limitDate = new Date(now);
    limitDate.setDate(limitDate.getDate() - CACHE_DAYS);
    limitDate.setHours(0, 0, 0, 0);
    return date >= limitDate;
  };

  /**
   * Verificar si el rango de fechas es "Hoy"
   */
  const isTodayFilter = (startDate, endDate) => {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    
    return startDate.getDate() === todayStart.getDate() &&
           startDate.getMonth() === todayStart.getMonth() &&
           startDate.getFullYear() === todayStart.getFullYear() &&
           endDate.getDate() === todayEnd.getDate() &&
           endDate.getMonth() === todayEnd.getMonth() &&
           endDate.getFullYear() === todayEnd.getFullYear();
  };

  /**
   * Cargar datos con estrategia SQLite-First
   * - Solo va a Supabase para actualizar HOY (con forceRefresh)
   * - Para otros filtros, siempre usa SQLite
   * - Para rangos fuera de 60 días, va a Supabase
   */
  const loadPlaysData = async (filters = {}, userIdOverride = null) => {
    const effectiveUserId = userIdOverride || userId;
    
    if (!effectiveUserId || !enabled) {
      return;
    }
    
    // Si ya está cargando, ignorar nueva petición (prevenir race conditions)
    if (loadingRef.current) {
      return;
    }
    
    // Cancelar cargas anteriores incrementando el token
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
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
      }

      // ========================================
      // ESTRATEGIA SQLite-First
      // - Solo va a Supabase para actualizar HOY (con forceRefresh)
      // - Para otros filtros, siempre usa SQLite
      // - Para rangos fuera de 60 días, va a Supabase
      // ========================================
      
      const isToday = isTodayFilter(startDate, endDate);
      const oldestDateInRange = new Date(startDate);
      const isRangeWithinCache = isWithinCacheDays(oldestDateInRange);

      // CASO 1: forceRefresh + filtro HOY → Actualizar desde Supabase
      if (forceRefresh && isToday) {
        const freshPlays = await loadFromSupabase(effectiveUserId, startDate, endDate);
        
        // Borrar HOY de SQLite y guardar datos frescos
        await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'collector', freshPlays, startDate, endDate);
        
        // Verificar token antes de setear datos
        if (currentToken !== loadTokenRef.current) {
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
        
        const groupedData = groupDataForCollector(freshPlays);
        setTableData({ plays: groupedData });
        
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // CASO 2: forceRefresh + otro filtro → Solo recargar desde SQLite
      if (forceRefresh && !isToday) {
        console.log('[useCollectorStatistics] 🔄 Recargando desde SQLite (no es HOY)...');
        
        let cachedPlays = [];
        try {
          cachedPlays = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'collector', {
            startDate,
            endDate
          });
        } catch (cacheError) {
          console.error('[useCollectorStatistics] ⚠️ Error leyendo caché:', cacheError);
          cachedPlays = [];
        }
        
        // Si caché vacío y rango dentro de 60 días, puede que nunca se haya cargado
        if (cachedPlays.length === 0 && isRangeWithinCache) {
          // Cargar desde Supabase solo esta vez para poblar caché
          const freshPlays = await loadFromSupabase(effectiveUserId, startDate, endDate);
          try {
            await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'collector', freshPlays, startDate, endDate);
          } catch (cacheError) {}
          cachedPlays = freshPlays;
        }
        
        if (currentToken !== loadTokenRef.current) {
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
        
        const groupedData = groupDataForCollector(cachedPlays);
        setTableData({ plays: groupedData });
        
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // CASO 3: Rango personalizado fuera de 60 días → Supabase directo (sin cachear)
      if (!isRangeWithinCache) {
        console.log('[useCollectorStatistics] 📡 Rango fuera de 60 días, cargando desde Supabase...');
        
        const freshPlays = await loadFromSupabase(effectiveUserId, startDate, endDate);
        
        if (currentToken !== loadTokenRef.current) {
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
        
        const groupedData = groupDataForCollector(freshPlays);
        setTableData({ plays: groupedData });
        
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // CASO 4: Carga normal (sin forceRefresh) → SQLite primero
      console.log('[useCollectorStatistics] 📦 Cargando desde SQLite...');
      
      let cachedPlays = [];
      try {
        cachedPlays = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'collector', {
          startDate,
          endDate
        });
      } catch (cacheError) {
        console.error('[useCollectorStatistics] ⚠️ Error leyendo caché:', cacheError);
        cachedPlays = [];
      }
      
      // Si caché vacío, cargar desde Supabase para poblar
      if (cachedPlays.length === 0) {
        console.log('[useCollectorStatistics] 📡 Caché vacío, cargando desde Supabase para poblar...');
        
        const freshPlays = await loadFromSupabase(effectiveUserId, startDate, endDate);
        
        try {
          await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'collector', freshPlays, startDate, endDate);
        } catch (cacheError) {}
        
        if (currentToken !== loadTokenRef.current) {
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
        
        const groupedData = groupDataForCollector(freshPlays);
        setTableData({ plays: groupedData });
        
        // Limpiar registros antiguos
        try {
          await SQLiteCache.cleanOldRecords(effectiveUserId, 'collector');
        } catch (cacheError) {}
        
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }
      
      // Hay datos en caché, usarlos
      if (currentToken !== loadTokenRef.current) {
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }
      
      const groupedData = groupDataForCollector(cachedPlays);
      setTableData({ plays: groupedData });

      // Limpiar registros muy antiguos (>60 días)
      try {
        await SQLiteCache.cleanOldRecords(effectiveUserId, 'collector');
      } catch (cacheError) {}

    } catch (error) {
      console.error('[useCollectorStatistics] ❌ Error en loadPlaysData:', error);
      
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
    dateRange
  };
};

export default useCollectorStatistics;
