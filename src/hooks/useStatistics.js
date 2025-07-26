import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Alert } from 'react-native';

/**
 * Hook de Estadísticas - Sistema Híbrido (Mock + Real Data Ready)
 * 
 * CONFIGURACIÓN PARA DESARROLLO/PRODUCCIÓN:
 * - USE_MOCK_DATA: true = usa datos simulados para desarrollo
 * - USE_MOCK_DATA: false = usa datos reales de la base de datos (cuando esté configurada)
 * 
 * TABLAS REQUERIDAS PARA DATOS REALES:
 * - jugadas: registro de todas las apuestas realizadas
 * - resultados: resultados de sorteos y premios ganados
 * - comisiones: cálculo y registro de comisiones por listero
 * - estadisticas_diarias: resumen diario de operaciones (opcional, se puede calcular)
 */

const USE_MOCK_DATA = true; // ⚠️ CAMBIAR A false CUANDO LAS TABLAS ESTÉN LISTAS

const useStatistics = () => {
  // Estados principales
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estados de datos - Estructura estandarizada para datos mock y reales
  const [dailyStats, setDailyStats] = useState({
    daily_total_bets: 25000,
    daily_total_prizes: 18000,
    daily_listero_commissions: 2500,
    daily_plays_count: 150,
    daily_net_profit: 4500
  });
  
  const [trendData, setTrendData] = useState([
    { date: '2025-07-16', total_bets: 20000, net_profit: 3000 },
    { date: '2025-07-17', total_bets: 22000, net_profit: 3500 },
    { date: '2025-07-18', total_bets: 25000, net_profit: 4000 },
    { date: '2025-07-19', total_bets: 23000, net_profit: 3800 },
    { date: '2025-07-20', total_bets: 27000, net_profit: 4200 },
    { date: '2025-07-21', total_bets: 24000, net_profit: 3900 },
    { date: '2025-07-22', total_bets: 25000, net_profit: 4500 }
  ]);
  
  const [lotteryStats, setLotteryStats] = useState([
    { name: 'Lotería Nacional', total_bets: 12000, total_volume: 12000 },
    { name: 'Loteka', total_bets: 8000, total_volume: 8000 },
    { name: 'La Primera', total_bets: 5000, total_volume: 5000 }
  ]);
  
  const [scheduleStats, setScheduleStats] = useState([
    { 
      schedule_name: 'Matutino', 
      total_plays: 50, 
      total_amount: 8000, 
      total_commission: 800, 
      net_profit: 1200 
    },
    { 
      schedule_name: 'Vespertino', 
      total_plays: 60, 
      total_amount: 10000, 
      total_commission: 1000, 
      net_profit: 1500 
    },
    { 
      schedule_name: 'Nocturno', 
      total_plays: 40, 
      total_amount: 7000, 
      total_commission: 700, 
      net_profit: 1800 
    }
  ]);

  // Estados de filtros
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 días atrás
    endDate: new Date()
  });
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  // ===================================================
  // FUNCIONES DE DATOS MOCK (PARA DESARROLLO)
  // ===================================================

  const loadMockDailyStats = async () => {
    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Generar datos mock con variación realista
    const baseStats = {
      daily_total_bets: 25000 + Math.random() * 10000,
      daily_total_prizes: 18000 + Math.random() * 5000,
      daily_listero_commissions: 2500 + Math.random() * 1000,
      daily_plays_count: 150 + Math.floor(Math.random() * 100),
      daily_net_profit: 4500 + Math.random() * 2000
    };
    
    setDailyStats(baseStats);
    return baseStats;
  };

  const loadMockTrendData = async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Generar tendencia de los últimos 7 días
    const trends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      trends.push({
        date: date.toISOString().split('T')[0],
        total_bets: 20000 + Math.random() * 15000,
        net_profit: 3000 + Math.random() * 3000,
        total_prizes: 15000 + Math.random() * 8000,
        commissions: 2000 + Math.random() * 1500
      });
    }
    
    setTrendData(trends);
    return trends;
  };

  const loadMockLotteryStats = async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Obtener loterías reales y generar estadísticas mock
    try {
      const { data: lotteries } = await supabase
        .from('loteria')
        .select('*');

      const stats = lotteries?.map(lottery => ({
        id: lottery.id,
        name: lottery.name,
        total_bets: 5000 + Math.random() * 15000,
        total_volume: 5000 + Math.random() * 15000,
        total_plays: 30 + Math.floor(Math.random() * 100),
        avg_bet_amount: 100 + Math.random() * 200,
        value: 5000 + Math.random() * 15000
      })) || [
        { name: 'Lotería Nacional', total_bets: 12000, total_volume: 12000, value: 12000 },
        { name: 'Loteka', total_bets: 8000, total_volume: 8000, value: 8000 },
        { name: 'La Primera', total_bets: 5000, total_volume: 5000, value: 5000 }
      ];

      setLotteryStats(stats);
      return stats;
    } catch (error) {
      const mockStats = [
        { name: 'Lotería Nacional', total_bets: 12000, total_volume: 12000, value: 12000 },
        { name: 'Loteka', total_bets: 8000, total_volume: 8000, value: 8000 },
        { name: 'La Primera', total_bets: 5000, total_volume: 5000, value: 5000 }
      ];
      setLotteryStats(mockStats);
      return mockStats;
    }
  };

  const loadMockScheduleStats = async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Obtener horarios reales y generar estadísticas mock
    try {
      const { data: schedules } = await supabase
        .from('horario')
        .select('*');

      const stats = schedules?.map(schedule => ({
        id: schedule.id,
        schedule_name: schedule.name,
        total_plays: 30 + Math.floor(Math.random() * 80),
        total_amount: 5000 + Math.random() * 12000,
        total_commission: 500 + Math.random() * 1200,
        net_profit: 1000 + Math.random() * 3000,
        avg_play_amount: 80 + Math.random() * 150,
        value: 5000 + Math.random() * 12000
      })) || [
        { schedule_name: 'Matutino', total_plays: 50, total_amount: 8000, value: 8000 },
        { schedule_name: 'Vespertino', total_plays: 60, total_amount: 10000, value: 10000 },
        { schedule_name: 'Nocturno', total_plays: 40, total_amount: 7000, value: 7000 }
      ];

      setScheduleStats(stats);
      return stats;
    } catch (error) {
      const mockStats = [
        { schedule_name: 'Matutino', total_plays: 50, total_amount: 8000, value: 8000 },
        { schedule_name: 'Vespertino', total_plays: 60, total_amount: 10000, value: 10000 },
        { schedule_name: 'Nocturno', total_plays: 40, total_amount: 7000, value: 7000 }
      ];
      setScheduleStats(mockStats);
      return mockStats;
    }
  };

  // ===================================================
  // FUNCIONES DE DATOS REALES (PARA PRODUCCIÓN)
  // ===================================================

  const loadRealDailyStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 🔮 CONSULTA SQL PARA ESTADÍSTICAS DIARIAS REALES
      // Esta consulta se ejecutará cuando las tablas estén configuradas
      /*
      const { data: dailyData, error } = await supabase
        .from('jugadas')
        .select(`
          *,
          loteria:loteria_id(name),
          horario:horario_id(name),
          resultados(premio_ganado)
        `)
        .gte('fecha_creacion', today)
        .lt('fecha_creacion', `${today}T23:59:59`);

      if (error) throw error;

      // Calcular estadísticas agregadas
      const totalBets = dailyData.reduce((sum, jugada) => sum + jugada.monto_apostado, 0);
      const totalPrizes = dailyData.reduce((sum, jugada) => sum + (jugada.resultados?.premio_ganado || 0), 0);
      const totalCommissions = dailyData.reduce((sum, jugada) => sum + jugada.comision_listero, 0);
      const netProfit = totalBets - totalPrizes - totalCommissions;

      const realStats = {
        daily_total_bets: totalBets,
        daily_total_prizes: totalPrizes,
        daily_listero_commissions: totalCommissions,
        daily_plays_count: dailyData.length,
        daily_net_profit: netProfit
      };

      setDailyStats(realStats);
      return realStats;
      */
      
      // Por ahora, usar datos mock hasta que las tablas estén listas
      return await loadMockDailyStats();
      
    } catch (error) {
      console.error('Error cargando estadísticas diarias reales:', error);
      // Fallback a datos mock en caso de error
      return await loadMockDailyStats();
    }
  };

  const loadRealTrendData = async (startDate, endDate) => {
    try {
      // 🔮 CONSULTA SQL PARA TENDENCIAS REALES
      /*
      const { data: trendData, error } = await supabase
        .from('jugadas')
        .select(`
          fecha_creacion,
          monto_apostado,
          comision_listero,
          resultados(premio_ganado)
        `)
        .gte('fecha_creacion', startDate.toISOString())
        .lte('fecha_creacion', endDate.toISOString())
        .order('fecha_creacion', { ascending: true });

      if (error) throw error;

      // Agrupar por fecha y calcular métricas
      const groupedByDate = trendData.reduce((acc, jugada) => {
        const date = jugada.fecha_creacion.split('T')[0];
        if (!acc[date]) {
          acc[date] = {
            date,
            total_bets: 0,
            total_prizes: 0,
            total_commissions: 0,
            net_profit: 0
          };
        }
        
        acc[date].total_bets += jugada.monto_apostado;
        acc[date].total_prizes += jugada.resultados?.premio_ganado || 0;
        acc[date].total_commissions += jugada.comision_listero;
        acc[date].net_profit = acc[date].total_bets - acc[date].total_prizes - acc[date].total_commissions;
        
        return acc;
      }, {});

      const trends = Object.values(groupedByDate);
      setTrendData(trends);
      return trends;
      */
      
      // Por ahora, usar datos mock
      return await loadMockTrendData();
      
    } catch (error) {
      console.error('Error cargando tendencias reales:', error);
      return await loadMockTrendData();
    }
  };

  const loadRealLotteryStats = async () => {
    try {
      // 🔮 CONSULTA SQL PARA ESTADÍSTICAS POR LOTERÍA REALES
      /*
      const { data: lotteryData, error } = await supabase
        .from('jugadas')
        .select(`
          monto_apostado,
          comision_listero,
          loteria:loteria_id(id, name),
          resultados(premio_ganado)
        `);

      if (error) throw error;

      // Agrupar por lotería
      const groupedByLottery = lotteryData.reduce((acc, jugada) => {
        const lotteryId = jugada.loteria.id;
        const lotteryName = jugada.loteria.name;
        
        if (!acc[lotteryId]) {
          acc[lotteryId] = {
            id: lotteryId,
            name: lotteryName,
            total_bets: 0,
            total_volume: 0,
            total_plays: 0,
            total_prizes: 0,
            value: 0
          };
        }
        
        acc[lotteryId].total_bets += jugada.monto_apostado;
        acc[lotteryId].total_volume += jugada.monto_apostado;
        acc[lotteryId].total_plays += 1;
        acc[lotteryId].total_prizes += jugada.resultados?.premio_ganado || 0;
        acc[lotteryId].value += jugada.monto_apostado;
        
        return acc;
      }, {});

      const stats = Object.values(groupedByLottery);
      setLotteryStats(stats);
      return stats;
      */
      
      // Por ahora, usar datos mock
      return await loadMockLotteryStats();
      
    } catch (error) {
      console.error('Error cargando estadísticas de lotería reales:', error);
      return await loadMockLotteryStats();
    }
  };

  const loadRealScheduleStats = async () => {
    try {
      // 🔮 CONSULTA SQL PARA ESTADÍSTICAS POR HORARIO REALES
      /*
      const { data: scheduleData, error } = await supabase
        .from('jugadas')
        .select(`
          monto_apostado,
          comision_listero,
          horario:horario_id(id, name),
          resultados(premio_ganado)
        `);

      if (error) throw error;

      // Agrupar por horario
      const groupedBySchedule = scheduleData.reduce((acc, jugada) => {
        const scheduleId = jugada.horario.id;
        const scheduleName = jugada.horario.name;
        
        if (!acc[scheduleId]) {
          acc[scheduleId] = {
            id: scheduleId,
            schedule_name: scheduleName,
            total_plays: 0,
            total_amount: 0,
            total_commission: 0,
            total_prizes: 0,
            net_profit: 0,
            value: 0
          };
        }
        
        acc[scheduleId].total_plays += 1;
        acc[scheduleId].total_amount += jugada.monto_apostado;
        acc[scheduleId].total_commission += jugada.comision_listero;
        acc[scheduleId].total_prizes += jugada.resultados?.premio_ganado || 0;
        acc[scheduleId].value += jugada.monto_apostado;
        
        return acc;
      }, {});

      // Calcular ganancia neta
      Object.values(groupedBySchedule).forEach(schedule => {
        schedule.net_profit = schedule.total_amount - schedule.total_prizes - schedule.total_commission;
      });

      const stats = Object.values(groupedBySchedule);
      setScheduleStats(stats);
      return stats;
      */
      
      // Por ahora, usar datos mock
      return await loadMockScheduleStats();
      
    } catch (error) {
      console.error('Error cargando estadísticas de horario reales:', error);
      return await loadMockScheduleStats();
    }
  };

  // ===================================================
  // FUNCIONES PRINCIPALES (HÍBRIDAS - MOCK/REAL)
  // ===================================================

  // Cargar estadísticas diarias - decide automáticamente entre mock y real
  const loadDailyStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (USE_MOCK_DATA) {
        return await loadMockDailyStats();
      } else {
        return await loadRealDailyStats();
      }
      
    } catch (error) {
      console.error('Error cargando estadísticas diarias:', error);
      setError(error);
      // Siempre hacer fallback a datos mock en caso de error
      return await loadMockDailyStats();
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar estadísticas de período
  const loadPeriodStats = async (startDate, endDate) => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (USE_MOCK_DATA) {
        // Para datos mock, simular cálculos de período
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const mockStats = {
          period_total_bets: 25000 * days + Math.random() * 10000,
          period_total_prizes: 18000 * days + Math.random() * 5000,
          period_listero_commissions: 2500 * days + Math.random() * 1000,
          period_plays_count: 150 * days + Math.floor(Math.random() * 100),
          period_net_profit: 4500 * days + Math.random() * 2000
        };
        return mockStats;
      } else {
        // 🔮 CONSULTA REAL PARA PERÍODO ESPECÍFICO
        /*
        const { data: periodData, error } = await supabase
          .from('jugadas')
          .select(`
            monto_apostado,
            comision_listero,
            resultados(premio_ganado)
          `)
          .gte('fecha_creacion', startDate.toISOString())
          .lte('fecha_creacion', endDate.toISOString());

        if (error) throw error;

        const totalBets = periodData.reduce((sum, jugada) => sum + jugada.monto_apostado, 0);
        const totalPrizes = periodData.reduce((sum, jugada) => sum + (jugada.resultados?.premio_ganado || 0), 0);
        const totalCommissions = periodData.reduce((sum, jugada) => sum + jugada.comision_listero, 0);

        return {
          period_total_bets: totalBets,
          period_total_prizes: totalPrizes,
          period_listero_commissions: totalCommissions,
          period_plays_count: periodData.length,
          period_net_profit: totalBets - totalPrizes - totalCommissions
        };
        */
        
        // Fallback temporal a mock
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        return {
          period_total_bets: 25000 * days,
          period_total_prizes: 18000 * days,
          period_listero_commissions: 2500 * days,
          period_plays_count: 150 * days,
          period_net_profit: 4500 * days
        };
      }
      
    } catch (error) {
      console.error('Error cargando estadísticas de período:', error);
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar datos de tendencia
  const loadTrendData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (USE_MOCK_DATA) {
        return await loadMockTrendData();
      } else {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date();
        return await loadRealTrendData(startDate, endDate);
      }
      
    } catch (error) {
      console.error('Error cargando tendencia:', error);
      setError(error);
      return await loadMockTrendData();
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar estadísticas por lotería
  const loadLotteryStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (USE_MOCK_DATA) {
        return await loadMockLotteryStats();
      } else {
        return await loadRealLotteryStats();
      }
      
    } catch (error) {
      console.error('Error cargando estadísticas de lotería:', error);
      setError(error);
      return await loadMockLotteryStats();
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar estadísticas por horario
  const loadScheduleStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (USE_MOCK_DATA) {
        return await loadMockScheduleStats();
      } else {
        return await loadRealScheduleStats();
      }
      
    } catch (error) {
      console.error('Error cargando estadísticas de horario:', error);
      setError(error);
      return await loadMockScheduleStats();
    } finally {
      setIsLoading(false);
    }
  };

  // ===================================================
  // DOCUMENTACIÓN DE IMPLEMENTACIÓN FUTURA
  // ===================================================

  /**
   * 🔮 ESQUEMA DE BASE DE DATOS REQUERIDO PARA DATOS REALES
   * 
   * Tabla: jugadas
   * - id (uuid, pk)
   * - fecha_creacion (timestamp)
   * - loteria_id (uuid, fk -> loteria.id)
   * - horario_id (uuid, fk -> horario.id)
   * - listero_id (uuid, fk -> profiles.id)
   * - numeros_apostados (text/json)
   * - monto_apostado (decimal)
   * - comision_listero (decimal)
   * - estado (enum: 'pendiente', 'ganada', 'perdida')
   * 
   * Tabla: resultados
   * - id (uuid, pk)
   * - jugada_id (uuid, fk -> jugadas.id)
   * - fecha_sorteo (timestamp)
   * - numeros_ganadores (text/json)
   * - premio_ganado (decimal)
   * - es_ganadora (boolean)
   * 
   * Tabla: comisiones (opcional)
   * - id (uuid, pk)
   * - listero_id (uuid, fk -> profiles.id)
   * - fecha (date)
   * - total_comisiones (decimal)
   * - total_ventas (decimal)
   * - porcentaje_comision (decimal)
   * 
   * INSTRUCCIONES PARA ACTIVAR DATOS REALES:
   * 1. Crear las tablas mencionadas arriba
   * 2. Cambiar USE_MOCK_DATA = false en la línea 19
   * 3. Descomentar las consultas SQL marcadas con 🔮
   * 4. Probar que las consultas funcionen correctamente
   * 5. Las funciones automáticamente cambiarán a datos reales
   */

  // ===================================================
  // FUNCIONES DE CONFIGURACIÓN Y UTILIDAD
  // ===================================================

  // Función para cambiar entre modo mock y real (para desarrollo)
  const toggleDataMode = () => {
    // Esta función permitirá cambiar dinámicamente en desarrollo
    // En producción, esto se controlará por la variable USE_MOCK_DATA
  };

  // Verificar si las tablas reales están disponibles
  const checkRealDataAvailability = async () => {
    try {
      // Verificar si existe la tabla 'jugadas'
      const { data, error } = await supabase
        .from('jugadas')
        .select('id')
        .limit(1);
      
      if (error && error.code === '42P01') {
        // Tabla no existe
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  };

  // Obtener listas reales para filtros
  const getLotteryList = async () => {
    try {
      const { data: lotteries, error } = await supabase
        .from('loteria')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return lotteries || [];
    } catch (error) {
      console.error('Error obteniendo lista de loterías:', error);
      return [
        { id: 1, name: 'Lotería Nacional' },
        { id: 2, name: 'Loteka' },
        { id: 3, name: 'La Primera' }
      ];
    }
  };

  const getScheduleList = async () => {
    try {
      const { data: schedules, error } = await supabase
        .from('horario')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return schedules || [];
    } catch (error) {
      console.error('Error obteniendo lista de horarios:', error);
      return [
        { id: 1, name: 'Matutino' },
        { id: 2, name: 'Vespertino' },
        { id: 3, name: 'Nocturno' }
      ];
    }
  };

  // ===================================================
  // FUNCIONES PRINCIPALES DE CARGA
  // ===================================================

  // Cargar todas las estadísticas
  const loadAllStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await Promise.all([
        loadDailyStats(),
        loadTrendData(),
        loadLotteryStats(),
        loadScheduleStats()
      ]);
      
    } catch (error) {
      console.error('❌ Error cargando todas las estadísticas:', error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refrescar todas las estadísticas
  const refreshAllStats = async () => {
    await loadAllStats();
  };

  // ===================================================
  // FUNCIONES DE UTILIDAD Y CÁLCULOS
  // ===================================================

  // Comparar períodos
  const comparePeriods = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  // Calcular cambio porcentual
  const calculatePercentageChange = (current, previous) => {
    return comparePeriods(current, previous);
  };

  // Formatear números para display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('es-DO').format(num);
  };

  // ===================================================
  // FUNCIONES DE FILTROS
  // ===================================================

  // Aplicar filtros
  const applyFilters = async (filters) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Actualizar estados de filtros
      if (filters.startDate) setDateRange(prev => ({ ...prev, startDate: filters.startDate }));
      if (filters.endDate) setDateRange(prev => ({ ...prev, endDate: filters.endDate }));
      if (filters.lotteryId) setSelectedLottery(filters.lotteryId);
      if (filters.scheduleId) setSelectedSchedule(filters.scheduleId);
      
      // Recargar datos con filtros aplicados
      if (USE_MOCK_DATA) {
        // Para datos mock, simular filtrado
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadAllStats();
      } else {
        // Para datos reales, aplicar filtros en las consultas
        // 🔮 Las consultas reales usarán estos filtros en WHERE clauses
        await loadAllStats();
      }
      
    } catch (error) {
      console.error('❌ Error aplicando filtros:', error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Resetear filtros
  const resetFilters = () => {
    setSelectedLottery(null);
    setSelectedSchedule(null);
    setDateRange({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    });
    loadAllStats();
  };

  // ===================================================
  // FUNCIONES DE EXPORTACIÓN
  // ===================================================

  // Exportar datos
  const exportToCSV = async (format = 'csv') => {
    try {
      // Simular proceso de exportación
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // En una implementación real, aquí se generaría el archivo
      // con los datos actuales del hook
      const exportData = {
        dailyStats,
        trendData,
        lotteryStats,
        scheduleStats,
        filters: {
          dateRange,
          selectedLottery,
          selectedSchedule
        },
        exportDate: new Date().toISOString(),
        dataMode: USE_MOCK_DATA ? 'MOCK' : 'REAL'
      };
      
      return true;
      
    } catch (error) {
      console.error('❌ Error exportando datos:', error);
      return false;
    }
  };

  // ===================================================
  // EFECTOS Y INICIALIZACIÓN
  // ===================================================

  // Efecto para cargar listas al montar el componente
  useEffect(() => {
    const initializeData = async () => {
      
      if (!USE_MOCK_DATA) {
        // Verificar disponibilidad de datos reales
        const isRealDataAvailable = await checkRealDataAvailability();
      }
      
      // Cargar datos iniciales
      await loadAllStats();
    };

    initializeData();
  }, []);

  // ===================================================
  // FORMATEAR DATOS PARA LA PANTALLA
  // ===================================================

  // Datos KPI formateados
  const kpiData = dailyStats ? [
    {
      title: 'Apuestas de Hoy',
      value: dailyStats.daily_total_bets || 0,
      change: 5.2, // En datos reales, esto se calcularía comparando con el día anterior
      trend: 'up',
      icon: '🎯',
      formattedValue: formatCurrency(dailyStats.daily_total_bets || 0)
    },
    {
      title: 'Comisiones',
      value: dailyStats.daily_listero_commissions || 0,
      change: 3.8,
      trend: 'up',
      icon: '💰',
      formattedValue: formatCurrency(dailyStats.daily_listero_commissions || 0)
    },
    {
      title: 'Ganancia Neta',
      value: (dailyStats.daily_total_bets || 0) - (dailyStats.daily_total_prizes || 0),
      change: 2.1,
      trend: 'up',
      icon: '📈',
      formattedValue: formatCurrency((dailyStats.daily_total_bets || 0) - (dailyStats.daily_total_prizes || 0))
    },
    {
      title: 'Jugadas',
      value: dailyStats.daily_plays_count || 0,
      change: 4.5,
      trend: 'up',
      icon: '🎲',
      formattedValue: formatNumber(dailyStats.daily_plays_count || 0)
    }
  ] : [];

  // Datos de gráficos formateados
  const chartData = {
    trends: trendData || [],
    byLottery: lotteryStats || [],
    distribution: scheduleStats || [],
    commissions: trendData?.map(item => ({
      ...item,
      commissions: item.commissions || item.total_bets * 0.1 // 10% estimado para mock
    })) || []
  };

  // Datos de tablas formateados
  const tableData = {
    plays: [], // Se llenaría con datos detallados de jugadas individuales
    bySchedule: scheduleStats || []
  };

  // Listas para filtros (combinando datos reales y mock)
  const [lotteries, setLotteries] = useState([
    { id: 1, name: 'Lotería Nacional' },
    { id: 2, name: 'Loteka' },
    { id: 3, name: 'La Primera' }
  ]);

  const [schedules, setSchedules] = useState([
    { id: 1, name: 'Matutino' },
    { id: 2, name: 'Vespertino' },
    { id: 3, name: 'Nocturno' }
  ]);

  // Cargar listas reales
  useEffect(() => {
    const loadFilterLists = async () => {
      const [realLotteries, realSchedules] = await Promise.all([
        getLotteryList(),
        getScheduleList()
      ]);
      
      setLotteries(realLotteries);
      setSchedules(realSchedules);
    };

    loadFilterLists();
  }, []);

  // ===================================================
  // RETURN DEL HOOK
  // ===================================================

  return {
    // ===== DATOS FORMATEADOS PARA LA UI =====
    kpiData,
    chartData,
    tableData,
    lotteries,
    schedules,
    
    // ===== ESTADOS DE CONTROL =====
    loading: isLoading,
    error,
    
    // ===== DATOS ORIGINALES =====
    dailyStats,
    trendData,
    lotteryStats,
    scheduleStats,
    
    // ===== ESTADOS DE FILTROS =====
    dateRange,
    selectedLottery,
    selectedSchedule,
    
    // ===== FUNCIONES DE CARGA =====
    loadAllStats,
    refreshAllStats,
    loadDailyStats,
    loadPeriodStats,
    loadTrendData,
    loadLotteryStats,
    loadScheduleStats,
    
    // ===== FUNCIONES DE UTILIDAD =====
    comparePeriods,
    calculatePercentageChange,
    formatCurrency,
    formatNumber,
    
    // ===== FUNCIONES DE FILTROS =====
    applyFilters,
    resetFilters,
    
    // ===== FUNCIONES DE EXPORTACIÓN =====
    exportToCSV,
    
    // ===== FUNCIONES DE CONFIGURACIÓN =====
    toggleDataMode,
    checkRealDataAvailability,
    
    // ===== SETTERS PARA FILTROS =====
    setDateRange,
    setSelectedLottery,
    setSelectedSchedule,
    
    // ===== INFORMACIÓN DEL SISTEMA =====
    isUsingMockData: USE_MOCK_DATA,
    clearData: resetFilters // Alias para compatibilidad
  };
};

export default useStatistics;
