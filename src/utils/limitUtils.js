import { supabase } from '../supabaseClient';

export const fetchLimitsContext = async (horarios, userId) => {
  if(!horarios.length) return { capacityMap: new Map() };
  
  // Consultar v_capacidades filtrando por horarios y listero (si se especifica)
  let query = supabase
    .from('v_capacidades')
    .select('*')
    .in('id_horario', horarios);
  
  if (userId) {
    query = query.eq('id_listero', userId);
  }
  
  const { data: capacityData, error } = await query;
  
  if (error) {
    console.error('Error fetching capacity data:', error);
    return { capacityMap: new Map() };
  }
  
  // Convertir a mapa para compatibilidad con la API existente
  const capacityMap = new Map();
  (capacityData || []).forEach(row => {
    const key = `${row.id_horario}|${row.jugada}|${row.numero}`;
    capacityMap.set(key, {
      used: row.used_today_listero || 0,
      effectiveLimit: row.effective_limit_listero,
      remaining: row.remaining_listero || 0,
      limitPerNumber: row.limit_per_number,
      limitLottery: row.limit_lottery,
      limitSpecific: row.limit_specific
    });
  });
  
  return { capacityMap };
};

export const checkInstructionsLimits = (instructions, horarios, limitCtx) => {
  const violations = [];
  const capacityMap = limitCtx.capacityMap;
  
  // Calcular intentos por clave canónica para cada horario y jugada
  const attemptMap = new Map(); // key: h|jugada|canonical -> intento total

  const toCanonicalParle = (n) => {
    const d = (n||'').replace(/[^0-9]/g,'');
    if(d.length===4){ const a=d.slice(0,2), b=d.slice(2); return [a,b].sort().join(''); }
    return n;
  };

  const toCanonicalTripleta = (n) => {
    const d = (n||'').replace(/[^0-9]/g,'');
    if(d.length===6){ 
      const pairs = [d.slice(0,2), d.slice(2,4), d.slice(4,6)];
      return pairs.sort().join('');
    }
    return d;
  };

  instructions.forEach(instr => {
    const jugada = instr.playType;
    // contar ocurrencias originales (incluso invertidas separadas)
    const counts = instr.numbers.reduce((acc,n)=> (acc[n]=(acc[n]||0)+1, acc), {});
    Object.keys(counts).forEach(num => {
      let canonical = num.replace(/[^0-9]/g,'');
      if(jugada==='parle') canonical = toCanonicalParle(num);
      else if(jugada==='tripleta') canonical = toCanonicalTripleta(num);
      
      horarios.forEach(h => {
        const key = `${h}|${jugada}|${canonical}`;
        const prev = attemptMap.get(key)||0;
        const add = (instr.amountEach||0) * counts[num];
        attemptMap.set(key, prev + add);
      });
    });
  });

  // Comparar intentos agregados con límites efectivos de la vista
  attemptMap.forEach((attempt, key) => {
    const capacityInfo = capacityMap.get(key);
    
    if (!capacityInfo) {
      // Si no hay información de capacidad, no hay restricción
      return;
    }
    
    const { used, effectiveLimit, remaining } = capacityInfo;
    
    if (!effectiveLimit) {
      // No hay límites efectivos, permitir inserción
      return;
    }
    
    if (attempt > remaining) {
      const [h, jugada, canonical] = key.split('|');
      violations.push({ 
        numero: canonical, 
        jugada, 
        permitido: effectiveLimit, 
        usado: used, 
        intento: attempt,
        limitType: capacityInfo.limitPerNumber !== undefined ? 'número' : 
                  (capacityInfo.limitLottery !== undefined ? 'lotería' : 'listero')
      });
    }
  });

  return violations;
};
