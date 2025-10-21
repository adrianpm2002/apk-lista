import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import * as SQLiteCache from '../utils/sqliteCache';

// 🎯 FIX: Usar toISOString() consistente con SQLiteCache
// No necesitamos helper local, usaremos date.toISOString() directamente

const CACHE_DAYS = 30; // Cachear últimos 30 días

// 🔍 DEBUG LOGGING - FORZADO PARA TESTING
const DEBUG_ENABLED = true; // ⚠️ FORCED ON para capturar logs en preview builds
const debugLog = (...args) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

/**
 * Agrupar datos para vista de colector
 * Los datos vienen planos de v_estadisticas, necesitamos agruparlos por listero
 */
const groupDataForCollector = (rawData) => {
  try {
    // 🎯 FIX: Diagnóstico completo de entrada
    debugLog('[useCollectorStatistics] 📊 ENTRADA groupDataForCollector:', {
      esArray: Array.isArray(rawData),
      longitud: rawData?.length || 0,
      primerElemento: rawData?.[0] ? '✅ existe' : '❌ no existe',
      tipoRawData: typeof rawData
    });
    
    if (!rawData || !Array.isArray(rawData)) {
      debugLog('[useCollectorStatistics] ⚠️ rawData no es array válido');
      return [];
    }
    
    if (rawData.length === 0) {
      debugLog('[useCollectorStatistics] ⚠️ rawData está vacío');
      return [];
    }

    debugLog('[useCollectorStatistics] 📊 Agrupando', rawData.length, 'registros');

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
    debugLog('[useCollectorStatistics] ✅ SALIDA groupDataForCollector:', {
      gruposCreados: result.length,
      totalJugadas: rawData.length,
      listeroIds: result.map(g => g.id)
    });
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
        
        console.log('🔍 [useCollectorStatistics] Usuario obtenido:', user?.id ? 'SÍ' : 'NO');
        
        if (user) {
          setUserId(user.id);
          console.log('🔍 [useCollectorStatistics] userId seteado a:', user.id);
          
          // 🎯 FIX: Cargar solo HOY en la primera carga, no 30 días
          const today = new Date();
          const startDate = new Date(today);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(today);
          endDate.setHours(23, 59, 59, 999);
          
          debugLog('🐛 [DEBUG COLLECTOR] 🚀 Inicialización - Cargando SOLO HOY:', startDate.toLocaleDateString());
          
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
      // 🎯 FIX: Usar toISOString() para compatibilidad con formato ISO
      const startStr = startDate.toISOString();
      const endStr = endDate.toISOString();

      let allPlaysData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: playsData, error } = await supabase
          .from('v_estadisticas')
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
   * Cargar datos con estrategia Cache-First simplificada
   */
  const loadPlaysData = async (filters = {}, userIdOverride = null) => {
    const effectiveUserId = userIdOverride || userId;
    
    if (!effectiveUserId || !enabled) {
      return;
    }
    
    // 🎯 FIX: Si ya está cargando, ignorar nueva petición (prevenir race conditions)
    if (loadingRef.current) {
      console.log('[useCollectorStatistics] ⏸️ Carga en curso, ignorando nueva petición');
      return;
    }
    
    // 🎯 FIX: Cancelar cargas anteriores incrementando el token
    loadTokenRef.current += 1;
    const currentToken = loadTokenRef.current;
    console.log('[useCollectorStatistics] 🎫 Nueva carga - Token:', currentToken);
    
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
        console.log('[useCollectorStatistics] ⚠️ No hay fechas, usando HOY por defecto');
      }

      console.log(`[useCollectorStatistics] 🔄 Cargando: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
      console.log(`[useCollectorStatistics] forceRefresh: ${forceRefresh}`);

      // ========================================
      // ESTRATEGIA CACHE-FIRST SIMPLIFICADA
      // ========================================
      
      if (forceRefresh) {
        // PULL-TO-REFRESH: Cargar desde Supabase y actualizar caché
        console.log('[useCollectorStatistics] 🔄 Pull-to-refresh - Consultando Supabase');
        
        const freshPlays = await loadFromSupabase(effectiveUserId, startDate, endDate);
        console.log(`[useCollectorStatistics] ✅ Supabase devolvió: ${freshPlays.length} registros`);
        
        // Reemplazar caché con datos frescos para este rango
        await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'collector', freshPlays, startDate, endDate);
        console.log(`[useCollectorStatistics] 💾 Caché actualizado`);
        
        // Verificar token antes de setear datos
        if (currentToken !== loadTokenRef.current) {
          console.log('[useCollectorStatistics] ❌ Carga cancelada (token mismatch)');
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
        
        const groupedData = groupDataForCollector(freshPlays);
        setTableData({ plays: groupedData });
        
        setDebugInfo({
          source: 'SUPABASE (pull-to-refresh)',
          totalBeforeFilter: freshPlays.length,
          totalAfterFilter: freshPlays.length,
          cacheOldestDate: 'Actualizado',
          rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        });
        
      } else {
        // CARGA NORMAL: Solo desde caché
        debugLog('[useCollectorStatistics] 📦 Carga normal - Intentar desde caché');
        
        let cachedPlays = [];
        try {
          // 🎯 FIX: Pasar filtros de fecha para optimizar query SQL
          cachedPlays = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'collector', {
            startDate,
            endDate
          });
          debugLog(`[useCollectorStatistics] 📦 Caché (filtrado): ${cachedPlays.length} registros`);
        } catch (cacheError) {
          console.error('[useCollectorStatistics] ⚠️ Error leyendo caché:', cacheError);
          cachedPlays = [];
        }
        
        // 🎯 FIX: Si caché está vacío, forzar carga desde Supabase
        if (cachedPlays.length === 0) {
          console.log('[useCollectorStatistics] ⚠️ Caché vacío, forzando carga desde Supabase...');
          
          const freshPlays = await loadFromSupabase(effectiveUserId, startDate, endDate);
          console.log(`[useCollectorStatistics] ✅ Supabase devolvió: ${freshPlays.length} registros`);
          
          try {
            await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'collector', freshPlays, startDate, endDate);
          } catch (cacheError) {
            console.log('[useCollectorStatistics] ⚠️ No se pudo guardar en caché (probablemente en web)');
          }
          
          if (currentToken !== loadTokenRef.current) {
            console.log('[useCollectorStatistics] ❌ Carga cancelada (token mismatch)');
            setIsLoading(false);
            loadingRef.current = false;
            return;
          }
          
          const groupedData = groupDataForCollector(freshPlays);
          setTableData({ plays: groupedData });
          
          setDebugInfo({
            source: 'SUPABASE (caché vacío - fallback)',
            totalBeforeFilter: freshPlays.length,
            totalAfterFilter: freshPlays.length,
            cacheOldestDate: 'N/A',
            rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
          });
          
          try {
            await SQLiteCache.cleanOldRecords(effectiveUserId, 'collector');
          } catch (cacheError) {}
          
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
        
        // 🎯 FIX: Ya no necesitamos filtrar manualmente - SQL lo hizo por nosotros
        console.log(`[useCollectorStatistics] ✅ Caché ya filtrado por SQL: ${cachedPlays.length} registros`);
        
        // Encontrar fecha más antigua en caché (para debugging)
        const oldestCached = cachedPlays.length > 0
          ? new Date(Math.min(...cachedPlays.map(p => new Date(p.fecha_jugada).getTime())))
          : null;
        
        // Verificar token antes de setear datos
        if (currentToken !== loadTokenRef.current) {
          console.log('[useCollectorStatistics] ❌ Carga cancelada (token mismatch)');
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
        
        const groupedData = groupDataForCollector(cachedPlays);
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
        await SQLiteCache.cleanOldRecords(effectiveUserId, 'collector');
      } catch (cacheError) {
        // Error silencioso
      }

    } catch (error) {
      console.error('[useCollectorStatistics] ❌ Error en loadPlaysData:', error);
      
      // Verificar token antes de limpiar datos
      if (currentToken !== loadTokenRef.current) {
        console.log('[useCollectorStatistics] ❌ Error handler cancelado (token mismatch)');
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
          await SQLiteCache.savePlaysToCache(userId, 'collector', todayPlays);
          await SQLiteCache.updateIncrementalTimestamp(userId, 'collector');
        } catch (cacheError) {
          return;
        }
        
        const { startDate, endDate } = dateRange;
        const isViewingToday = 
          startDate.getDate() === today.getDate() &&
          startDate.getMonth() === today.getMonth() &&
          startDate.getFullYear() === today.getFullYear();

        if (isViewingToday) {
          try {
            const cachedPlays = await SQLiteCache.readPlaysFromCache(userId, 'collector', {
              startDate,
              endDate
            });
            
            const groupedCachedData = groupDataForCollector(cachedPlays);
            setTableData({ plays: groupedCachedData });
          } catch (cacheError) {
            // Error silencioso
          }
        }
      }

      try {
        await SQLiteCache.cleanOldRecords(userId, 'collector');
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

export default useCollectorStatistics;
