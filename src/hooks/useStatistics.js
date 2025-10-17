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

  console.log('[useStatistics] Current state - userRole:', userRole, 'userId:', userId);
  console.log('[useStatistics] listeroStats enabled:', userRole === 'listero');
  console.log('[useStatistics] listeroStats data:', listeroStats.tableData?.plays?.length, 'plays');

  // Detectar el rol del usuario
  useEffect(() => {
    const detectUserRole = async () => {
      console.log('[useStatistics] Detecting user role...');
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('[useStatistics] No user found');
          return;
        }

        console.log('[useStatistics] User found:', user.id);

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!error && profile && profile.role) {
          console.log('[useStatistics] Role detected:', profile.role);
          setUserRole(profile.role);
          setUserId(user.id);
        } else {
          console.error('[useStatistics] Error getting profile:', error);
        }
      } catch (error) {
        console.error('[useStatistics] Exception detecting role:', error);
        // Error crítico: no hacer nada, dejar userRole como null
        // StatisticsScreen manejará el error y redirigirá
      }
    };

    detectUserRole();
  }, []);

  // Función para obtener el hook activo según el rol
  const getActiveStats = () => {
    console.log('[useStatistics] getActiveStats - userRole:', userRole);
    let stats;
    switch (userRole) {
      case 'collector':
      case 'colector':
        console.log('[useStatistics] Returning collectorStats');
        stats = collectorStats;
        break;
      case 'admin':
        console.log('[useStatistics] Returning adminStats');
        stats = adminStats;
        break;
      case 'listero':
      default:
        console.log('[useStatistics] Returning listeroStats (default)');
        stats = listeroStats;
        break;
    }
    console.log('[useStatistics] Active stats data:', stats.tableData?.plays?.length || 0, 'plays');
    return stats;
  };

  const activeStats = getActiveStats();

  // Generar datos KPI básicos para compatibilidad
  const generateKpiData = () => {
    const plays = activeStats.tableData?.plays || [];
    console.log('[useStatistics] 📊 generateKpiData - userRole:', userRole, 'plays:', plays.length);
    
    if (plays.length > 0) {
      console.log('[useStatistics] 📊 Sample play for KPI:', plays[0]);
      console.log('[useStatistics] 📊 Play object keys:', Object.keys(plays[0]));
    }
    
    if (userRole === 'listero') {
      const totals = plays.reduce((acc, play) => {
        const bruto = Number(play.monto_total) || 0;
        const ganancia = Number(play.ganancia_listero) || 0;
        const premio = Number(play.monto_a_pagar) || 0;
        const balance = Number(play.balance_listero) || 0;
        
        acc.bruto += bruto;
        acc.ganancia += ganancia;
        acc.premio += premio;
        acc.balance += balance;
        return acc;
      }, { bruto: 0, ganancia: 0, premio: 0, balance: 0 });

      // Limpio = Bruto - Ganancia
      const limpio = totals.bruto - totals.ganancia;

      console.log('[useStatistics] 📊 Listero KPI totals:', { 
        bruto: totals.bruto, 
        ganancia: totals.ganancia, 
        limpio,
        premio: totals.premio,
        balance: totals.balance 
      });

      return [
        {
          title: 'Bruto',
          value: totals.bruto,
          change: 0,
          trend: 'neutral',
          icon: '💰',
          formattedValue: `$${totals.bruto.toFixed(2)}`
        },
        {
          title: 'Ganancia',
          value: totals.ganancia,
          change: 0,
          trend: totals.ganancia >= 0 ? 'up' : 'down',
          icon: '📈',
          formattedValue: `$${totals.ganancia.toFixed(2)}`
        },
        {
          title: 'Limpio',
          value: limpio,
          change: 0,
          trend: 'neutral',
          icon: '✨',
          formattedValue: `$${limpio.toFixed(2)}`
        },
        {
          title: 'Premio',
          value: totals.premio,
          change: 0,
          trend: 'neutral',
          icon: '🏆',
          formattedValue: `$${totals.premio.toFixed(2)}`
        },
        {
          title: 'Balance',
          value: totals.balance,
          change: 0,
          trend: totals.balance >= 0 ? 'up' : 'down',
          icon: '💵',
          formattedValue: `$${totals.balance.toFixed(2)}`
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
    const plays = activeStats.tableData?.plays || [];
    console.log('[useStatistics] 📈 generateChartData - plays:', plays.length);
    
    // TODO: Implementar generación real de datos de gráfica basados en plays
    return {
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      datasets: [{
        data: [0, 0, 0, 0, 0, 0, 0]
      }]
    };
  };

  // Funciones de compatibilidad
  const loadAllStats = async () => {
    // Guard: No ejecutar si no hay userId
    if (!userId) {
      return;
    }
    
    if (activeStats.loadPlaysData) {
      return activeStats.loadPlaysData({
        startDate: activeStats.dateRange?.startDate || new Date(new Date().setHours(0, 0, 0, 0)),
        endDate: activeStats.dateRange?.endDate || new Date(new Date().setHours(23, 59, 59, 999))
      });
    }
  };

  const loadPlaysData = async (filters = {}) => {
    // Guard: No ejecutar si no hay userId
    if (!userId) {
      return;
    }
    
    if (activeStats.loadPlaysData) {
      return activeStats.loadPlaysData(filters);
    }
  };

  const applyFilters = async (filters = {}) => {
    // Guard: No ejecutar si no hay userId
    if (!userId) {
      return;
    }
    
    if (activeStats.applyFilters) {
      // Pasar filtros directamente al hook específico
      return activeStats.applyFilters(filters);
    }
  };

  const clearData = () => {
    // No hacer nada por ahora, los hooks individuales manejan su estado
  };

  // Interface de compatibilidad con el hook original
  const playsData = userRole === 'listero' ? (activeStats.tableData?.plays || []) : 
                    userRole === 'collector' || userRole === 'colector' ? 
                      (activeStats.tableData?.plays || []) : 
                    userRole === 'admin' ? 
                      (activeStats.tableData?.plays || []) : [];
  
  console.log('[useStatistics] 📤 Returning data - userRole:', userRole, 'plays:', playsData.length);
  
  return {
    // Estados básicos
    // userRole removido - ahora se obtiene directamente en StatisticsScreen
    userId,
    loading: activeStats.loading || false,
    isRefreshing: activeStats.isRefreshing || false,
    error: null,

    // Datos formateados para compatibilidad
    kpiData: generateKpiData(),
    chartData: generateChartData(),
    tableData: {
      // Para colector y admin, usar los datos agrupados tal como vienen del hook
      // Para listero, usar plays directamente
      plays: playsData
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
