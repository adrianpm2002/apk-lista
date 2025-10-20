import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import * as SQLiteCache from '../utils/sqliteCache';

// 🎯 FIX: Usar toISOString() consistente con SQLiteCache
// No necesitamos helper local, usaremos date.toISOString() directamente

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
          balance_listero: 0,
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
        listero.balance_listero = listero.plays.reduce((sum, play) => sum + (Number(play.balance_listero) || 0), 0);
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

const CACHE_DAYS = 30; // Cachear últimos 30 días

export const useAdminStatistics = (options = {}) => {
  const { enabled = true } = options;
  
  // 🔍 DEBUG: Log de inicialización del hook
  console.log('🔍 [useAdminStatistics] Hook inicializado con enabled:', enabled);
  
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
  
  // Estado para trackear el período actual (para pull-to-refresh inteligente)
  const [currentPeriodType, setCurrentPeriodType] = useState('today');
  
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

  // Detectar userId y auto-cargar datos (se ejecuta cuando enabled cambia)
  useEffect(() => {
    console.log('🔍 [useAdminStatistics] useEffect disparado - enabled:', enabled);
    
    const initializeData = async () => {
      if (!enabled) {
        console.log('🔍 [useAdminStatistics] Hook DESHABILITADO, saliendo...');
        setUserId(null);
        return;
      }
      
      console.log('🔍 [useAdminStatistics] Hook HABILITADO, continuando...');
      
      if (loadingRef.current) {
        console.log('🔍 [useAdminStatistics] Ya está cargando, saliendo...');
        return;
      }
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        console.log('🔍 [useAdminStatistics] Usuario obtenido:', user?.id ? 'SÍ' : 'NO');
        
        if (user) {
          setUserId(user.id);
          console.log('🔍 [useAdminStatistics] userId seteado a:', user.id);
          
          // 🎯 FIX: Cargar solo HOY en la primera carga, no 30 días
          const today = new Date();
          const startDate = new Date(today);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(today);
          endDate.setHours(23, 59, 59, 999);
          
          console.log('🐛 [DEBUG ADMIN] 🚀 Inicialización - Cargando SOLO HOY:', startDate.toLocaleDateString());
                    
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
   * Estas views ya están pre-filtradas por fecha, no necesitan filtro adicional
   */
  const loadFromView = async (userId, viewName) => {
    try {
      let allPlays = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      debugLog('🐛 [DEBUG ADMIN] 📊 Cargando desde view:', viewName);

      while (hasMore) {
        const { data, error } = await supabase
          .from(viewName)
          .select('*')
          .order('fecha_jugada', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allPlays = allPlays.concat(data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }

        // Límite de seguridad
        if (page > 250) break;
      }

      debugLog('🐛 [DEBUG ADMIN] ✅ View cargada:', allPlays.length, 'registros');
      return allPlays || [];
    } catch (error) {
      debugLog('🐛 [DEBUG ADMIN] ❌ Error cargando view:', error);
      return [];
    }
  };

  /**
   * Cargar datos con estrategia optimizada de 3 niveles
   */
  const loadPlaysData = async (filters = {}, userIdOverride = null) => {
    const effectiveUserId = userIdOverride || userId;
    
    if (!effectiveUserId || !enabled) {
      return;
    }
    
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);

    try {
      // Recalcular fechas "hoy" si no vienen en filters
      let {
        startDate = null,
        endDate = null,
        forceRefresh = false,
        periodType = 'custom'
      } = filters;
      
      // Si no hay startDate/endDate, usar "hoy" recién calculado
      if (!startDate || !endDate) {
        const now = new Date();
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        console.log('🐛 [DEBUG ADMIN] ⚠️ No hay fechas en filters, usando HOY recién calculado');
      }

      // Auto-detectar tipo de período si no viene especificado
      if (periodType === 'custom' && startDate && endDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Detectar si es HOY
        if (startDate.getTime() === today.getTime() && 
            endDate.getDate() === today.getDate() &&
            endDate.getMonth() === today.getMonth() &&
            endDate.getFullYear() === today.getFullYear()) {
          periodType = 'today';
        }
        // Detectar si es AYER
        else if (startDate.getTime() === yesterday.getTime() &&
                 endDate.getDate() === yesterday.getDate() &&
                 endDate.getMonth() === yesterday.getMonth() &&
                 endDate.getFullYear() === yesterday.getFullYear()) {
          periodType = 'yesterday';
        }
      }

      console.log('🐛 [DEBUG ADMIN] 🎯 Tipo de período detectado:', periodType);

      // === ESTRATEGIA 1: HOY - Siempre consultar v_estadisticas_hoy ===
      if (periodType === 'today') {
        console.log('🐛 [DEBUG ADMIN] � ESTRATEGIA HOY - Consultando v_estadisticas_hoy');
        
        const todayPlays = await loadFromView(effectiveUserId, 'v_estadisticas_hoy');
        
        // Reemplazar HOY en caché
        await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'admin', todayPlays, startDate, endDate);
        
        setDebugInfo({
          source: 'v_estadisticas_hoy',
          totalBeforeFilter: todayPlays.length,
          totalAfterFilter: todayPlays.length,
          cacheOldestDate: 'N/A',
          rangeRequested: startDate.toLocaleDateString()
        });
        
        const groupedData = groupDataForAdmin(todayPlays);
        setTableData({ plays: groupedData });
        setCurrentPeriodType('today'); // Trackear para pull-to-refresh
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // === ESTRATEGIA 2: AYER - Siempre consultar v_estadisticas_ayer ===
      if (periodType === 'yesterday') {
        console.log('🐛 [DEBUG ADMIN] � ESTRATEGIA AYER - Consultando v_estadisticas_ayer');
        
        const yesterdayPlays = await loadFromView(effectiveUserId, 'v_estadisticas_ayer');
        
        // Reemplazar AYER en caché
        await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'admin', yesterdayPlays, startDate, endDate);
        
        setDebugInfo({
          source: 'v_estadisticas_ayer',
          totalBeforeFilter: yesterdayPlays.length,
          totalAfterFilter: yesterdayPlays.length,
          cacheOldestDate: 'N/A',
          rangeRequested: startDate.toLocaleDateString()
        });
        
        const groupedData = groupDataForAdmin(yesterdayPlays);
        setTableData({ plays: groupedData });
        setCurrentPeriodType('yesterday'); // Trackear para pull-to-refresh
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // === ESTRATEGIA 3: 7 DÍAS / 30 DÍAS / PERSONALIZADO ===
      console.log('🐛 [DEBUG ADMIN] 💾 ESTRATEGIA CACHÉ - Período:', periodType);
      
      // Leer caché
      let cachedPlays = [];
      try {
        cachedPlays = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'admin', {});
        console.log('🐛 [DEBUG ADMIN] 📦 Caché leído:', cachedPlays.length, 'registros');
      } catch (cacheError) {
        console.log('🐛 [DEBUG ADMIN] ❌ Error leyendo caché:', cacheError.message);
      }

      // Encontrar fecha más antigua en caché
      const oldestCached = cachedPlays.length > 0
        ? new Date(Math.min(...cachedPlays.map(p => new Date(p.fecha_jugada).getTime())))
        : null;

      console.log('🐛 [DEBUG ADMIN] 📅 Fecha más antigua en caché:', oldestCached?.toLocaleDateString() || 'N/A');

      // Evaluar condiciones para decidir si consultar Supabase
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const includesHoyOrAyer = startDate < today && endDate >= today || 
                                startDate < yesterday && endDate >= yesterday && endDate < today;
      
      const maxCacheAge = new Date();
      maxCacheAge.setDate(maxCacheAge.getDate() - 60);
      maxCacheAge.setHours(0, 0, 0, 0);
      const includesVeryOldDates = startDate < maxCacheAge;
      const cacheIsEmpty = cachedPlays.length === 0;
      const cacheMissingRange = !oldestCached || oldestCached > startDate;

      console.log('🐛 [DEBUG ADMIN] 🔍 Evaluación:');
      console.log('🐛 [DEBUG ADMIN]    - Incluye HOY/AYER:', includesHoyOrAyer);
      console.log('🐛 [DEBUG ADMIN]    - Incluye fechas >60 días:', includesVeryOldDates);
      console.log('🐛 [DEBUG ADMIN]    - Caché vacío:', cacheIsEmpty);
      console.log('🐛 [DEBUG ADMIN]    - Caché falta rango:', cacheMissingRange);
      console.log('🐛 [DEBUG ADMIN]    - forceRefresh:', forceRefresh);

      // Decidir si consultar Supabase
      const needsSupabase = forceRefresh || cacheIsEmpty || cacheMissingRange || 
                           includesHoyOrAyer || includesVeryOldDates;

      if (!needsSupabase) {
        // Usar SOLO caché
        console.log('🐛 [DEBUG ADMIN] ✅ Usando SOLO CACHÉ');
        
        const filteredCachedPlays = cachedPlays.filter(play => {
          const playDate = new Date(play.fecha_jugada);
          return playDate >= startDate && playDate <= endDate;
        });
        
        setDebugInfo({
          source: 'CACHE',
          totalBeforeFilter: cachedPlays.length,
          totalAfterFilter: filteredCachedPlays.length,
          cacheOldestDate: oldestCached?.toLocaleDateString() || 'N/A',
          rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        });
        
        const groupedData = groupDataForAdmin(filteredCachedPlays);
        setTableData({ plays: groupedData });
        setCurrentPeriodType(periodType); // Trackear para pull-to-refresh
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // Necesita consultar Supabase
      console.log('🐛 [DEBUG ADMIN] 🌐 Consultando SUPABASE...');
      
      // Determinar qué rango consultar
      let queryStart, queryEnd;
      
      if (forceRefresh || includesHoyOrAyer) {
        // Pull-to-refresh o incluye HOY/AYER: consultar el rango exacto solicitado
        queryStart = startDate;
        queryEnd = endDate;
        console.log('🐛 [DEBUG ADMIN]    📌 Motivo: pull-to-refresh o incluye HOY/AYER');
      } else if (cacheIsEmpty) {
        // Primera vez: cargar últimos 60 días
        queryStart = new Date();
        queryStart.setDate(queryStart.getDate() - 59);
        queryStart.setHours(0, 0, 0, 0);
        queryEnd = new Date();
        queryEnd.setHours(23, 59, 59, 999);
        console.log('🐛 [DEBUG ADMIN]    📌 Motivo: Primera carga (60 días)');
      } else {
        // Caché incompleto: consultar desde la fecha solicitada más antigua
        queryStart = startDate;
        queryEnd = new Date();
        queryEnd.setHours(23, 59, 59, 999);
        console.log('🐛 [DEBUG ADMIN]    📌 Motivo: Completar caché');
      }

      console.log('🐛 [DEBUG ADMIN] 📅 Consultando desde:', queryStart.toLocaleDateString(), 'hasta:', queryEnd.toLocaleDateString());
      
      const playsData = await loadFromSupabase(effectiveUserId, queryStart, queryEnd);
      console.log('🐛 [DEBUG ADMIN] ✅ Supabase devolvió:', playsData.length, 'registros');

      // Reemplazar el rango en caché
      if (forceRefresh) {
        // Pull-to-refresh: reemplazar solo el rango solicitado
        await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'admin', playsData, queryStart, queryEnd);
        console.log('🐛 [DEBUG ADMIN] 💾 Reemplazados en caché:', playsData.length, 'registros');
      } else {
        // Primera carga o completar: guardar normalmente
        if (playsData.length > 0) {
          await SQLiteCache.savePlaysToCache(effectiveUserId, 'admin', playsData);
          await SQLiteCache.updateIncrementalTimestamp(effectiveUserId, 'admin');
          console.log('🐛 [DEBUG ADMIN] 💾 Guardados en caché:', playsData.length, 'registros');
        }
      }

      // Filtrar por el rango solicitado
      const filteredPlays = playsData.filter(play => {
        const playDate = new Date(play.fecha_jugada);
        return playDate >= startDate && playDate <= endDate;
      });
      
      console.log('🐛 [DEBUG ADMIN] 🎯 Después de filtrar:', filteredPlays.length, '/', playsData.length);
      
      const oldestPlay = playsData.length > 0
        ? new Date(Math.min(...playsData.map(p => new Date(p.fecha_jugada).getTime())))
        : null;
      
      setDebugInfo({
        source: 'SUPABASE',
        totalBeforeFilter: playsData.length,
        totalAfterFilter: filteredPlays.length,
        cacheOldestDate: oldestPlay ? oldestPlay.toLocaleDateString() : 'Sin datos',
        rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      });
      
      const groupedData = groupDataForAdmin(filteredPlays);
      setTableData({ plays: groupedData });
      setCurrentPeriodType(periodType); // Trackear para pull-to-refresh

      // Limpiar registros muy antiguos (>60 días)
      try {
        await SQLiteCache.cleanOldRecords(effectiveUserId, 'admin');
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
    
    console.log('[useAdminStatistics] Calling loadPlaysData with final range:', finalStartDate, 'to', finalEndDate, 'forceRefresh:', forceRefresh);

    await loadPlaysData({
      startDate: finalStartDate,
      endDate: finalEndDate,
      forceRefresh,
      periodType // Pasar el tipo de período
    });
  };

  /**
   * Refrescar datos (pull-to-refresh)
   */
  const refresh = async () => {
    await loadPlaysData({ 
      ...dateRange, 
      forceRefresh: true,
      periodType: currentPeriodType // Usar el tipo de período actual
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
