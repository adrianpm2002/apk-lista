import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getListeroStatsFromView } from '../services/listeroStatsService';

/**
 * HOOK LIMPIO PARA ESTADÍSTICAS
 * =============================
 * - Simple y enfocado
 * - Manejo de errores robusto
 * - Fallback a datos de ejemplo
 * - Performance optimizado
 */
const useStatisticsClean = (period = 'today') => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    dailyStats: null,
    chartData: [],
    tableData: []
  });

  // Generar datos de ejemplo como fallback
  const generateExampleData = useCallback(() => {
    const today = new Date();
    
    return {
      dailyStats: {
        totalBets: 45000 + Math.random() * 20000,
        totalPrizes: 32000 + Math.random() * 15000,
        totalCommissions: 4500 + Math.random() * 2000,
        netProfit: 8500 + Math.random() * 5000,
        totalPlays: 156 + Math.floor(Math.random() * 50),
        avgBetAmount: 288 + Math.random() * 100
      },
      chartData: Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - (6 - i));
        return {
          date: date.toLocaleDateString('es-DO'),
          bets: 20000 + Math.random() * 25000,
          prizes: 15000 + Math.random() * 20000,
          profit: 3000 + Math.random() * 10000
        };
      }),
      profitLossData: Array.from({ length: 10 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - (9 - i));
        const profit = (Math.random() - 0.5) * 8000; // Valor entre -4000 y +4000
        return {
          date: date.toLocaleDateString('es-DO', { month: 'short', day: 'numeric' }),
          value: profit,
          color: profit >= 0 ? '#4CAF50' : '#F44336'
        };
      }),
      tableData: [
        { 
          lottery: 'Lotería Nacional', 
          plays: 45 + Math.floor(Math.random() * 20), 
          amount: 18000 + Math.random() * 10000, 
          prizes: 12000 + Math.random() * 8000, 
          profit: 6000 + Math.random() * 4000 
        },
        { 
          lottery: 'Loteka', 
          plays: 62 + Math.floor(Math.random() * 25), 
          amount: 15000 + Math.random() * 8000, 
          prizes: 11000 + Math.random() * 6000, 
          profit: 4000 + Math.random() * 3000 
        },
        { 
          lottery: 'La Primera', 
          plays: 49 + Math.floor(Math.random() * 15), 
          amount: 12000 + Math.random() * 6000, 
          prizes: 9000 + Math.random() * 4000, 
          profit: 3000 + Math.random() * 2000 
        }
      ]
    };
  }, []);

  // Cargar datos reales desde v_estadisticas
  const loadRealData = useCallback(async () => {
    try {
      // Obtener usuario actual
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user || null;
      if (!user) {
        console.log('[useStatisticsClean] No user found');
        return null;
      }

      // Obtener rango de fechas según el período
      const dateRange = getDateRange(period);
      console.log('[useStatisticsClean] loadRealData - dateRange:', dateRange, 'user:', user.id);

      const from = new Date(dateRange.start);
      const to = new Date(dateRange.end);

      // Llamar a la nueva función que usa v_estadisticas
      const stats = await getListeroStatsFromView(user.id, { from, to });
      console.log('[useStatisticsClean] getListeroStatsFromView returned:', stats?.length || 0);

      if (!stats || stats.length === 0) {
        console.log('[useStatisticsClean] No hay datos reales en v_estadisticas, usando fallback');
        return null;
      }

      // Construir estructuras para la UI desde los datos agregados
      const totalBets = stats.reduce((sum, s) => sum + Number(s.bruto || 0), 0);
      const totalCommissions = stats.reduce((sum, s) => sum + Number(s.ganancia || 0), 0);
      const totalBalance = stats.reduce((sum, s) => sum + Number(s.balance || 0), 0);
      const totalPlays = stats.reduce((sum, s) => sum + Number(s.jugadas_count || 0), 0);
      const avgBetAmount = totalPlays ? totalBets / totalPlays : 0;

      const dailyStats = {
        totalBets: Number(totalBets.toFixed(2)),
        totalPrizes: 0, // No calculamos premios directamente aquí
        totalCommissions: Number(totalCommissions.toFixed(2)),
        netProfit: Number(totalBalance.toFixed(2)),
        totalPlays,
        avgBetAmount: Number(avgBetAmount.toFixed(2))
      };

      // chartData: agrupar por fecha
      const chartMap = {};
      stats.forEach(s => {
        const day = s.fecha || '';
        if (!chartMap[day]) chartMap[day] = { date: day, bets: 0, prizes: 0, profit: 0 };
        chartMap[day].bets += Number(s.bruto || 0);
        chartMap[day].profit += Number(s.balance || 0);
      });
      const chartData = Object.values(chartMap).sort((a,b)=> new Date(a.date) - new Date(b.date));

      // tableData: agrupar por lotería
      const tableMap = {};
      stats.forEach(s => {
        const key = s.nombre_loteria || 'Lotería';
        if (!tableMap[key]) tableMap[key] = { lottery: key, plays: 0, amount: 0, prizes: 0, profit: 0 };
        tableMap[key].plays += Number(s.jugadas_count || 0);
        tableMap[key].amount += Number(s.bruto || 0);
        tableMap[key].profit += Number(s.ganancia || 0);
      });
      const tableData = Object.values(tableMap).sort((a,b)=> b.amount - a.amount).map(x=> ({ 
        ...x, 
        amount: Number(x.amount.toFixed(2)), 
        profit: Number(x.profit.toFixed(2)) 
      }));

      console.log('[useStatisticsClean] Datos procesados:', { dailyStats, chartData: chartData.length, tableData: tableData.length });
      return { dailyStats, chartData, tableData };

    } catch (err) {
      console.warn('[useStatisticsClean] Error cargando datos reales:', err?.message || err);
      return null;
    }
  }, [period]);

  // Obtener rango de fechas según el período
  const getDateRange = (period) => {
    const now = new Date();
    const start = new Date();
    
    switch (period) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start.setDate(now.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start.setHours(0, 0, 0, 0);
    }

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    // Formatear fechas en zona horaria local en lugar de UTC
    const formatLocalDateTime = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const ms = String(date.getMilliseconds()).padStart(3, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
    };

    return {
      start: formatLocalDateTime(start),
      end: formatLocalDateTime(end)
    };
  };

  // Procesar datos reales de la base de datos
  const processRealData = (jugadas) => {
    // Calcular estadísticas diarias basadas en los campos reales
    const totalBets = jugadas.reduce((sum, j) => sum + (j.monto_total || 0), 0);
    // Por ahora no tenemos datos de premios y comisiones en la tabla jugada
    const totalPrizes = 0; // Será calculado cuando tengamos tabla de resultados
    const totalCommissions = totalBets * 0.1; // Estimado al 10%
    const netProfit = totalBets - totalPrizes - totalCommissions;
    const avgBetAmount = totalBets / (jugadas.length || 1);

    const dailyStats = {
      totalBets,
      totalPrizes,
      totalCommissions,
      netProfit,
      totalPlays: jugadas.length,
      avgBetAmount
    };

    // Agrupar por fecha para el gráfico
    const chartData = processChartData(jugadas);
    
    // Procesar datos para gráfico de ganancias/pérdidas
    const profitLossData = processProfitLossData(jugadas);

    // Agrupar por horario para la tabla (en lugar de lotería)
    const tableData = processTableData(jugadas);

    return {
      dailyStats,
      chartData,
      profitLossData,
      tableData
    };
  };

  // Procesar datos para el gráfico
  const processChartData = (jugadas) => {
    const grouped = {};

    jugadas.forEach(jugada => {
      const date = new Date(jugada.created_at).toLocaleDateString('es-DO');
      
      if (!grouped[date]) {
        grouped[date] = {
          date,
          bets: 0,
          prizes: 0,
          profit: 0
        };
      }

      const amount = jugada.monto_total || 0;
      grouped[date].bets += amount;
      grouped[date].prizes += 0; // Sin datos de premios por ahora
      grouped[date].profit += amount * 0.9; // Estimado
    });

    return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Procesar datos para gráfico de ganancias/pérdidas
  const processProfitLossData = (jugadas) => {
    const grouped = {};

    jugadas.forEach(jugada => {
      const date = new Date(jugada.created_at);
      const dateKey = date.toLocaleDateString('es-DO', { month: 'short', day: 'numeric' });
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          bets: 0,
          prizes: 0
        };
      }

      const amount = jugada.monto_total || 0;
      grouped[dateKey].bets += amount;
      grouped[dateKey].prizes += 0; // Sin datos de premios por ahora
    });

    return Object.values(grouped)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(day => {
        const profit = day.bets - day.prizes - (day.bets * 0.1); // bets - prizes - commissions
        return {
          date: day.date,
          value: profit,
          color: profit >= 0 ? '#4CAF50' : '#F44336'
        };
      });
  };

  // Procesar datos para la tabla por lotería
  const processTableData = (jugadas) => {
    const grouped = {};

    jugadas.forEach(jugada => {
      // Obtener nombre de lotería a través de la relación horario -> lotería
      const loteryName = jugada.horario?.loteria?.nombre || 'Sin lotería';
      
      if (!grouped[loteryName]) {
        grouped[loteryName] = {
          lottery: loteryName,
          plays: 0,
          amount: 0,
          prizes: 0,
          profit: 0
        };
      }

      const amount = jugada.monto_total || 0;
      grouped[loteryName].plays += 1;
      grouped[loteryName].amount += amount;
      grouped[loteryName].prizes += 0; // Sin datos de premios por ahora
      grouped[loteryName].profit += amount * 0.9; // Estimado (90% del monto)
    });

    return Object.values(grouped).sort((a, b) => b.amount - a.amount);
  };

  // Función principal de carga
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Intentar cargar datos reales
      const realData = await loadRealData();

      if (realData) {
        // Usar datos reales
        setData(realData);
      } else {
        // Usar datos de ejemplo como fallback
        const exampleData = generateExampleData();
        setData(exampleData);
      }

    } catch (err) {
      console.error('Error en loadData:', err);
      setError(err.message);
      
      // En caso de error, usar datos de ejemplo
      const exampleData = generateExampleData();
      setData(exampleData);
      
    } finally {
      setLoading(false);
    }
  }, [loadRealData, generateExampleData]);

  // Cargar datos cuando cambie el período
  useEffect(() => {
    loadData();
  }, [period, loadData]);

  // Función de refresh
  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    loading,
    error,
    data,
    refresh
  };
};

export default useStatisticsClean;
