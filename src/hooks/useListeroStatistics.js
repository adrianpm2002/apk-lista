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

export const useListeroStatistics = (options = {}) => {
  const { enabled = true } = options;
  
  // Estados básicos
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [tableData, setTableData] = useState({
    plays: []
  });
  
  // 🐛 DEBUG: Metadata temporal para debugging
  const [debugInfo, setDebugInfo] = useState({
    source: '', // 'CACHE' | 'SUPABASE'
    totalBeforeFilter: 0,
    totalAfterFilter: 0,
    cacheOldestDate: null,
    rangeRequested: ''
  });
  
  // Estado para el rango de fechas (hoy por defecto)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setHours(23, 59, 59, 999))
  });
  
  // Estado para trackear el período actual (para pull-to-refresh inteligente)
  const [currentPeriodType, setCurrentPeriodType] = useState('today');
  
  // Ref para evitar múltiples cargas simultáneas
  const loadingRef = useRef(false);
  
  // 🎯 FIX: Token de cancelación para race conditions
  const loadTokenRef = useRef(0);

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
          
          // 🎯 FIX: Cargar solo HOY en la primera carga, no 30 días
          const today = new Date();
          const startDate = new Date(today);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(today);
          endDate.setHours(23, 59, 59, 999);
          
          debugLog('🐛 [DEBUG LISTERO] 🚀 Inicialización - Cargando SOLO HOY:', startDate.toLocaleDateString());
          
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
   * Cargar datos desde vistas optimizadas (HOY o AYER)
   * Estas vistas ya vienen filtradas por fecha, no necesitan .gte() ni .lte()
   */
  const loadFromView = async (userId, viewName) => {
    try {
      debugLog(`🐛 [DEBUG LISTERO] 📊 Consultando vista: ${viewName}`);

      let allPlaysData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: playsData, error } = await supabase
          .from(viewName)
          .select('*')
          .eq('id_listero', userId)
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

      debugLog(`🐛 [DEBUG LISTERO] ✅ Vista ${viewName} devolvió: ${allPlaysData.length} registros`);
      return allPlaysData || [];
    } catch (error) {
      console.error(`[DEBUG LISTERO] ❌ Error consultando vista ${viewName}:`, error);
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
    
    // 🎯 FIX: Cancelar cargas anteriores incrementando el token
    loadTokenRef.current += 1;
    const currentToken = loadTokenRef.current;
    debugLog('🐛 [DEBUG LISTERO] 🎫 Nueva carga iniciada - Token:', currentToken);
    
    // No usar loadingRef para bloquear, permitir cancelar cargas anteriores
    loadingRef.current = true;
    setIsLoading(true);

    try {
      // 🎯 Extraer parámetros
      let {
        startDate = null,
        endDate = null,
        forceRefresh = false,
        periodType = 'custom' // 'today', 'yesterday', 'last7days', 'last30days', 'custom'
      } = filters;
      
      // Si no hay startDate/endDate, usar "hoy" recién calculado
      if (!startDate || !endDate) {
        const now = new Date();
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        periodType = 'today';
        debugLog('🐛 [DEBUG LISTERO] ⚠️ No hay fechas en filters, usando HOY recién calculado');
      }
      
      debugLog('🐛 [DEBUG LISTERO] 📅 Período:', periodType);
      debugLog('🐛 [DEBUG LISTERO] 📅 Fechas - start:', startDate.toISOString(), 'end:', endDate.toISOString());
      debugLog('🐛 [DEBUG LISTERO] 🔄 forceRefresh:', forceRefresh);

      // 🎯 NUEVA LÓGICA: Detectar tipo de período automáticamente si no viene
      if (periodType === 'custom') {
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

      debugLog('🐛 [DEBUG LISTERO] 🎯 Tipo de período detectado:', periodType);

      // === ESTRATEGIA 1: HOY - Siempre consultar v_estadisticas_hoy ===
      if (periodType === 'today') {
        debugLog('🐛 [DEBUG LISTERO] 📊 ESTRATEGIA HOY - Consultando v_estadisticas_hoy');
        
        const todayPlays = await loadFromView(effectiveUserId, 'v_estadisticas_hoy');
        
        // Reemplazar HOY en caché
        await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'listero', todayPlays, startDate, endDate);
        
        setDebugInfo({
          source: 'v_estadisticas_hoy',
          totalBeforeFilter: todayPlays.length,
          totalAfterFilter: todayPlays.length,
          cacheOldestDate: 'N/A',
          rangeRequested: startDate.toLocaleDateString()
        });
        
        setTableData({ plays: todayPlays });
        setCurrentPeriodType('today'); // Trackear para pull-to-refresh
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // === ESTRATEGIA 2: AYER - Siempre consultar v_estadisticas_ayer ===
      if (periodType === 'yesterday') {
        debugLog('🐛 [DEBUG LISTERO] � ESTRATEGIA AYER - Consultando v_estadisticas_ayer');
        
        const yesterdayPlays = await loadFromView(effectiveUserId, 'v_estadisticas_ayer');
        
        // Reemplazar AYER en caché
        await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'listero', yesterdayPlays, startDate, endDate);
        
        setDebugInfo({
          source: 'v_estadisticas_ayer',
          totalBeforeFilter: yesterdayPlays.length,
          totalAfterFilter: yesterdayPlays.length,
          cacheOldestDate: 'N/A',
          rangeRequested: startDate.toLocaleDateString()
        });
        
        setTableData({ plays: yesterdayPlays });
        setCurrentPeriodType('yesterday'); // Trackear para pull-to-refresh
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // === ESTRATEGIA 3: 7 DÍAS / 30 DÍAS / PERSONALIZADO ===
      debugLog('🐛 [DEBUG LISTERO] � ESTRATEGIA CACHÉ - Período:', periodType);
      
      // Leer caché
      let cachedPlays = [];
      try {
        cachedPlays = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'listero', {});
        debugLog('🐛 [DEBUG LISTERO] 📦 Caché leído:', cachedPlays.length, 'registros');
      } catch (cacheError) {
        debugLog('🐛 [DEBUG LISTERO] ❌ Error leyendo caché:', cacheError);
        cachedPlays = [];
      }

      // Calcular fecha más antigua en caché
      const oldestCached = cachedPlays.length > 0 
        ? new Date(Math.min(...cachedPlays.map(p => new Date(p.fecha_jugada).getTime())))
        : null;

      // Detectar si necesita consultar Supabase
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const maxCacheAge = new Date();
      maxCacheAge.setDate(maxCacheAge.getDate() - 60); // 60 días atrás
      maxCacheAge.setHours(0, 0, 0, 0);
      
      // 🎯 FIX: Verificar si HOY/AYER están FRESCOS en caché
      const todayInCache = cachedPlays.some(p => {
        const pDate = new Date(p.fecha_jugada);
        return pDate.getDate() === today.getDate() && 
               pDate.getMonth() === today.getMonth() && 
               pDate.getFullYear() === today.getFullYear();
      });
      
      const yesterdayInCache = cachedPlays.some(p => {
        const pDate = new Date(p.fecha_jugada);
        return pDate.getDate() === yesterday.getDate() && 
               pDate.getMonth() === yesterday.getMonth() && 
               pDate.getFullYear() === yesterday.getFullYear();
      });
      
      // Solo considerar "incluye hoy/ayer" como motivo para ir a Supabase si NO están en caché
      const includesHoyOrAyer = (endDate >= today && !todayInCache) || 
                                (endDate >= yesterday && endDate < today && !yesterdayInCache);
      
      const includesVeryOldDates = startDate < maxCacheAge;
      const cacheIsEmpty = cachedPlays.length === 0;
      const cacheMissingRange = !oldestCached || oldestCached > startDate;

      debugLog('🐛 [DEBUG LISTERO] 🔍 Evaluación:');
      debugLog('🐛 [DEBUG LISTERO]    - HOY en caché:', todayInCache);
      debugLog('🐛 [DEBUG LISTERO]    - AYER en caché:', yesterdayInCache);
      debugLog('🐛 [DEBUG LISTERO]    - Incluye HOY/AYER (necesita actualizar):', includesHoyOrAyer);
      debugLog('🐛 [DEBUG LISTERO]    - Incluye fechas >60 días:', includesVeryOldDates);
      debugLog('🐛 [DEBUG LISTERO]    - Caché vacío:', cacheIsEmpty);
      debugLog('🐛 [DEBUG LISTERO]    - Caché falta rango:', cacheMissingRange);
      debugLog('🐛 [DEBUG LISTERO]    - forceRefresh:', forceRefresh);

      // Decidir si consultar Supabase
      const needsSupabase = forceRefresh || cacheIsEmpty || cacheMissingRange || 
                           includesHoyOrAyer || includesVeryOldDates;

      if (!needsSupabase) {
        // Usar SOLO caché
        debugLog('🐛 [DEBUG LISTERO] ✅ Usando SOLO CACHÉ');
        
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
        
        setTableData({ plays: filteredCachedPlays });
        setCurrentPeriodType(periodType); // Trackear para pull-to-refresh
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // Necesita consultar Supabase
      debugLog('🐛 [DEBUG LISTERO] 🌐 Consultando SUPABASE...');
      
      // Determinar qué rango consultar
      let queryStart, queryEnd;
      
      if (forceRefresh || includesHoyOrAyer) {
        // Pull-to-refresh o incluye HOY/AYER: consultar el rango exacto solicitado
        queryStart = startDate;
        queryEnd = endDate;
        debugLog('🐛 [DEBUG LISTERO]    📌 Motivo: pull-to-refresh o incluye HOY/AYER');
      } else if (cacheIsEmpty) {
        // Primera vez: cargar últimos 60 días
        queryStart = new Date();
        queryStart.setDate(queryStart.getDate() - 59);
        queryStart.setHours(0, 0, 0, 0);
        queryEnd = new Date();
        queryEnd.setHours(23, 59, 59, 999);
        debugLog('🐛 [DEBUG LISTERO]    📌 Motivo: Primera carga (60 días)');
      } else {
        // Caché incompleto: consultar desde la fecha solicitada más antigua
        queryStart = startDate;
        queryEnd = new Date();
        queryEnd.setHours(23, 59, 59, 999);
        debugLog('🐛 [DEBUG LISTERO]    📌 Motivo: Completar caché');
      }

      debugLog('🐛 [DEBUG LISTERO] 📅 Consultando desde:', queryStart.toLocaleDateString(), 'hasta:', queryEnd.toLocaleDateString());
      
      const playsData = await loadFromSupabase(effectiveUserId, queryStart, queryEnd);
      debugLog('🐛 [DEBUG LISTERO] ✅ Supabase devolvió:', playsData.length, 'registros');

      // Reemplazar el rango en caché
      if (forceRefresh) {
        // Pull-to-refresh: reemplazar solo el rango solicitado
        await SQLiteCache.replacePlaysByDateRange(effectiveUserId, 'listero', playsData, queryStart, queryEnd);
        debugLog('🐛 [DEBUG LISTERO] 💾 Reemplazados en caché:', playsData.length, 'registros');
      } else {
        // Primera carga o completar: guardar normalmente
        if (playsData.length > 0) {
          await SQLiteCache.savePlaysToCache(effectiveUserId, 'listero', playsData);
          await SQLiteCache.updateIncrementalTimestamp(effectiveUserId, 'listero');
          debugLog('🐛 [DEBUG LISTERO] 💾 Guardados en caché:', playsData.length, 'registros');
        }
      }

      // Filtrar por el rango solicitado
      const filteredPlays = playsData.filter(play => {
        const playDate = new Date(play.fecha_jugada);
        return playDate >= startDate && playDate <= endDate;
      });
      
      debugLog('🐛 [DEBUG LISTERO] � Después de filtrar:', filteredPlays.length, '/', playsData.length);
      
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
      
      setTableData({ plays: filteredPlays });
      setCurrentPeriodType(periodType); // Trackear para pull-to-refresh

      // Limpiar registros muy antiguos (>60 días)
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
      forceRefresh = false,
      periodType = 'custom' // Aceptar el tipo de período
    } = filters;

    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
    
    await loadPlaysData({
      startDate: startDate || dateRange.startDate,
      endDate: endDate || dateRange.endDate,
      forceRefresh,
      periodType // Pasar el tipo de período
    });
  };  /**
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
    debugInfo // 🐛 DEBUG: Metadata temporal
  };
};

export default useListeroStatistics;
