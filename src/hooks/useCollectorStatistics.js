import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { statisticsCacheService } from '../services/statisticsCacheService';

// Helper para convertir fecha local a string para consultas de base de datos
const formatDateForQuery = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const useCollectorStatistics = (options = {}) => {
  const { enabled = true } = options;
  
  // Estados básicos (compatibilidad con pantallas)
  const [loading, setLoading] = useState(false); // Cambio: isLoading -> loading
  const [error, setError] = useState(null); // Agregado
  const [userId, setUserId] = useState(null);
  
  // Estados para cache
  const [isDataFromCache, setIsDataFromCache] = useState(false);
  const [cacheInfo, setCacheInfo] = useState(null);
  
  // Estados para compatibilidad con pantallas
  const [kpiData, setKpiData] = useState({}); // Agregado
  const [chartData, setChartData] = useState([]); // Agregado
  const [tableData, setTableData] = useState({ plays: [] }); // Mantener estructura para collector
  const [lotteries, setLotteries] = useState([]); // Agregado
  const [schedules, setSchedules] = useState([]); // Agregado
  
  // Estado para el rango de fechas (hoy por defecto)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setHours(23, 59, 59, 999))
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

      const { period, startDate, endDate, lottery, schedule } = filters;
      
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

        // Aplicar filtro de lotería si está especificado
        if (lottery) {
          query = query.eq('id_loteria', lottery);
        }

        // Aplicar filtro de horario si está especificado
        if (schedule) {
          query = query.eq('id_horario', schedule);
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
          console.error('Error loading collector plays data:', error);
          return [];
        }
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
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
      console.error('Error in loadCollectorPlaysData:', error);
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

  // Funciones de manejo de cache
  const loadDataFromCache = async (period = 'today') => {
    if (!userId) return false;
    
    try {
      console.log('🔍 [useCollectorStatistics] Checking cache for period:', period);
      const cachedResult = await statisticsCacheService.getStatisticsFromCache('collector', period);
      
      if (cachedResult && cachedResult.data) {
        console.log('✅ [useCollectorStatistics] Cache hit - using cached data');
        
        // Agrupar datos para vista de colector
        const groupedData = groupDataForCollector(cachedResult.data);
        
        setTableData(prev => ({
          ...prev,
          plays: groupedData
        }));
        
        // Calcular KPIs para compatibilidad con pantallas
        const totals = getTotalsFromGroupedData(groupedData);
        setKpiData(totals);
        
        setIsDataFromCache(true);
        
        // Obtener información del cache
        const info = await statisticsCacheService.getCacheInfo('collector');
        setCacheInfo(info);
        
        return true;
      }
      
      console.log('❌ [useCollectorStatistics] Cache miss - no cached data found');
      setIsDataFromCache(false);
      return false;
    } catch (error) {
      console.error('❌ [useCollectorStatistics] Error loading from cache:', error);
      setIsDataFromCache(false);
      return false;
    }
  };

  const saveDataToCache = async (data, period = 'today') => {
    if (!userId || !data) return;
    
    try {
      console.log('💾 [useCollectorStatistics] Saving data to cache for period:', period);
      await statisticsCacheService.saveStatisticsToCache('collector', data, period);
      
      // Actualizar información del cache
      const info = await statisticsCacheService.getCacheInfo('collector');
      setCacheInfo(info);
    } catch (error) {
      console.error('❌ [useCollectorStatistics] Error saving to cache:', error);
    }
  };

  const clearCache = async () => {
    try {
      await statisticsCacheService.clearStatisticsCache('collector');
      setIsDataFromCache(false);
      setCacheInfo(null);
      console.log('🗑️ [useCollectorStatistics] Cache cleared');
    } catch (error) {
      console.error('❌ [useCollectorStatistics] Error clearing cache:', error);
    }
  };

  // Función principal para cargar datos de jugadas del colector
  const loadPlaysData = async (filters = {}) => {
    try {
      const { period } = filters;
      
      // Si hay filtros específicos (como lottery), forzar la recarga
      const hasSpecificFilters = filters?.lottery || filters?.schedule;
      
      // Si no hay filtros específicos, intentar cargar desde cache primero
      if (!hasSpecificFilters && period) {
        const cacheLoaded = await loadDataFromCache(period);
        if (cacheLoaded) {
          return tableData?.plays || [];
        }
      }
      
      // Prevenir ejecuciones concurrentes SOLO si no hay filtros específicos
      if (loading && !hasSpecificFilters) {
        // ya cargando, abortar (silencioso)
        return;
      }
      
      // Si hay filtros específicos, limpiar datos inmediatamente
      if (hasSpecificFilters) {
        setTableData(prev => ({
          ...prev,
          plays: []
        }));
      }
      
      setLoading(true);
      setError(null); // Limpiar errores previos
      setIsDataFromCache(false); // Marcar que los datos no vienen del cache
      
      if (!userId) {
        setLoading(false);
        return;
      }
      
      console.log('🔄 [useCollectorStatistics] Loading fresh data from database');
      const playsData = await loadCollectorPlaysData(userId, filters);
      
      // Agrupar datos para vista de colector
      const groupedData = groupDataForCollector(playsData);
      
      setTableData(prev => ({
        ...prev,
        plays: groupedData
      }));

      // Calcular KPIs para compatibilidad con pantallas
      const totals = getTotalsFromGroupedData(groupedData);
      setKpiData(totals);
      
      // Guardar en cache si no hay filtros específicos
      if (!hasSpecificFilters && period) {
        await saveDataToCache(playsData, period);
      }
      
      return groupedData;
      
    } catch (error) {
      console.error('Error loading collector plays data:', error);
      setError(error.message || 'Error al cargar datos');
      setTableData(prev => ({
        ...prev,
        plays: []
      }));
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Función loadAllStats para compatibilidad
  const loadAllStats = async () => {
    return await loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
  };

  // Función applyFilters para compatibilidad
  const applyFilters = async (filters) => {
    const { period, startDate, endDate, ...otherFilters } = filters;
    
    // Si se proporciona un período, convertirlo a fechas
    if (period) {
      const today = new Date();
      let start, end;
      
      switch (period) {
        case 'today':
          start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
          end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
          break;
        case 'last7days':
          start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
          end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
          break;
        case 'last30days':
          start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
          end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
          break;
        case 'lastMonth':
          start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
          break;
        default:
          start = dateRange.startDate;
          end = dateRange.endDate;
      }
      
      setDateRange({ startDate: start, endDate: end });
      return await loadPlaysData({ period, startDate: start, endDate: end, ...otherFilters });
    }
    
    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
      return await loadPlaysData({ startDate, endDate, ...otherFilters });
    }
    
    return await loadPlaysData(filters);
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

  // Función helper para calcular totales desde datos agrupados
  const getTotalsFromGroupedData = (groupedData) => {
    if (!groupedData || groupedData.length === 0) {
      return {
        totalBruto: 0,
        totalPremios: 0,
        totalGanancias: 0,
        totalBalance: 0
      };
    }

    return groupedData.reduce((totals, listero) => {
      totals.totalBruto += listero.total_bruto || 0;
      totals.totalPremios += listero.total_premio || 0;
      totals.totalGanancias += listero.total_ganancia_colector || 0;
      totals.totalBalance += listero.balance_colector || 0;
      return totals;
    }, {
      totalBruto: 0,
      totalPremios: 0,
      totalGanancias: 0,
      totalBalance: 0
    });
  };

  // Función para cambiar el rango de fechas
  const updateDateRange = (startDate, endDate) => {
    setDateRange({ startDate, endDate });
  };

  // Efecto para cargar usuario autenticado
  useEffect(() => {
    if (!enabled) return;
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (error) {
        setError('Error al cargar usuario');
      }
    };

    loadUserData();
  }, [enabled]);

  // Efecto para cargar datos cuando se obtiene el userId
  useEffect(() => {
    if (!enabled) return;
    if (userId && !loading) {
      loadAllStats();
    }
  }, [userId, enabled]);

  // Efecto para recargar cuando cambie el rango de fechas
  useEffect(() => {
    if (!enabled) return;
    if (userId && !loading) {
      const timeoutId = setTimeout(() => {
        loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      }, 300); // Debounce de 300ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [dateRange.startDate, dateRange.endDate, enabled]);

  return {
    // Estados (compatibilidad con pantallas)
    kpiData,
    chartData,
    tableData, // Mantener estructura { plays: [] }
    lotteries,
    schedules,
    loading, // Cambio: isLoading -> loading
    error,
    
    // Estados de cache
    isDataFromCache,
    cacheInfo,
    
    // Estados legacy (para compatibilidad hacia atrás)
    isLoading: loading, // Mantener para compatibilidad
    dateRange,
    userId,
    
    // Funciones (compatibilidad con pantallas)
    loadAllStats,
    applyFilters,
    
    // Funciones de cache
    loadDataFromCache,
    saveDataToCache,
    clearCache,
    
    // Funciones legacy
    loadPlaysData,
    updateDateRange,
    getBankBalance,
    getTotals
  };
};

// Exportación por defecto para compatibilidad
export default useCollectorStatistics;

// Mantener también la exportación named para compatibilidad
export { useCollectorStatistics };
