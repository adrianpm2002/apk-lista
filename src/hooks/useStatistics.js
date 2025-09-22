import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useListeroStatistics } from './useListeroStatistics';
import { useCollectorStatistics } from './useCollectorStatistics';
import { useAdminStatistics } from './useAdminStatistics';

// Hook de compatibilidad que mantiene la interfaz original
// pero usa los nuevos hooks específicos por rol internamente
const useStatistics = () => {
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  
  // Hooks específicos por rol (siempre montados, pero con gating por "enabled")
  const listeroStats = useListeroStatistics({ enabled: userRole === 'listero' });
  const collectorStats = useCollectorStatistics({ enabled: userRole === 'collector' || userRole === 'colector' });
  const adminStats = useAdminStatistics({ enabled: userRole === 'admin' });

  // Detectar el rol del usuario
  useEffect(() => {
    const detectUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!error && profile) {
          setUserRole(profile.role || 'listero');
          setUserId(user.id);
        }
      } catch (error) {
        // Mantener fallback silencioso a 'listero' si hay error
        setUserRole('listero');
      }
    };

    detectUserRole();
  }, []);

  // Función para obtener el hook activo según el rol
  const getActiveStats = () => {
    switch (userRole) {
      case 'collector':
      case 'colector':
        return collectorStats;
      case 'admin':
        return adminStats;
      case 'listero':
      default:
        return listeroStats;
    }
  };

  const activeStats = getActiveStats();

  // Generar datos KPI básicos para compatibilidad
  const generateKpiData = () => {
    const plays = activeStats.tableData?.plays || [];
    
    if (userRole === 'listero') {
      const totals = plays.reduce((acc, play) => {
        acc.totalBets += 1;
        acc.totalAmount += play.bruto || 0;
        acc.totalPrize += play.premio || 0;
        acc.totalGain += play.ganancia || 0;
        return acc;
      }, { totalBets: 0, totalAmount: 0, totalPrize: 0, totalGain: 0 });

      return [
        {
          title: 'Apuestas Totales',
          value: totals.totalBets,
          change: 0,
          trend: 'neutral',
          icon: '🎯',
          formattedValue: totals.totalBets.toString()
        },
        {
          title: 'Monto Total',
          value: totals.totalAmount,
          change: 0,
          trend: 'neutral',
          icon: '💰',
          formattedValue: `$${totals.totalAmount.toLocaleString()}`
        },
        {
          title: 'Premios',
          value: totals.totalPrize,
          change: 0,
          trend: 'neutral',
          icon: '🏆',
          formattedValue: `$${totals.totalPrize.toLocaleString()}`
        },
        {
          title: 'Ganancia',
          value: totals.totalGain,
          change: 0,
          trend: totals.totalGain >= 0 ? 'up' : 'down',
          icon: '📈',
          formattedValue: `$${totals.totalGain.toLocaleString()}`
        }
      ];
    }

    // Para collector y admin - datos agrupados
    if (userRole === 'collector' || userRole === 'colector') {
      const totals = collectorStats.getTotals ? collectorStats.getTotals() : {
        total_bruto: 0,
        total_premio: 0,
        total_ganancia_colector: 0,
        balance_banco: 0
      };

      return [
        {
          title: 'Listeros',
          value: plays.length,
          change: 0,
          trend: 'neutral',
          icon: '👥',
          formattedValue: plays.length.toString()
        },
        {
          title: 'Bruto Total',
          value: totals.total_bruto,
          change: 0,
          trend: 'neutral',
          icon: '💰',
          formattedValue: `$${totals.total_bruto.toLocaleString()}`
        },
        {
          title: 'Premios',
          value: totals.total_premio,
          change: 0,
          trend: 'neutral',
          icon: '🏆',
          formattedValue: `$${totals.total_premio.toLocaleString()}`
        },
        {
          title: 'Balance Banco',
          value: totals.balance_banco,
          change: 0,
          trend: totals.balance_banco >= 0 ? 'up' : 'down',
          icon: '🏦',
          formattedValue: `$${totals.balance_banco.toLocaleString()}`
        }
      ];
    }

    // Para admin
    if (userRole === 'admin') {
      const totals = adminStats.getTotals ? adminStats.getTotals() : {
        total_bruto: 0,
        total_premio: 0,
        total_ganancia_sistema: 0,
        balance_banco_total: 0,
        total_colectores: 0
      };

      return [
        {
          title: 'Colectores',
          value: totals.total_colectores || plays.length,
          change: 0,
          trend: 'neutral',
          icon: '👨‍💼',
          formattedValue: (totals.total_colectores || plays.length).toString()
        },
        {
          title: 'Bruto Total',
          value: totals.total_bruto,
          change: 0,
          trend: 'neutral',
          icon: '💰',
          formattedValue: `$${totals.total_bruto.toLocaleString()}`
        },
        {
          title: 'Premios',
          value: totals.total_premio,
          change: 0,
          trend: 'neutral',
          icon: '🏆',
          formattedValue: `$${totals.total_premio.toLocaleString()}`
        },
        {
          title: 'Balance Total',
          value: totals.balance_banco_total,
          change: 0,
          trend: totals.balance_banco_total >= 0 ? 'up' : 'down',
          icon: '🏦',
          formattedValue: `$${totals.balance_banco_total.toLocaleString()}`
        }
      ];
    }

    return [];
  };

  // Generar datos de gráfico básicos
  const generateChartData = () => {
    return {
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      datasets: [{
        data: [0, 0, 0, 0, 0, 0, 0]
      }]
    };
  };

  // Funciones de compatibilidad
  const loadAllStats = async () => {
    if (activeStats.loadPlaysData) {
      return activeStats.loadPlaysData({
        startDate: activeStats.dateRange?.startDate || new Date(new Date().setHours(0, 0, 0, 0)),
        endDate: activeStats.dateRange?.endDate || new Date(new Date().setHours(23, 59, 59, 999))
      });
    }
  };

  const loadPlaysData = async (filters = {}) => {
    if (activeStats.loadPlaysData) {
      return activeStats.loadPlaysData(filters);
    }
  };

  const applyFilters = async (filters = {}) => {
    if (activeStats.loadPlaysData) {
      // Si recibimos un período específico, pasarlo directamente
      const { period, startDate, endDate, ...rest } = filters || {};
      
      if (period) {
        // Pasar el período directamente al hook específico
        return activeStats.loadPlaysData({ period, ...rest });
      }
      
      // Mantener compatibilidad con el sistema anterior de fechas
      if (startDate && endDate && typeof activeStats.updateDateRange === 'function') {
        activeStats.updateDateRange(startDate, endDate);
      }
      return activeStats.loadPlaysData({ startDate, endDate, ...rest });
    }
  };

  const clearData = () => {
    // No hacer nada por ahora, los hooks individuales manejan su estado
  };

  // Interface de compatibilidad con el hook original
  return {
    // Estados básicos
    userRole,
    userId,
    loading: activeStats.isLoading || false,
    error: null,

    // Datos formateados para compatibilidad
    kpiData: generateKpiData(),
    chartData: generateChartData(),
    tableData: {
      // Para colector y admin, usar los datos agrupados tal como vienen del hook
      // Para listero, usar plays directamente
      plays: userRole === 'listero' ? (activeStats.tableData?.plays || []) : 
             userRole === 'collector' || userRole === 'colector' ? 
               // Para collector: devolver la estructura agrupada por listero
               (activeStats.tableData?.plays || []) : 
             userRole === 'admin' ? 
               // Para admin: devolver la estructura jerárquica completa (bancos -> colectores -> listeros)
               (activeStats.tableData?.plays || []) : []
    },
    
    // Datos básicos - solo se muestran si hay datos reales
    lotteries: [],
    schedules: [],

    // Funciones
    loadAllStats,
    loadPlaysData,
    applyFilters,
    clearData,

    // Funciones adicionales específicas por rol (con fallbacks seguros)
    updateDateRange: activeStats.updateDateRange || (() => {}),
    getBankBalance: activeStats.getBankBalance || (() => 0),
    getTotals: activeStats.getTotals || (() => ({
      total_bruto: 0,
      total_premio: 0,
      total_ganancia_colector: 0,
      balance_banco: 0
    }))
  };
};

export default useStatistics;
