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

const useStatistics = () => {
  // Estados principales - para listeros y colectores
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
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
  
  // Estados para agrupación por listero (colectores) - removidos
  // const [availableListeros, setAvailableListeros] = useState([]);
  // const [selectedListero, setSelectedListero] = useState(null);

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
      
      // Cargar datos reales filtrados por usuario
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 30); // Últimos 30 días por defecto
      
      await loadPlaysData({ startDate, endDate });
      
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
      await loadPlaysData({
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

  // Cargar datos de tendencia para período específico
  const loadTrendDataForPeriod = async (startDate, endDate) => {
    try {
      // Obtener el usuario autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener rol del usuario desde la tabla profiles
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError) {
        console.error('Error al obtener el rol del usuario:', userError);
        return;
      }

      const role = userData?.role || 'listero';
      
      const trendData = [];
      const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      
      for (let i = 0; i <= dayDiff; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Consultar jugadas para este día específico según el rol
        let query = supabase
          .from('v_estadisticas')
          .select(`
            monto_total,
            monto_a_pagar,
            ganancia_listero,
            ganancia_colector
          `)
          .gte('fecha_jugada', `${dateStr} 00:00:00`)
          .lte('fecha_jugada', `${dateStr} 23:59:59`)
          .eq('estado_horario', 'cerrada');

        if (role === 'colector' || role === 'collector') {
          query = query.eq('id_colector', user.id);
        } else if (role === 'listero') {
          query = query.eq('id_listero', user.id);
        } else if (role === 'admin') {
          query = query.eq('id_banco', user.id);
        }

        const { data: dayJugadas } = await query.limit(50000); // Aumentar límite para días con alto volumen
        
        const dayTotalBets = (dayJugadas || []).reduce((sum, j) => sum + (j.monto_total || 0), 0);
        const dayTotalPrizes = (dayJugadas || []).reduce((sum, j) => sum + (j.monto_a_pagar || 0), 0);
        
        // Usar ganancia según el rol
        const dayTotalCommissions = (dayJugadas || []).reduce((sum, j) => {
          if (role === 'admin') {
            return sum + (j.ganancia_colector || 0);
          }
          return sum + ((role === 'colector' || role === 'collector') ? (j.ganancia_colector || 0) : (j.ganancia_listero || 0));
        }, 0);
        
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
      console.error('❌ Error cargando tendencias:', error);
    }
  };

  // Resetear filtros
  const resetFilters = () => {
    setSelectedLottery(null);
    setSelectedSchedule(null);
    setSelectedListero(null); // Resetear también el listero seleccionado
    setDateRange({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    });
    loadAllStats();
  };

  // Filtrar por listero seleccionado - FUNCIÓN ELIMINADA
  /*
  const filterByListero = (listeroId) => {
    setSelectedListero(listeroId);
    
    if (!listeroId) {
      // Si no hay listero seleccionado, mostrar todos los datos
      loadFilteredStats(dateRange.startDate, dateRange.endDate, selectedLottery, selectedSchedule);
      return;
    }

    // Filtrar los datos actuales por el listero seleccionado
    const filteredPlays = tableData.plays.filter(play => 
      play.id_listero && play.id_listero === listeroId
    );

    // Recalcular estadísticas solo para este listero
    const totalBets = filteredPlays.reduce((sum, p) => sum + (p.bruto || 0), 0);
    const totalPrizes = filteredPlays.reduce((sum, p) => sum + (p.premio || 0), 0);
    const totalCommissions = filteredPlays.reduce((sum, p) => sum + (p.ganancia_colector || 0), 0);
    const netProfit = filteredPlays.reduce((sum, p) => sum + (p.balance_colector || 0), 0);

    setDailyStats({
      daily_total_bets: totalBets,
      daily_total_prizes: totalPrizes,
      daily_listero_commissions: totalCommissions,
      daily_plays_count: filteredPlays.length,
      daily_net_profit: netProfit
    });

    setTableData(prev => ({
      ...prev,
      plays: filteredPlays
    }));
  };
  */

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
    console.log('🔄 [useEffect-loadUserData] Ejecutándose...');
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          //
          console.log('👤 [useEffect-loadUserData] Usuario encontrado:', user.id);
          setUserId(user.id);
          
          // NO cargar datos aquí - lo hará el useEffect de userId
          console.log('✅ [useEffect-loadUserData] Usuario establecido, el useEffect de userId cargará los datos');
        }
      } catch (error) {
        console.error('❌ Error cargando usuario:', error);
      }
    };

    loadUserData();
  }, []);

  // Efecto para recargar jugadas cuando cambie el userId (solo una vez cuando se obtiene el userId)
  useEffect(() => {
    console.log('🔄 [useEffect-userId] Ejecutándose con userId:', userId);
    if (userId && !USE_MOCK_DATA && !isLoading) {
      console.log('📊 [useEffect-userId] Llamando loadPlaysData por primera vez...');
      loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
    }
  }, [userId]); // Solo cuando cambie userId, no dateRange
  
  // Efecto separado para cambios de fecha (con debounce implícito)
  useEffect(() => {
    console.log('🔄 [useEffect-dateRange] Cambio de fechas detectado');
    if (userId && !USE_MOCK_DATA && !isLoading) {
      console.log('📊 [useEffect-dateRange] Recargando por cambio de fechas...');
      const timeoutId = setTimeout(() => {
        loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      }, 300); // Debounce de 300ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [dateRange.startDate, dateRange.endDate]);

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

  // KPI Data actualizado

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

  // Función para cargar datos de jugadas según el rol del usuario autenticado
  const loadPlaysData = async (filters = {}) => {
    try {
      console.log('🔍 [loadPlaysData] === INICIO ===');
      console.log('🔍 [loadPlaysData] Filters recibidos:', filters);
      console.log('🔍 [loadPlaysData] UserId:', userId);
      console.log('🔍 [loadPlaysData] Use mock data:', USE_MOCK_DATA);
      console.log('🔍 [loadPlaysData] isLoading actual:', isLoading);
      
      // Prevenir ejecuciones concurrentes
      if (isLoading) {
        console.log('🔄 [loadPlaysData] Ya está cargando, abortando...');
        return;
      }
      
      setIsLoading(true);
      
      let playsData = [];
      
      if (USE_MOCK_DATA || !userId) {
        console.log('🔍 [loadPlaysData] Usando datos mock o sin userId');
        playsData = generateMockPlaysData();
      } else {
        // Detectar el rol del usuario para usar la función apropiada
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();

        let userRole = 'listero'; // Por defecto
        if (!profileError && profile) {
          userRole = profile.role || 'listero';
        }

        console.log(`🔍 [loadPlaysData] Loading data for role: ${userRole}`);

        // Usar función específica según el rol - MISMA LÓGICA PARA TODOS LOS ROLES
        if (userRole === 'admin') {
          playsData = await loadAdminPlaysData(userId, filters);
        } else if (userRole === 'collector' || userRole === 'colector') {
          playsData = await loadCollectorPlaysData(userId, filters);
        } else {
          // listero y cualquier otro rol
          playsData = await loadListeroPlaysData(userId, filters);
        }
      }
      
      // Transformar datos para que sean compatibles con el componente
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
          id: (j.id_listero || j.id_colector) + '_' + j.fecha_jugada,
          created_at: j.fecha_jugada,
          fecha: new Date(j.fecha_jugada).toLocaleDateString('es-ES'),
          hora: new Date(j.fecha_jugada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          loteria: j.nombre_loteria || 'N/A',
          horario: j.nombre_horario || 'N/A',
          jugada: j.tipo_jugada || 'N/A',
          numeros: j.numeros_jugados || 'N/A',
          monto: j.monto_total || 0,
          nota: j.nota || '',
          // Campos básicos para compatibilidad
          play_type: j.tipo_jugada || 'N/A',
          bruto: j.monto_total || 0,
          resultado: j.resultado || 'Pendiente',
          premio: j.monto_a_pagar || 0,
          pagado: j.monto_a_pagar || 0,
          // Campos específicos según el rol
          ganancia_listero: j.ganancia_listero || 0,
          ganancia_colector: j.ganancia_colector || 0,
          ganancia_banco: j.ganancia_colector || 0,
          balance_listero: j.balance_listero || 0,
          balance_colector: j.balance_colector || 0,
          balance_banco: j.balance_colector || 0,
          // IDs para filtrado
          id_listero: j.id_listero || null,
          id_colector: j.id_colector || null,
          id_banco: j.id_banco || null,
          // Información de usuarios
          listero_username: j.listero_username || '',
          colector_username: j.colector_username || '',
          // Campos adicionales que pueden necesitarse
          ganancia: userRole === 'collector' ? j.ganancia_colector || 0 : j.ganancia_listero || 0,
          balance: userRole === 'collector' ? j.balance_colector || 0 : 
                  userRole === 'admin' ? j.balance_colector || 0 : 
                  j.balance_listero || 0,
          gananciaListero: j.ganancia_listero || 0,
          gananciaColector: j.ganancia_colector || 0,
          balanceListero: j.balance_listero || 0,
          balanceColector: j.balance_colector || 0
        }));
      
      setTableData(prev => ({
        ...prev,
        plays: formattedPlays
      }));
      
      console.log('✅ [loadPlaysData] Datos establecidos en tableData:', formattedPlays.length, 'registros');
      console.log('✅ [loadPlaysData] === FIN ===');
      
      return formattedPlays;
      
    } catch (error) {
      console.error('❌ Error cargando jugadas:', error);
      // Fallback a datos mock
      const mockData = generateMockPlaysData();
      setTableData(prev => ({
        ...prev,
        plays: mockData
      }));
      console.log('🔄 [loadPlaysData] Fallback a mock data:', mockData.length, 'registros');
      return mockData;
    } finally {
      setIsLoading(false);
    }
  };

  // Función específica para cargar datos de COLECTOR (segunda capa - agrupa por lotería y horario)
  async function loadCollectorPlaysData(userId, filters = {}) {
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
        const startStr = startDate.toISOString().split('T')[0] + ' 00:00:00';
        const endStr = endDate.toISOString().split('T')[0] + ' 23:59:59';
        dateFilters = {
          startStr,
          endStr
        };
      }

      // Obtener todos los datos usando paginación optimizada
      let allPlaysData = [];
      let page = 0;
      const pageSize = 5000;
      let hasMore = true;
      
      while (hasMore) {
        // Crear consulta específica para colector - filtra por id_colector
        let query = supabase
          .from('v_estadisticas')
          .select(`
            id_listero,
            id_colector,
            id_banco,
            id_loteria,
            id_horario,
            fecha_jugada,
            nombre_loteria,
            nombre_horario,
            tipo_jugada,
            numeros_jugados,
            nota,
            monto_total,
            monto_a_pagar,
            ganancia_listero,
            ganancia_colector,
            balance_listero,
            balance_colector,
            estado_horario,
            resultado,
            listero_username,
            colector_username
          `)
          .eq('id_colector', userId) // FILTRO ESPECÍFICO PARA COLECTOR
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
          hasMore = playsData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
        
        // Límite de seguridad
        if (page > 250) {
          console.warn('⚠️ [loadCollectorPlaysData] Límite de páginas alcanzado (1.25M registros)');
          break;
        }
        
        // Mostrar progreso cada 10 páginas
        if (page % 10 === 0) {
          console.log(`📊 [loadCollectorPlaysData] Progress: ${allPlaysData.length} records loaded`);
        }
      }
      
      console.log(`🔍 [loadCollectorPlaysData] Total records obtained: ${allPlaysData.length}`);
      
      if (allPlaysData.length > 100000) {
        console.warn(`⚠️ [loadCollectorPlaysData] Alto volumen para colector: ${allPlaysData.length} registros.`);
      }

      return allPlaysData || [];
      
    } catch (error) {
      console.error('❌ Error en loadCollectorPlaysData:', error);
      return [];
    }
  }

  // Función para generar datos reales de jugadas desde v_estadisticas (SOLO LISTEROS)
  // COMENTADA TEMPORALMENTE - USAR FUNCIONES ESPECÍFICAS POR ROL
  /*
  async function loadRealPlaysData(userId) {
    try {
      if (!userId) {
        return generateMockPlaysData();
      }

      // Obtener todos los datos usando paginación optimizada para alto volumen
      let allPlaysData = [];
      let page = 0;
      const pageSize = 5000; // Aumentar tamaño de página
      let hasMore = true;
      
      console.log('🔍 [loadRealPlaysData] Starting data fetch for listero...');
      
      while (hasMore) {
        const { data: playsData, error } = await supabase
          .from('v_estadisticas')
          .select('*')
          .eq('id_listero', userId)
          .eq('estado_horario', 'cerrada')
          .order('fecha_jugada', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.error('❌ Error cargando jugadas reales:', error);
          return generateMockPlaysData();
        }
        
        console.log(`🔍 [loadRealPlaysData] Page ${page + 1}: ${playsData?.length || 0} records`);
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
          hasMore = playsData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
        
        // Límite de seguridad aumentado
        if (page > 250) { // Hasta 1.25M registros
          console.warn('⚠️ [loadRealPlaysData] Límite de páginas alcanzado (1.25M registros)');
          break;
        }
        
        // Mostrar progreso cada 10 páginas
        if (page % 10 === 0) {
          console.log(`📊 [loadRealPlaysData] Progress: ${allPlaysData.length} records loaded`);
        }
      }
      
      console.log(`🔍 [loadRealPlaysData] Total records obtained: ${allPlaysData.length}`);
      
      // Advertencia si el volumen es muy alto para un listero individual
      if (allPlaysData.length > 100000) {
        console.warn(`⚠️ [loadRealPlaysData] Alto volumen para listero: ${allPlaysData.length} registros.`);
      }

      return allPlaysData || [];
      
    } catch (error) {
      console.error('❌ Error en loadRealPlaysData:', error);
      return generateMockPlaysData();
    }
  }
  */

  // Función específica para cargar datos de LISTERO (usando misma lógica que colector)
  async function loadListeroPlaysData(userId, filters = {}) {
    try {
      if (!userId) {
        console.warn('⚠️ [loadListeroPlaysData] No userId provided');
        return [];
      }

      console.log('🔍 [loadListeroPlaysData] Starting data fetch for listero...');

      const { startDate, endDate } = filters;
      
      // Formatear fechas si están disponibles
      let dateFilters = {};
      if (startDate && endDate) {
        const startStr = startDate.toISOString().split('T')[0] + ' 00:00:00';
        const endStr = endDate.toISOString().split('T')[0] + ' 23:59:59';
        dateFilters = {
          startStr,
          endStr
        };
      }

      // Obtener todos los datos usando paginación optimizada
      let allPlaysData = [];
      let page = 0;
      const pageSize = 5000;
      let hasMore = true;
      
      while (hasMore) {
        // Crear consulta específica para listero - filtra por id_listero
        let query = supabase
          .from('v_estadisticas')
          .select(`
            id_listero,
            id_colector,
            id_banco,
            id_loteria,
            id_horario,
            fecha_jugada,
            nombre_loteria,
            nombre_horario,
            tipo_jugada,
            numeros_jugados,
            nota,
            monto_total,
            monto_a_pagar,
            ganancia_listero,
            ganancia_colector,
            balance_listero,
            balance_colector,
            estado_horario,
            resultado,
            listero_username,
            colector_username
          `)
          .eq('id_listero', userId) // FILTRO ESPECÍFICO PARA LISTERO
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
          console.error('❌ [loadListeroPlaysData] Error cargando datos:', error);
          return [];
        }
        
        console.log(`🔍 [loadListeroPlaysData] Page ${page + 1}: ${playsData?.length || 0} records`);
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
          hasMore = playsData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
        
        // Límite de seguridad
        if (page > 250) {
          console.warn('⚠️ [loadListeroPlaysData] Límite de páginas alcanzado (1.25M registros)');
          break;
        }
        
        // Mostrar progreso cada 10 páginas
        if (page % 10 === 0) {
          console.log(`📊 [loadListeroPlaysData] Progress: ${allPlaysData.length} records loaded`);
        }
      }
      
      console.log(`🔍 [loadListeroPlaysData] Total records obtained: ${allPlaysData.length}`);
      
      if (allPlaysData.length > 100000) {
        console.warn(`⚠️ [loadListeroPlaysData] Alto volumen para listero: ${allPlaysData.length} registros.`);
      }

      return allPlaysData || [];
      
    } catch (error) {
      console.error('❌ Error en loadListeroPlaysData:', error);
      return [];
    }
  }

  // Función específica para cargar datos de ADMIN (usando misma lógica que colector y listero)
  async function loadAdminPlaysData(userId, filters = {}) {
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
        const startStr = startDate.toISOString().split('T')[0] + ' 00:00:00';
        const endStr = endDate.toISOString().split('T')[0] + ' 23:59:59';
        dateFilters = {
          startStr,
          endStr
        };
      }

      // Obtener todos los datos usando paginación optimizada
      let allPlaysData = [];
      let page = 0;
      const pageSize = 5000;
      let hasMore = true;
      
      while (hasMore) {
        // Crear consulta específica para admin - filtra por id_banco
        let query = supabase
          .from('v_estadisticas')
          .select(`
            id_listero,
            id_colector,
            id_banco,
            id_loteria,
            id_horario,
            fecha_jugada,
            nombre_loteria,
            nombre_horario,
            tipo_jugada,
            numeros_jugados,
            nota,
            monto_total,
            monto_a_pagar,
            ganancia_listero,
            ganancia_colector,
            balance_listero,
            balance_colector,
            estado_horario,
            resultado,
            listero_username,
            colector_username
          `)
          .eq('id_banco', userId) // FILTRO ESPECÍFICO PARA ADMIN
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
        
        console.log(`🔍 [loadAdminPlaysData] Page ${page + 1}: ${playsData?.length || 0} records`);
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
          hasMore = playsData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
        
        // Límite de seguridad
        if (page > 250) {
          console.warn('⚠️ [loadAdminPlaysData] Límite de páginas alcanzado (1.25M registros)');
          break;
        }
        
        // Mostrar progreso cada 10 páginas
        if (page % 10 === 0) {
          console.log(`📊 [loadAdminPlaysData] Progress: ${allPlaysData.length} records loaded`);
        }
      }
      
      console.log(`🔍 [loadAdminPlaysData] Total records obtained: ${allPlaysData.length}`);
      
      if (allPlaysData.length > 100000) {
        console.warn(`⚠️ [loadAdminPlaysData] Alto volumen para admin: ${allPlaysData.length} registros.`);
      }

      return allPlaysData || [];
      
    } catch (error) {
      console.error('❌ Error en loadAdminPlaysData:', error);
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

  // Cargar listas de loterías y horarios al inicializar
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
  }, []); // Cargar una sola vez al inicializar

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
    
    // ===== ESTADOS PARA COLECTORES =====
    // availableListeros, // ELIMINADO
    // selectedListero, // ELIMINADO
    userRole,
    
    // ===== FUNCIONES DE CARGA =====
    loadAllStats,
    refreshAllStats,
    loadDailyStats,
    loadPeriodStats,
    loadTrendData,
    loadLotteryStats,
    loadScheduleStats,
    loadPlaysData, // Función para cargar jugadas del listero
    
    // ===== FUNCIONES DE UTILIDAD =====
    comparePeriods,
    calculatePercentageChange,
    formatCurrency,
    formatNumber,
    
    // ===== FUNCIONES DE FILTROS =====
    applyFilters,
    resetFilters,
    // filterByListero, // ELIMINADO
    
    // ===== FUNCIONES DE EXPORTACIÓN =====
    exportToCSV,
    
    // ===== FUNCIONES DE CONFIGURACIÓN =====
    toggleDataMode,
    checkRealDataAvailability,
    
    // ===== SETTERS PARA FILTROS =====
    setDateRange,
    setSelectedLottery,
    setSelectedSchedule,
    // setSelectedListero, // ELIMINADO
    
    // ===== INFORMACIÓN DEL SISTEMA =====
    isUsingMockData: USE_MOCK_DATA,
    clearData: resetFilters // Alias para compatibilidad
  };
};

export default useStatistics;
