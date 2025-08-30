import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Alert } from 'react-native';

const useStatistics = () => {
  // Estados principales
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estados de datos simplificados con datos mock
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
  // FUNCIONES DE CARGA DE DATOS SIMPLIFICADAS
  // ===================================================

  // Cargar estadísticas diarias de hoy (versión simplificada)
  const loadDailyStats = async () => {
    try {
      setIsLoading(true);
      
      // Simulamos una carga de datos
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Datos mock para demostración
      setDailyStats({
        daily_total_bets: 25000 + Math.random() * 5000,
        daily_total_prizes: 18000 + Math.random() * 3000,
        daily_listero_commissions: 2500 + Math.random() * 500,
        daily_plays_count: 150 + Math.floor(Math.random() * 50),
        daily_net_profit: 4500 + Math.random() * 1000
      });

    } catch (error) {
      console.error('Error cargando estadísticas diarias:', error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar estadísticas de período
  const loadPeriodStats = async (startDate, endDate) => {
    try {
      setIsLoading(true);
      
      // Simulamos una carga de datos
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Datos mock basados en el período
      const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const mockStats = {
        period_total_bets: 25000 * days,
        period_total_prizes: 18000 * days,
        period_listero_commissions: 2500 * days,
        period_plays_count: 150 * days,
        period_net_profit: 4500 * days
      };
      
      return mockStats;

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
      
      // Simulamos una carga de datos
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Generar datos de tendencia para los últimos 7 días
      const trends = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        trends.push({
          date: date.toISOString().split('T')[0],
          total_bets: 20000 + Math.random() * 10000,
          net_profit: 3000 + Math.random() * 2000
        });
      }
      
      setTrendData(trends);

    } catch (error) {
      console.error('Error cargando tendencia:', error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar estadísticas por lotería (usando datos reales)
  const loadLotteryStats = async () => {
    try {
      setIsLoading(true);
      
      // Intentar obtener datos reales de loterías
      const { data: lotteries, error } = await supabase
        .from('loteria')
        .select('*');

      if (error) {
        throw error;
      }

      // Generar estadísticas mock basadas en las loterías reales
      const stats = lotteries?.map(lottery => ({
        name: lottery.name,
        total_bets: 5000 + Math.random() * 10000,
        total_volume: 5000 + Math.random() * 10000,
        value: 5000 + Math.random() * 10000
      })) || lotteryStats;

      setLotteryStats(stats);

    } catch (error) {
      console.error('Error cargando estadísticas de lotería:', error);
      // Usar datos mock si falla
      setLotteryStats([
        { name: 'Lotería Nacional', total_bets: 12000, total_volume: 12000, value: 12000 },
        { name: 'Loteka', total_bets: 8000, total_volume: 8000, value: 8000 },
        { name: 'La Primera', total_bets: 5000, total_volume: 5000, value: 5000 }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar estadísticas por horario (usando datos reales)
  const loadScheduleStats = async () => {
    try {
      setIsLoading(true);
      
      // Intentar obtener datos reales de horarios
      const { data: schedules, error } = await supabase
        .from('horario')
        .select('*');

      if (error) {
        throw error;
      }

      // Generar estadísticas mock basadas en los horarios reales
      const stats = schedules?.map(schedule => ({
        schedule_name: schedule.name,
        total_plays: 30 + Math.floor(Math.random() * 50),
        total_amount: 5000 + Math.random() * 8000,
        total_commission: 500 + Math.random() * 800,
        net_profit: 1000 + Math.random() * 2000,
        value: 5000 + Math.random() * 8000
      })) || scheduleStats;

      setScheduleStats(stats);

    } catch (error) {
      console.error('Error cargando estadísticas de horario:', error);
      // Usar datos mock si falla
      setScheduleStats([
        { 
          schedule_name: 'Matutino', 
          total_plays: 50, 
          total_amount: 8000, 
          total_commission: 800, 
          net_profit: 1200,
          value: 8000
        },
        { 
          schedule_name: 'Vespertino', 
          total_plays: 60, 
          total_amount: 10000, 
          total_commission: 1000, 
          net_profit: 1500,
          value: 10000
        },
        { 
          schedule_name: 'Nocturno', 
          total_plays: 40, 
          total_amount: 7000, 
          total_commission: 700, 
          net_profit: 1800,
          value: 7000
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ===================================================
  // FUNCIONES PRINCIPALES
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
      console.error('Error cargando todas las estadísticas:', error);
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
  // FUNCIONES DE UTILIDAD
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

  // ===================================================
  // FUNCIONES DE FILTROS
  // ===================================================

  // Aplicar filtros
  const applyFilters = async (filters) => {
    try {
      setIsLoading(true);
      
      // Simular aplicación de filtros
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Recargar datos con filtros aplicados
      await loadAllStats();
      
    } catch (error) {
      console.error('Error aplicando filtros:', error);
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
  };

  // ===================================================
  // FUNCIONES DE EXPORTACIÓN
  // ===================================================

  // Exportar datos a CSV
  const exportToCSV = async (format = 'csv') => {
    try {
      // Simular exportación
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`Exportando datos en formato ${format}...`);
      
      // En una implementación real, aquí se generaría y descargaría el archivo
      return true;
      
    } catch (error) {
      console.error('Error exportando datos:', error);
      return false;
    }
  };

  // ===================================================
  // FORMATEAR DATOS PARA LA PANTALLA
  // ===================================================

  // Formatear datos para la pantalla
  const kpiData = dailyStats ? [
    {
      title: 'Apuestas de Hoy',
      value: dailyStats.daily_total_bets || 0,
      change: 5.2, // Simulado
      trend: 'up',
      icon: '🎯'
    },
    {
      title: 'Comisiones',
      value: dailyStats.daily_listero_commissions || 0,
      change: 3.8,
      trend: 'up',
      icon: '💰'
    },
    {
      title: 'Ganancia Neta',
      value: (dailyStats.daily_total_bets || 0) - (dailyStats.daily_total_prizes || 0),
      change: 2.1,
      trend: 'up',
      icon: '📈'
    },
    {
      title: 'Jugadas',
      value: dailyStats.daily_plays_count || 0,
      change: 4.5,
      trend: 'up',
      icon: '🎲'
    }
  ] : [];

  const chartData = {
    trends: trendData || [],
    byLottery: lotteryStats || [],
    distribution: scheduleStats || [],
    commissions: trendData || []
  };

  const tableData = {
    plays: [], // Se cargaría con datos detallados
    bySchedule: scheduleStats || []
  };

  // Listas para filtros (usando datos reales + mock)
  const lotteries = [
    { id: 1, name: 'Lotería Nacional' },
    { id: 2, name: 'Loteka' },
    { id: 3, name: 'La Primera' }
  ];

  const schedules = [
    { id: 1, name: 'Matutino' },
    { id: 2, name: 'Vespertino' },
    { id: 3, name: 'Nocturno' }
  ];

  return {
    // Estados formateados para la pantalla
    kpiData,
    chartData,
    tableData,
    lotteries,
    schedules,
    loading: isLoading,
    error,

    // Estados originales
    dailyStats,
    trendData,
    lotteryStats,
    scheduleStats,
    dateRange,
    selectedLottery,
    selectedSchedule,

    // Funciones de carga
    loadAllStats,
    refreshAllStats,
    loadDailyStats,
    loadPeriodStats,
    loadTrendData,
    loadLotteryStats,
    loadScheduleStats,

    // Funciones de utilidad
    comparePeriods,
    calculatePercentageChange,

    // Funciones de filtros
    applyFilters,
    resetFilters,

    // Funciones de exportación
    exportToCSV,
    clearData: resetFilters, // Alias para clearData

    // Setters para filtros
    setDateRange,
    setSelectedLottery,
    setSelectedSchedule
  };
};

export default useStatistics;
