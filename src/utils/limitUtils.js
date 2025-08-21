import { supabase } from '../supabaseClient';

export const fetchLimitsContext = async (horarios, userId) => {
  if(!horarios.length) return { limitMap:new Map(), specificLimits:null, usageMap:new Map() };
  let specificLimits=null;
  if(userId){
    const { data: profile } = await supabase.from('profiles').select('limite_especifico').eq('id', userId).maybeSingle();
    specificLimits = profile?.limite_especifico || null;
  }
  const { data: limitRows } = await supabase.from('limite_numero').select('numero, limite, jugada, id_horario').in('id_horario', horarios);
  const limitMap=new Map();
  (limitRows||[]).forEach(r=> limitMap.set(r.id_horario+"|"+r.jugada+"|"+r.numero, r.limite));
  const dayStart=new Date(); dayStart.setHours(0,0,0,0);
  const { data: jugadasDia } = await supabase.from('jugada').select('id_horario,jugada,numeros,monto_unitario,created_at').gte('created_at', dayStart.toISOString()).in('id_horario', horarios);
  const usageMap=new Map();
  (jugadasDia||[]).forEach(j=>{
    (j.numeros||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(n=>{
      let canonical = n;
      if(j.jugada==='parle'){
        // Normalizar parle como combinación sin orden (ABCD == CDBA). Asumimos 4 dígitos.
        const digits = n.replace(/[^0-9]/g,'').split('');
        if(digits.length===4){ canonical = digits.sort().join(''); }
      }
      const k = j.id_horario+"|"+j.jugada+"|"+canonical;
      usageMap.set(k,(usageMap.get(k)||0)+(j.monto_unitario||0));
    });
  });
  return { limitMap, specificLimits, usageMap };
};

export const checkInstructionsLimits = (instructions, horarios, limitCtx) => {
  const violations=[];
  instructions.forEach(instr=>{
    const jugada = instr.playType;
    const counts = instr.numbers.reduce((acc,n)=> (acc[n]=(acc[n]||0)+1, acc), {});
    Object.keys(counts).forEach(num=>{
      horarios.forEach(h=>{
        let canonical = num;
        if(jugada==='parle'){
          const digits = num.replace(/[^0-9]/g,'').split('');
          if(digits.length===4){ canonical = digits.sort().join(''); }
        }
        const key=h+"|"+jugada+"|"+canonical;
        const perNumber = limitCtx.limitMap.get(key);
        const specLimit = limitCtx.specificLimits && limitCtx.specificLimits[jugada];
        let effective = perNumber!=null && specLimit!=null ? Math.min(perNumber,specLimit) : (perNumber!=null ? perNumber : (specLimit!=null ? specLimit : null));
        if(!effective) return;
        const used = limitCtx.usageMap.get(key)||0;
        const attempt = (instr.amountEach||0) * counts[num];
        if(used + attempt > effective){
          violations.push({ numero:num, jugada, permitido:effective, usado:used, intento:attempt });
        }
      });
    });
  });
  return violations;
};
