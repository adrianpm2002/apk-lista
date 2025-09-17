import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Helper para convertir fecha local a string para consultas de base de datos
const formatDateForQuery = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useCollectorStatistics = () => {
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

  // Función específica para cargar datos de COLECTOR con agrupación jerárquica
  const loadCollectorPlaysData = async (userId, filters = {}) => {
    try {
      if (!userId) {
        console.warn('⚠️ [loadCollectorPlaysData] No userId provided');
        return [];
      }

      console.log('🔍 [loadCollectorPlaysData] Starting data fetch for collector...');

      const { startDate, endDate } = filters;
      
      // Formatear fechas si están disponibles
      let dateFilters = {};
      if (startDate && endDate) {
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
      const pageSize = 1000; // Tamaño de página que coincide con el límite real de Supabase
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('v_estadisticas')
          .select('*')
          .eq('id_colector', userId)
          .eq('estado_horario', 'cerrada')
          .order('fecha_jugada', { ascending: false });

        // Aplicar filtros de fecha si están disponibles
        if (dateFilters.startStr && dateFilters.endStr) {
          query = query
            .gte('fecha_jugada', dateFilters.startStr)
            .lte('fecha_jugada', dateFilters.endStr);
        }

        const { data: playsData, error } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.error('❌ [loadCollectorPlaysData] Error cargando datos:', error);
          return [];
        }
        
        console.log(`🔍 [loadCollectorPlaysData] Page ${page + 1}: ${playsData?.length || 0} records`);
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
          // CORECCIÓN: Si obtienes exactamente 1000 registros (límite de Supabase), puede haber más
          // Solo parar cuando obtengas menos de 1000 registros
          hasMore = playsData.length === 1000; // Continuar si se obtuvieron exactamente 1000 registros
          page++;
        } else {
          hasMore = false;
        }
        
        // Límite de seguridad para evitar bucles infinitos
        if (page > 250) { // Hasta 1.25M registros
          console.warn('⚠️ [loadCollectorPlaysData] Límite de páginas alcanzado (1.25M registros)');
          break;
        }
        
        // Mostrar progreso cada 10 páginas
        if (page % 10 === 0) {
          console.log(`📊 [loadCollectorPlaysData] Progress: ${allPlaysData.length} records loaded`);
        }
      }
      
      console.log(`🔍 [loadCollectorPlaysData] Total records obtained: ${allPlaysData.length}`);

      return allPlaysData || [];
      
    } catch (error) {
      console.error('❌ Error en loadCollectorPlaysData:', error);
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
      console.log('🔍 [loadPlaysData-Collector] === INICIO ===');
      console.log('🔍 [loadPlaysData-Collector] Filters:', filters);
      
      // Prevenir ejecuciones concurrentes
      if (isLoading) {
        console.log('🔄 [loadPlaysData-Collector] Ya está cargando, abortando...');
        return;
      }
      
      setIsLoading(true);
      
      if (!userId) {
        console.log('❌ [loadPlaysData-Collector] No userId disponible');
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
      
      console.log('✅ [loadPlaysData-Collector] Datos agrupados establecidos:', groupedData.length, 'listeros');
      
      return groupedData;
      
    } catch (error) {
      console.error('❌ Error cargando jugadas collector:', error);
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
    console.log('🔄 [useCollectorStatistics] Cargando usuario...');
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('👤 [useCollectorStatistics] Usuario encontrado:', user.id);
          setUserId(user.id);
        }
      } catch (error) {
        console.error('❌ Error cargando usuario:', error);
      }
    };

    loadUserData();
  }, []);

  // Efecto para cargar datos cuando se obtiene el userId
  useEffect(() => {
    console.log('🔄 [useCollectorStatistics] userId cambió:', userId);
    if (userId && !isLoading) {
      console.log('📊 [useCollectorStatistics] Cargando datos iniciales...');
      loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
    }
  }, [userId]);

  // Efecto para recargar cuando cambie el rango de fechas
  useEffect(() => {
    console.log('🔄 [useCollectorStatistics] Rango de fechas cambió');
    if (userId && !isLoading) {
      console.log('📊 [useCollectorStatistics] Recargando por cambio de fechas...');
      const timeoutId = setTimeout(() => {
        loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      }, 300); // Debounce de 300ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [dateRange.startDate, dateRange.endDate]);

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
