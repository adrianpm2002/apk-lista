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
      const {
        startDate = dateRange.startDate,
        endDate = dateRange.endDate,
        forceRefresh = false
      } = filters;

      // 1. Intentar leer del caché SQLite primero
      let cachedPlays = [];
      try {
        // Leer TODO el caché disponible (sin filtro de fechas aún)
        cachedPlays = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'admin', {});
        console.log('🐛 [DEBUG ADMIN] Caché leído:', cachedPlays.length, 'registros');
      } catch (cacheError) {
        console.log('🐛 [DEBUG ADMIN] Error leyendo caché:', cacheError.message);
        cachedPlays = [];
      }

      // 2. Si hay datos en caché, verificar si cubren el rango solicitado
      if (cachedPlays.length > 0 && !forceRefresh) {
        // Filtrar por el rango solicitado
        const filteredCachedPlays = cachedPlays.filter(play => {
          const playDate = new Date(play.fecha_jugada);
          return playDate >= startDate && playDate <= endDate;
        });
        
        console.log('🐛 [DEBUG ADMIN] Después del filtro:', filteredCachedPlays.length, 'registros');
        
        // Verificar si el caché cubre el rango completo
        const oldestCached = cachedPlays.length > 0 
          ? new Date(Math.min(...cachedPlays.map(p => new Date(p.fecha_jugada).getTime())))
          : null;
        
        const cacheCoversRange = oldestCached && oldestCached <= startDate;
        
        console.log('🐛 [DEBUG ADMIN] ¿Caché cubre rango?', cacheCoversRange, '- Oldest:', oldestCached?.toLocaleDateString());
        
        // 🎯 FIX CRÍTICO: SOLO usar caché si cubre el rango COMPLETO
        // No usar caché parcial aunque tenga algunos datos
        if (cacheCoversRange && filteredCachedPlays.length >= 0) {
          // Agrupar datos FILTRADOS antes de setear
          const groupedData = groupDataForAdmin(filteredCachedPlays);
          
          console.log('🐛 [DEBUG ADMIN] ✅ Usando CACHÉ -', filteredCachedPlays.length, 'jugadas filtradas →', groupedData.length, 'colectores agrupados');
          
          // Actualizar debugInfo
          setDebugInfo({
            source: 'CACHE',
            totalBeforeFilter: cachedPlays.length,
            totalAfterFilter: filteredCachedPlays.length,
            cacheOldestDate: oldestCached ? oldestCached.toLocaleDateString() : 'N/A',
            rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
          });
          
          setTableData({ plays: groupedData });

          // Verificar si necesita actualización incremental
          let needsUpdate = false;
          try {
            needsUpdate = await SQLiteCache.needsIncrementalUpdate(effectiveUserId, 'admin');
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
      }

      // 3. No hay caché suficiente o forceRefresh: cargar desde Supabase
      console.log('🐛 [DEBUG ADMIN] ⚠️ Caché insuficiente, consultando SUPABASE...');
      
      // 🎯 Consultar últimos 30 días para cachear, pero mostrar solo el rango solicitado
      const cacheStart = new Date();
      cacheStart.setDate(cacheStart.getDate() - 29); // 30 días incluyendo hoy
      cacheStart.setHours(0, 0, 0, 0);
      
      const cacheEnd = new Date();
      cacheEnd.setHours(23, 59, 59, 999);
      
      console.log('🐛 [DEBUG ADMIN] Consultando Supabase desde:', cacheStart.toLocaleDateString(), 'hasta:', cacheEnd.toLocaleDateString());
      
      const playsData = await loadFromSupabase(effectiveUserId, cacheStart, cacheEnd);
      
      console.log('🐛 [DEBUG ADMIN] Supabase devolvió:', playsData.length, 'registros');

      // 4. Guardar TODO en caché SQLite (últimos 30 días)
      if (playsData.length > 0) {
        try {
          console.log('🐛 [DEBUG ADMIN] Guardando', playsData.length, 'registros en caché...');
          await SQLiteCache.savePlaysToCache(effectiveUserId, 'admin', playsData);
          await SQLiteCache.updateIncrementalTimestamp(effectiveUserId, 'admin');
          console.log('🐛 [DEBUG ADMIN] Guardado resultado: ✅ Éxito');
        } catch (cacheError) {
          console.log('🐛 [DEBUG ADMIN] Guardado resultado: ❌ Error -', cacheError.message);
        }
      }

      // 5. Filtrar por el rango solicitado y agrupar
      const filteredPlays = playsData.filter(play => {
        const playDate = new Date(play.fecha_jugada);
        return playDate >= startDate && playDate <= endDate;
      });
      
      console.log('🐛 [DEBUG ADMIN] Después del filtro:', filteredPlays.length, 'jugadas para mostrar');
      
      // Actualizar debugInfo
      setDebugInfo({
        source: 'SUPABASE',
        totalBeforeFilter: playsData.length,
        totalAfterFilter: filteredPlays.length,
        cacheOldestDate: cacheStart.toLocaleDateString(),
        rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      });
      
      const groupedData = groupDataForAdmin(filteredPlays);
      setTableData({ plays: groupedData });

      // 6. Limpiar registros antiguos
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
      forceRefresh = false
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

export default useAdminStatistics;
