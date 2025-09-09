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
  
  // Hooks específicos por rol
  const listeroStats = useListeroStatistics();
  const collectorStats = useCollectorStatistics();
  const adminStats = useAdminStatistics();

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
          console.log('🔍 [useStatistics-compat] Rol detectado:', profile.role);
        }
      } catch (error) {
        console.error('❌ Error detectando rol:', error);
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
    console.log('🔄 [useStatistics-compat] loadAllStats called');
    if (activeStats.loadPlaysData) {
      return activeStats.loadPlaysData({
        startDate: activeStats.dateRange?.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: activeStats.dateRange?.endDate || new Date()
      });
    }
  };

  const loadPlaysData = async (filters = {}) => {
    console.log('🔄 [useStatistics-compat] loadPlaysData called with filters:', filters);
    if (activeStats.loadPlaysData) {
      return activeStats.loadPlaysData(filters);
    }
  };

  const applyFilters = async (filters = {}) => {
    console.log('🔄 [useStatistics-compat] applyFilters called with filters:', filters);
    if (activeStats.loadPlaysData) {
      return activeStats.loadPlaysData(filters);
    }
  };

  const clearData = () => {
    console.log('🔄 [useStatistics-compat] clearData called');
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
               // Para collector: devolver las jugadas sin procesar para que renderCollectorExpandableTable las agrupe
               (activeStats.tableData?.plays || []).flatMap(listero => listero.plays || []) : 
             userRole === 'admin' ? 
               // Para admin: devolver las jugadas sin procesar para que renderAdminExpandableTable las agrupe  
               (activeStats.tableData?.plays || []).flatMap(collector => 
                 collector.listeros?.flatMap(listero => listero.plays || []) || []
               ) : []
    },
    
    // Datos básicos (mock para compatibilidad)
    lotteries: [
      { id: '1', name: 'Caribe' },
      { id: '2', name: 'Primera' },
      { id: '3', name: 'Jaguey' }
    ],
    schedules: [
      { id: '1', name: '8:00 AM' },
      { id: '2', name: '12:00 PM' },
      { id: '3', name: '3:00 PM' },
      { id: '4', name: '7:00 PM' }
    ],

    // Funciones
    loadAllStats,
    loadPlaysData,
    applyFilters,
    clearData,

    // Funciones adicionales específicas por rol
    updateDateRange: activeStats.updateDateRange,
    getBankBalance: activeStats.getBankBalance,
    getTotals: activeStats.getTotals
  };
};

export default useStatistics;
