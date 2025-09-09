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
  // Cargando límites para loterías
      
      // Cargar límites por lotería
      const { data: lotteryLimitsData, error: lotteryError } = await supabase
        .from('limite_loteria')
        .select('id_loteria, limites')
        .in('id_loteria', lotteryIds);
      
      if (lotteryError) {
        console.warn('Error cargando límites de lotería:', lotteryError);
      }
      
      if (lotteryLimitsData) {
        lotteryLimitsData.forEach(item => {
          lotteryLimits[item.id_loteria] = item.limites || {};
        });
  // Límites por lotería cargados
      }
    }
  } catch (e) {
    console.warn('Error loading lottery limits in limitUtils, continuing without them:', e.message);
    lotteryLimits = {};
  }
  
  // Usar zona horaria de La Habana (Cuba) para calcular el día actual
  const nowLocal = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const y = nowLocal.getFullYear();
  const m = pad(nowLocal.getMonth() + 1);
  const d = pad(nowLocal.getDate());
  const startStr = `${y}-${m}-${d} 00:00:00`;
  const endStr = `${y}-${m}-${d} 23:59:59.999`;
  
  // Consultando jugadas para el día actual
  
  // Filtrar jugadas del día solo del listero actual - usando zona horaria local
  let jugadasQuery = supabase.from('jugada')
    .select('id_horario,jugada,numeros,monto_unitario,created_at,id_listero')
    .gte('created_at', startStr)
    .lte('created_at', endStr)
    .in('id_horario', horarios);
  
  if (userId) {
    // Filtrar solo las jugadas del listero actual (capacidad individual)
    jugadasQuery = jugadasQuery.eq('id_listero', userId);
  // Filtrando por listero individual
  }
  
  const { data: jugadasDia, error: jugadasError } = await jugadasQuery;
  
  
  // Consulta adicional para verificar si hay jugadas en general (sin filtro de fecha)
  const { data: jugadasTodas, error: jugadasTodasError } = await supabase.from('jugada')
    .select('id_horario,jugada,numeros,monto_unitario,created_at,id_listero')
    .in('id_horario', horarios)
    .limit(5);
  if (jugadasTodas && jugadasTodas.length > 0) {
    // muestra de jugadas cargada
  }
  const usageMap=new Map();
  (jugadasDia||[]).forEach(j=>{
  // procesando jugada para usageMap
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
  // UsageMap final generado
  return { limitMap, specificLimits, lotteryLimits, horarioToLoteria, usageMap };
};

export const checkInstructionsLimits = (instructions, horarios, limitCtx) => {
  // Iniciando validación de límites
  
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
  // Límites disponibles calculados
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

  // Función para obtener límite específico del nuevo formato por lotería
  const getSpecificLimitForLottery = (specificLimits, jugada, lotteryId) => {
    if (!specificLimits || !lotteryId) return null;
    
    // Formato: {lotteryId: {jugada: valor}}
    const lotteryLimits = specificLimits[lotteryId];
    return lotteryLimits && lotteryLimits[jugada] ? lotteryLimits[jugada] : null;
  };

  // Comparar intentos agregados con límites efectivos (incluyendo límites por lotería)
  attemptMap.forEach((attempt, key) => {
    const [h, jugada, canonical] = key.split('|');
    
  // Evaluando límite para clave: ${key}
    
    // Límite por número específico
    const perNumber = limitCtx.limitMap.get(key);
    
    // Límite por lotería - NUEVA FUNCIONALIDAD
    const lotteryId = limitCtx.horarioToLoteria && limitCtx.horarioToLoteria.get(h);
    const lotteryLimit = lotteryId && limitCtx.lotteryLimits && limitCtx.lotteryLimits[lotteryId] && limitCtx.lotteryLimits[lotteryId][jugada];
    
    // Límite específico del listero usando nueva función
    const specLimit = getSpecificLimitForLottery(limitCtx.specificLimits, jugada, lotteryId);
    
  // Límites encontrados calculados
    
    // Calcular límite efectivo (mínimo entre los tres tipos)
    const effective = calculateEffectiveLimit(perNumber, lotteryLimit, specLimit);
    
    if(!effective) {
  // No hay límites efectivos, permitiendo inserción
      return;
    }
    const used = limitCtx.usageMap.get(key)||0;
  // Límite efectivo calculado
    
    if(used + attempt > effective){
      violations.push({ 
        numero: canonical, 
        jugada, 
        permitido: effective, 
        usado: used, 
        intento: attempt,
        limitType: perNumber !== undefined ? 'número' : (lotteryLimit !== undefined ? 'lotería' : 'listero')
      });
  // Límite violado registrado
    }
  });

  // Validación completada. Violaciones encontradas: ${violations.length}
  
  return violations;
};
