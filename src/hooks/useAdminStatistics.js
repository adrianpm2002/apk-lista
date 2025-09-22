import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

// Helper para convertir fecha local a string para consultas de base de datos
const formatDateForQuery = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
    startDate: new Date(new Date().setHours(0, 0, 0, 0)), // Hoy 00:00:00
    endDate: new Date(new Date().setHours(23, 59, 59, 999)) // Hoy 23:59:59
  });

  // Control de concurrencia para evitar múltiples llamadas simultáneas
  const loadingRef = useRef(false);
  const abortControllerRef = useRef(null);

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
        return { viewName: 'v_estadisticas_ultimo_mes_cerradas', isOptimized: true, period: 'último mes' };
      case 'lastMonth':
        return { viewName: 'v_estadisticas_mes_pasado_cerradas', isOptimized: true, period: 'mes pasado' };
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
      return { viewName: 'v_estadisticas_ultimo_mes_cerradas', isOptimized: true, period: 'último mes' };
    }
    if (isFilteringLastMonth(startDate, endDate)) {
      return { viewName: 'v_estadisticas_mes_pasado_cerradas', isOptimized: true, period: 'mes pasado' };
    }
    return { viewName: 'v_estadisticas', isOptimized: false, period: 'custom' };
  };

  // Función específica para cargar datos de ADMIN con agrupación jerárquica completa
  const loadAdminPlaysData = async (userId, filters = {}) => {
    try {
      if (!userId) {
        return [];
      }

  // inicio de carga (silencioso)

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

      // Obtener todos los datos usando paginación optimizada (filtrar por id_banco del admin)
      let allPlaysData = [];
      let page = 0;
      const pageSize = 1000; // Tamaño de página que coincide con el límite real de Supabase
      let hasMore = true;
      
  // inicio paginación (silencioso)
      
      while (hasMore) {
        let query = supabase
          .from(viewName)
          .select('*')
          .eq('id_banco', userId); // ADMIN filtra por su id_banco

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
          return [];
        }
        
  // progreso por página (silencioso)
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
          // CORRIGIENDO: Si obtienes exactamente 1000 registros (límite de Supabase), continuar
          const shouldContinue = playsData.length === 1000;
          hasMore = shouldContinue;
          page++;
        } else {
          hasMore = false;
        }
        
        // Límite de seguridad para evitar bucles infinitos
        if (page > 250) { // Hasta 1.25M registros
          break;
        }
        
        // Mostrar progreso cada 10 páginas
        // progreso cada 10 páginas (omitido)
      }
      // total obtenido (silencioso)

      return allPlaysData || [];
      
    } catch (error) {
      return [];
    }
  };

  // Función para agrupar datos por estructura jerárquica completa: Colectores -> Listeros -> Loterías/Horarios
  // Función para agrupar datos por estructura jerárquica: Colectores -> Listeros -> Loterías/Horarios
  // (El admin solo ve su banco, por lo que no necesitamos la capa de bancos)
  const groupDataForAdmin = (rawData) => {
    if (!rawData || rawData.length === 0) {
      return [];
    }

    // Agrupar directamente por colector (el admin solo ve su banco)
    const collectorGroups = {};
    
    rawData.forEach(record => {
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
          lottery_hour_groups: {},
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
        // Agrupar las jugadas del listero por lotería + horario
        const lotteryHourGroups = {};
        
        listero.plays.forEach(play => {
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
        listero.lottery_hour_groups = Object.values(lotteryHourGroups);
        
        // Calcular totales del listero
        listero.total_bruto = listero.plays.reduce((sum, play) => sum + (play.monto_total || 0), 0);
        listero.total_premio = listero.plays.reduce((sum, play) => sum + (play.monto_a_pagar || 0), 0);
        listero.total_ganancia_listero = listero.plays.reduce((sum, play) => sum + (play.ganancia_listero || 0), 0);
        listero.total_ganancia_colector = listero.plays.reduce((sum, play) => sum + (play.ganancia_colector || 0), 0);
        listero.balance_listero = listero.plays.reduce((sum, play) => sum + (play.balance_listero || 0), 0);
        listero.balance_colector = listero.plays.reduce((sum, play) => sum + (play.balance_colector || 0), 0);
      });
      
      // Convertir object de listeros a array
      collector.listeros = Object.values(collector.listeros);
      
      // Calcular totales del colector
      collector.total_bruto = collector.raw_plays.reduce((sum, play) => sum + (play.monto_total || 0), 0);
      collector.total_premio = collector.raw_plays.reduce((sum, play) => sum + (play.monto_a_pagar || 0), 0);
      collector.total_ganancia_colector = collector.raw_plays.reduce((sum, play) => sum + (play.ganancia_colector || 0), 0);
      collector.balance_colector = collector.raw_plays.reduce((sum, play) => sum + (play.balance_colector || 0), 0);
    });

    return Object.values(collectorGroups);
  };

  // Función principal para cargar datos de jugadas del admin
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
      
      const playsData = await loadAdminPlaysData(userId, filters);
      
      // Agrupar datos para vista de admin
      const groupedData = groupDataForAdmin(playsData);
      
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

  // Función para obtener el balance total del banco (suma de todos los balance_colector)
  const getBankBalance = () => {
    if (!tableData.plays || tableData.plays.length === 0) {
      return 0;
    }
    
    return tableData.plays.reduce((total, collector) => {
      return total + (collector.balance_banco || 0);
    }, 0);
  };

  // Función para obtener totales generales del sistema
  const getTotals = () => {
    if (!tableData.plays || tableData.plays.length === 0) {
      return {
        total_bruto: 0,
        total_premio: 0,
        total_ganancia_sistema: 0,
        balance_banco_total: 0,
        total_colectores: 0,
        total_listeros: 0
      };
    }

    const totals = tableData.plays.reduce((totals, collector) => {
      totals.total_bruto += collector.total_bruto || 0;
      totals.total_premio += collector.total_premio || 0;
      totals.total_ganancia_sistema += collector.total_ganancia_colector || 0;
      totals.balance_banco_total += collector.balance_banco || 0;
      totals.total_colectores += 1;
      totals.total_listeros += collector.listeros?.length || 0;
      return totals;
    }, {
      total_bruto: 0,
      total_premio: 0,
      total_ganancia_sistema: 0,
      balance_banco_total: 0,
      total_colectores: 0,
      total_listeros: 0
    });

    return totals;
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
        // Error silencioso
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
