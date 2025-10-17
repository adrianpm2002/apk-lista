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

export const useListeroStatistics = (options = {}) => {
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

  // Detectar userId (se ejecuta cuando enabled cambia)
  useEffect(() => {
    const detectUserId = async () => {
      console.log('[useListeroStatistics] detectUserId effect - enabled:', enabled);
      
      if (!enabled) {
        setUserId(null); // Limpiar userId si se deshabilita
        return;
      }
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[useListeroStatistics] User detected:', user?.id);
        if (user) {
          setUserId(user.id);
        }
      } catch (error) {
        console.error('[useListeroStatistics] Error detecting userId:', error);
      }
    };

    detectUserId();
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
          .eq('id_listero', userId)
          .gte('fecha_jugada', startStr)
          .lte('fecha_jugada', endStr)
          .order('fecha_jugada', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.error('[useListeroStatistics] Error loading from Supabase:', error);
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
      console.error('[useListeroStatistics] Exception in loadFromSupabase:', error);
      throw error;
    }
  };

  /**
   * Cargar datos con estrategia de caché inteligente
   */
  const loadPlaysData = async (filters = {}) => {
    console.log('[useListeroStatistics] loadPlaysData called with filters:', filters);
    console.log('[useListeroStatistics] Current state - userId:', userId, 'enabled:', enabled);
    
    if (!userId || !enabled) {
      console.log('[useListeroStatistics] Skipping load - missing userId or not enabled');
      return;
    }
    
    if (loadingRef.current) {
      console.log('[useListeroStatistics] Skipping load - already loading');
      return; // Evitar cargas simultáneas
    }

    loadingRef.current = true;
    setIsLoading(true);
    console.log('[useListeroStatistics] Starting data load...');

    try {
      const {
        startDate = dateRange.startDate,
        endDate = dateRange.endDate,
        forceRefresh = false
      } = filters;

      // 1. Intentar leer del caché SQLite primero
      const cachedPlays = await SQLiteCache.readPlaysFromCache(userId, 'listero', {
        startDate,
        endDate
      });

      console.log('[useListeroStatistics] Cache read result:', cachedPlays.length, 'plays');

      if (cachedPlays.length > 0 && !forceRefresh) {
        // Tenemos datos en caché
        console.log(`[useListeroStatistics] ✅ Using cached data: ${cachedPlays.length} plays`);
        setTableData({ plays: cachedPlays });

        // Verificar si necesita actualización incremental (solo HOY)
        const needsUpdate = await SQLiteCache.needsIncrementalUpdate(userId, 'listero');
        console.log('[useListeroStatistics] Needs incremental update:', needsUpdate);
        
        if (needsUpdate) {
          // Actualización incremental en background (solo hoy)
          console.log('[useListeroStatistics] 🔄 Starting incremental update in background...');
          updateTodayInBackground(userId);
        }

        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // 2. No hay caché o forceRefresh: cargar desde Supabase
      console.log('[useListeroStatistics] 📡 No cache or forceRefresh - loading from Supabase...');
      console.log('[useListeroStatistics] Date range: last 30 days');
      
      // Cargar últimos 30 días
      const cacheStart = new Date();
      cacheStart.setDate(cacheStart.getDate() - (CACHE_DAYS - 1));
      cacheStart.setHours(0, 0, 0, 0);
      
      const cacheEnd = new Date();
      cacheEnd.setHours(23, 59, 59, 999);

      const playsData = await loadFromSupabase(userId, cacheStart, cacheEnd);

      console.log('[useListeroStatistics] 📥 Loaded from Supabase:', playsData.length, 'plays');

      // 3. Guardar en caché SQLite
      if (playsData.length > 0) {
        console.log('[useListeroStatistics] 💾 Saving to SQLite cache...');
        await SQLiteCache.savePlaysToCache(userId, 'listero', playsData);
        await SQLiteCache.updateIncrementalTimestamp(userId, 'listero');
        console.log('[useListeroStatistics] ✅ Saved to cache');
      } else {
        console.log('[useListeroStatistics] ⚠️ No data from Supabase');
      }

      // 4. Filtrar por el rango solicitado
      const filteredPlays = playsData.filter(play => {
        const playDate = new Date(play.fecha_jugada);
        return playDate >= startDate && playDate <= endDate;
      });

      console.log('[useListeroStatistics] 🎯 Filtered for requested range:', filteredPlays.length, 'plays');
      console.log('[useListeroStatistics] Requested range:', startDate, 'to', endDate);

      setTableData({ plays: filteredPlays });

      // 5. Limpiar registros antiguos
      await SQLiteCache.cleanOldRecords(userId, 'listero');

    } catch (error) {
      console.error('[useListeroStatistics] ❌ Error loading plays:', error);
      console.error('[useListeroStatistics] Error details:', error.message, error.stack);
      setTableData({ plays: [] });
    } finally {
      console.log('[useListeroStatistics] ✅ Load complete - setting loading=false');
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
        await SQLiteCache.savePlaysToCache(userId, 'listero', todayPlays);
        await SQLiteCache.updateIncrementalTimestamp(userId, 'listero');
        
        // Refrescar datos si está viendo hoy
        const { startDate, endDate } = dateRange;
        const isViewingToday = 
          startDate.getDate() === today.getDate() &&
          startDate.getMonth() === today.getMonth() &&
          startDate.getFullYear() === today.getFullYear();

        if (isViewingToday) {
          const cachedPlays = await SQLiteCache.readPlaysFromCache(userId, 'listero', {
            startDate,
            endDate
          });
          setTableData({ plays: cachedPlays });
        }

        console.log(`[useListeroStatistics] Incremental update completed: ${todayPlays.length} plays`);
      }

      // Limpiar registros antiguos
      await SQLiteCache.cleanOldRecords(userId, 'listero');
    } catch (error) {
      console.error('[useListeroStatistics] Error in incremental update:', error);
    }
  };

  /**
   * Aplicar filtros (cambia el rango de fechas y recarga)
   */
  const applyFilters = async (filters = {}) => {
    console.log('[useListeroStatistics] 🔍 applyFilters called with:', filters);
    
    const {
      startDate,
      endDate,
      forceRefresh = false
    } = filters;

    if (startDate && endDate) {
      console.log('[useListeroStatistics] Setting new date range:', startDate, 'to', endDate);
      setDateRange({ startDate, endDate });
    }

    console.log('[useListeroStatistics] Calling loadPlaysData...');
    await loadPlaysData({
      startDate: startDate || dateRange.startDate,
      endDate: endDate || dateRange.endDate,
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
    dateRange
  };
};

export default useListeroStatistics;
