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

  // Mapeo directo de período a vista optimizada
  const getViewByPeriod = (period) => {
    switch (period) {
      case 'today':
        return { viewName: 'v_estadisticas_hoy', isOptimized: true, period: 'hoy' };
      case 'yesterday':
        return { viewName: 'v_estadisticas_ayer', isOptimized: true, period: 'ayer' };
      case 'last7days':
        return { viewName: 'v_estadisticas_7d', isOptimized: true, period: 'últimos 7 días' };
      case 'last30days':
        return { viewName: 'v_estadisticas_mes', isOptimized: true, period: 'este mes' };
      case 'lastMonth':
        return { viewName: 'v_estadisticas_mes_pasado', isOptimized: true, period: 'mes pasado' };
      default:
        return { viewName: 'v_estadisticas', isOptimized: false, period: 'custom' };
    }
  };

  // Helper para detectar si el filtro es para el día de hoy
  const isFilteringToday = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    
    return filterStart.getTime() >= todayStart.getTime() && 
           filterEnd.getTime() <= todayEnd.getTime();
  };

  // Helper para detectar si el filtro es para ayer
  const isFilteringYesterday = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    
    return filterStart.getTime() >= yesterdayStart.getTime() && 
           filterEnd.getTime() <= yesterdayEnd.getTime();
  };

  // Helper para detectar si el filtro es para los últimos 7 días
  const isFilteringLast7Days = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    
    // Verificar si el rango corresponde aproximadamente a "últimos 7 días"
    // Permitir una tolerancia de algunos minutos para diferencias de tiempo
    const timeDiffStart = Math.abs(filterStart.getTime() - sevenDaysAgo.getTime());
    const timeDiffEnd = Math.abs(filterEnd.getTime() - now.getTime());
    
    // Tolerancia de 5 minutos (300000 ms)
    const tolerance = 5 * 60 * 1000;
    
    return timeDiffStart <= tolerance && timeDiffEnd <= tolerance;
  };

  // Helper para detectar si el filtro es para los últimos 30 días (Este mes)
  const isFilteringLast30Days = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    
    // Verificar si el rango corresponde aproximadamente a "últimos 30 días"
    // Permitir una tolerancia de algunos minutos para diferencias de tiempo
    const timeDiffStart = Math.abs(filterStart.getTime() - thirtyDaysAgo.getTime());
    const timeDiffEnd = Math.abs(filterEnd.getTime() - now.getTime());
    
    // Tolerancia de 5 minutos (300000 ms)
    const tolerance = 5 * 60 * 1000;
    
    return timeDiffStart <= tolerance && timeDiffEnd <= tolerance;
  };

  // Helper para detectar si el filtro es para el mes pasado
  const isFilteringLastMonth = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    
    // Verificar si el rango corresponde exactamente al mes pasado
    // Comparar año, mes y día
    const startMatches = filterStart.getFullYear() === lastMonthStart.getFullYear() &&
                        filterStart.getMonth() === lastMonthStart.getMonth() &&
                        filterStart.getDate() === lastMonthStart.getDate();
    
    const endMatches = filterEnd.getFullYear() === lastMonthEnd.getFullYear() &&
                      filterEnd.getMonth() === lastMonthEnd.getMonth() &&
                      filterEnd.getDate() === lastMonthEnd.getDate();
    
    return startMatches && endMatches;
  };

  // Helper para determinar qué vista usar según el filtro de fechas
  const getOptimizedView = (startDate, endDate) => {
    if (isFilteringToday(startDate, endDate)) {
      return { viewName: 'v_estadisticas_hoy', isOptimized: true, period: 'hoy' };
    }
    if (isFilteringYesterday(startDate, endDate)) {
      return { viewName: 'v_estadisticas_ayer', isOptimized: true, period: 'ayer' };
    }
    if (isFilteringLast7Days(startDate, endDate)) {
      return { viewName: 'v_estadisticas_7d', isOptimized: true, period: 'últimos 7 días' };
    }
    if (isFilteringLast30Days(startDate, endDate)) {
      return { viewName: 'v_estadisticas_mes', isOptimized: true, period: 'este mes' };
    }
    if (isFilteringLastMonth(startDate, endDate)) {
      return { viewName: 'v_estadisticas_mes_pasado', isOptimized: true, period: 'mes pasado' };
    }
    return { viewName: 'v_estadisticas', isOptimized: false, period: 'custom' };
  };

  // Función específica para cargar datos de COLECTOR con agrupación jerárquica
  const loadCollectorPlaysData = async (userId, filters = {}) => {
    try {
      if (!userId) {
        return [];
      }

      const { period, startDate, endDate, forceRefresh = false } = filters;
      
      // Si forceRefresh es true, saltar toda la lógica de caché y consultar directamente
      if (forceRefresh) {
        const freshData = await fetchCollectorDataFromSupabase(userId, filters);
        const cachePeriod = normalizePeriodForCache(period);
        await saveToCache(userId, cachePeriod, freshData, 'collector');
        return freshData;
      }
      
      // Normalizar período para caché (last7days -> recent)
      const cachePeriod = normalizePeriodForCache(period);
      
      // ============================================
      // OPTIMIZACIÓN 1: Filtrado local desde caché
      // ============================================
      // Si es filtro de hoy o ayer, intentar filtrar localmente desde caché de 7 días
      if (period === 'today' || period === 'yesterday') {
        const cached7Days = await readFromCache(userId, 'recent', 'collector');
        
        if (cached7Days) {
          const range = period === 'today' ? getTodayRange() : getYesterdayRange();
          const filteredData = filterByDateRange(cached7Days, range.start, range.end, 'fecha_jugada');
          
          if (filteredData && filteredData.length >= 0) {
            return filteredData;
          }
        }
      }
      
      // ============================================
      // OPTIMIZACIÓN 2: Verificar caché antes de consultar Supabase
      // ============================================
      const cachedData = await readFromCache(userId, cachePeriod, 'collector');
      
      if (cachedData && cachedData._metadata) {
        const metadata = cachedData._metadata;
        const cacheAge = (Date.now() - metadata.timestamp) / (1000 * 60); // minutos
        
        // Si el caché es reciente (< 10 min), usarlo directamente
        if (cacheAge < CACHE_REFRESH_THRESHOLD) {
          const { _metadata, ...data } = cachedData;
          return data.plays || [];
        }
        
        // Si el caché es antiguo pero no demasiado (< 60 min), usarlo y refrescar en segundo plano
        if (cacheAge < 60) {
          const { _metadata, ...data } = cachedData;
          
          // Refrescar en segundo plano (sin await)
          (async () => {
            try {
              const freshData = await fetchCollectorDataFromSupabase(userId, filters);
              await saveToCache(userId, cachePeriod, freshData, 'collector');
            } catch (err) {
              console.error('[useCollectorStatistics] Error en refresco:', err.message);
            }
          })();
          
          return data.plays || [];
        }
      }
      
      // ============================================
      // OPTIMIZACIÓN 3: Consultar Supabase y guardar en caché
      // ============================================
      const freshData = await fetchCollectorDataFromSupabase(userId, filters);
      
      // Guardar en caché según plataforma
      if (isMobile) {
        await saveToCache(userId, cachePeriod, freshData, 'collector');
      } else if (isWeb || isExpoGo) {
        // Expo Go/Web: Solo cachear 'recent' (7 días)
        if (cachePeriod === 'recent') {
          await saveToCache(userId, cachePeriod, freshData, 'collector');
        }
      }
      
      return freshData;
      
    } catch (error) {
      console.error('[useCollectorStatistics] Error en loadCollectorPlaysData:', error);
      return [];
    }
  };

  // Función auxiliar para consultar Supabase (lógica original extraída)
  const fetchCollectorDataFromSupabase = async (userId, filters = {}) => {
    try {
      const { period, startDate, endDate } = filters;
      
      // Determinar qué vista usar según el período o filtro de fechas
      let viewConfig;
      if (period) {
        // Usar mapeo directo por período (nueva funcionalidad)
        viewConfig = getViewByPeriod(period);
      } else {
        // Usar detección por fechas (funcionalidad legacy)
        viewConfig = getOptimizedView(startDate, endDate);
      }
      
      const { viewName, isOptimized } = viewConfig;
      
      // Formatear fechas si están disponibles y no estamos usando vista optimizada
      let dateFilters = {};
      if (startDate && endDate && !isOptimized) {
        const startStr = formatDateForQuery(startDate) + ' 00:00:00';
        const endStr = formatDateForQuery(endDate) + ' 23:59:59';
        dateFilters = {
          startStr,
          endStr
        };
      }

      // Obtener todos los datos usando paginación optimizada
      let allPlaysData = [];
      let page = 0;
      // Supabase tiene límite máximo de 1000 registros por consulta
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from(viewName)
          .select('*')
          .eq('id_colector', userId);

        // Solo agregar filtro de estado_horario si no estamos usando vista optimizada
        if (!isOptimized) {
          query = query.eq('estado_horario', 'cerrada');
        }
        
        query = query.order('fecha_jugada', { ascending: false });

        // Solo aplicar filtros de fecha si no estamos usando vista optimizada
        if (dateFilters.startStr && dateFilters.endStr && !isOptimized) {
          query = query
            .gte('fecha_jugada', dateFilters.startStr)
            .lte('fecha_jugada', dateFilters.endStr);
        }

        const { data: playsData, error } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.error('[useCollectorStatistics] Error en consulta Supabase:', error);
          return [];
        }
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
          // CORECCIÓN: Si obtienes exactamente 1000 registros, puede haber más
          hasMore = playsData.length === 1000; // Continuar si se obtuvieron exactamente 1000 registros
          page++;
        } else {
          hasMore = false;
        }
        
        // Límite de seguridad para evitar bucles infinitos
        if (page > 250) { // Hasta 1.25M registros
              break;
        }
      }
      
      return allPlaysData || [];
      
    } catch (error) {
      console.error('[useCollectorStatistics] Error en fetchCollectorDataFromSupabase:', error);
      return [];
    }
  };

  // Función para agrupar datos por estructura jerárquica: Listeros -> Loterías/Horarios
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


