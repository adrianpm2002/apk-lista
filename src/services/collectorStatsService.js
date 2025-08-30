import { supabase } from '../supabaseClient';
import { calculatePrize } from '../utils/prizeCalculator';

export async function getDailyStatsForCollector(collectorId, startDate, endDate) {
  const { data: jugadas, error } = await supabase
    .from('jugada')
    .select(`
      id, created_at, numeros, monto_unitario, monto_total,
      listero_id,
      listero!inner(collector_id, nombre),
      loteria!inner(nombre, tipo),
      horario!inner(nombre, hora),
      numero_limitado(numero, tarifa_aplicada),
      resultado(numero_ganador)
    `)
    .eq('listero.collector_id', collectorId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const dailyStats = {};
  
  jugadas.forEach(jugada => {
    const date = jugada.created_at.split('T')[0];
    if (!dailyStats[date]) {
      dailyStats[date] = { totalRecogido: 0, totalPagado: 0 };
    }

    const monto = jugada.monto_total || (jugada.monto_unitario * getQuantityFromNumbers(jugada.numeros));
    dailyStats[date].totalRecogido += monto;

    if (jugada.resultado?.numero_ganador) {
      const pago = calculatePrize(jugada, jugada.resultado.numero_ganador, jugada.numero_limitado);
      dailyStats[date].totalPagado += pago;
    }
  });

  return Object.entries(dailyStats).map(([date, stats]) => ({
    date,
    totalRecogido: parseFloat(stats.totalRecogido.toFixed(2)),
    totalPagado: parseFloat(stats.totalPagado.toFixed(2)),
    balance: parseFloat((stats.totalRecogido - stats.totalPagado).toFixed(2))
  }));
}

export async function getPlaysDetailsForCollector(collectorId, startDate, endDate, filters = {}) {
  let query = supabase
    .from('jugada')
    .select(`
      id, created_at, numeros, monto_unitario, monto_total,
      listero_id,
      listero!inner(collector_id, nombre),
      loteria!inner(nombre, tipo),
      horario!inner(nombre, hora),
      numero_limitado(numero, tarifa_aplicada),
      resultado(numero_ganador)
    `)
    .eq('listero.collector_id', collectorId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (filters.lottery) query = query.eq('loteria.nombre', filters.lottery);
  if (filters.schedule) query = query.eq('horario.nombre', filters.schedule);
  if (filters.listero) query = query.eq('listero_id', filters.listero);

  const { data: jugadas, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  const groupedByListero = {};
  
  jugadas.forEach(jugada => {
    const listeroId = jugada.listero_id;
    if (!groupedByListero[listeroId]) {
      groupedByListero[listeroId] = {
        listero: jugada.listero.nombre,
        plays: []
      };
    }

    const monto = jugada.monto_total || (jugada.monto_unitario * getQuantityFromNumbers(jugada.numeros));
    let pago = 0;
    let estado = 'no cogió premio';

    if (jugada.resultado?.numero_ganador) {
      pago = calculatePrize(jugada, jugada.resultado.numero_ganador, jugada.numero_limitado);
      estado = pago > 0 ? 'bingo' : 'no cogió premio';
    }

    groupedByListero[listeroId].plays.push({
      id: jugada.id,
      created_at: jugada.created_at,
      numeros: jugada.numeros,
      monto_unitario: parseFloat(jugada.monto_unitario.toFixed(2)),
      monto_total: parseFloat(monto.toFixed(2)),
      resultado: jugada.resultado?.numero_ganador || 'resultado no disponible',
      estado,
      pago_calculado: parseFloat(pago.toFixed(2)),
      loteria: jugada.loteria.nombre,
      horario: jugada.horario.nombre
    });
  });

  return groupedByListero;
}

function getQuantityFromNumbers(numerosStr) {
  return numerosStr.split(',').length;
}

export async function getTotalRecogidoHistoricoCollector(collectorId) {
  const { data, error } = await supabase
    .from('jugada')
    .select(`
      monto_unitario, monto_total, numeros,
      listero!inner(collector_id)
    `)
    .eq('listero.collector_id', collectorId);

  if (error) throw error;

  return data.reduce((total, jugada) => {
    const monto = jugada.monto_total || (jugada.monto_unitario * getQuantityFromNumbers(jugada.numeros));
    return total + monto;
  }, 0);
}

export async function getTotalPagadoHistoricoCollector(collectorId) {
  const { data, error } = await supabase
    .from('jugada')
    .select(`
      monto_unitario, numeros,
      listero!inner(collector_id),
      loteria!inner(tipo),
      numero_limitado(numero, tarifa_aplicada),
      resultado(numero_ganador)
    `)
    .eq('listero.collector_id', collectorId)
    .not('resultado', 'is', null);

  if (error) throw error;

  return data.reduce((total, jugada) => {
    if (jugada.resultado?.numero_ganador) {
      const pago = calculatePrize(jugada, jugada.resultado.numero_ganador, jugada.numero_limitado);
      return total + pago;
    }
    return total;
  }, 0);
}
