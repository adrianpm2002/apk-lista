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
          
          debugLog('🐛 [DEBUG COLLECTOR] 🚀 Inicialización - Cargando SOLO HOY:', startDate.toLocaleDateString());
          
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
   * Cargar datos con estrategia de caché inteligente
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
      // 🎯 FIX: Recalcular fechas "hoy" si no vienen en filters para evitar fechas obsoletas
      let {
        startDate = null,
        endDate = null,
        forceRefresh = false
      } = filters;
      
      // Si no hay startDate/endDate, usar "hoy" recién calculado
      if (!startDate || !endDate) {
        const now = new Date();
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        debugLog('🐛 [DEBUG COLLECTOR] ⚠️ No hay fechas en filters, usando HOY recién calculado');
      }
      
      debugLog('🐛 [DEBUG COLLECTOR] 📅 Fechas finales - start:', startDate.toISOString(), 'end:', endDate.toISOString());
      debugLog('🐛 [DEBUG COLLECTOR] 🔄 forceRefresh:', forceRefresh ? 'SÍ (saltará caché)' : 'NO (intentará caché primero)');

      // 1. Intentar leer del caché SQLite primero
      debugLog('🐛 [DEBUG COLLECTOR] 🔍 PASO 1: Intentando leer desde CACHÉ SQLite...');
      let cachedPlays = [];
      try {
        // Leer TODO el caché disponible (sin filtro de fechas aún)
        cachedPlays = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'collector', {});
        debugLog('🐛 [DEBUG COLLECTOR] 📦 Caché leído:', cachedPlays.length, 'registros');
      } catch (cacheError) {
        debugLog('🐛 [DEBUG COLLECTOR] ❌ Error leyendo caché:', cacheError.message);
        cachedPlays = [];
      }

      debugLog('🐛 [DEBUG COLLECTOR] 🔍 PASO 2: Evaluando si usar caché o consultar Supabase...');
      debugLog('🐛 [DEBUG COLLECTOR]    - Caché tiene:', cachedPlays.length, 'registros');
      debugLog('🐛 [DEBUG COLLECTOR]    - forceRefresh:', forceRefresh);

      // 2. Si hay datos en caché, verificar si cubren el rango solicitado
      if (cachedPlays.length > 0 && !forceRefresh) {
        debugLog('🐛 [DEBUG COLLECTOR]    ✅ Condición 1 cumplida: Caché NO está vacío');
        debugLog('🐛 [DEBUG COLLECTOR]    ✅ Condición 2 cumplida: NO es forceRefresh');
        debugLog('🐛 [DEBUG COLLECTOR] 🔍 PASO 3: Filtrando caché por rango de fechas...');

        // Filtrar por el rango solicitado
        const filteredCachedPlays = cachedPlays.filter(play => {
          const playDate = new Date(play.fecha_jugada);
          return playDate >= startDate && playDate <= endDate;
        });
        
        debugLog('🐛 [DEBUG COLLECTOR]    📊 Después del filtro:', filteredCachedPlays.length, 'registros');
        debugLog('🐛 [DEBUG COLLECTOR] 🔍 PASO 4: Verificando cobertura del caché...');
        
        // Verificar si el caché cubre el rango completo
        const oldestCached = cachedPlays.length > 0 
          ? new Date(Math.min(...cachedPlays.map(p => new Date(p.fecha_jugada).getTime())))
          : null;
        
        const cacheCoversRange = oldestCached && oldestCached <= startDate;
        
        debugLog('🐛 [DEBUG COLLECTOR]    📆 Fecha más antigua en caché:', oldestCached?.toLocaleDateString('es-CU'));
        debugLog('🐛 [DEBUG COLLECTOR]    📆 Fecha inicio solicitada:', startDate.toLocaleDateString('es-CU'));
        debugLog('🐛 [DEBUG COLLECTOR]    ❓ ¿Caché cubre rango completo?', cacheCoversRange ? '✅ SÍ' : '❌ NO');
        
        // 🎯 FIX: Confiar en cobertura de caché incluso si está vacío
        // Si el caché cubre el rango, significa que consultamos Supabase antes
        // y NO había datos en ese rango. No consultar de nuevo innecesariamente.
        if (cacheCoversRange) {
          // Agrupar datos del cache FILTRADOS
          const groupedCachedData = groupDataForCollector(filteredCachedPlays);
          
          debugLog('🐛 [DEBUG COLLECTOR] ✅ DECISIÓN: Usando CACHÉ -', filteredCachedPlays.length, 'jugadas filtradas →', groupedCachedData.length, 'listeros agrupados');
          debugLog('🐛 [DEBUG COLLECTOR] ⏭️ Saltando consulta a Supabase');
          
          // Actualizar debugInfo
          setDebugInfo({
            source: 'CACHE',
            totalBeforeFilter: cachedPlays.length,
            totalAfterFilter: filteredCachedPlays.length,
            cacheOldestDate: oldestCached ? oldestCached.toLocaleDateString() : 'N/A',
            rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
          });
          
          setTableData({ plays: groupedCachedData });

          // Verificar si necesita actualización incremental
          let needsUpdate = false;
          try {
            needsUpdate = await SQLiteCache.needsIncrementalUpdate(effectiveUserId, 'collector');
          } catch (cacheError) {
            // Error silencioso
          }
          
          if (needsUpdate) {
            updateTodayInBackground(effectiveUserId);
          }

          setIsLoading(false);
          loadingRef.current = false;
          return;
        } else {
          debugLog('🐛 [DEBUG COLLECTOR] ❌ DECISIÓN: Caché NO cubre rango completo');
          debugLog('🐛 [DEBUG COLLECTOR]    ❌ Razón: cacheCoversRange =', cacheCoversRange);
          debugLog('🐛 [DEBUG COLLECTOR] 🌐 Continuando a consulta de Supabase...');
        }
      } else {
        // Caché vacío o forceRefresh
        if (cachedPlays.length === 0) {
          debugLog('🐛 [DEBUG COLLECTOR]    ❌ Condición 1 NO cumplida: Caché está VACÍO');
        }
        if (forceRefresh) {
          debugLog('🐛 [DEBUG COLLECTOR]    ❌ Condición 2 NO cumplida: ES forceRefresh (pull-to-refresh)');
        }
        debugLog('🐛 [DEBUG COLLECTOR] 🌐 Saltando caché, irá directo a Supabase');
      }

      // 3. No hay caché suficiente o forceRefresh: cargar desde Supabase
      debugLog('🐛 [DEBUG COLLECTOR] 🔍 PASO 5: Consultando SUPABASE...');
      if (forceRefresh) {
        debugLog('🐛 [DEBUG COLLECTOR]    📌 Motivo: forceRefresh=true (pull-to-refresh)');
      } else if (cachedPlays.length === 0) {
        debugLog('🐛 [DEBUG COLLECTOR]    📌 Motivo: Caché vacío');
      } else {
        debugLog('🐛 [DEBUG COLLECTOR]    📌 Motivo: Caché no cubre rango solicitado');
      }
      
      // 🎯 Consultar últimos 30 días para cachear, pero mostrar solo el rango solicitado
      const cacheStart = new Date();
      cacheStart.setDate(cacheStart.getDate() - 29); // 30 días incluyendo hoy
      cacheStart.setHours(0, 0, 0, 0);
      
      const cacheEnd = new Date();
      cacheEnd.setHours(23, 59, 59, 999);
      
      debugLog('🐛 [DEBUG COLLECTOR] Consultando Supabase desde:', cacheStart.toLocaleDateString(), 'hasta:', cacheEnd.toLocaleDateString());
      
      const playsData = await loadFromSupabase(effectiveUserId, cacheStart, cacheEnd);
      
      debugLog('🐛 [DEBUG COLLECTOR] Supabase devolvió:', playsData.length, 'registros');

      // 4. Guardar TODO en caché SQLite (últimos 30 días)
      if (playsData.length > 0) {
        debugLog('🐛 [DEBUG COLLECTOR] 💾 Guardando', playsData.length, 'registros en caché SQLite...');
        debugLog('🐛 [DEBUG COLLECTOR] 💾 Rango a guardar: desde', playsData[playsData.length - 1]?.fecha_jugada, 'hasta', playsData[0]?.fecha_jugada);
        
        try {
          await SQLiteCache.savePlaysToCache(effectiveUserId, 'collector', playsData);
          await SQLiteCache.updateIncrementalTimestamp(effectiveUserId, 'collector');
          debugLog('🐛 [DEBUG COLLECTOR] 💾 Guardado resultado: ✅ Éxito');
          debugLog('🐛 [DEBUG COLLECTOR] 💾 Timestamp incremental actualizado');
          
          // 🎯 VERIFICACIÓN: Leer inmediatamente para confirmar guardado
          try {
            const verification = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'collector', {});
            debugLog('🐛 [DEBUG COLLECTOR] ✅ VERIFICACIÓN: Cache ahora tiene', verification.length, 'registros');
            if (verification.length !== playsData.length) {
              debugLog('🐛 [DEBUG COLLECTOR] ⚠️ DISCREPANCIA: Guardados', playsData.length, 'pero cache tiene', verification.length);
            }
          } catch (verifyError) {
            debugLog('🐛 [DEBUG COLLECTOR] ⚠️ No se pudo verificar guardado:', verifyError.message);
          }
        } catch (cacheError) {
          debugLog('🐛 [DEBUG COLLECTOR] ❌ Error guardando en caché:', cacheError.message, cacheError.stack);
        }
      }

      // 5. Filtrar por el rango solicitado y agrupar

      // 5. Filtrar por el rango solicitado y agrupar
      debugLog('🐛 [DEBUG COLLECTOR] 🎯 FILTRO - startDate:', startDate.toISOString());
      debugLog('🐛 [DEBUG COLLECTOR] 🎯 FILTRO - endDate:', endDate.toISOString());
      debugLog('🐛 [DEBUG COLLECTOR] 🎯 FILTRO - Aplicando a', playsData.length, 'registros...');
      
      const filteredPlays = playsData.filter((play, index) => {
        const playDate = new Date(play.fecha_jugada);
        const isInRange = playDate >= startDate && playDate <= endDate;
        
        // Log detallado de las primeras 5 jugadas
        if (index < 5) {
          console.log(`🐛 [DEBUG COLLECTOR] Jugada ${index}: ${play.fecha_jugada} → ${isInRange ? '✅ PASA' : '❌ NO PASA'}`);
        }
        
        return isInRange;
      });
      
      debugLog('🐛 [DEBUG COLLECTOR] Después del filtro:', filteredPlays.length, '/', playsData.length, 'jugadas para mostrar');
      
      // 🐛 DEBUG: Calcular fecha más antigua de los datos cargados
      const oldestPlay = playsData.length > 0
        ? new Date(Math.min(...playsData.map(p => new Date(p.fecha_jugada).getTime())))
        : null;
      
      debugLog('🐛 [DEBUG COLLECTOR] Fecha más antigua en datos de Supabase:', oldestPlay?.toLocaleDateString());
      
      // Actualizar debugInfo
      setDebugInfo({
        source: 'SUPABASE',
        totalBeforeFilter: playsData.length,
        totalAfterFilter: filteredPlays.length,
        cacheOldestDate: oldestPlay ? oldestPlay.toLocaleDateString() : 'Sin datos',
        rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      });
      
      const groupedData = groupDataForCollector(filteredPlays);
      debugLog('🐛 [DEBUG COLLECTOR] 🔍 Después de agrupar:', groupedData.length, 'listeros');
      if (groupedData.length > 0) {
        const totalJugadas = groupedData.reduce((sum, listero) => sum + (listero.plays?.length || 0), 0);
        debugLog('🐛 [DEBUG COLLECTOR] 🔍 Total de jugadas en grupos:', totalJugadas);
        debugLog('🐛 [DEBUG COLLECTOR] 🔍 Primer listero:', groupedData[0].listero_name, 'con', groupedData[0].plays?.length, 'jugadas');
      }
      setTableData({ plays: groupedData });

      // 6. Limpiar registros antiguos
      try {
        await SQLiteCache.cleanOldRecords(effectiveUserId, 'collector');
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
      forceRefresh = false
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
    dateRange,
    debugInfo
  };
};

export default useCollectorStatistics;
