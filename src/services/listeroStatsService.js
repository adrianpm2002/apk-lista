import { supabase } from '../supabaseClient';
import { parseResultado, evaluatePlay, winnersByType, canonicalParle, DEFAULT_PRICES } from '../utils/prizeCalculator';

// Helpers
const toLocalDateStr = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const day = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};

const buildRangeStrings = (from, to) => {
  const s = toLocalDateStr(from) + ' 00:00:00';
  const e = toLocalDateStr(to) + ' 23:59:59.999';
  return { startStr: s, endStr: e };
};

const isTodayLocal = (d) => {
  const dt = new Date(d);
  const now = new Date();
  return dt.getFullYear()===now.getFullYear() && dt.getMonth()===now.getMonth() && dt.getDate()===now.getDate();
};

const startOfTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,'0');
  const d = String(now.getDate()).padStart(2,'0');
  return `${y}-${m}-${d} 00:00:00`;
};

const splitNumbers = (raw) => {
  if (!raw) return [];
  // Acepta separados por espacios o comas
  return String(raw)
    .split(/[ ,]+/)
    .map(s=> s.trim())
    .filter(Boolean);
};

export async function fetchPricesForListero(listeroId){
  try{
    const { data: profile } = await supabase.from('profiles').select('id_precio').eq('id', listeroId).maybeSingle();
    const idPrecio = profile?.id_precio;
    if (idPrecio) {
      const { data: priceRow } = await supabase.from('precio').select('precios').eq('id', idPrecio).maybeSingle();
      if (priceRow?.precios) return priceRow.precios;
    }
  }catch{}
  return DEFAULT_PRICES;
}

// Nueva función para obtener precios específicos por lotería
export async function fetchPricesForListeroAndLottery(listeroId, lotteryId){
  try{
    const { data: profile } = await supabase.from('profiles').select('id_precio').eq('id', listeroId).maybeSingle();
    const gainsData = profile?.id_precio;
    
    if (gainsData && typeof gainsData === 'object') {
      // Buscar el ID de ganancia específico para esta lotería
      const gainId = gainsData[`${lotteryId}_id`];
      
      if (gainId) {
        const { data: priceRow } = await supabase.from('precio').select('precios').eq('id', gainId).maybeSingle();
        if (priceRow?.precios) return priceRow.precios;
      }
    }
  }catch{}
  return DEFAULT_PRICES;
}

export async function fetchJugadasForListero(listeroId, from, to, includeToday=false){
  const { startStr, endStr } = buildRangeStrings(from, to);
  const { data, error } = await supabase
    .from('jugada')
  .select('id, id_horario, id_listero, jugada, numeros, nota, monto_unitario, monto_total, created_at, horario: id_horario (id, nombre, loteria: id_loteria (id, nombre))')
    .eq('id_listero', listeroId)
    .gte('created_at', startStr)
    .lte('created_at', endStr)
    .order('created_at', { ascending: true });
  if (error) {
    throw error;
  }
  const mapped = (data||[]).map(r=> ({
    id: r.id,
    scheduleId: r.horario?.id || r.id_horario,
    scheduleName: r.horario?.nombre || 'Horario',
    lotteryId: r.horario?.loteria?.id || null,
    lotteryName: r.horario?.loteria?.nombre || 'Lotería',
  playType: r.jugada || 'posicion',
  numeros: r.numeros,
  nota: r.nota,
    monto_unitario: r.monto_unitario,
    monto_total: r.monto_total,
    created_at: r.created_at,
  }));
  if (!includeToday){
    const filtered = mapped.filter(j => !isTodayLocal(j.created_at));
    return filtered;
  }
  return mapped;
}

export async function getTotalRecogidoHistorico(listeroId, { excludeToday=true } = {}){
  const query = supabase
    .from('jugada')
    .select('monto_total, monto_unitario, numeros, created_at', { head: false });
  query.eq('id_listero', listeroId);
  if (excludeToday) {
    query.lt('created_at', startOfTodayStr());
  }
  const { data, error } = await query;
  if (error) throw error;
  // Total según regla: usar monto_total si existe; si es null, inferir por cantidad * monto_unitario
  const total = (data||[]).reduce((sum, r) => {
    const mt = r.monto_total;
    if (mt !== null && mt !== undefined) return sum + Number(mt);
    const count = splitNumbers(r.numeros).length;
    return sum + Number(r.monto_unitario || 0) * count;
  }, 0);
  return Number(total.toFixed(2));
}

export async function getTotalPagadoHistorico(listeroId, { excludeToday=true } = {}){
  // Obtener banco del listero primero
  const { data: listeroProfile } = await supabase
    .from('profiles')
    .select('id_banco')
    .eq('id', listeroId)
    .maybeSingle();
  
  const bankId = listeroProfile?.id_banco;

  // Obtener todas las jugadas del listero (excluye hoy)
  const jugQuery = supabase
    .from('jugada')
  .select('id, id_horario, jugada, numeros, monto_unitario, created_at, horario: id_horario (id, nombre, loteria: id_loteria (id, nombre))');
  jugQuery.eq('id_listero', listeroId);
  if (excludeToday) jugQuery.lt('created_at', startOfTodayStr());
  const { data: jugadas, error } = await jugQuery;
  if (error) throw error;
  const js = (jugadas||[]).map(r=> ({
    id: r.id,
    scheduleId: r.horario?.id || r.id_horario,
    lotteryId: r.horario?.loteria?.id || null,
    playType: r.jugada || 'posicion',
    numeros: r.numeros,
    amount: r.monto_unitario,
    created_at: r.created_at,
  }));
  if (!js.length) return 0;

  // Rango de resultados según fechas de jugadas (con filtro de banco)
  const minDate = js.reduce((min, j)=> Math.min(min, new Date(j.created_at).getTime()), Infinity);
  const maxDate = js.reduce((max, j)=> Math.max(max, new Date(j.created_at).getTime()), 0);
  const from = new Date(minDate);
  const to = new Date(maxDate);
  const resMap = await fetchResultadosByHorarioDay(from, to, bankId);
  const limitedMap = await fetchNumeroLimitadoByHorario(js.map(j=> j.scheduleId));

  let total = 0;
  for (const j of js){
    const day = toLocalDateStr(j.created_at);
    const resNums = resMap.get(`${j.scheduleId}|${day}`);
    const { pago } = await computePagoForJugadaWithLottery(listeroId, {
      numeros: j.numeros,
      monto_unitario: j.amount,
      playType: j.playType,
      lotteryId: j.lotteryId,
    }, resNums, limitedMap.get(j.scheduleId));
    total += Number(pago || 0);
  }
  return Number(total.toFixed(2));
}

export async function fetchResultadosByHorarioDay(from, to, bankId = null){
  const { startStr, endStr } = buildRangeStrings(from, to);
  
  if (bankId) {
    // Consulta con filtro de banco
    const { data, error } = await supabase
      .from('resultado')
      .select(`
        id_horario, numeros, created_at,
        horario:horario(id, loteria:loteria(id, id_banco))
      `)
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .order('created_at', { ascending: true });
    if (error) {
      throw error;
    }
    
    // Filtrar por banco después de la consulta
    const filteredData = (data||[]).filter(r => 
      r.horario?.loteria?.id_banco === bankId
    );
    
    // Mantener la última del día por id_horario
    const map = new Map(); // key: `${id_horario}|${YYYY-MM-DD}` => numeros
    filteredData.forEach(r=> {
      const day = toLocalDateStr(r.created_at);
      map.set(`${r.id_horario}|${day}`, r.numeros);
    });
    return map;
  } else {
    // Consulta sin filtro de banco (para compatibilidad)
    const { data, error } = await supabase
      .from('resultado')
      .select('id_horario, numeros, created_at')
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .order('created_at', { ascending: true });
    if (error) {
      throw error;
    }
    // Mantener la última del día por id_horario
    const map = new Map(); // key: `${id_horario}|${YYYY-MM-DD}` => numeros
    (data||[]).forEach(r=> {
      const day = toLocalDateStr(r.created_at);
      map.set(`${r.id_horario}|${day}`, r.numeros);
    });
    return map;
  }
}

export async function fetchNumeroLimitadoByHorario(horarioIds){
  if (!horarioIds?.length) return new Map();
  const { data, error } = await supabase
    .from('numero_limitado')
    .select('id_horario, numero')
    .in('id_horario', Array.from(new Set(horarioIds)));
  if (error) throw error;
  const map = new Map();
  (data||[]).forEach(r=> {
    if (!map.has(r.id_horario)) map.set(r.id_horario, new Set());
    map.get(r.id_horario).add(String(r.numero));
  });
  return map;
}

export function inferMontoRecogido(j){
  if (j.monto_total != null && j.monto_total !== undefined) return Number(j.monto_total);
  const count = splitNumbers(j.numeros).length;
  return Number(j.monto_unitario || 0) * count;
}

export function computePagoForJugada(j, resultadoNumeros, limitedSet, prices){
  if (!resultadoNumeros) {
    return { hasPrize:false, pago:0, estado:'resultado no disponible', resultado:null };
  }
  const parsed = parseResultado(resultadoNumeros);
  const evalRes = evaluatePlay({ playType: j.playType || 'posicion', numbers: j.numeros, amount: j.monto_unitario }, parsed, limitedSet || new Set(), prices || DEFAULT_PRICES);
  const pay = Number(Number(evalRes.pay || 0).toFixed(2));
  return { hasPrize: evalRes.hasPrize, pago: pay, estado: evalRes.hasPrize ? 'bingo' : 'no cogió premio', resultado: resultadoNumeros };
}

// Nueva función que calcula el pago usando precios específicos por lotería
export async function computePagoForJugadaWithLottery(listeroId, j, resultadoNumeros, limitedSet){
  if (!resultadoNumeros) {
    return { hasPrize:false, pago:0, estado:'resultado no disponible', resultado:null };
  }
  
  // Obtener precios específicos para la lotería de esta jugada
  const prices = await fetchPricesForListeroAndLottery(listeroId, j.lotteryId);
  
  const parsed = parseResultado(resultadoNumeros);
  const evalRes = evaluatePlay({ playType: j.playType || 'posicion', numbers: j.numeros, amount: j.monto_unitario }, parsed, limitedSet || new Set(), prices);
  const pay = Number(Number(evalRes.pay || 0).toFixed(2));
  return { hasPrize: evalRes.hasPrize, pago: pay, estado: evalRes.hasPrize ? 'bingo' : 'no cogió premio', resultado: resultadoNumeros };
}

// Heurística simple si se requiere tipo; si el proyecto guarda j.jugada, usarlo en su lugar
function guessPlayType(numbersStr){
  // Mantener como 'posicion' por defecto; en producción, traer el campo jugada de la tabla si existe
  return 'posicion';
}

export async function getDailyStats(listeroId, { from, to, lotteryId=null, scheduleId=null, includeToday=false, onlyClosedToday=false }){
  try {
    // Construir query para v_statistics_complete
    const { startStr, endStr } = buildRangeStrings(from, to);
    
    let query = supabase
      .from('v_statistics_complete')
      .select('*')
      .eq('id_listero', listeroId)
      .gte('created_at', startStr)
      .lte('created_at', endStr);

    // Aplicar filtros opcionales
    if (lotteryId) {
      query = query.eq('loteria_id', lotteryId);
    }
    if (scheduleId) {
      query = query.eq('horario_id', scheduleId);
    }

    const { data: statsData, error } = await query;

    if (error) {
      console.error('Error consultando v_statistics_complete:', error);
      throw error;
    }

    // Agrupar por día y calcular totales
    const groupedByDay = (statsData || []).reduce((acc, row) => {
      const day = row.fecha_dia || new Date().toISOString().split('T')[0];
      
      // Aplicar filtros de hoy si es necesario
      const todayStr = toLocalDateStr(new Date());
      if (day === todayStr && onlyClosedToday && includeToday) {
        // Solo incluir si el estado de la lotería es cerrado
        if (row.estado_loteria !== 'cerrado') {
          return acc;
        }
      }
      
      if (!acc[day]) {
        acc[day] = {
          day,
          total_recogido: 0,
          total_pagado: 0,
          listeroEarning: 0
        };
      }
      
      acc[day].total_recogido += Number(row.bruto) || 0;
      acc[day].total_pagado += Number(row.premio) || 0;
      acc[day].listeroEarning += Number(row.ganancia_listero) || 0;
      
      return acc;
    }, {});

    // Convertir a array y ordenar por día
    const dailyStats = Object.values(groupedByDay).sort((a, b) => a.day.localeCompare(b.day));
    
    console.log('📊 getDailyStats desde v_statistics_complete:', {
      input: { listeroId, from: startStr, to: endStr, lotteryId, scheduleId },
      output: dailyStats
    });
    
    return dailyStats;
    
  } catch (error) {
    console.error('Error en getDailyStats:', error);
    // Fallback al método original si hay error
    return getDailyStatsOriginal(listeroId, { from, to, lotteryId, scheduleId, includeToday, onlyClosedToday });
  }
}

// Función original como fallback
async function getDailyStatsOriginal(listeroId, { from, to, lotteryId=null, scheduleId=null, includeToday=false, onlyClosedToday=false }){
  // Obtener banco del listero primero
  const { data: listeroProfile } = await supabase
    .from('profiles')
    .select('id_banco')
    .eq('id', listeroId)
    .maybeSingle();
  
  const bankId = listeroProfile?.id_banco;
  
  const [jugadas, resMap] = await Promise.all([
    fetchJugadasForListero(listeroId, from, to, includeToday),
    fetchResultadosByHorarioDay(from, to, bankId),
  ]);

  const horarioIds = jugadas.map(j=> j.scheduleId);
  const limitedMap = await fetchNumeroLimitadoByHorario(horarioIds);

  const todayStr = toLocalDateStr(new Date());
  const filtered = jugadas.filter(j=> (
    (lotteryId? j.lotteryId===lotteryId : true) &&
    (scheduleId? j.scheduleId===scheduleId : true)
  ));

  const rows = [];
  for (const j of filtered) {
    const day = toLocalDateStr(j.created_at);
    const resNums = resMap.get(`${j.scheduleId}|${day}`);
    const { pago } = await computePagoForJugadaWithLottery(listeroId, j, resNums, limitedMap.get(j.scheduleId));
    const recogido = inferMontoRecogido(j);
    const listeroEarning = await calculateListeroEarnings(listeroId, [j]);
    rows.push({ day, recogido, pagado: pago, listeroEarning });
  }
  
  const filteredRows = rows.filter(r=> {
    if(includeToday && onlyClosedToday && r.day === todayStr){
      // mantener solo días de hoy que tengan resultado (cerradas)
      // Encontrar si existe resultado para cualquier horario en ese día
      // Como rows ya está por día agregado luego, aquí no conocemos scheduleId;
      // por eso aplicaremos el filtro más abajo al agregar por day revisando resMap.
      return true;
    }
    return true;
  });

  const agg = filteredRows.reduce((acc, r)=>{
    if(!acc[r.day]) acc[r.day] = { day:r.day, total_recogido:0, total_pagado:0, total_listero_earning:0 };
    acc[r.day].total_recogido += r.recogido;
    acc[r.day].total_pagado += r.pagado;
    acc[r.day].total_listero_earning += r.listeroEarning;
    return acc;
  }, {});

  let result = Object.values(agg)
    .sort((a,b)=> a.day.localeCompare(b.day))
  .map(x=> ({ 
    ...x, 
    total_recogido: Number(x.total_recogido.toFixed(2)), 
    total_pagado: Number(x.total_pagado.toFixed(2)), 
    total_listero_earning: Number(x.total_listero_earning.toFixed(2)),
    balance: Number((x.total_recogido - x.total_pagado - x.total_listero_earning).toFixed(2)) 
  }));

  if(includeToday && onlyClosedToday){
    // Filtrar el día de hoy si no hay ningún resultado registrado para ese día
    const hasAnyResultToday = Array.from(resMap.keys()).some(k=> k.endsWith(`|${todayStr}`));
    if(!hasAnyResultToday){
      result = result.filter(r=> r.day !== todayStr);
    }
  }
  return result;
}

export async function getByHorarioStats(listeroId, { from, to, includeToday=false }){
  // Obtener banco del listero primero
  const { data: listeroProfile } = await supabase
    .from('profiles')
    .select('id_banco')
    .eq('id', listeroId)
    .maybeSingle();
  
  const bankId = listeroProfile?.id_banco;
  
  const [jugadas, resMap] = await Promise.all([
    fetchJugadasForListero(listeroId, from, to, includeToday),
    fetchResultadosByHorarioDay(from, to, bankId),
  ]);
  const limitedMap = await fetchNumeroLimitadoByHorario(jugadas.map(j=> j.scheduleId));

  const rows = [];
  for (const j of jugadas) {
    const day = toLocalDateStr(j.created_at);
    const resNums = resMap.get(`${j.scheduleId}|${day}`);
    const { pago } = await computePagoForJugadaWithLottery(listeroId, j, resNums, limitedMap.get(j.scheduleId));
    const recogido = inferMontoRecogido(j);
    rows.push({ scheduleId:j.scheduleId, scheduleName:j.scheduleName, lotteryName:j.lotteryName, total_recogido:recogido, total_pagado:pago });
  }

  const agg = rows.reduce((acc, r)=>{
    if(!acc[r.scheduleId]) acc[r.scheduleId] = { id_horario:r.scheduleId, schedule_name:r.scheduleName, lottery_name:r.lotteryName, total_recogido:0, total_pagado:0 };
    acc[r.scheduleId].total_recogido += r.total_recogido;
    acc[r.scheduleId].total_pagado += r.total_pagado;
    return acc;
  }, {});

  return Object.values(agg).map(x=> ({ ...x, total_recogido: Number(x.total_recogido.toFixed(2)), total_pagado: Number(x.total_pagado.toFixed(2)), balance: Number((x.total_recogido - x.total_pagado).toFixed(2)) }));
}

export async function getPlaysDetails(listeroId, { from, to, lotteryId=null, scheduleId=null, includeToday=false, onlyClosedToday=false }){
  try {
    // Construir query para v_statistics_complete
    const { startStr, endStr } = buildRangeStrings(from, to);
    
    let query = supabase
      .from('v_statistics_complete')
      .select('*')
      .eq('id_listero', listeroId)
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .order('created_at', { ascending: false });

    // Aplicar filtros opcionales
    if (lotteryId) {
      query = query.eq('loteria_id', lotteryId);
    }
    if (scheduleId) {
      query = query.eq('horario_id', scheduleId);
    }

    const { data: statsData, error } = await query;

    if (error) {
      console.error('Error consultando v_statistics_complete para detalles:', error);
      throw error;
    }

    // Filtrar por hoy si es necesario
    const todayStr = toLocalDateStr(new Date());
    const filteredData = (statsData || []).filter(row => {
      const rowDay = row.fecha_dia;
      
      if (rowDay === todayStr && onlyClosedToday && includeToday) {
        // Solo incluir si el estado de la lotería es cerrado
        return row.estado_loteria === 'cerrado';
      }
      
      return true;
    });

    // Mapear a formato esperado
    const result = filteredData.map(row => ({
      created_at: row.created_at,
      jugada: row.play_type,
      numeros: row.numeros,
      monto_unitario: row.monto_unitario,
      monto_total: row.bruto,
      nota: row.nota || '',
      lottery_name: row.loteria_nombre,
      schedule_name: row.horario_nombre,
      resultado: row.resultado,
      pago_calculado: row.premio,
      estado: row.premio > 0 ? 'ganada' : 'perdida',
      ganancia_listero: row.ganancia_listero,
      ganancia_colector: row.ganancia_colector,
      balance_listero: row.balance_listero,
      balance_colector: row.balance_colector
    }));
    
    console.log('📋 getPlaysDetails desde v_statistics_complete:', {
      input: { listeroId, from: startStr, to: endStr, lotteryId, scheduleId },
      output: `${result.length} jugadas`
    });
    
    return result;
    
  } catch (error) {
    console.error('Error en getPlaysDetails:', error);
    // Fallback al método original si hay error
    return getPlaysDetailsOriginal(listeroId, { from, to, lotteryId, scheduleId, includeToday, onlyClosedToday });
  }
}

// Función original como fallback
async function getPlaysDetailsOriginal(listeroId, { from, to, lotteryId=null, scheduleId=null, includeToday=false, onlyClosedToday=false }){
  // Obtener banco del listero primero
  const { data: listeroProfile } = await supabase
    .from('profiles')
    .select('id_banco')
    .eq('id', listeroId)
    .maybeSingle();
  
  const bankId = listeroProfile?.id_banco;
  
  const [jugadas, resMap] = await Promise.all([
    fetchJugadasForListero(listeroId, from, to, includeToday),
    fetchResultadosByHorarioDay(from, to, bankId),
  ]);
  const limitedMap = await fetchNumeroLimitadoByHorario(jugadas.map(j=> j.scheduleId));

  const todayStr = toLocalDateStr(new Date());
  const filtered = jugadas.filter(j=> (
    (lotteryId? j.lotteryId===lotteryId : true) &&
    (scheduleId? j.scheduleId===scheduleId : true)
  )).filter(j=>{
    if(includeToday && onlyClosedToday){
      const day = toLocalDateStr(j.created_at);
      if(day === todayStr){
        // incluir solo si hay resultado para ese horario hoy
        return resMap.has(`${j.scheduleId}|${todayStr}`);
      }
    }
    return true;
  });

  const result = [];
  for (const j of filtered) {
    const day = toLocalDateStr(j.created_at);
    const resNums = resMap.get(`${j.scheduleId}|${day}`);
    const { pago, estado, resultado } = await computePagoForJugadaWithLottery(listeroId, j, resNums, limitedMap.get(j.scheduleId));
    
    // Calcular ganancia del listero para esta jugada
    const listeroEarning = await calculateListeroEarnings(listeroId, [j]);
    
    result.push({
      id: j.id,
      created_at: j.created_at,
      numeros: j.numeros,
      jugada: j.playType,
      nota: j.nota,
      monto_unitario: j.monto_unitario,
      monto_total: j.monto_total,
      resultado: resultado || null,
      estado,
      pago_calculado: Number(Number(pago).toFixed(2)),
      lottery_name: j.lotteryName,
      schedule_name: j.scheduleName,
      id_loteria: j.lotteryId,
      listero_earning: Number(listeroEarning.toFixed(2)), // Ganancia del listero
    });
  }
  
  return result;
}

export async function getByLotteryStats(listeroId, { from, to, includeToday=false }){
  const [jugadas, resMap] = await Promise.all([
    fetchJugadasForListero(listeroId, from, to, includeToday),
    fetchResultadosByHorarioDay(from, to),
  ]);
  const limitedMap = await fetchNumeroLimitadoByHorario(jugadas.map(j=> j.scheduleId));

  const rows = [];
  for (const j of jugadas) {
    const day = toLocalDateStr(j.created_at);
    const resNums = resMap.get(`${j.scheduleId}|${day}`);
    const { pago } = await computePagoForJugadaWithLottery(listeroId, j, resNums, limitedMap.get(j.scheduleId));
    const recogido = inferMontoRecogido(j);
    rows.push({ lotteryName:j.lotteryName, total_recogido:recogido, total_pagado:pago });
  }

  const agg = rows.reduce((acc, r)=>{
    const key = r.lotteryName || 'Lotería';
    if(!acc[key]) acc[key] = { lottery_name:key, total_recogido:0, total_pagado:0 };
    acc[key].total_recogido += r.total_recogido;
    acc[key].total_pagado += r.total_pagado;
    return acc;
  }, {});

  return Object.values(agg).map(x=> ({ ...x, total_recogido: Number(x.total_recogido.toFixed(2)), total_pagado: Number(x.total_pagado.toFixed(2)), balance: Number((x.total_recogido - x.total_pagado).toFixed(2)) }));
}

// Exponer contratos estilo "endpoint"
export async function getDailyStatsEndpoint(listeroId, rangeDays=7){
  const to = new Date();
  const from = new Date(); from.setDate(to.getDate() - rangeDays + 1);
  return await getDailyStats(listeroId, { from, to, includeToday:false });
}

// getByHorarioEndpoint eliminado del uso actual en UI

export async function getPlaysDetailsEndpoint(listeroId, from, to){
  return await getPlaysDetails(listeroId, { from, to });
}

export async function getByLotteryEndpoint(listeroId, from, to){
  return await getByLotteryStats(listeroId, { from, to });
}

// Nueva función para calcular las ganancias del listero específicas por lotería
export async function calculateListeroEarnings(listeroId, plays) {
  try {
    // Obtener configuración de ganancias del listero
    const { data: profile } = await supabase.from('profiles').select('id_precio').eq('id', listeroId).maybeSingle();
    const gainsData = profile?.id_precio;
    
    if (!gainsData || typeof gainsData !== 'object') {
      return 0; // Sin ganancias configuradas
    }
    
    let totalEarnings = 0;
    
    // Agrupar jugadas por lotería y tipo de jugada
    const playsByLotteryAndType = new Map();
    
    for (const play of plays) {
      const lotteryId = play.id_loteria || play.lotteryId;
      const playType = play.jugada || play.playType || 'posicion';
      
      if (!lotteryId) continue;
      
      const key = `${lotteryId}_${playType}`;
      if (!playsByLotteryAndType.has(key)) {
        playsByLotteryAndType.set(key, {
          lotteryId,
          playType,
          totalAmount: 0,
          plays: []
        });
      }
      
      const group = playsByLotteryAndType.get(key);
      const amount = play.monto_total != null ? Number(play.monto_total) : 
                   ((play.monto_unitario || 0) * (play.numeros?.split(',').length || 1));
      
      group.totalAmount += amount;
      group.plays.push(play);
    }
    
    // Calcular ganancias por cada grupo
    for (const [key, group] of playsByLotteryAndType) {
      const gainId = gainsData[`${group.lotteryId}_id`];
      
      if (!gainId) continue; // Sin ganancia configurada para esta lotería
      
      try {
        // Obtener configuración de precios/porcentajes
        const { data: priceConfig } = await supabase
          .from('precio')
          .select('precios')
          .eq('id', gainId)
          .maybeSingle();
        
        if (priceConfig?.precios) {
          const playTypeConfig = priceConfig.precios[group.playType];
          const listeroPercentage = playTypeConfig?.listeroPct || 0;
          
          // Calcular ganancia: monto total * porcentaje del listero / 100
          const earnings = (group.totalAmount * listeroPercentage) / 100;
          totalEarnings += earnings;
        }
      } catch (err) {
        console.error(`Error obteniendo configuración para ganancia ${gainId}:`, err);
      }
    }
    
    return Number(totalEarnings.toFixed(2));
  } catch (error) {
    console.error('Error calculando ganancias del listero:', error);
    return 0;
  }
}
