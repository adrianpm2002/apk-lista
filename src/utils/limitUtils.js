import { supabase } from '../supabaseClient';

export const fetchLimitsContext = async (horarios, userId) => {
  if(!horarios.length) return { limitMap:new Map(), specificLimits:null, lotteryLimits:{}, horarioToLoteria:new Map(), usageMap:new Map() };
  let specificLimits=null;
  let bankId=null;
  if(userId){
    const { data: profile } = await supabase.from('profiles').select('limite_especifico, id_banco').eq('id', userId).maybeSingle();
    specificLimits = profile?.limite_especifico || null;
    bankId = profile?.id_banco;
  }
  
  // Obtener límites por número
  const { data: limitRows } = await supabase.from('limite_numero').select('numero, limite, jugada, id_horario').in('id_horario', horarios);
  const limitMap=new Map();
  (limitRows||[]).forEach(r=> limitMap.set(r.id_horario+"|"+r.jugada+"|"+r.numero, r.limite));
  
  // Obtener información de horarios y sus loterías
  const { data: horariosData } = await supabase
    .from('horario')
    .select('id, id_loteria')
    .in('id', horarios);
  
  const horarioToLoteria = new Map();
  (horariosData || []).forEach(h => {
    horarioToLoteria.set(h.id, h.id_loteria);
  });
  
  // Obtener límites por lotería - NUEVA FUNCIONALIDAD
  let lotteryLimits = {};
  try {
    if (horariosData && horariosData.length > 0) {
      const lotteryIds = [...new Set(horariosData.map(h => h.id_loteria))];
      console.log('🔍 [limitUtils] Cargando límites para loterías:', lotteryIds);
      
      // Cargar límites por lotería
      const { data: lotteryLimitsData, error: lotteryError } = await supabase
        .from('limite_loteria')
        .select('id_loteria, limites')
        .in('id_loteria', lotteryIds);
      
      if (lotteryError) {
        console.warn('🔍 [limitUtils] Error cargando límites de lotería:', lotteryError);
      } else {
        console.log('🔍 [limitUtils] Datos de límites por lotería cargados:', lotteryLimitsData);
      }
      
      if (lotteryLimitsData) {
        lotteryLimitsData.forEach(item => {
          lotteryLimits[item.id_loteria] = item.limites || {};
        });
        console.log('🎯 [limitUtils] Límites por lotería cargados:', Object.keys(lotteryLimits).length, 'loterías');
        console.log('🎯 [limitUtils] Límites por lotería detalle:', lotteryLimits);
      }
    }
  } catch (e) {
    console.warn('Error loading lottery limits in limitUtils, continuing without them:', e.message);
    lotteryLimits = {};
  }
  
  const dayStart=new Date(); dayStart.setHours(0,0,0,0);
  // Usar un rango más amplio para asegurar que capture todas las jugadas del día
  const dayStartUTC = new Date(dayStart.getTime() - (12 * 60 * 60 * 1000)); // 12 horas antes para cubrir zonas horarias
  const dayEndUTC = new Date(dayStart.getTime() + (36 * 60 * 60 * 1000)); // 36 horas después para cubrir zonas horarias
  
  console.log('🔍 [limitUtils] Consultando jugadas desde:', dayStartUTC.toISOString(), 'hasta:', dayEndUTC.toISOString());
  console.log('🔍 [limitUtils] Horarios para consulta:', horarios);
  console.log('🔍 [limitUtils] Bank ID:', bankId);
  
  // Filtrar jugadas del día solo del mismo banco - usando rango amplio de fechas
  let jugadasQuery = supabase.from('jugada')
    .select('id_horario,jugada,numeros,monto_unitario,created_at,id_listero')
    .gte('created_at', dayStartUTC.toISOString())
    .lte('created_at', dayEndUTC.toISOString())
    .in('id_horario', horarios);
  
  if (bankId) {
    // Obtener listeros del mismo banco
    const { data: listeros, error: listerosError } = await supabase.from('profiles').select('id').eq('id_banco', bankId);
    console.log('🔍 [limitUtils] Listeros del banco:', listeros, 'Error:', listerosError);
    const listerosIds = (listeros||[]).map(l => l.id);
    if (listerosIds.length > 0) {
      jugadasQuery = jugadasQuery.in('id_listero', listerosIds);
      console.log('🔍 [limitUtils] Filtrando por listeros:', listerosIds);
    } else {
      // Si no hay listeros del banco, no hay jugadas válidas
      console.log('🔍 [limitUtils] No hay listeros en el banco, retornando usageMap vacío');
      return { limitMap, specificLimits, lotteryLimits, horarioToLoteria, usageMap:new Map() };
    }
  }
  
  const { data: jugadasDia, error: jugadasError } = await jugadasQuery;
  console.log('🔍 [limitUtils] Jugadas del día encontradas:', jugadasDia?.length || 0, 'Error:', jugadasError);
  
  // Consulta adicional para verificar si hay jugadas en general (sin filtro de fecha)
  const { data: jugadasTodas, error: jugadasTodasError } = await supabase.from('jugada')
    .select('id_horario,jugada,numeros,monto_unitario,created_at,id_listero')
    .in('id_horario', horarios)
    .limit(5);
  console.log('🔍 [limitUtils] Jugadas totales encontradas (últimas 5):', jugadasTodas?.length || 0, 'Error:', jugadasTodasError);
  if (jugadasTodas && jugadasTodas.length > 0) {
    console.log('🔍 [limitUtils] Muestra de jugadas:', jugadasTodas.map(j => ({
      created_at: j.created_at,
      jugada: j.jugada,
      numeros: j.numeros,
      monto: j.monto_unitario
    })));
  }
  console.log('🔍 [limitUtils] Jugadas del día encontradas:', jugadasDia?.length || 0, 'Error:', jugadasError);
  const usageMap=new Map();
  (jugadasDia||[]).forEach(j=>{
    console.log('🔍 [limitUtils] Procesando jugada:', {
      id_horario: j.id_horario,
      jugada: j.jugada,
      numeros: j.numeros,
      monto_unitario: j.monto_unitario,
      id_listero: j.id_listero
    });
    (j.numeros||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(n=>{
      let canonical = n;
      if(j.jugada==='parle'){
        // Normalizar parle como combinación sin orden por pares de 2 dígitos: AB|CD == CD|AB
        const d = n.replace(/[^0-9]/g,'');
        if(d.length===4){ const a=d.slice(0,2), b=d.slice(2); canonical = [a,b].sort().join(''); }
      }
      const k = j.id_horario+"|"+j.jugada+"|"+canonical;
      const prevUsage = usageMap.get(k)||0;
      const newUsage = prevUsage + (j.monto_unitario||0);
      usageMap.set(k, newUsage);
      console.log(`🔍 [limitUtils] Uso actualizado para ${k}: ${prevUsage} + ${j.monto_unitario} = ${newUsage}`);
    });
  });
  console.log('🔍 [limitUtils] UsageMap final:', Array.from(usageMap.entries()));
  return { limitMap, specificLimits, lotteryLimits, horarioToLoteria, usageMap };
};

export const checkInstructionsLimits = (instructions, horarios, limitCtx) => {
  console.log('🔍 [limitUtils] Iniciando validación de límites');
  console.log('🔍 [limitUtils] Horarios:', horarios);
  console.log('🔍 [limitUtils] Contexto límites:', {
    limitMap: Array.from(limitCtx.limitMap.entries()),
    specificLimits: limitCtx.specificLimits,
    lotteryLimits: limitCtx.lotteryLimits,
    horarioToLoteria: Array.from(limitCtx.horarioToLoteria.entries()),
    usageMapSize: limitCtx.usageMap.size
  });
  
  const violations=[];
  // Agregar intentos por clave canónica para cada horario y jugada
  const attemptMap = new Map(); // key: h|jugada|canonical -> intento total

  const toCanonicalParle = (n) => {
    const d = (n||'').replace(/[^0-9]/g,'');
    if(d.length===4){ const a=d.slice(0,2), b=d.slice(2); return [a,b].sort().join(''); }
    return n;
  };

  // Función auxiliar para calcular el límite efectivo (igual que useCapacityData)
  const calculateEffectiveLimit = (perNumber, lotteryLimit, specLimit) => {
    const limits = [];
    if (perNumber !== undefined && perNumber !== null) limits.push(perNumber);
    if (lotteryLimit !== undefined && lotteryLimit !== null) limits.push(lotteryLimit);
    if (specLimit !== undefined && specLimit !== null) limits.push(specLimit);
    console.log(`🔍 [limitUtils] Límites disponibles: número=${perNumber}, lotería=${lotteryLimit}, específico=${specLimit}, resultado=${limits.length > 0 ? Math.min(...limits) : null}`);
    return limits.length > 0 ? Math.min(...limits) : null;
  };

  instructions.forEach(instr => {
    const jugada = instr.playType;
    // contar ocurrencias originales (incluso invertidas separadas)
    const counts = instr.numbers.reduce((acc,n)=> (acc[n]=(acc[n]||0)+1, acc), {});
    Object.keys(counts).forEach(num => {
      const canonical = (jugada==='parle') ? toCanonicalParle(num) : num;
      horarios.forEach(h => {
        const key = `${h}|${jugada}|${canonical}`;
        const prev = attemptMap.get(key)||0;
        const add = (instr.amountEach||0) * counts[num];
        attemptMap.set(key, prev + add);
      });
    });
  });

  // Comparar intentos agregados con límites efectivos (incluyendo límites por lotería)
  attemptMap.forEach((attempt, key) => {
    const [h, jugada, canonical] = key.split('|');
    
    console.log(`🔍 [limitUtils] Evaluando: ${jugada} ${canonical} en horario ${h}, intento: ${attempt}`);
    
    // Límite por número específico
    const perNumber = limitCtx.limitMap.get(key);
    
    // Límite específico del listero
    const specLimit = limitCtx.specificLimits && limitCtx.specificLimits[jugada];
    
    // Límite por lotería - NUEVA FUNCIONALIDAD
    const lotteryId = limitCtx.horarioToLoteria && limitCtx.horarioToLoteria.get(h);
    const lotteryLimit = lotteryId && limitCtx.lotteryLimits && limitCtx.lotteryLimits[lotteryId] && limitCtx.lotteryLimits[lotteryId][jugada];
    
    console.log(`🔍 [limitUtils] Límites encontrados: número=${perNumber}, lotería=${lotteryLimit} (lotteryId=${lotteryId}), específico=${specLimit}`);
    
    // Calcular límite efectivo (mínimo entre los tres tipos)
    const effective = calculateEffectiveLimit(perNumber, lotteryLimit, specLimit);
    
    if(!effective) {
      console.log(`🔍 [limitUtils] No hay límites efectivos para ${jugada} ${canonical}, permitiendo inserción`);
      return;
    }
    const used = limitCtx.usageMap.get(key)||0;
    console.log(`🔍 [limitUtils] Límite efectivo: ${effective}, usado: ${used}, intento: ${attempt}, total: ${used + attempt}`);
    
    if(used + attempt > effective){
      violations.push({ 
        numero: canonical, 
        jugada, 
        permitido: effective, 
        usado: used, 
        intento: attempt,
        limitType: perNumber !== undefined ? 'número' : (lotteryLimit !== undefined ? 'lotería' : 'listero')
      });
      console.log(`🚫 [limitUtils] Límite violado - ${jugada} ${canonical}: límite ${effective} (${perNumber !== undefined ? 'número' : (lotteryLimit !== undefined ? 'lotería' : 'listero')}), usado ${used}, intento ${attempt}`);
    }
  });

  console.log(`🔍 [limitUtils] Validación completada. Violaciones encontradas: ${violations.length}`);
  violations.forEach(v => console.log(`🚫 [limitUtils] Violación: ${v.jugada} ${v.numero} - límite ${v.permitido}, usado ${v.usado}, intento ${v.intento}`));
  
  return violations;
};
