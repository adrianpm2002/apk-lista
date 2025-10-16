import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { saveToCache, readFromCache, filterByDateRange } from '../utils/statisticsCache';

// Threshold para background refresh (minutos)
const CACHE_REFRESH_THRESHOLD = 10; // minutos

// Detectar plataforma
const isExpoGo = Constants.appOwnership === 'expo';
const isMobile = !isExpoGo && (Platform.OS === 'android' || Platform.OS === 'ios');
const isWeb = Platform.OS === 'web' || isExpoGo;

// Helper para convertir fecha local a string para consultas de base de datos
const formatDateForQuery = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Función para obtener rango de hoy
const getTodayRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  return { start, end };
};

// Función para obtener rango de ayer
const getYesterdayRange = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
  const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
  return { start, end };
};

// Función para normalizar el período al nombre de caché
const normalizePeriodForCache = (period) => {
  // Mapear 'last7days' a 'recent' para consistencia con sistema de caché
  if (period === 'last7days') {
    return 'recent';
  }
  return period;
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
    startDate: new Date(new Date().setHours(0, 0, 0, 0)), // Hoy 00:00:00
    endDate: new Date(new Date().setHours(23, 59, 59, 999)) // Hoy 23:59:59
  });

  // Helper para calcular fecha de inicio del caché (últimos 30 días)
  const getCacheStartDate = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);
    return new Date(thirtyDaysAgo.getFullYear(), thirtyDaysAgo.getMonth(), thirtyDaysAgo.getDate(), 0, 0, 0, 0);
  };

  // Helper para verificar si un rango de fechas está dentro del caché (últimos 30 días)
  const isWithinCacheRange = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    
    const cacheStart = getCacheStartDate();
    const today = new Date();
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    
    return filterStart >= cacheStart && filterEnd <= todayEnd;
  };

  // Función específica para cargar datos de COLECTOR con merge incremental
  const loadCollectorPlaysData = async (userId, filters = {}) => {
    try {
      if (!userId) {
        return [];
      }

      const { period, startDate, endDate, customStartDate, customEndDate, directData, forceRefresh = false } = filters;
      
      // Si se proporciona directData (consulta directa desde StatisticsScreen), usarlo
      if (directData) {
        return directData;
      }
      
      // Calcular fechas según el período si no vienen explícitas
      let calculatedStartDate = customStartDate || startDate;
      let calculatedEndDate = customEndDate || endDate;
      
      // Si no vienen fechas, calcularlas según el período
      if (!calculatedStartDate || !calculatedEndDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        switch (period) {
          case 'today':
            calculatedStartDate = new Date(today);
            calculatedEndDate = new Date(today);
            calculatedEndDate.setHours(23, 59, 59, 999);
            break;
          case 'yesterday':
            calculatedStartDate = new Date(today);
            calculatedStartDate.setDate(today.getDate() - 1);
            calculatedEndDate = new Date(calculatedStartDate);
            calculatedEndDate.setHours(23, 59, 59, 999);
            break;
          case 'last7days':
            calculatedStartDate = new Date(today);
            calculatedStartDate.setDate(today.getDate() - 6);
            calculatedEndDate = new Date(today);
            calculatedEndDate.setHours(23, 59, 59, 999);
            break;
          case 'last30days':
            calculatedStartDate = new Date(today);
            calculatedStartDate.setDate(today.getDate() - 29);
            calculatedEndDate = new Date(today);
            calculatedEndDate.setHours(23, 59, 59, 999);
            break;
          default:
            // Sin período específico, usar 30 días por defecto
            calculatedStartDate = new Date(today);
            calculatedStartDate.setDate(today.getDate() - 29);
            calculatedEndDate = new Date(today);
            calculatedEndDate.setHours(23, 59, 59, 999);
        }
      }
      
      const finalStartDate = calculatedStartDate;
      const finalEndDate = calculatedEndDate;
      
      const cachedData = await readFromCache(userId, 'cache_30days', 'collector');
      let cachedPlays = [];
      let cacheMetadata = null;
      
      if (cachedData && cachedData._metadata) {
        cacheMetadata = cachedData._metadata;
        const { _metadata, ...data } = cachedData;
        cachedPlays = data.plays || [];
      }
      
      if (forceRefresh) {
        const lastDate = getMaxFechaJugada(cachedPlays);
        const newPlays = await fetchIncrementalData(userId, lastDate);
        
        if (newPlays) {
          const mergedPlays = mergePlaysByIdJugada(cachedPlays, newPlays);
          await saveToCache(userId, 'cache_30days', mergedPlays, 'collector');
          return filterPlaysByDateRange(mergedPlays, period, finalStartDate, finalEndDate);
        }
        
        return filterPlaysByDateRange(cachedPlays, period, finalStartDate, finalEndDate);
      }
      
      if (cacheMetadata) {
        const cacheAge = (Date.now() - cacheMetadata.timestamp) / (1000 * 60);
        
        if (cacheAge < CACHE_REFRESH_THRESHOLD) {
          return filterPlaysByDateRange(cachedPlays, period, finalStartDate, finalEndDate);
        }
      }
      
      const lastDate = getMaxFechaJugada(cachedPlays);
      
      if (cachedPlays.length > 0 && lastDate) {
        const newPlays = await fetchIncrementalData(userId, lastDate);
        
        if (newPlays) {
          const mergedPlays = mergePlaysByIdJugada(cachedPlays, newPlays);
          await saveToCache(userId, 'cache_30days', mergedPlays, 'collector');
          return filterPlaysByDateRange(mergedPlays, period, finalStartDate, finalEndDate);
        }
        
        return filterPlaysByDateRange(cachedPlays, period, finalStartDate, finalEndDate);
      } else {
        const initialData = await fetchInitialData(userId);
        
        if (initialData) {
          await saveToCache(userId, 'cache_30days', initialData, 'collector');
          return filterPlaysByDateRange(initialData, period, finalStartDate, finalEndDate);
        }
        
        return [];
      }
      
    } catch (error) {
      console.error('[useCollectorStatistics] Error en loadCollectorPlaysData:', error);
      return [];
    }
  };
  
  const getMaxFechaJugada = (plays) => {
    if (!plays || plays.length === 0) return null;
    const maxDate = plays.reduce((max, play) => {
      const playDate = new Date(play.fecha_jugada);
      return playDate > max ? playDate : max;
    }, new Date(0));
    return maxDate;
  };
  
  const mergePlaysByIdJugada = (existingPlays, newPlays) => {
    const playMap = new Map();
    existingPlays.forEach(play => playMap.set(play.id_jugada, play));
    newPlays.forEach(play => playMap.set(play.id_jugada, play));
    
    // CRÍTICO: Re-ordenar después del merge para mantener orden DESC
    const merged = Array.from(playMap.values());
    merged.sort((a, b) => {
      const dateA = new Date(a.fecha_jugada || a.created_at).getTime();
      const dateB = new Date(b.fecha_jugada || b.created_at).getTime();
      return dateB - dateA; // DESC: más reciente primero
    });
    
    return merged;
  };
  
  // OPTIMIZADO: Elimina filtrado redundante
  // Los datos ya vienen filtrados del flujo principal (loadPlaysData)
  const filterPlaysByDateRange = (plays, period, startDate, endDate) => {
    if (!plays || plays.length === 0) return [];
    
    // Si es custom pero faltan fechas, retornar array vacío (caso de error)
    if (period === 'custom' && (!startDate || !endDate)) {
      console.warn('[useCollectorStatistics] Período custom sin fechas válidas');
      return [];
    }
    
    // Si vienen fechas explícitas, aplicar filtro directo
    if (startDate && endDate) {
      return filterByDateRange(plays, startDate, endDate);
    }
    
    // Para períodos predefinidos, los datos ya están filtrados por loadPlaysData
    // No es necesario recalcular rangos ni re-filtrar
    return plays;
  };

  const fetchInitialData = async (userId) => {
    try {
      const cacheStart = getCacheStartDate();
      const startStr = formatDateForQuery(cacheStart) + ' 00:00:00';
      const today = new Date();
      const endStr = formatDateForQuery(today) + ' 23:59:59';
      
      return await fetchFromSupabaseWithPagination(userId, startStr, endStr);
    } catch (error) {
      console.error('[useCollectorStatistics] Error en fetchInitialData:', error);
      return [];
    }
  };
  
  const fetchIncrementalData = async (userId, lastDate) => {
    try {
      if (!lastDate) return await fetchInitialData(userId);
      
      // OPTIMIZACIÓN: Restar 10 horas a la fecha más reciente para capturar jugadas
      // de horarios que abrieron al mismo tiempo pero cierran más tarde
      // Ejemplo: Dos horarios abren 8:00 AM, uno cierra 10:00 AM (más reciente en caché)
      // pero el otro cierra 12:00 PM → necesitamos las jugadas de 8:00-12:00 del segundo
      const adjustedLastDate = new Date(lastDate);
      adjustedLastDate.setHours(adjustedLastDate.getHours() - 10);
      
      const startStr = formatDateForQuery(adjustedLastDate) + ' ' + 
                       String(adjustedLastDate.getHours()).padStart(2, '0') + ':' +
                       String(adjustedLastDate.getMinutes()).padStart(2, '0') + ':00';
      const today = new Date();
      const endStr = formatDateForQuery(today) + ' 23:59:59';
      
      return await fetchFromSupabaseWithPagination(userId, startStr, endStr, true);
    } catch (error) {
      console.error('[useCollectorStatistics] Error en fetchIncrementalData:', error);
      return [];
    }
  };
  
  const fetchFromSupabaseWithPagination = async (userId, startStr, endStr, isIncremental = false) => {
    try {
      let allPlaysData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('v_estadisticas')
          .select('*')
          .eq('id_colector', userId)
          .gte('fecha_jugada', startStr)
          .lte('fecha_jugada', endStr)
          .order('fecha_jugada', { ascending: false });

        const { data: playsData, error } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.error('[useCollectorStatistics] Error en consulta Supabase:', error);
          return isIncremental ? null : [];
        }
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
          hasMore = playsData.length === 1000;
          page++;
        } else {
          hasMore = false;
        }
        
        if (page > 250) {
          break;
        }
      }
      
      return allPlaysData;
      
    } catch (error) {
      console.error('[useCollectorStatistics] Error en fetchFromSupabaseWithPagination:', error);
      return isIncremental ? null : [];
    }
  };  // Función para agrupar datos por estructura jerárquica: Listeros -> Loterías/Horarios
  const groupDataForCollector = (rawData) => {
    if (!rawData || rawData.length === 0) {
      return [];
    }

    // Agrupar por listero
    const listeroGroups = {};
    
    rawData.forEach(record => {
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

    // Calcular totales por listero y agrupar por lotería/horario
    Object.values(listeroGroups).forEach(group => {
      // Agrupar las jugadas del listero por lotería + horario
      const lotteryHourGroups = {};
      
      group.plays.forEach(play => {
        const key = `${play.id_loteria}_${play.id_horario}`;
        const lotteryName = play.nombre_loteria || 'N/A';
        const hourName = play.nombre_horario || 'N/A';
        
        if (!lotteryHourGroups[key]) {
          lotteryHourGroups[key] = {
            id: key,
            loteria: lotteryName,
            horario: hourName,
            id_loteria: play.id_loteria,
            id_horario: play.id_horario,
            plays: [],
            bruto: 0,
            premio: 0,
            ganancia_listero: 0,
            ganancia_colector: 0
          };
        }
        
        lotteryHourGroups[key].plays.push(play);
        lotteryHourGroups[key].bruto += play.monto_total || 0;
        lotteryHourGroups[key].premio += play.monto_a_pagar || 0;
        lotteryHourGroups[key].ganancia_listero += play.ganancia_listero || 0;
        lotteryHourGroups[key].ganancia_colector += play.ganancia_colector || 0;
      });
      
      // Asignar los grupos de lotería/horario al listero
      group.lottery_hour_groups = Object.values(lotteryHourGroups);
      
      // Calcular totales del listero
      group.total_bruto = group.plays.reduce((sum, play) => sum + (play.monto_total || 0), 0);
      group.total_premio = group.plays.reduce((sum, play) => sum + (play.monto_a_pagar || 0), 0);
      group.total_ganancia_listero = group.plays.reduce((sum, play) => sum + (play.ganancia_listero || 0), 0);
      group.total_ganancia_colector = group.plays.reduce((sum, play) => sum + (play.ganancia_colector || 0), 0);
      group.balance_colector = group.plays.reduce((sum, play) => sum + (play.balance_colector || 0), 0);
    });

    return Object.values(listeroGroups);
  };

  // Función principal para cargar datos de jugadas del colector
  const loadPlaysData = async (filters = {}) => {
    try {
  // inicio carga (silencioso)
      
      // Prevenir ejecuciones concurrentes
      if (isLoading) {
        // ya cargando, abortar (silencioso)
        return;
      }
      
      setIsLoading(true);
      
      if (!userId) {
        // no hay userId (silencioso)
        setIsLoading(false);
        return;
      }
      
      const playsData = await loadCollectorPlaysData(userId, filters);
      
      // Agrupar datos para vista de colector
      const groupedData = groupDataForCollector(playsData);
      
      setTableData(prev => ({
        ...prev,
        plays: groupedData
      }));
      
  // datos agrupados establecidos (silencioso)
      
      return groupedData;
      
    } catch (error) {
      setTableData(prev => ({
        ...prev,
        plays: []
      }));
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Función para obtener el balance total del banco (suma de balance_colector)
  const getBankBalance = () => {
    if (!tableData.plays || tableData.plays.length === 0) {
      return 0;
    }
    
    return tableData.plays.reduce((total, listero) => {
      return total + (listero.balance_colector || 0);
    }, 0);
  };

  // Función para obtener totales generales
  const getTotals = () => {
    if (!tableData.plays || tableData.plays.length === 0) {
      return {
        total_bruto: 0,
        total_premio: 0,
        total_ganancia_colector: 0,
        balance_banco: 0
      };
    }

    return tableData.plays.reduce((totals, listero) => {
      totals.total_bruto += listero.total_bruto || 0;
      totals.total_premio += listero.total_premio || 0;
      totals.total_ganancia_colector += listero.total_ganancia_colector || 0;
      totals.balance_banco += listero.balance_colector || 0;
      return totals;
    }, {
      total_bruto: 0,
      total_premio: 0,
      total_ganancia_colector: 0,
      balance_banco: 0
    });
  };

  // Función para cambiar el rango de fechas
  const updateDateRange = (startDate, endDate) => {
    setDateRange({ startDate, endDate });
  };

  // Efecto para cargar usuario autenticado
  useEffect(() => {
    if (!enabled) return; // no inicializar cuando está deshabilitado
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (error) {
      }
    };

    loadUserData();
  }, [enabled]);

  // Efecto para cargar datos cuando se obtiene el userId
  useEffect(() => {
    if (!enabled) return;
    if (userId && !isLoading) {
      loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
    }
  }, [userId, enabled]);

  // Efecto para recargar cuando cambie el rango de fechas
  useEffect(() => {
    if (!enabled) return;
    if (userId && !isLoading) {
      const timeoutId = setTimeout(() => {
        loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      }, 300); // Debounce de 300ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [dateRange.startDate, dateRange.endDate, enabled]);

  return {
    // Estados
    isLoading,
    tableData,
    dateRange,
    userId,
    
    // Funciones
    loadPlaysData,
    updateDateRange,
    getBankBalance,
    getTotals
  };
};


