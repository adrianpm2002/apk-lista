import { supabase } from '../supabaseClient';

export const fetchLimitsContext = async (horarios, userId) => {
  if(!horarios.length) return { limitMap:new Map(), specificLimits:null, usageMap:new Map() };
  let specificLimits=null;
  let bankId=null;
  if(userId){
    const { data: profile } = await supabase.from('profiles').select('limite_especifico, id_banco').eq('id', userId).maybeSingle();
    specificLimits = profile?.limite_especifico || null;
    bankId = profile?.id_banco;
  }
  const { data: limitRows } = await supabase.from('limite_numero').select('numero, limite, jugada, id_horario').in('id_horario', horarios);
  const limitMap=new Map();
  (limitRows||[]).forEach(r=> limitMap.set(r.id_horario+"|"+r.jugada+"|"+r.numero, r.limite));
  const dayStart=new Date(); dayStart.setHours(0,0,0,0);
  
  // Filtrar jugadas del día solo del mismo banco
  let jugadasQuery = supabase.from('jugada').select('id_horario,jugada,numeros,monto_unitario,created_at,id_listero').gte('created_at', dayStart.toISOString()).in('id_horario', horarios);
  
  if (bankId) {
    // Obtener listeros del mismo banco
    const { data: listeros } = await supabase.from('profiles').select('id').eq('id_banco', bankId);
    const listerosIds = (listeros||[]).map(l => l.id);
    if (listerosIds.length > 0) {
      jugadasQuery = jugadasQuery.in('id_listero', listerosIds);
    } else {
      // Si no hay listeros del banco, no hay jugadas válidas
      return { limitMap, specificLimits, usageMap:new Map() };
    }
  }
  
  const { data: jugadasDia } = await jugadasQuery;
  const usageMap=new Map();
  (jugadasDia||[]).forEach(j=>{
    (j.numeros||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(n=>{
      let canonical = n;
      if(j.jugada==='parle'){
        // Normalizar parle como combinación sin orden por pares de 2 dígitos: AB|CD == CD|AB
        const d = n.replace(/[^0-9]/g,'');
        if(d.length===4){ const a=d.slice(0,2), b=d.slice(2); canonical = [a,b].sort().join(''); }
      }
      const k = j.id_horario+"|"+j.jugada+"|"+canonical;
      usageMap.set(k,(usageMap.get(k)||0)+(j.monto_unitario||0));
    });
  });
  return { limitMap, specificLimits, usageMap };
};

export const checkInstructionsLimits = (instructions, horarios, limitCtx) => {
  const violations=[];
  // Agregar intentos por clave canónica para cada horario y jugada
  const attemptMap = new Map(); // key: h|jugada|canonical -> intento total

  const toCanonicalParle = (n) => {
    const d = (n||'').replace(/[^0-9]/g,'');
    if(d.length===4){ const a=d.slice(0,2), b=d.slice(2); return [a,b].sort().join(''); }
    return n;
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

  // Comparar intentos agregados con límites efectivos
  attemptMap.forEach((attempt, key) => {
    const [h, jugada, canonical] = key.split('|');
    const perNumber = limitCtx.limitMap.get(key);
    const specLimit = limitCtx.specificLimits && limitCtx.specificLimits[jugada];
    let effective = perNumber!=null && specLimit!=null ? Math.min(perNumber,specLimit) : (perNumber!=null ? perNumber : (specLimit!=null ? specLimit : null));
    if(!effective) return;
    const used = limitCtx.usageMap.get(key)||0;
    if(used + attempt > effective){
      violations.push({ numero: canonical, jugada, permitido: effective, usado: used, intento: attempt });
    }
  });

  return violations;
};
