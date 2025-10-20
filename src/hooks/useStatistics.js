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
        if (!user) {
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!error && profile && profile.role) {
          console.log('🔍 [useStatistics] Rol detectado:', profile.role);
          console.log('🔍 [useStatistics] User ID:', user.id);
          setUserRole(profile.role);
          setUserId(user.id);
        } else {
          console.log('🔍 [useStatistics] ❌ Error o rol no encontrado:', error?.message || 'No profile/role');
        }
      } catch (error) {
        // Error crítico: no hacer nada, dejar userRole como null
        // StatisticsScreen manejará el error y redirigirá
      }
    };

    detectUserRole();
  }, []);

  // Función para obtener el hook activo según el rol
  const getActiveStats = () => {
    console.log('🔍 [useStatistics] getActiveStats llamado - userRole:', userRole);
    
    switch (userRole) {
      case 'collector':
      case 'colector':
        console.log('🔍 [useStatistics] Activando hook COLLECTOR');
        return collectorStats;
      case 'admin':
        console.log('🔍 [useStatistics] Activando hook ADMIN');
        return adminStats;
      case 'listero':
      default:
        console.log('🔍 [useStatistics] Activando hook LISTERO (default)');
        return listeroStats;
    }
  };

  const activeStats = getActiveStats();

  // Generar datos KPI básicos para compatibilidad
  const generateKpiData = () => {
    try {
      const plays = activeStats.tableData?.plays || [];
      
      // 🎯 FIX: Validación más estricta de tipos
      if (!Array.isArray(plays)) {
        console.warn('[useStatistics] plays no es un array:', typeof plays);
        return [];
      }
      
      // Validar que hay un rol válido
      if (!userRole) {
        return [];
      }
      
      if (userRole === 'listero') {
        // Filtrar plays válidos (que tengan las propiedades necesarias)
        const validPlays = plays.filter(play => 
          play && typeof play === 'object' && 'monto_total' in play
        );
        
        const totals = validPlays.reduce((acc, play) => {
          // Usar parseFloat con validación de números finitos
          const bruto = parseFloat(play.monto_total) || 0;
          const ganancia = parseFloat(play.ganancia_listero) || 0;
          const premio = parseFloat(play.monto_a_pagar) || 0;
          const balance = parseFloat(play.balance_listero) || 0;
          
          // Validar que los números son finitos (no NaN, no Infinity)
          if (!isFinite(bruto) || !isFinite(ganancia) || !isFinite(premio) || !isFinite(balance)) {
            console.warn('[useStatistics] Valores no finitos en play:', play.id_jugada);
            return acc;
          }
          
          acc.bruto += bruto;
          acc.ganancia += ganancia;
          acc.premio += premio;
          acc.balance += balance;
          return acc;
        }, { bruto: 0, ganancia: 0, premio: 0, balance: 0 });

      // Limpio = Bruto - Ganancia
      const limpio = totals.bruto - totals.ganancia;

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

      // 🎯 FIX: Validar que los valores sean números finitos
      const validateNumber = (value) => {
        const num = parseFloat(value);
        return isFinite(num) ? num : 0;
      };

      const bruto = validateNumber(totals.total_bruto);
      const premio = validateNumber(totals.total_premio);
      const ganancia = validateNumber(totals.total_ganancia_colector);
      const balance = validateNumber(totals.balance_banco);

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
          value: bruto,
          change: 0,
          trend: 'neutral',
          icon: '💰',
          formattedValue: `$${bruto.toFixed(2)}`
        },
        {
          title: 'Premio',
          value: premio,
          change: 0,
          trend: 'neutral',
          icon: '🏆',
          formattedValue: `$${premio.toFixed(2)}`
        },
        {
          title: 'Ganancia',
          value: ganancia,
          change: 0,
          trend: ganancia >= 0 ? 'up' : 'down',
          icon: '📈',
          formattedValue: `$${ganancia.toFixed(2)}`
        },
        {
          title: 'Balance Banco',
          value: balance,
          change: 0,
          trend: balance >= 0 ? 'up' : 'down',
          icon: '🏦',
          formattedValue: `$${balance.toFixed(2)}`
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
    } catch (error) {
      return [];
    }
  };

  // Generar datos de gráficas
  const generateChartData = () => {
    try {
      const plays = activeStats.tableData?.plays || [];
      
      // TODO: Implementar generación real de datos de gráfica basados en plays
      return {
        labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
        datasets: [{
          data: [0, 0, 0, 0, 0, 0, 0]
        }]
      };
    } catch (error) {
      return {
        labels: [],
        datasets: [{ data: [] }]
      };
    }
  };

  // Funciones de compatibilidad
  const loadAllStats = async () => {
    try {
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
    } catch (error) {
      // Error silencioso
    }
  };

  const loadPlaysData = async (filters = {}) => {
    try {
      // Guard: No ejecutar si no hay userId
      if (!userId) {
        return;
      }
      
      if (activeStats.loadPlaysData) {
        return activeStats.loadPlaysData(filters);
      }
    } catch (error) {
      // Error silencioso
    }
  };

  const applyFilters = async (filters = {}) => {
    try {
      // Guard: No ejecutar si no hay userId
      if (!userId) {
        return;
      }
      
      if (activeStats.applyFilters) {
        // Pasar filtros directamente al hook específico
        return activeStats.applyFilters(filters);
      }
    } catch (error) {
      // Error silencioso
    }
  };

  const clearData = () => {
    // No hacer nada por ahora, los hooks individuales manejan su estado
  };

  // Interface de compatibilidad con el hook original
  let playsData = [];
  try {
    playsData = userRole === 'listero' ? (activeStats.tableData?.plays || []) : 
                      userRole === 'collector' || userRole === 'colector' ? 
                        (activeStats.tableData?.plays || []) : 
                      userRole === 'admin' ? 
                        (activeStats.tableData?.plays || []) : [];
    
    console.log('[useStatistics] 📊 playsData extraídos:', playsData?.length || 0);
    console.log('[useStatistics] 📋 Tipo de playsData:', Array.isArray(playsData) ? 'Array' : typeof playsData);
    if (playsData?.length > 0) {
      console.log('[useStatistics] 📝 Primer elemento:', playsData[0]);
    }
    
    if (!Array.isArray(playsData)) {
      console.warn('[useStatistics] ⚠️ playsData NO ES ARRAY, forzando a []');
      playsData = [];
    }
  } catch (error) {
    console.error('[useStatistics] ❌ Error extrayendo playsData:', error);
    playsData = [];
  }
  
  const finalTableData = {
    plays: playsData
  };
  
  console.log('[useStatistics] 🎁 Retornando tableData con:', finalTableData.plays?.length || 0, 'registros');
  
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
    tableData: finalTableData,
    
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
    })),
    
    // 🐛 DEBUG: Metadata temporal
    debugInfo: activeStats.debugInfo || {
      source: 'N/A',
      totalBeforeFilter: 0,
      totalAfterFilter: 0,
      cacheOldestDate: 'N/A',
      rangeRequested: 'N/A'
    }
  };
};

export default useStatistics;
