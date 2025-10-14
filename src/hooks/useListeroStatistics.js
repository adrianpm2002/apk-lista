import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { statisticsCacheService } from '../services/statisticsCacheService';

// Helper para convertir fecha local a string para consultas de base de datos
const formatDateForQuery = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const useListeroStatistics = (options = {}) => {
  const { enabled = true } = options;
  
  // Estados básicos (compatibilidad con pantallas)
  const [loading, setLoading] = useState(false); // Cambio: isLoading -> loading
  const [error, setError] = useState(null); // Agregado
  const [userId, setUserId] = useState(null);
  
  // Ref para evitar dependencias circulares
  const loadingRef = useRef(false);
  
  // Estados para cache
  const [isDataFromCache, setIsDataFromCache] = useState(false);
  const [cacheInfo, setCacheInfo] = useState(null);
  
  // Estados para compatibilidad con pantallas
  const [kpiData, setKpiData] = useState({}); // Agregado
  const [chartData, setChartData] = useState([]); // Agregado
  const [tableData, setTableData] = useState([]); // Cambiado: de objeto a array para listero
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

  // Función específica para cargar datos de LISTERO
  const loadListeroPlaysData = async (userId, filters = {}) => {
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
      
      let dateFilters = {};
      if (startDate && endDate && !isOptimized) {
        const startStr = formatDateForQuery(startDate) + ' 00:00:00';
        const endStr = formatDateForQuery(endDate) + ' 23:59:59';
        dateFilters = {
          startStr,
          endStr
        };
      }

      let allPlaysData = [];
      let page = 0;
      // Supabase tiene límite máximo de 1000 registros por consulta
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from(viewName)
          .select('*')
          .eq('id_listero', userId);

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
          console.error('Error loading plays data:', error);
          return [];
        }
        
        if (playsData && playsData.length > 0) {
          
          allPlaysData = allPlaysData.concat(playsData);
          hasMore = playsData.length === 1000; // Continuar si se obtuvieron exactamente 1000 registros
          page++;
        } else {
          hasMore = false;
        }
        
        if (page > 250) { // Hasta 1.25M registros
          break;
        }
      }

      return allPlaysData || [];
      
    } catch (error) {
      console.error('Error in loadListeroPlaysData:', error);
      return [];
    }
  };

  // Funciones de manejo de cache
  const loadDataFromCache = useCallback(async (period = 'today') => {
    if (!userId) return false;
    
    try {
      const cachedResult = await statisticsCacheService.getStatisticsFromCache('listero', period);
      
      if (cachedResult && cachedResult.data) {
        
        // Transformar datos para compatibilidad con componentes (similar a loadPlaysData)
        const formattedPlays = (cachedResult.data || [])
          .filter(j => {
            // Filtro: verificar que fecha_jugada existe y es válida
            if (!j.fecha_jugada) return false;
            if (j.fecha_jugada === null || j.fecha_jugada === undefined) return false;
            if (typeof j.fecha_jugada === 'string' && j.fecha_jugada.trim() === '') return false;
            
            const testDate = new Date(j.fecha_jugada);
            if (isNaN(testDate.getTime())) return false;
            
            return true;
          })
          .map(j => ({
            id: j.id_listero + '_' + j.fecha_jugada,
            created_at: j.fecha_jugada,
            fecha_jugada: j.fecha_jugada,
            fecha: new Date(j.fecha_jugada).toLocaleDateString('es-ES'),
            hora: new Date(j.fecha_jugada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            loteria: j.nombre_loteria || 'N/A',
            horario: j.nombre_horario || 'N/A',
            jugada: j.tipo_jugada || 'N/A',
            numeros: j.numeros_jugados || 'N/A',
            numeros_jugados: j.numeros_jugados || 'N/A',
            monto: j.monto_total || 0,
            monto_total: j.monto_total || 0,
            nota: j.nota || '',
            tipo_jugada: j.tipo_jugada || 'N/A',
            resultado: j.resultado || 'Pendiente',
            monto_a_pagar: j.monto_a_pagar || 0,
            ganancia_listero: j.ganancia_listero || 0,
            balance_listero: j.balance_listero || 0,
            // Campos básicos para compatibilidad
            play_type: j.tipo_jugada || 'N/A',
            bruto: j.monto_total || 0,
            premio: j.monto_a_pagar || 0,
            pagado: j.monto_a_pagar || 0,
            ganancia: j.ganancia_listero || 0,
            balance: j.balance_listero || 0,
            // IDs para filtrado
            id_listero: j.id_listero || null,
            listero_username: j.listero_username || ''
          }));
        
        // Actualizar tableData
        setTableData(formattedPlays);
        
        // Calcular KPIs
        const totals = formattedPlays.reduce((acc, play) => {
          acc.totalBruto += Number(play.monto_total) || 0;
          acc.totalPremios += Number(play.monto_a_pagar) || 0;
          acc.totalGanancias += Number(play.ganancia_listero) || 0;
          acc.totalBalance += Number(play.balance_listero) || 0;
          return acc;
        }, { totalBruto: 0, totalPremios: 0, totalGanancias: 0, totalBalance: 0 });
        
        setKpiData(totals);
        setIsDataFromCache(true);
        
        // Obtener información del cache
        const info = await statisticsCacheService.getCacheInfo('listero');
        setCacheInfo(info);
        
        return true;
      }
      
      setIsDataFromCache(false);
      return false;
    } catch (error) {
      setIsDataFromCache(false);
      return false;
    }
  }, [userId]);

  const saveDataToCache = useCallback(async (data, period = 'today') => {
    if (!userId || !data) return;
    
    try {
      await statisticsCacheService.saveStatisticsToCache('listero', data, period);
      
      // Actualizar información del cache
      const info = await statisticsCacheService.getCacheInfo('listero');
      setCacheInfo(info);
    } catch (error) {
      // Error silencioso en cache
    }
  }, [userId]);

  const clearCache = useCallback(async () => {
    try {
      await statisticsCacheService.clearStatisticsCache('listero');
      setIsDataFromCache(false);
      setCacheInfo(null);
    } catch (error) {
      // Error silencioso
    }
  }, []);

  // Función principal para cargar datos de jugadas del listero
  const loadPlaysData = useCallback(async (filters = {}) => {
    try {
      
      const { period } = filters;
      
      // Si hay filtros específicos (como lottery), forzar la recarga
      const hasSpecificFilters = filters?.lottery || filters?.schedule;
      
      // Si no hay filtros específicos, intentar cargar desde cache primero
      if (!hasSpecificFilters && period) {
        const cacheLoaded = await loadDataFromCache(period);
        if (cacheLoaded) {
          return tableData || [];
        }
      }
      
      // Prevenir ejecuciones concurrentes SOLO si no hay filtros específicos
      if (loadingRef.current && !hasSpecificFilters) {
        return;
      }
      
      // Si hay filtros específicos, proceder aunque esté loading
      if (hasSpecificFilters) {
        // Limpiar datos inmediatamente para evitar mostrar datos viejos
        setTableData(prev => ({
          ...prev,
          plays: []
        }));
      }
      
      loadingRef.current = true;
      setLoading(true);
      setError(null); // Limpiar errores previos
      setIsDataFromCache(false); // Marcar que los datos no vienen del cache
      
      if (!userId) {
        loadingRef.current = false;
        setLoading(false);
        return;
      }
      
      const playsData = await loadListeroPlaysData(userId, filters);
      
      // Transformar datos para compatibilidad con componentes
      const formattedPlays = (playsData || [])
        .filter(j => {
          // Filtro: verificar que fecha_jugada existe y es válida
          if (!j.fecha_jugada) return false;
          if (j.fecha_jugada === null || j.fecha_jugada === undefined) return false;
          if (typeof j.fecha_jugada === 'string' && j.fecha_jugada.trim() === '') return false;
          
          const testDate = new Date(j.fecha_jugada);
          if (isNaN(testDate.getTime())) return false;
          
          return true;
        })
        .map(j => ({
          id: j.id_listero + '_' + j.fecha_jugada,
          created_at: j.fecha_jugada,
          fecha_jugada: j.fecha_jugada, // Agregado para compatibilidad
          fecha: new Date(j.fecha_jugada).toLocaleDateString('es-ES'),
          hora: new Date(j.fecha_jugada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          loteria: j.nombre_loteria || 'N/A',
          horario: j.nombre_horario || 'N/A',
          jugada: j.tipo_jugada || 'N/A',
          numeros: j.numeros_jugados || 'N/A',
          numeros_jugados: j.numeros_jugados || 'N/A', // Agregado
          monto: j.monto_total || 0,
          monto_total: j.monto_total || 0, // Agregado
          nota: j.nota || '',
          tipo_jugada: j.tipo_jugada || 'N/A', // Agregado
          resultado: j.resultado || 'Pendiente',
          monto_a_pagar: j.monto_a_pagar || 0, // Agregado
          ganancia_listero: j.ganancia_listero || 0,
          balance_listero: j.balance_listero || 0,
          // Campos básicos para compatibilidad
          play_type: j.tipo_jugada || 'N/A',
          bruto: j.monto_total || 0,
          premio: j.monto_a_pagar || 0,
          pagado: j.monto_a_pagar || 0,
          ganancia: j.ganancia_listero || 0,
          balance: j.balance_listero || 0,
          // IDs para filtrado
          id_listero: j.id_listero || null,
          listero_username: j.listero_username || ''
        }));
      
      // Actualizar tableData como array directo (importante para listero)
      setTableData(formattedPlays);
      
      // Calcular KPIs
      const totals = formattedPlays.reduce((acc, play) => {
        acc.totalBruto += Number(play.monto_total) || 0;
        acc.totalPremios += Number(play.monto_a_pagar) || 0;
        acc.totalGanancias += Number(play.ganancia_listero) || 0;
        acc.totalBalance += Number(play.balance_listero) || 0;
        return acc;
      }, { totalBruto: 0, totalPremios: 0, totalGanancias: 0, totalBalance: 0 });
      
      setKpiData(totals);
      
      // Guardar en cache si no hay filtros específicos
      if (!hasSpecificFilters && period) {
        await saveDataToCache(playsData, period);
      }
      
      return formattedPlays;
      
    } catch (error) {
      console.error('Error loading listero plays data:', error);
      setError(error.message || 'Error al cargar datos');
      setTableData([]);
      return [];
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [userId, loadDataFromCache, saveDataToCache]); // Agregar dependencias de cache

  // Función loadAllStats para compatibilidad
  const loadAllStats = useCallback(async () => {
    return await loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
  }, [loadPlaysData, dateRange.startDate, dateRange.endDate]);

  // Función applyFilters para compatibilidad
  const applyFilters = useCallback(async (filters) => {
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
  }, [loadPlaysData, dateRange.startDate, dateRange.endDate]);

  // Función para cambiar el rango de fechas
  const updateDateRange = useCallback((startDate, endDate) => {
    setDateRange({ startDate, endDate });
  }, []);

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
    if (!enabled || !userId) return;
    
    // Usar loadPlaysData directamente para evitar dependencias circulares
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1); // Primer día del mes
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Último día del mes
    loadPlaysData({ startDate, endDate });
  }, [userId, enabled, loadPlaysData]); // Ahora loadPlaysData es estable

  // Efecto para recargar cuando cambie el rango de fechas
  useEffect(() => {
    if (!enabled || !userId) return;
    
    const timeoutId = setTimeout(() => {
      loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [dateRange.startDate, dateRange.endDate, enabled, userId, loadPlaysData]); // Incluir loadPlaysData estable

  return {
    // Estados (compatibilidad con pantallas)
    kpiData,
    chartData,
    tableData, // Ahora es array directo
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
    updateDateRange
  };
};

// Exportación por defecto para compatibilidad
export default useListeroStatistics;

// Mantener también la exportación named para compatibilidad
export { useListeroStatistics };