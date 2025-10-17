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

/**
 * Agrupar datos para vista de colector
 * Los datos vienen planos de v_estadisticas, necesitamos agruparlos por listero
 */
const groupDataForCollector = (rawData) => {
  try {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      console.log('[groupDataForCollector] No data to group');
      return [];
    }

    console.log('[groupDataForCollector] Grouping', rawData.length, 'records');

    // Agrupar por listero
    const listeroGroups = {};
    
    rawData.forEach(record => {
      if (!record) {
        console.warn('[groupDataForCollector] Null record found, skipping');
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
    console.log('[groupDataForCollector] Grouped into', result.length, 'listeros');
    return result;
  } catch (error) {
    console.error('[groupDataForCollector] ERROR:', error);
    console.error('[groupDataForCollector] Stack:', error.stack);
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

  // Detectar userId y auto-cargar datos (se ejecuta cuando enabled cambia)
  useEffect(() => {
    const initializeData = async () => {
      console.log('[useCollectorStatistics] Initialize effect - enabled:', enabled);
      
      if (!enabled) {
        console.log('[useCollectorStatistics] Hook disabled - clearing userId');
        setUserId(null);
        return;
      }
      
      if (loadingRef.current) {
        console.log('[useCollectorStatistics] Already loading, skipping...');
        return;
      }
      
      try {
        console.log('[useCollectorStatistics] Getting user from Supabase...');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          console.log('[useCollectorStatistics] ✅ User detected:', user.id);
          setUserId(user.id);
          
          // Auto-cargar datos inmediatamente después de detectar userId
          console.log('[useCollectorStatistics] 🚀 Auto-loading data for userId:', user.id);
          
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);
          
          // Pasar userId explícitamente porque setUserId es asíncrono
          loadPlaysData({ 
            startDate, 
            endDate, 
            forceRefresh: false 
          }, user.id);
        } else {
          console.log('[useCollectorStatistics] ⚠️ No user found');
        }
      } catch (error) {
        console.error('[useCollectorStatistics] ❌ Error getting user:', error);
      }
    };

    initializeData();
  }, [enabled]);

  /**
   * Cargar datos desde Supabase
   */
  const loadFromSupabase = async (userId, startDate, endDate) => {
    try {
      console.log('[useCollectorStatistics] loadFromSupabase CALLED');
      console.log('[useCollectorStatistics] Query params - userId:', userId);
      console.log('[useCollectorStatistics] Query params - startDate:', startDate);
      console.log('[useCollectorStatistics] Query params - endDate:', endDate);
      
      const startStr = formatDateForQuery(startDate);
      const endStr = formatDateForQuery(endDate);
      
      console.log('[useCollectorStatistics] Formatted dates - start:', startStr, 'end:', endStr);

      let allPlaysData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        console.log('[useCollectorStatistics] 🔍 Fetching page', page, 'from Supabase...');
        console.log('[useCollectorStatistics] Query: v_estadisticas WHERE id_colector =', userId);
        
        const { data: playsData, error } = await supabase
          .from('v_estadisticas')
          .select('*')
          .eq('id_colector', userId)
          .gte('fecha_jugada', startStr)
          .lte('fecha_jugada', endStr)
          .order('fecha_jugada', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        console.log('[useCollectorStatistics] 📊 Page', page, 'result - data:', playsData?.length || 0, 'error:', error);

        if (error) {
          console.error('[useCollectorStatistics] ❌ Supabase error:', error);
          console.error('[useCollectorStatistics] Error message:', error.message);
          console.error('[useCollectorStatistics] Error details:', error.details);
          console.error('[useCollectorStatistics] Error hint:', error.hint);
          throw error;
        }
        
        if (playsData && playsData.length > 0) {
          console.log('[useCollectorStatistics] ✅ Page', page, 'has', playsData.length, 'records');
          allPlaysData = allPlaysData.concat(playsData);
          hasMore = playsData.length === pageSize;
          page++;
        } else {
          console.log('[useCollectorStatistics] ⚠️ Page', page, 'is empty - stopping pagination');
          hasMore = false;
        }
        
        // Límite de seguridad
        if (page > 250) {
          console.log('[useCollectorStatistics] ⚠️ Safety limit reached at page 250');
          break;
        }
      }

      console.log('[useCollectorStatistics] 🎉 Total loaded from Supabase:', allPlaysData.length, 'plays');
      return allPlaysData || [];
    } catch (error) {
      console.error('[useCollectorStatistics] ❌ Exception in loadFromSupabase:', error);
      console.error('[useCollectorStatistics] Exception message:', error.message);
      console.error('[useCollectorStatistics] Exception stack:', error.stack);
      throw error;
    }
  };

  /**
   * Cargar datos con estrategia de caché inteligente
   */
  const loadPlaysData = async (filters = {}, userIdOverride = null) => {
    const effectiveUserId = userIdOverride || userId;
    
    console.log('[useCollectorStatistics] 🚀 loadPlaysData CALLED with filters:', filters);
    console.log('[useCollectorStatistics] Current state - userId:', effectiveUserId, 'enabled:', enabled, 'loading:', loadingRef.current);
    
    if (!effectiveUserId || !enabled) {
      console.log('[useCollectorStatistics] ⚠️ Skipping load - userId or enabled is false');
      return;
    }
    
    if (loadingRef.current) {
      console.log('[useCollectorStatistics] ⚠️ Already loading - skipping');
      return;
    }

    console.log('[useCollectorStatistics] Setting loading state...');
    loadingRef.current = true;
    setIsLoading(true);

    try {
      const {
        startDate = dateRange.startDate,
        endDate = dateRange.endDate,
        forceRefresh = false
      } = filters;

      console.log('[useCollectorStatistics] Final dates - start:', startDate, 'end:', endDate, 'forceRefresh:', forceRefresh);

      // 1. Intentar leer del caché SQLite primero
      let cachedPlays = [];
      try {
        cachedPlays = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'collector', {
          startDate,
          endDate
        });
        console.log('[useCollectorStatistics] Cache read result:', cachedPlays.length, 'plays');
      } catch (cacheError) {
        console.error('[useCollectorStatistics] ⚠️ Error reading from cache:', cacheError);
        console.log('[useCollectorStatistics] Continuing without cache...');
        cachedPlays = [];
      }

      if (cachedPlays.length > 0 && !forceRefresh) {
        console.log(`[useCollectorStatistics] ✅ Using cached data: ${cachedPlays.length} plays`);
        
        // Agrupar datos del cache
        console.log('[useCollectorStatistics] 🔄 Grouping cached data by listero...');
        const groupedCachedData = groupDataForCollector(cachedPlays);
        console.log('[useCollectorStatistics] 📦 Grouped cached data into', groupedCachedData.length, 'listeros');
        
        setTableData({ plays: groupedCachedData });

        // Verificar si necesita actualización incremental
        let needsUpdate = false;
        try {
          needsUpdate = await SQLiteCache.needsIncrementalUpdate(effectiveUserId, 'collector');
          console.log('[useCollectorStatistics] Needs incremental update:', needsUpdate);
        } catch (cacheError) {
          console.error('[useCollectorStatistics] ⚠️ Error checking incremental update:', cacheError);
        }
        
        if (needsUpdate) {
          console.log('[useCollectorStatistics] 🔄 Starting incremental update in background...');
          updateTodayInBackground(effectiveUserId);
        }

        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // 2. No hay caché o forceRefresh: cargar desde Supabase
      console.log('[useCollectorStatistics] 📡 No cache or forceRefresh - loading from Supabase...');
      console.log('[useCollectorStatistics] Date range: last 30 days');
      
      const cacheStart = new Date();
      cacheStart.setDate(cacheStart.getDate() - (CACHE_DAYS - 1));
      cacheStart.setHours(0, 0, 0, 0);
      
      const cacheEnd = new Date();
      cacheEnd.setHours(23, 59, 59, 999);

      console.log('[useCollectorStatistics] Calling loadFromSupabase with range:', cacheStart, 'to', cacheEnd);
      const playsData = await loadFromSupabase(effectiveUserId, cacheStart, cacheEnd);

      console.log('[useCollectorStatistics] 📥 Loaded from Supabase:', playsData.length, 'plays');

      // 3. Guardar en caché SQLite
      if (playsData.length > 0) {
        try {
          console.log('[useCollectorStatistics] 💾 Saving to SQLite cache...');
          await SQLiteCache.savePlaysToCache(effectiveUserId, 'collector', playsData);
          await SQLiteCache.updateIncrementalTimestamp(effectiveUserId, 'collector');
          console.log('[useCollectorStatistics] ✅ Saved to cache');
        } catch (cacheError) {
          console.error('[useCollectorStatistics] ⚠️ Error saving to cache:', cacheError);
          console.log('[useCollectorStatistics] Continuing without cache...');
        }
      } else {
        console.log('[useCollectorStatistics] ⚠️ No data from Supabase');
      }

      // 4. Filtrar por el rango solicitado
      console.log('[useCollectorStatistics] 🎯 Filtering plays for date range:', startDate, 'to', endDate);
      const filteredPlays = playsData.filter(play => {
        const playDate = new Date(play.fecha_jugada);
        return playDate >= startDate && playDate <= endDate;
      });

      console.log('[useCollectorStatistics] 🎯 Filtered result:', filteredPlays.length, 'plays for requested range');
      
      // 5. Agrupar por listero para compatibilidad con UI
      console.log('[useCollectorStatistics] 🔄 Grouping data by listero...');
      const groupedData = groupDataForCollector(filteredPlays);
      console.log('[useCollectorStatistics] 📦 Grouped into', groupedData.length, 'listeros');
      
      setTableData({ plays: groupedData });

      // 6. Limpiar registros antiguos
      try {
        console.log('[useCollectorStatistics] 🧹 Cleaning old records...');
        await SQLiteCache.cleanOldRecords(effectiveUserId, 'collector');
        console.log('[useCollectorStatistics] ✅ Cleaned old records');
      } catch (cacheError) {
        console.error('[useCollectorStatistics] ⚠️ Error cleaning old records:', cacheError);
      }

    } catch (error) {
      console.error('[useCollectorStatistics] ❌ Error loading plays:', error);
      console.error('[useCollectorStatistics] Error details:', error.message);
      console.error('[useCollectorStatistics] Stack:', error.stack);
      setTableData({ plays: [] });
    } finally {
      console.log('[useCollectorStatistics] ✅ Load complete - setting loading=false');
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
          console.error('[useCollectorStatistics] ⚠️ Error in incremental update cache save:', cacheError);
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
            
            // Agrupar datos del cache
            console.log('[useCollectorStatistics] 🔄 Grouping updated cached data by listero...');
            const groupedCachedData = groupDataForCollector(cachedPlays);
            console.log('[useCollectorStatistics] 📦 Grouped updated data into', groupedCachedData.length, 'listeros');
            
            setTableData({ plays: groupedCachedData });
          } catch (cacheError) {
            console.error('[useCollectorStatistics] ⚠️ Error reading cache in incremental update:', cacheError);
          }
        }

        console.log(`[useCollectorStatistics] Incremental update completed: ${todayPlays.length} plays`);
      }

      try {
        await SQLiteCache.cleanOldRecords(userId, 'collector');
      } catch (cacheError) {
        console.error('[useCollectorStatistics] ⚠️ Error cleaning in incremental update:', cacheError);
      }
    } catch (error) {
      console.error('[useCollectorStatistics] Error in incremental update:', error);
    }
  };

  /**
   * Aplicar filtros
   */
  const applyFilters = async (filters = {}) => {
    console.log('[useCollectorStatistics] 🔧 applyFilters CALLED with:', filters);
    
    const {
      startDate,
      endDate,
      forceRefresh = false
    } = filters;

    if (startDate && endDate) {
      console.log('[useCollectorStatistics] Setting date range:', startDate, 'to', endDate);
      setDateRange({ startDate, endDate });
    }

    const finalStartDate = startDate || dateRange.startDate;
    const finalEndDate = endDate || dateRange.endDate;
    
    console.log('[useCollectorStatistics] Calling loadPlaysData with final range:', finalStartDate, 'to', finalEndDate, 'forceRefresh:', forceRefresh);

    await loadPlaysData({
      startDate: finalStartDate,
      endDate: finalEndDate,
      forceRefresh
    });
    
    console.log('[useCollectorStatistics] ✅ applyFilters completed');
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

export default useCollectorStatistics;
