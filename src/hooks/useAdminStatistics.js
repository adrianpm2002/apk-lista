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
      console.log('[groupDataForAdmin] No data to group');
      return [];
    }

    console.log('[groupDataForAdmin] Grouping', rawData.length, 'records');

    // Agrupar directamente por colector (el admin solo ve su banco)
    const collectorGroups = {};
    
    rawData.forEach(record => {
      if (!record) {
        console.warn('[groupDataForAdmin] Null record found, skipping');
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
    console.log('[groupDataForAdmin] Grouped into', result.length, 'collectors');
    return result;
  } catch (error) {
    console.error('[groupDataForAdmin] ERROR:', error);
    console.error('[groupDataForAdmin] Stack:', error.stack);
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
  
  // Ref para evitar múltiples cargas simultáneas
  const loadingRef = useRef(false);

  // Detectar userId y auto-cargar datos (se ejecuta cuando enabled cambia)
  useEffect(() => {
    const initializeData = async () => {
      console.log('[useAdminStatistics] Initialize effect - enabled:', enabled);
      
      if (!enabled) {
        setUserId(null);
        return;
      }
      
      if (loadingRef.current) {
        console.log('[useAdminStatistics] Already loading, skipping...');
        return;
      }
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[useAdminStatistics] User detected:', user?.id);
        
        if (user) {
          setUserId(user.id);
          
          // Auto-cargar datos inmediatamente después de detectar userId
          console.log('[useAdminStatistics] 🚀 Auto-loading data for userId:', user.id);
          
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
        console.error('[useAdminStatistics] Error detecting userId:', error);
      }
    };

    initializeData();
  }, [enabled]);

  /**
   * Cargar datos desde Supabase
   */
  const loadFromSupabase = async (userId, startDate, endDate) => {
    try {
      console.log('[useAdminStatistics] loadFromSupabase CALLED');
      console.log('[useAdminStatistics] Query params - userId:', userId);
      console.log('[useAdminStatistics] Query params - startDate:', startDate);
      console.log('[useAdminStatistics] Query params - endDate:', endDate);
      
      const startStr = formatDateForQuery(startDate);
      const endStr = formatDateForQuery(endDate);
      
      console.log('[useAdminStatistics] Formatted dates - start:', startStr, 'end:', endStr);

      let allPlaysData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        console.log('[useAdminStatistics] 🔍 Fetching page', page, 'from Supabase...');
        console.log('[useAdminStatistics] Query: v_estadisticas WHERE id_banco =', userId);
        
        const { data: playsData, error } = await supabase
          .from('v_estadisticas')
          .select('*')
          .eq('id_banco', userId)
          .gte('fecha_jugada', startStr)
          .lte('fecha_jugada', endStr)
          .order('fecha_jugada', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        console.log('[useAdminStatistics] 📊 Page', page, 'result - data:', playsData?.length || 0, 'error:', error);

        if (error) {
          console.error('[useAdminStatistics] ❌ Supabase error:', error);
          console.error('[useAdminStatistics] Error message:', error.message);
          console.error('[useAdminStatistics] Error details:', error.details);
          console.error('[useAdminStatistics] Error hint:', error.hint);
          throw error;
        }
        
        if (playsData && playsData.length > 0) {
          console.log('[useAdminStatistics] ✅ Page', page, 'has', playsData.length, 'records');
          allPlaysData = allPlaysData.concat(playsData);
          hasMore = playsData.length === pageSize;
          page++;
        } else {
          console.log('[useAdminStatistics] ⚠️ Page', page, 'is empty - stopping pagination');
          hasMore = false;
        }
        
        // Límite de seguridad
        if (page > 250) {
          console.log('[useAdminStatistics] ⚠️ Safety limit reached at page 250');
          break;
        }
      }

      console.log('[useAdminStatistics] 🎉 Total loaded from Supabase:', allPlaysData.length, 'plays');
      return allPlaysData || [];
    } catch (error) {
      console.error('[useAdminStatistics] ❌ Exception in loadFromSupabase:', error);
      console.error('[useAdminStatistics] Exception message:', error.message);
      console.error('[useAdminStatistics] Exception stack:', error.stack);
      throw error;
    }
  };

  /**
   * Cargar datos con estrategia de caché inteligente
   */
  const loadPlaysData = async (filters = {}, userIdOverride = null) => {
    const effectiveUserId = userIdOverride || userId;
    
    console.log('[useAdminStatistics] loadPlaysData called with filters:', filters);
    console.log('[useAdminStatistics] Current state - userId:', effectiveUserId, 'enabled:', enabled);
    
    if (!effectiveUserId || !enabled) {
      console.log('[useAdminStatistics] Skipping load - missing userId or not enabled');
      return;
    }
    
    if (loadingRef.current) {
      console.log('[useAdminStatistics] Skipping load - already loading');
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    console.log('[useAdminStatistics] Starting data load...');

    try {
      const {
        startDate = dateRange.startDate,
        endDate = dateRange.endDate,
        forceRefresh = false
      } = filters;

      // 1. Intentar leer del caché SQLite primero
      let cachedPlays = [];
      try {
        cachedPlays = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'admin', {
          startDate,
          endDate
        });
        console.log('[useAdminStatistics] Cache read result:', cachedPlays.length, 'plays');
      } catch (cacheError) {
        console.error('[useAdminStatistics] ⚠️ Error reading from cache:', cacheError);
        console.log('[useAdminStatistics] Continuing without cache...');
        cachedPlays = [];
      }

      if (cachedPlays.length > 0 && !forceRefresh) {
        console.log(`[useAdminStatistics] ✅ Using cached data: ${cachedPlays.length} plays`);
        
        // Agrupar datos antes de setear
        const groupedData = groupDataForAdmin(cachedPlays);
        console.log('[useAdminStatistics] Grouped into', groupedData.length, 'collectors');
        setTableData({ plays: groupedData });

        // Verificar si necesita actualización incremental
        let needsUpdate = false;
        try {
          needsUpdate = await SQLiteCache.needsIncrementalUpdate(effectiveUserId, 'admin');
          console.log('[useAdminStatistics] Needs incremental update:', needsUpdate);
        } catch (cacheError) {
          console.error('[useAdminStatistics] ⚠️ Error checking incremental update:', cacheError);
        }
        
        if (needsUpdate) {
          console.log('[useAdminStatistics] 🔄 Starting incremental update in background...');
          updateTodayInBackground(effectiveUserId);
        }

        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // 2. No hay caché o forceRefresh: cargar desde Supabase
      console.log('[useAdminStatistics] 📡 No cache or forceRefresh - loading from Supabase...');
      console.log('[useAdminStatistics] Date range: last 30 days');
      
      const cacheStart = new Date();
      cacheStart.setDate(cacheStart.getDate() - (CACHE_DAYS - 1));
      cacheStart.setHours(0, 0, 0, 0);
      
      const cacheEnd = new Date();
      cacheEnd.setHours(23, 59, 59, 999);

      console.log('[useAdminStatistics] Calling loadFromSupabase with range:', cacheStart, 'to', cacheEnd);
      const playsData = await loadFromSupabase(effectiveUserId, cacheStart, cacheEnd);

      console.log('[useAdminStatistics] 📥 Loaded from Supabase:', playsData.length, 'plays');

      // 3. Guardar en caché SQLite
      if (playsData.length > 0) {
        try {
          console.log('[useAdminStatistics] 💾 Saving to SQLite cache...');
          await SQLiteCache.savePlaysToCache(effectiveUserId, 'admin', playsData);
          await SQLiteCache.updateIncrementalTimestamp(effectiveUserId, 'admin');
          console.log('[useAdminStatistics] ✅ Saved to cache');
        } catch (cacheError) {
          console.error('[useAdminStatistics] ⚠️ Error saving to cache:', cacheError);
          console.log('[useAdminStatistics] Continuing without cache...');
        }
      } else {
        console.log('[useAdminStatistics] ⚠️ No data from Supabase');
      }

      // 4. Filtrar por el rango solicitado
      console.log('[useAdminStatistics] 🎯 Filtering plays for date range:', startDate, 'to', endDate);
      const filteredPlays = playsData.filter(play => {
        const playDate = new Date(play.fecha_jugada);
        return playDate >= startDate && playDate <= endDate;
      });

      console.log('[useAdminStatistics] 🎯 Filtered result:', filteredPlays.length, 'plays for requested range');
      
      // Agrupar datos antes de setear
      const groupedData = groupDataForAdmin(filteredPlays);
      console.log('[useAdminStatistics] Grouped into', groupedData.length, 'collectors');
      setTableData({ plays: groupedData });

      // 5. Limpiar registros antiguos
      try {
        console.log('[useAdminStatistics] 🧹 Cleaning old records...');
        await SQLiteCache.cleanOldRecords(effectiveUserId, 'admin');
        console.log('[useAdminStatistics] ✅ Cleaned old records');
      } catch (cacheError) {
        console.error('[useAdminStatistics] ⚠️ Error cleaning old records:', cacheError);
      }
      console.log('[useAdminStatistics] ✅ Cleaned old records');

    } catch (error) {
      console.error('[useAdminStatistics] ❌ Error loading plays:', error);
      console.error('[useAdminStatistics] Error details:', error.message);
      console.error('[useAdminStatistics] Stack:', error.stack);
      setTableData({ plays: [] });
    } finally {
      console.log('[useAdminStatistics] ✅ Load complete - setting loading=false');
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
            
            // Agrupar datos antes de setear
            const groupedData = groupDataForAdmin(cachedPlays);
            console.log('[useAdminStatistics] Incremental update - Grouped into', groupedData.length, 'collectors');
            setTableData({ plays: groupedData });
          } catch (cacheError) {
            console.error('[useAdminStatistics] ⚠️ Error reading cache in incremental update:', cacheError);
          }
        }

        console.log(`[useAdminStatistics] Incremental update completed: ${todayPlays.length} plays`);
      }

      try {
        await SQLiteCache.cleanOldRecords(userId, 'admin');
      } catch (cacheError) {
        console.error('[useAdminStatistics] ⚠️ Error cleaning in incremental update:', cacheError);
      }
    } catch (error) {
      console.error('[useAdminStatistics] Error in incremental update:', error);
    }
  };

  /**
   * Aplicar filtros
   */
  const applyFilters = async (filters = {}) => {
    console.log('[useAdminStatistics] 🔧 applyFilters CALLED with:', filters);
    
    const {
      startDate,
      endDate,
      forceRefresh = false
    } = filters;

    if (startDate && endDate) {
      console.log('[useAdminStatistics] Setting date range:', startDate, 'to', endDate);
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
    
    console.log('[useAdminStatistics] ✅ applyFilters completed');
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
    dateRange
  };
};

export default useAdminStatistics;
