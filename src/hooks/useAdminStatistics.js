import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

// Helper para convertir fecha local a string para consultas de base de datos
const formatDateForQuery = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useAdminStatistics = () => {
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

  // Función específica para cargar datos de ADMIN con agrupación jerárquica completa
  const loadAdminPlaysData = async (userId, filters = {}) => {
    try {
      if (!userId) {
        console.warn('⚠️ [loadAdminPlaysData] No userId provided');
        return [];
      }

      console.log('🔍 [loadAdminPlaysData] Starting data fetch for admin...');

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

      // Obtener todos los datos usando paginación optimizada (filtrar por id_banco del admin)
      let allPlaysData = [];
      let page = 0;
      const pageSize = 1000; // Tamaño de página que coincide con el límite real de Supabase
      let hasMore = true;
      
      console.log(`🔍 [loadAdminPlaysData] Starting pagination for userId: ${userId}, pageSize: ${pageSize}`);
      
      while (hasMore) {
        let query = supabase
          .from('v_estadisticas')
          .select('*')
          .eq('id_banco', userId) // ADMIN filtra por su id_banco
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
          console.error('❌ [loadAdminPlaysData] Error cargando datos:', error);
          return [];
        }
        
        console.log(`🔍 [loadAdminPlaysData] User ${userId} - Page ${page + 1}: ${playsData?.length || 0} records`);
        console.log(`🔍 [loadAdminPlaysData] Page ${page + 1} range: ${page * pageSize} to ${(page + 1) * pageSize - 1}`);
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
          // CORRIGIENDO: Si obtienes exactamente 1000 registros (límite de Supabase), continuar
          const shouldContinue = playsData.length === 1000;
          console.log(`🔍 [loadAdminPlaysData] Page ${page + 1}: length=${playsData.length}, shouldContinue=${shouldContinue}`);
          hasMore = shouldContinue;
          page++;
        } else {
          console.log(`🔍 [loadAdminPlaysData] Page ${page + 1}: No records, stopping pagination`);
          hasMore = false;
        }
        
        // Límite de seguridad para evitar bucles infinitos
        if (page > 250) { // Hasta 1.25M registros
          console.warn('⚠️ [loadAdminPlaysData] Límite de páginas alcanzado (1.25M registros)');
          break;
        }
        
        // Mostrar progreso cada 10 páginas
        if (page % 10 === 0) {
          console.log(`📊 [loadAdminPlaysData] User ${userId} - Progress: ${allPlaysData.length} records loaded`);
        }
      }
      
      console.log(`🔍 [loadAdminPlaysData] User ${userId} - Total records obtained: ${allPlaysData.length}`);

      return allPlaysData || [];
      
    } catch (error) {
      console.error('❌ Error en loadAdminPlaysData:', error);
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
      console.log('🔍 [loadPlaysData-Admin] === INICIO ===');
      console.log('🔍 [loadPlaysData-Admin] Filters:', filters);
      
      // Prevenir ejecuciones concurrentes
      if (isLoading) {
        console.log('🔄 [loadPlaysData-Admin] Ya está cargando, abortando...');
        return;
      }
      
      setIsLoading(true);
      
      if (!userId) {
        console.log('❌ [loadPlaysData-Admin] No userId disponible');
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
      
      console.log('✅ [loadPlaysData-Admin] Datos agrupados establecidos:', groupedData.length, 'bancos');
      
      return groupedData;
      
    } catch (error) {
      console.error('❌ Error cargando jugadas admin:', error);
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
    console.log('🔄 [useAdminStatistics] Cargando usuario...');
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('👤 [useAdminStatistics] Usuario encontrado:', user.id);
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
    console.log('🔄 [useAdminStatistics] userId cambió:', userId);
    if (userId && !isLoading) {
      console.log('📊 [useAdminStatistics] Cargando datos iniciales...');
      loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
    }
  }, [userId]);

  // Efecto para recargar cuando cambie el rango de fechas
  useEffect(() => {
    console.log('🔄 [useAdminStatistics] Rango de fechas cambió');
    if (userId && !isLoading) {
      console.log('📊 [useAdminStatistics] Recargando por cambio de fechas...');
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
