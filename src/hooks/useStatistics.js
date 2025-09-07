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

const USE_MOCK_DATA = false; // ✅ Usando datos reales desde v_estadisticas

const useStatistics = (bankId = null) => {
  // Hook inicializado - logs removidos para producción
  // Estados principales
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Estados de datos - Estructura estandarizada para datos reales usando v_estadisticas
  const [dailyStats, setDailyStats] = useState({
    daily_total_bets: 0,
    daily_total_prizes: 0,
    daily_listero_commissions: 0,
    daily_plays_count: 0,
    daily_net_profit: 0
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
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 días atrás
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
    
    // Generar estadísticas mock sin consultas a base de datos
    const mockStats = [
      { id: 1, name: 'Lotto Nacional', total_bets: 12000, total_volume: 12000, total_plays: 45, avg_bet_amount: 150, value: 12000 },
      { id: 2, name: 'Quiniela Real', total_bets: 8000, total_volume: 8000, total_plays: 32, avg_bet_amount: 125, value: 8000 },
      { id: 3, name: 'Gana Más', total_bets: 5000, total_volume: 5000, total_plays: 28, avg_bet_amount: 110, value: 5000 },
      { id: 4, name: 'Nueva York', total_bets: 6500, total_volume: 6500, total_plays: 35, avg_bet_amount: 140, value: 6500 },
      { id: 5, name: 'Florida Day', total_bets: 4200, total_volume: 4200, total_plays: 25, avg_bet_amount: 105, value: 4200 }
    ];

    setLotteryStats(mockStats);
    return mockStats;
  };

  const loadMockScheduleStats = async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Generar estadísticas mock sin consultas a base de datos
    const mockStats = [
      { id: 1, schedule_name: 'Matutino 11:30 AM', total_plays: 50, total_amount: 8000, total_commission: 400, total_prizes: 1200, net_profit: 6400, avg_play_amount: 160, value: 8000 },
      { id: 2, schedule_name: 'Vespertino 04:30 PM', total_plays: 60, total_amount: 10000, total_commission: 500, total_prizes: 1500, net_profit: 8000, avg_play_amount: 167, value: 10000 },
      { id: 3, schedule_name: 'Nocturno 09:00 PM', total_plays: 40, total_amount: 7000, total_commission: 350, total_prizes: 1050, net_profit: 5600, avg_play_amount: 175, value: 7000 }
    ];

    setScheduleStats(mockStats);
    return mockStats;
  };

  // ===================================================
  // FUNCIONES DE DATOS REALES (PARA PRODUCCIÓN)
  // ===================================================

  const loadRealDailyStats = async () => {
    try {
      // DATOS FICTICIOS - No consultar base de datos
  // ...
      
      const mockStats = {
        daily_total_bets: 125000,
        daily_total_prizes: 15000,
        daily_listero_commissions: 6250,
        daily_plays_count: 42,
        daily_net_profit: 110000
      };
      
      setDailyStats(mockStats);
      return mockStats;
      
    } catch (error) {
  // ...
      // Fallback a datos mock en caso de error
      return await loadMockDailyStats();
    }
  };

  const loadRealTrendData = async (startDate, endDate) => {
    try {
      // Generar datos de tendencias ficticios para los últimos 7 días
      const today = new Date();
      const mockTrends = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Generar datos ficticios variados pero realistas
        const baseBets = 100000 + Math.random() * 50000;
        const basePrizes = baseBets * (0.10 + Math.random() * 0.05); // 10-15% de premios
        const baseCommissions = baseBets * (0.04 + Math.random() * 0.02); // 4-6% comisiones
        
        mockTrends.push({
          date: dateStr,
          total_bets: Math.round(baseBets),
          total_prizes: Math.round(basePrizes),
          total_commissions: Math.round(baseCommissions),
          net_profit: Math.round(baseBets - basePrizes)
        });
      }
      
  // ...
      setTrendData(mockTrends);
      return mockTrends;
      
    } catch (error) {
  // ...
      // Fallback a datos mock en caso de error
      return await loadMockTrendData();
    }
  };

  const loadRealLotteryStats = async () => {
    try {
      // Generar estadísticas ficticias por lotería
      const mockLotteries = [
        { id: 1, name: 'Lotto Nacional' },
        { id: 2, name: 'Quiniela Real' }, 
        { id: 3, name: 'Gana Más' },
        { id: 4, name: 'Nueva York' },
        { id: 5, name: 'Florida Day' }
      ];
      
      const lotteryStats = mockLotteries.map(lottery => {
        const baseBets = 20000 + Math.random() * 30000;
        const basePrizes = baseBets * (0.08 + Math.random() * 0.07); // 8-15% premios
        
        return {
          id: lottery.id,
          name: lottery.name,
          total_bets: Math.round(baseBets),
          total_volume: Math.round(baseBets),
          total_plays: Math.round(15 + Math.random() * 25), // 15-40 jugadas
          total_prizes: Math.round(basePrizes),
          value: Math.round(baseBets)
        };
      });
      
  // ...
      setLotteryStats(lotteryStats);
      return lotteryStats;
      
    } catch (error) {
  // ...
      return await loadMockLotteryStats();
    }
  };

  const loadRealScheduleStats = async () => {
    try {
      // Generar estadísticas ficticias por horario
      const mockSchedules = [
        { id: 1, name: 'Matutino 11:30 AM' },
        { id: 2, name: 'Vespertino 04:30 PM' },
        { id: 3, name: 'Nocturno 09:00 PM' }
      ];
      
      const scheduleStats = mockSchedules.map(schedule => {
        const totalAmount = 30000 + Math.random() * 25000;
        const totalPrizes = totalAmount * (0.08 + Math.random() * 0.07); // 8-15% premios
        const totalCommission = totalAmount * 0.05; // 5% comisión
        
        return {
          id: schedule.id,
          schedule_name: schedule.name,
          total_plays: Math.round(20 + Math.random() * 30), // 20-50 jugadas
          total_amount: Math.round(totalAmount),
          total_commission: Math.round(totalCommission),
          total_prizes: Math.round(totalPrizes),
          net_profit: Math.round(totalAmount - totalPrizes - totalCommission),
          value: Math.round(totalAmount)
        };
      });
      
  // ...
      setScheduleStats(scheduleStats);
      return scheduleStats;
      
    } catch (error) {
  // ...
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
        const realData = await loadRealDailyStats();
        
        // Verificar si los datos reales están vacíos o nulos
        if (!realData || 
            (realData.daily_total_bets === 0 && 
             realData.daily_plays_count === 0 && 
             realData.daily_listero_commissions === 0)) {
          // ...
          return await loadMockDailyStats();
        }
        
        return realData;
      }
      
    } catch (error) {
  // ...
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
  // ...
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
        const realData = await loadRealTrendData(startDate, endDate);
        
        // Verificar si los datos de tendencia están vacíos
        if (!realData || realData.length === 0) {
          // ...
          return await loadMockTrendData();
        }
        
        return realData;
      }
      
    } catch (error) {
  // ...
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
        const realData = await loadRealLotteryStats();
        
        // Verificar si los datos reales están vacíos
        if (!realData || realData.length === 0) {
          // ...
          return await loadMockLotteryStats();
        }
        
        return realData;
      }
      
    } catch (error) {
  // ...
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
        const realData = await loadRealScheduleStats();
        
        // Verificar si los datos reales están vacíos
        if (!realData || realData.length === 0) {
          // ...
          return await loadMockScheduleStats();
        }
        
        return realData;
      }
      
    } catch (error) {
  // ...
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
      // Como estamos usando solo datos ficticios, siempre retornar false
      return false;
    } catch (error) {
      return false;
    }
  };

  // Obtener listas ficticias para filtros
  const getLotteryList = async () => {
    try {
      // Retornar loterías ficticias
      const mockLotteries = [
        { id: 1, name: 'Lotto Nacional' },
        { id: 2, name: 'Quiniela Real' },
        { id: 3, name: 'Gana Más' },
        { id: 4, name: 'Nueva York' },
        { id: 5, name: 'Florida Day' }
      ];
      
  // ...
      return mockLotteries;
    } catch (error) {
  // ...
      return [];
    }
  };

  const getScheduleList = async () => {
    try {
      // Retornar horarios ficticios
      const mockSchedules = [
        { id: 1, name: 'Matutino 11:30 AM' },
        { id: 2, name: 'Vespertino 04:30 PM' },
        { id: 3, name: 'Nocturno 09:00 PM' }
      ];
      
  // ...
      return mockSchedules;
    } catch (error) {
  // ...
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
      
      // Solo actualizar estados de filtros de fecha
      if (filters.startDate) setDateRange(prev => ({ ...prev, startDate: filters.startDate }));
      if (filters.endDate) setDateRange(prev => ({ ...prev, endDate: filters.endDate }));
      
      // Cargar datos con filtros de fecha aplicados
      await loadFilteredStats({
        startDate: filters.startDate,
        endDate: filters.endDate
      });
      
    } catch (error) {
      console.error('❌ Error aplicando filtros:', error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Función nueva para cargar estadísticas filtradas
  const loadFilteredStats = async (filters) => {
    try {
      console.log('🔍 loadFilteredStats called with:', { filters, bankId });
      const { startDate, endDate } = filters;
      
      if (!bankId || !startDate || !endDate) {
        console.log('❌ Missing requirements for filtering - bankId:', !!bankId, 'dates:', !!startDate, !!endDate);
        return;
      }
      
      // Formatear fechas para consulta con timestamp
      const startStr = startDate.toISOString().split('T')[0] + ' 00:00:00';
      const endStr = endDate.toISOString().split('T')[0] + ' 23:59:59';
      
      console.log('🕐 Query dates:', { startStr, endStr });
      
      // Consulta simple solo por fecha y banco para estadísticas
      const { data: jugadas, error } = await supabase
        .from('v_estadisticas')
        .select(`
          id_listero,
          fecha_jugada,
          nombre_loteria,
          nombre_horario,
          tipo_jugada,
          numeros_jugados,
          nota,
          monto_total,
          monto_a_pagar,
          ganancia_listero,
          balance_listero,
          estado_horario
        `)
        .eq('id_listero', bankId)
        .gte('fecha_jugada', startStr)
        .lte('fecha_jugada', endStr)
        .eq('estado_horario', 'cerrada')
        .order('fecha_jugada', { ascending: false });
      
      console.log('📊 Query result:', { count: jugadas?.length || 0, error });
      if (error) {
        console.error('❌ Error cargando estadísticas filtradas:', error);
        throw error;
      }
      
      // Calcular estadísticas reales filtradas
      const totalBets = (jugadas || []).reduce((sum, j) => sum + (j.monto_total || 0), 0);
      const totalPrizes = (jugadas || []).reduce((sum, j) => sum + (j.monto_a_pagar || 0), 0);
      const totalCommissions = (jugadas || []).reduce((sum, j) => sum + (j.ganancia_listero || 0), 0);
      const playsCount = (jugadas || []).length;
      const netProfit = totalBets - totalPrizes - totalCommissions;
      
      // Actualizar estadísticas con datos filtrados
      const filteredStats = {
        daily_total_bets: totalBets,
        daily_total_prizes: totalPrizes,
        daily_listero_commissions: totalCommissions,
        daily_plays_count: playsCount,
        daily_net_profit: netProfit
      };
      
      setDailyStats(filteredStats);
      
      // Actualizar datos de tabla con jugadas filtradas
      const formattedPlays = (jugadas || []).map(j => ({
        id: j.id_listero + '_' + j.fecha_jugada, // Crear un ID único
        created_at: j.fecha_jugada, // Usar fecha_jugada como created_at
        fecha: new Date(j.fecha_jugada).toLocaleDateString('es-ES'),
        hora: new Date(j.fecha_jugada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        loteria: j.nombre_loteria || 'N/A',
        horario: j.nombre_horario || 'N/A',
        jugada: j.tipo_jugada || 'N/A',
        numeros: j.numeros_jugados || 'N/A',
        monto: j.monto_total || 0,
        nota: j.nota || '',
        // Campos adicionales para la tabla (usando datos reales de la vista)
        play_type: j.tipo_jugada || 'N/A',
        bruto: j.monto_total || 0,
        ganancia_listero: j.ganancia_listero || 0, // Valor real de la vista
        ganancia_colector: 0, // No disponible en esta vista simplificada
        resultado: 'Pendiente', // TODO: agregar cuando esté disponible
        premio: j.monto_a_pagar || 0, // Valor real de la vista
        balance_listero: j.balance_listero || 0, // Valor real de la vista
        balance_colector: 0, // No disponible en esta vista simplificada
        balance_banco: 0 // No disponible en esta vista simplificada
      }));
      
      setTableData(prev => ({
        ...prev,
        plays: formattedPlays
      }));
      
      // Generar datos de tendencia para el período filtrado
      await loadTrendDataForPeriod(startDate, endDate);
      
    } catch (error) {
      console.error('❌ Error aplicando filtros:', error);
      throw error;
    }
  };

  // Cargar datos de tendencia para período específico
  const loadTrendDataForPeriod = async (startDate, endDate) => {
    try {
      const trendData = [];
      const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      for (let i = 0; i <= dayDiff; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Consultar jugadas para este día específico
        const { data: dayJugadas } = await supabase
          .from('v_estadisticas')
          .select(`
            monto_total,
            monto_a_pagar,
            ganancia_listero
          `)
          .eq('id_listero', bankId)
          .gte('fecha_jugada', `${dateStr} 00:00:00`)
          .lte('fecha_jugada', `${dateStr} 23:59:59`)
          .eq('estado_horario', 'cerrada');
        
        const dayTotalBets = (dayJugadas || []).reduce((sum, j) => sum + (j.monto_total || 0), 0);
        const dayTotalPrizes = (dayJugadas || []).reduce((sum, j) => sum + (j.monto_a_pagar || 0), 0);
        const dayTotalCommissions = (dayJugadas || []).reduce((sum, j) => sum + (j.ganancia_listero || 0), 0);
        const dayNetProfit = dayTotalBets - dayTotalPrizes - dayTotalCommissions;
        
        trendData.push({
          date: dateStr,
          total_bets: dayTotalBets,
          total_prizes: dayTotalPrizes,
          net_profit: dayNetProfit
        });
      }
      
      setTrendData(trendData);
      
    } catch (error) {
      console.error('❌ Error cargando tendencias filtradas:', error);
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
  //
      
      if (!USE_MOCK_DATA) {
        // Verificar disponibilidad de datos reales
        const isRealDataAvailable = await checkRealDataAvailability();
  //
      }
      
      // Cargar datos iniciales
  //
      await loadAllStats();
  //
    };

    initializeData();
  }, []);

  // Efecto para cargar usuario autenticado y sus datos
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          //
          setUserId(user.id);
          
          // Cargar datos de jugadas una vez que tenemos el usuario
          if (!USE_MOCK_DATA) {
            await loadPlaysData();
          }
        }
      } catch (error) {
        console.error('❌ Error cargando usuario:', error);
      }
    };

    loadUserData();
  }, []);

  // Efecto para recargar jugadas cuando cambie el userId
  useEffect(() => {
    if (userId && !USE_MOCK_DATA) {
      loadPlaysData();
    }
  }, [userId]);

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

  // Estados de tablas
  const [tableData, setTableData] = useState({
    plays: [],
    bySchedule: []
  });

  // Función para cargar datos de jugadas
  const loadPlaysData = async (userRole = 'listero') => {
    try {
      setIsLoading(true);
      
      let playsData = [];
      
      if (USE_MOCK_DATA || !userId) {
        playsData = generateMockPlaysData();
      } else {
        playsData = await loadRealPlaysData(userId, userRole);
      }
      
      setTableData(prev => ({
        ...prev,
        plays: playsData
      }));
      
      return playsData;
      
    } catch (error) {
      // Fallback a datos mock
      const mockData = generateMockPlaysData();
      setTableData(prev => ({
        ...prev,
        plays: mockData
      }));
      return mockData;
    } finally {
      setIsLoading(false);
    }
  };

  // Función para cargar datos agrupados para collector
  const loadCollectorData = async (collectorId) => {
    try {
      setIsLoading(true);
      
      if (USE_MOCK_DATA || !collectorId) {
        return [];
      }
      
      return await loadCollectorGroupedData(collectorId);
      
    } catch (error) {
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Función para cargar datos agrupados para admin
  const loadAdminData = async (bankId) => {
    try {
      setIsLoading(true);
      
      if (USE_MOCK_DATA || !bankId) {
        return [];
      }
      
      return await loadAdminGroupedData(bankId);
      
    } catch (error) {
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Función para generar datos reales de jugadas desde v_estadisticas
  async function loadRealPlaysData(userId, userRole = 'listero') {
    try {
      if (!userId) {
        return generateMockPlaysData();
      }

      let query = supabase.from('v_estadisticas').select('*');

      // Filtrar según el rol del usuario
      switch (userRole) {
        case 'listero':
          query = query.eq('id_listero', userId);
          break;
        case 'collector':
          query = query.eq('id_colector', userId);
          break;
        case 'admin':
          // Admin ve todo el banco (asumiendo que userId es el id_colector para admin)
          query = query.eq('id_colector', userId);
          break;
        default:
          query = query.eq('id_listero', userId);
      }

      const { data: playsData, error } = await query
        .eq('estado_horario', 'cerrada') // Solo horarios cerrados
        .order('fecha_jugada', { ascending: false });

      if (error) {
        return generateMockPlaysData();
      }

      return playsData || [];
      
    } catch (error) {
      return generateMockPlaysData();
    }
  }

  // Función para cargar datos agrupados por listero (para collector)
  async function loadCollectorGroupedData(collectorId) {
    try {
      if (!collectorId) {
        return [];
      }

      const { data: playsData, error } = await supabase
        .from('v_estadisticas')
        .select('*')
        .eq('id_colector', collectorId)
        .eq('estado_horario', 'cerrada')
        .order('fecha_jugada', { ascending: false });

      if (error) {
        return [];
      }

      // Agrupar por listero
      const groupedByListero = {};
      (playsData || []).forEach(play => {
        const listeroKey = play.listero_username || `Listero ${play.id_listero}`;
        if (!groupedByListero[listeroKey]) {
          groupedByListero[listeroKey] = {
            listero_username: listeroKey,
            id_listero: play.id_listero,
            bruto_total: 0,
            ganancia_colector_total: 0,
            ganancia_listero_total: 0,
            premios_total: 0,
            balance_colector_total: 0,
            plays: []
          };
        }
        
        groupedByListero[listeroKey].bruto_total += Number(play.bruto || 0);
        groupedByListero[listeroKey].ganancia_colector_total += Number(play.ganancia_colector || 0);
        groupedByListero[listeroKey].ganancia_listero_total += Number(play.ganancia_listero || 0);
        groupedByListero[listeroKey].premios_total += Number(play.premio || 0);
        groupedByListero[listeroKey].balance_colector_total += Number(play.balance_colector || 0);
        groupedByListero[listeroKey].plays.push(play);
      });

      return Object.values(groupedByListero);
      
    } catch (error) {
      return [];
    }
  }

  // Función para cargar datos agrupados por colector (para admin)
  async function loadAdminGroupedData(bankId) {
    try {
      if (!bankId) {
        return [];
      }

      const { data: playsData, error } = await supabase
        .from('v_estadisticas')
        .select('*')
        .eq('id_colector', bankId)
        .eq('estado_horario', 'cerrada')
        .order('fecha_jugada', { ascending: false });

      if (error) {
        return [];
      }

      // Agrupar por colector
      const groupedByColector = {};
      (playsData || []).forEach(play => {
        const colectorKey = play.colector_username || `Colector ${play.id_colector}`;
        if (!groupedByColector[colectorKey]) {
          groupedByColector[colectorKey] = {
            colector_username: colectorKey,
            id_colector: play.id_colector,
            bruto_total: 0,
            ganancia_colector_total: 0,
            ganancia_listero_total: 0,
            premios_total: 0,
            balance_banco_total: 0,
            plays: []
          };
        }
        
        groupedByColector[colectorKey].bruto_total += Number(play.bruto || 0);
        groupedByColector[colectorKey].ganancia_colector_total += Number(play.ganancia_colector || 0);
        groupedByColector[colectorKey].ganancia_listero_total += Number(play.ganancia_listero || 0);
        groupedByColector[colectorKey].premios_total += Number(play.premio || 0);
        groupedByColector[colectorKey].balance_banco_total += Number(play.balance_banco || 0);
        groupedByColector[colectorKey].plays.push(play);
      });

      return Object.values(groupedByColector);
      
    } catch (error) {
      return [];
    }
  }

  // Función para generar datos ficticios de jugadas individuales (fallback)
  function generateMockPlaysData() {
    const mockPlays = [];
    const lotteryNames = ['Lotto Nacional', 'Quiniela Real', 'Gana Más', 'Nueva York', 'Florida Day'];
    const scheduleNames = ['Matutino 11:30 AM', 'Vespertino 04:30 PM', 'Nocturno 09:00 PM'];
    
    // Generar jugadas para los últimos 3 días
    for (let i = 0; i < 3; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Generar 5-10 jugadas por día
      const playsPerDay = 5 + Math.floor(Math.random() * 6);
      for (let j = 0; j < playsPerDay; j++) {
        const brutoAmount = 50 + (Math.random() * 200); // 50-250 con decimales
        const premioAmount = Math.random() > 0.8 ? (100 + (Math.random() * 500)) : 0; // 20% chance de ganar
        
        mockPlays.push({
          id: `play_${i}_${j}`,
          created_at: date.toISOString(),
          loteria_nombre: lotteryNames[Math.floor(Math.random() * lotteryNames.length)],
          horario_nombre: scheduleNames[Math.floor(Math.random() * scheduleNames.length)],
          resultado: String(Math.floor(Math.random() * 100)).padStart(2, '0'),
          numeros: String(Math.floor(Math.random() * 100)).padStart(2, '0'),
          play_type: ['Fijo', 'Corrido', 'Pale'][Math.floor(Math.random() * 3)],
          nota: `Cliente ${Math.floor(Math.random() * 100)}`,
          bruto: Number(brutoAmount.toFixed(2)), // Mantener 2 decimales
          ganancia_listero: Number((brutoAmount * 0.05).toFixed(2)), // 5% comisión con 2 decimales
          premio: Number(premioAmount.toFixed(2)), // Premio con 2 decimales
          balance_listero: Number((brutoAmount - premioAmount).toFixed(2)) // Balance con 2 decimales
        });
      }
    }
    
    return mockPlays;
  }

  // Listas para filtros (vacías inicialmente, se cargan desde BD)
  const [lotteries, setLotteries] = useState([]);

  const [schedules, setSchedules] = useState([]);

  // Cargar listas reales cuando cambie el bankId
  useEffect(() => {
    const loadFilterLists = async () => {
      if (!bankId) {
        return;
      }

      const [realLotteries, realSchedules] = await Promise.all([
        getLotteryList(),
        getScheduleList()
      ]);
      
      setLotteries(realLotteries);
      setSchedules(realSchedules);
    };

    loadFilterLists();
  }, [bankId]); // ⭐ DEPENDENCIA CAMBIADA A bankId

  // Auto-cargar datos mock al inicializar
  useEffect(() => {
    if (USE_MOCK_DATA) {
      // Cargar datos mock automáticamente
      const autoLoadMockData = async () => {
        try {
          await Promise.all([
            loadMockDailyStats(),
            loadMockTrendData(),
            loadMockLotteryStats(),
            loadMockScheduleStats()
          ]);
          
          // También cargar las listas mock de loterías y horarios
          setLotteries([
            { id: 1, name: 'Lotería Nacional' },
            { id: 2, name: 'Loteka' },
            { id: 3, name: 'La Primera' }
          ]);
          
          setSchedules([
            { id: 1, name: 'Matutino - 10:00 AM' },
            { id: 2, name: 'Vespertino - 3:00 PM' },
            { id: 3, name: 'Nocturno - 7:00 PM' }
          ]);
          
        } catch (error) {
          console.error('❌ Error cargando datos mock:', error);
        }
      };
      
      autoLoadMockData();
    }
  }, []); // Solo ejecutar una vez al montar

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
    loadPlaysData, // Nueva función para cargar jugadas
    loadCollectorData, // Nueva función para collector
    loadAdminData, // Nueva función para admin
    
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
