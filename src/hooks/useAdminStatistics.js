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

  // Detectar userId (se ejecuta cuando enabled cambia)
  useEffect(() => {
    const detectUserId = async () => {
      if (!enabled) {
        setUserId(null); // Limpiar userId si se deshabilita
        return;
      }
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (error) {
        console.error('[useAdminStatistics] Error detecting userId:', error);
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
          .eq('id_banco', userId)
          .gte('fecha_jugada', startStr)
          .lte('fecha_jugada', endStr)
          .order('fecha_jugada', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.error('[useAdminStatistics] Error loading from Supabase:', error);
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
      console.error('[useAdminStatistics] Exception in loadFromSupabase:', error);
      throw error;
    }
  };

  /**
   * Cargar datos con estrategia de caché inteligente
   */
  const loadPlaysData = async (filters = {}) => {
    if (!userId || !enabled) return;
    if (loadingRef.current) return;

    loadingRef.current = true;
    setIsLoading(true);

    try {
      const {
        startDate = dateRange.startDate,
        endDate = dateRange.endDate,
        forceRefresh = false
      } = filters;

      // 1. Intentar leer del caché SQLite primero
      const cachedPlays = await SQLiteCache.readPlaysFromCache(userId, 'admin', {
        startDate,
        endDate
      });

      if (cachedPlays.length > 0 && !forceRefresh) {
        console.log(`[useAdminStatistics] Loaded ${cachedPlays.length} plays from cache`);
        setTableData({ plays: cachedPlays });

        // Verificar si necesita actualización incremental
        const needsUpdate = await SQLiteCache.needsIncrementalUpdate(userId, 'admin');
        
        if (needsUpdate) {
          console.log('[useAdminStatistics] Starting incremental update...');
          updateTodayInBackground(userId);
        }

        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      // 2. No hay caché o forceRefresh: cargar desde Supabase
      console.log('[useAdminStatistics] Loading from Supabase...');
      
      const cacheStart = new Date();
      cacheStart.setDate(cacheStart.getDate() - (CACHE_DAYS - 1));
      cacheStart.setHours(0, 0, 0, 0);
      
      const cacheEnd = new Date();
      cacheEnd.setHours(23, 59, 59, 999);

      const playsData = await loadFromSupabase(userId, cacheStart, cacheEnd);

      // 3. Guardar en caché SQLite
      if (playsData.length > 0) {
        await SQLiteCache.savePlaysToCache(userId, 'admin', playsData);
        await SQLiteCache.updateIncrementalTimestamp(userId, 'admin');
      }

      // 4. Filtrar por el rango solicitado
      const filteredPlays = playsData.filter(play => {
        const playDate = new Date(play.fecha_jugada);
        return playDate >= startDate && playDate <= endDate;
      });

      setTableData({ plays: filteredPlays });

      // 5. Limpiar registros antiguos
      await SQLiteCache.cleanOldRecords(userId, 'admin');

    } catch (error) {
      console.error('[useAdminStatistics] Error loading plays:', error);
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
        await SQLiteCache.savePlaysToCache(userId, 'admin', todayPlays);
        await SQLiteCache.updateIncrementalTimestamp(userId, 'admin');
        
        const { startDate, endDate } = dateRange;
        const isViewingToday = 
          startDate.getDate() === today.getDate() &&
          startDate.getMonth() === today.getMonth() &&
          startDate.getFullYear() === today.getFullYear();

        if (isViewingToday) {
          const cachedPlays = await SQLiteCache.readPlaysFromCache(userId, 'admin', {
            startDate,
            endDate
          });
          setTableData({ plays: cachedPlays });
        }

        console.log(`[useAdminStatistics] Incremental update completed: ${todayPlays.length} plays`);
      }

      await SQLiteCache.cleanOldRecords(userId, 'admin');
    } catch (error) {
      console.error('[useAdminStatistics] Error in incremental update:', error);
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

  // Cargar datos cuando userId está disponible
  useEffect(() => {
    if (userId && enabled) {
      loadPlaysData();
    }
  }, [userId, enabled]);

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
