import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import * as SQLiteCache from '../utils/sqliteCache';

// 🎯 FIX: Usar toISOString() consistente con SQLiteCache
// No necesitamos helper local, usaremos date.toISOString() directamente

/**
 * Función para agrupar datos por estructura jerárquica: Colectores -> Listeros -> Jugadas
 * El Listero ve su listero con datos agrupados por colector, cada colector tiene listeros, 
 * y cada listero tiene sus jugadas.
 */
const groupDataForListero = (rawData) => {
  console.log('[groupDataForListero] 🔍 Iniciando agrupación');
  console.log('[groupDataForListero] 📊 Datos recibidos:', rawData?.length || 0, 'registros');
  
  try {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      console.log('[groupDataForListero] ⚠️ Sin datos para agrupar');
      return [];
    }

    // Agrupar directamente por colector (el Listero solo ve su listero)
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
    console.log('[groupDataForListero] ✅ Agrupación exitosa:', result.length, 'colectores');
    return result;
  } catch (error) {
    console.error('[groupDataForListero] ❌ Error en agrupación:', error);
    console.log('[groupDataForListero] 🔄 Retornando datos sin agrupar');
    // Si falla la agrupación, devolver los datos raw
    return rawData || [];
  }
};

const CACHE_DAYS = 30; // Cachear últimos 30 días

export const useListeroStatistics = (options = {}) => {
  const { enabled = true } = options;
  
  // 🔍 DEBUG: Log de inicialización del hook
  console.log('🔍 [useListeroStatistics] Hook inicializado con enabled:', enabled);
  
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
    console.log('🔍 [useListeroStatistics] useEffect disparado - enabled:', enabled);
    
    const initializeData = async () => {
      if (!enabled) {
        console.log('🔍 [useListeroStatistics] Hook DESHABILITADO, saliendo...');
        setUserId(null);
        return;
      }
      
      console.log('🔍 [useListeroStatistics] Hook HABILITADO, continuando...');
      
      if (loadingRef.current) {
        console.log('🔍 [useListeroStatistics] Ya está cargando, saliendo...');
        return;
      }
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        console.log('🔍 [useListeroStatistics] Usuario obtenido:', user?.id ? 'SÍ' : 'NO');
        
        if (user) {
          setUserId(user.id);
          console.log('🔍 [useListeroStatistics] userId seteado a:', user.id);
          
          // 🎯 FIX: Cargar solo HOY en la primera carga
          const today = new Date();
          const startDate = new Date(today);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(today);
          endDate.setHours(23, 59, 59, 999);
          
          console.log('🐛 [DEBUG Listero] 🚀 Inicialización - Cargando SOLO HOY:', startDate.toLocaleDateString());
                    
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
    console.log('[useListeroStatistics] 🔍 loadFromSupabase iniciado');
    console.log('[useListeroStatistics] 📋 Parámetros:', {
      userId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    
    try {
      // 🎯 FIX: Usar toISOString() para compatibilidad con formato ISO
      const startStr = startDate.toISOString();
      const endStr = endDate.toISOString();

      let allPlaysData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        console.log(`[useListeroStatistics] 📡 Consultando Supabase - Página ${page + 1}`);
        
        const { data: playsData, error } = await supabase
          .from('v_estadisticas')
          .select('*')
          .eq('id_listero', userId)
          .gte('fecha_jugada', startStr)
          .lte('fecha_jugada', endStr)
          .order('fecha_jugada', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.error('[useListeroStatistics] ❌ Error de Supabase:', error);
          throw error;
        }
        
        console.log(`[useListeroStatistics] ✅ Página ${page + 1}: ${playsData?.length || 0} registros`);
        
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
    
    // 🎯 FIX: Cancelar cargas anteriores incrementando el token
    loadTokenRef.current += 1;
    const currentToken = loadTokenRef.current;
    console.log('[useListeroStatistics] 🎫 Nueva carga - Token:', currentToken);
    
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
        console.log('[useListeroStatistics] ⚠️ No hay fechas, usando HOY por defecto');
      }

      console.log(`[useListeroStatistics] 🔄 Cargando: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
      console.log(`[useListeroStatistics] forceRefresh: ${forceRefresh}`);

      // ========================================
      // ESTRATEGIA CACHE-FIRST SIMPLIFICADA
      // ========================================
      
      if (forceRefresh) {
        // PULL-TO-REFRESH: Cargar desde Supabase y actualizar caché
        console.log('[useListeroStatistics] 🔄 Pull-to-refresh - Consultando Supabase');
        
        const freshPlays = await loadFromSupabase(effectiveUserId, startDate, endDate);
        console.log(`[useListeroStatistics] ✅ Supabase devolvió: ${freshPlays.length} registros`);
        
        // Reemplazar caché con datos frescos para este rango
        await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'listero', freshPlays, startDate, endDate);
        console.log(`[useListeroStatistics] 💾 Caché actualizado`);
        
        // Verificar token antes de setear datos
        if (currentToken !== loadTokenRef.current) {
          console.log('[useListeroStatistics] ❌ Carga cancelada (token mismatch)');
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
        
        console.log('[useListeroStatistics] 🔄 Agrupando datos...');
        const groupedData = groupDataForListero(freshPlays);
        console.log('[useListeroStatistics] 📊 Datos agrupados:', groupedData?.length || 0);
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
        console.log('[useListeroStatistics] 📦 Carga normal - Solo caché');
        
        let cachedPlays = [];
        try {
          cachedPlays = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'listero', {});
          console.log(`[useListeroStatistics] 📦 Caché: ${cachedPlays.length} registros`);
        } catch (cacheError) {
          console.error('[useListeroStatistics] ⚠️ Error leyendo caché:', cacheError);
          cachedPlays = [];
        }
        
        // 🎯 FIX: Si caché está vacío, forzar carga desde Supabase
        if (cachedPlays.length === 0) {
          console.log('[useListeroStatistics] ⚠️ Caché vacío, forzando carga desde Supabase...');
          
          const freshPlays = await loadFromSupabase(effectiveUserId, startDate, endDate);
          console.log(`[useListeroStatistics] ✅ Supabase devolvió: ${freshPlays.length} registros`);
          
          // Intentar guardar en caché (puede fallar en web, pero intentamos)
          try {
            await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'listero', freshPlays, startDate, endDate);
          } catch (cacheError) {
            console.log('[useListeroStatistics] ⚠️ No se pudo guardar en caché (probablemente en web)');
          }
          
          // Verificar token
          if (currentToken !== loadTokenRef.current) {
            console.log('[useListeroStatistics] ❌ Carga cancelada (token mismatch)');
            setIsLoading(false);
            loadingRef.current = false;
            return;
          }
          
          const groupedData = groupDataForListero(freshPlays);
          setTableData({ plays: groupedData });
          
          setDebugInfo({
            source: 'SUPABASE (caché vacío - fallback)',
            totalBeforeFilter: freshPlays.length,
            totalAfterFilter: freshPlays.length,
            cacheOldestDate: 'N/A',
            rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
          });
          
          // Limpiar y salir
          try {
            await SQLiteCache.cleanOldRecords(effectiveUserId, 'listero');
          } catch (cacheError) {
            // Error silencioso
          }
          
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
        
        // Filtrar por rango de fechas solicitado
        const filteredPlays = cachedPlays.filter(p => {
          const playDate = new Date(p.fecha_jugada);
          return playDate >= startDate && playDate <= endDate;
        });
        
        console.log(`[useListeroStatistics] 📊 Filtrados: ${filteredPlays.length}/${cachedPlays.length}`);
        
        // Encontrar fecha más antigua en caché
        const oldestCached = cachedPlays.length > 0
          ? new Date(Math.min(...cachedPlays.map(p => new Date(p.fecha_jugada).getTime())))
          : null;
        
        // Verificar token antes de setear datos
        if (currentToken !== loadTokenRef.current) {
          console.log('[useListeroStatistics] ❌ Carga cancelada (token mismatch)');
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
        
        console.log('[useListeroStatistics] 🔄 Agrupando datos desde caché...');
        const groupedData = groupDataForListero(filteredPlays);
        console.log('[useListeroStatistics] 📊 Datos agrupados:', groupedData?.length || 0);
        setTableData({ plays: groupedData });
        
        setDebugInfo({
          source: 'CACHE',
          totalBeforeFilter: cachedPlays.length,
          totalAfterFilter: filteredPlays.length,
          cacheOldestDate: oldestCached?.toLocaleDateString() || 'Sin datos',
          rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        });
      }

      // Limpiar registros muy antiguos (>60 días)
      try {
        await SQLiteCache.cleanOldRecords(effectiveUserId, 'listero');
      } catch (cacheError) {
        // Error silencioso
      }

    } catch (error) {
      console.error('[useListeroStatistics] ❌ Error en loadPlaysData:', error);
      console.error('[useListeroStatistics] 📋 Detalles del error:', {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      
      // Verificar token antes de limpiar datos
      if (currentToken !== loadTokenRef.current) {
        console.log('[useListeroStatistics] ❌ Error handler cancelado (token mismatch)');
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
          await SQLiteCache.savePlaysToCache(userId, 'listero', todayPlays);
          await SQLiteCache.updateIncrementalTimestamp(userId, 'listero');
        } catch (cacheError) {
          console.error('[useListeroStatistics] ⚠️ Error in incremental update cache save:', cacheError);
          return;
        }
        
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
            
            const groupedData = groupDataForListero(cachedPlays);
            setTableData({ plays: groupedData });
          } catch (cacheError) {
            // Error silencioso
          }
        }
      }

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
    
    console.log('[useListeroStatistics] Calling loadPlaysData with final range:', finalStartDate, 'to', finalEndDate, 'forceRefresh:', forceRefresh);

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

export default useListeroStatistics;
