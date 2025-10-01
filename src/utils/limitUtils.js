import { supabase } from '../supabaseClient';

export const fetchLimitsContext = async (horarios, userId) => {
  if(!horarios.length) return { capacityMap: new Map(), defaultLimitsMap: new Map() };
  
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
    return { capacityMap: new Map(), defaultLimitsMap: new Map() };
  }
  
  // Separar datos específicos de números vs límites por defecto (numero = null)
  const capacityMap = new Map();
  const defaultLimitsMap = new Map(); // Para filas con numero = null
  
  (capacityData || []).forEach(row => {
    if (row.numero === null || row.numero === '') {
      // Fila con límites por defecto para horario/jugada/listero
      const defaultKey = `${row.id_horario}|${row.jugada}`;
      defaultLimitsMap.set(defaultKey, {
        used: 0, // Sin uso específico para este número
        effectiveLimit: row.effective_limit_listero,
        remaining: row.effective_limit_listero || 0, // Todo el límite disponible
        limitPerNumber: row.limit_per_number,
        limitLottery: row.limit_lottery,
        limitSpecific: row.limit_specific
      });
    } else {
      // Fila con número específico
      const key = `${row.id_horario}|${row.jugada}|${row.numero}`;
      capacityMap.set(key, {
        used: row.used_today_listero || 0,
        effectiveLimit: row.effective_limit_listero,
        remaining: row.remaining_listero || 0,
        limitPerNumber: row.limit_per_number,
        limitLottery: row.limit_lottery,
        limitSpecific: row.limit_specific
      });
    }
  });
  
  return { capacityMap, defaultLimitsMap };
};

export const checkInstructionsLimits = (instructions, horarios, limitCtx) => {
  const violations = [];
  const capacityMap = limitCtx.capacityMap;
  const defaultLimitsMap = limitCtx.defaultLimitsMap;
  
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
    let capacityInfo = capacityMap.get(key);
    
    // Si no hay información específica para este número, buscar límites por defecto
    if (!capacityInfo) {
      const [h, jugada, canonical] = key.split('|');
      const defaultKey = `${h}|${jugada}`;
      const defaultLimits = defaultLimitsMap.get(defaultKey);
      
      if (!defaultLimits) {
        // No hay límites específicos ni por defecto, permitir inserción
        return;
      }
      
      // Usar los límites por defecto para este número no jugado antes
      capacityInfo = {
        used: 0, // Este número específico no se ha jugado
        effectiveLimit: defaultLimits.effectiveLimit,
        remaining: defaultLimits.effectiveLimit || 0, // Todo el límite disponible
        limitPerNumber: defaultLimits.limitPerNumber,
        limitLottery: defaultLimits.limitLottery,
        limitSpecific: defaultLimits.limitSpecific
      };
    }
    
    const { used, effectiveLimit, remaining } = capacityInfo;
    
    // Si effectiveLimit es null o undefined, no hay límite configurado (permitir)
    // Si effectiveLimit es 0, el número está bloqueado (no permitir nada)
    if (effectiveLimit === null || effectiveLimit === undefined) {
      // No hay límites configurados, permitir inserción
      return;
    }
    
    // Verificar si el intento excede lo que queda disponible
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
