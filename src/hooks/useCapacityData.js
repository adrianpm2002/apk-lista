import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Hook centralizado para cargar capacidades (uso vs límite) por número/jugada/horario/lotería.
 * Combina límites específicos del listero (profiles.limite_especifico) con limite_numero y uso en numero_limitado.
 *
 * Retorna siempre sólo horarios abiertos (misma lógica que BatteryButton original) salvo que se pase options.includeClosed.
 */
export function useCapacityData(bankId, options = {}) {
  const { includeClosed = false, auto = false, hideZero = true } = options;
  const [capacityData, setCapacityData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastBankRef = useRef(null);

  const fetchCapacities = useCallback(async () => {
    if (!bankId) return;
    setLoading(true); setError(null);
    try {
      // 1. Perfil -> límites específicos
      const { data: { user } } = await supabase.auth.getUser();
      let specificLimits = null;
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('limite_especifico').eq('id', user.id).maybeSingle();
        specificLimits = profile?.limite_especifico || null;
      }

      // 2. Loterías del banco
      const { data: lots, error: lotsErr } = await supabase.from('loteria').select('id,nombre').eq('id_banco', bankId);
      if(lotsErr) throw lotsErr;
      const lotIds = (lots||[]).map(l=> l.id);
      if(!lotIds.length){ setCapacityData([]); setLoading(false); return; }

      // 3. Horarios de esas loterías
      const { data: horariosRows, error: horErr } = await supabase
        .from('horario')
        .select('id,nombre,id_loteria,hora_inicio,hora_fin')
        .in('id_loteria', lotIds);
      if(horErr) throw horErr;
      const horarioMeta = {}; (horariosRows||[]).forEach(h=>{ horarioMeta[h.id]=h; });

      // 4. Límites por número (para porcentaje) - puede que no exista para todos
      const { data: limits, error: limErr } = await supabase
        .from('limite_numero')
        .select('numero, limite, jugada, id_horario')
        .in('id_horario', (horariosRows||[]).map(h=>h.id));
      if(limErr) throw limErr;
      const limitNumberMap = new Map(); // key h|jugada|numero -> limite_numero.limite
      (limits||[]).forEach(r=>{ limitNumberMap.set(`${r.id_horario}|${r.jugada}|${r.numero}`, r.limite); });

      // 5. Jugadas del día (uso real) en tabla jugada - usar rango LOCAL del día para evitar desfases por UTC
      const nowLocal = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const y = nowLocal.getFullYear();
      const m = pad(nowLocal.getMonth() + 1);
      const d = pad(nowLocal.getDate());
      const startStr = `${y}-${m}-${d} 00:00:00`;
      const endStr = `${y}-${m}-${d} 23:59:59.999`;
      const { data: jugadas, error: jugErr } = await supabase
        .from('jugada')
        .select('id_horario,jugada,numeros,monto_unitario,created_at')
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .in('id_horario', (horariosRows||[]).map(h=>h.id));
      if(jugErr) throw jugErr;

      // 6. Calcular horarios abiertos
      const now = new Date();
      const nowMin = now.getHours()*60 + now.getMinutes();
      const isOpen = (hi,hf)=>{
        if(!hi||!hf) return false; const [shi,smi]=hi.split(':'); const [shf,smf]=hf.split(':');
        const start=parseInt(shi,10)*60+parseInt(smi||'0',10); const end=parseInt(shf,10)*60+parseInt(smf||'0',10);
        if(start===end) return true; if(end>start) return nowMin>=start && nowMin<end; return (nowMin>=start)||(nowMin<end);
      };

      // 7. Agregar uso por número considerando repeticiones y parle canónico
      const usageMap = new Map(); // key h|jugada|numeroCanonical -> uso acumulado
      const parleCanonical = (n) => {
        if(n.length!==4) return n; const a=n.slice(0,2), b=n.slice(2); const alt=b+a; return alt < n ? alt : n;
      };
      (jugadas||[]).forEach(j => {
        const h = j.id_horario; const jug = j.jugada; const monto = j.monto_unitario || 0;
        if(!h || !jug || monto<=0) return;
        const hor = horarioMeta[h]; if(!hor) return;
        if(!isOpen(hor.hora_inicio, hor.hora_fin)) return; // sólo abiertos
        const nums = (j.numeros||'').split(',').map(s=> s.trim()).filter(Boolean);
        nums.forEach(raw => {
          const digits = raw.replace(/[^0-9]/g,'');
          if(!digits) return;
            let canonical = digits;
            if(jug==='parle' && digits.length===4){ canonical = parleCanonical(digits); }
          const key = `${h}|${jug}|${canonical}`;
          usageMap.set(key, (usageMap.get(key)||0) + monto);
        });
      });

      // 8. Construir filas finales. Si hay límite específico para 'fijo' (u otras jugadas) pero sin límite_numero individual
      // y no hay uso todavía, aun así se deben mostrar todos los números posibles con usado=0.
      const rows = [];
      const pushRow = (h, jug, numero, used, effective, hor, lotName, lotId) => {
        const pct = Math.min(100, effective ? (used / effective) * 100 : 0);
        rows.push({
          loteriaId: String(lotId),
          loteriaNombre: lotName,
          horarioId: h,
          horarioNombre: hor.nombre,
          jugada: jug,
          numero,
          limite: effective,
          usado: used,
          porcentaje: pct,
          abierto: true
        });
      };

      // a) Filas con uso real
      const expectedLenFor = (jug) => jug==='centena'?3 : jug==='parle'?4 : jug==='tripleta'?6 : 2;
      usageMap.forEach((used, key) => {
        const [h,jug,numero] = key.split('|');
        const hor = horarioMeta[h]; if(!hor) return;
        const lotId = hor.id_loteria; const lotName = (lots||[]).find(l=>l.id===lotId)?.nombre || lotId;
        const perNumber = limitNumberMap.get(`${h}|${jug}|${numero}`);
        const specLimit = specificLimits && specificLimits[jug];
        let effective;
        if(perNumber!==undefined && specLimit!==undefined) effective = Math.min(perNumber, specLimit);
        else if(perNumber!==undefined) effective = perNumber;
        else if(specLimit!==undefined) effective = specLimit;
        if(!effective) return;
        const padLen = expectedLenFor(jug);
        pushRow(h, jug, String(numero).padStart(padLen,'0'), used, effective, hor, lotName, lotId);
      });

      // b) Generar filas para jugadas con limite específico aunque no haya uso ni limite_numero.
      if(specificLimits){
        Object.entries(specificLimits).forEach(([jug, limVal]) => {
          if(!limVal || limVal<=0) return;
          const enumerate = (length) => {
            (horariosRows||[]).forEach(hor => {
              if(!isOpen(hor.hora_inicio, hor.hora_fin)) return;
              const lotId = hor.id_loteria; const lotName = (lots||[]).find(l=>l.id===lotId)?.nombre || lotId;
              const max = length===2? 100 : length===3? 1000 : 0;
              for(let n=0;n<max;n++){
                const num = String(n).padStart(length,'0');
                const keyUsage = `${hor.id}|${jug}|${num}`;
                if(usageMap.has(keyUsage)) continue;
                const perNumber = limitNumberMap.get(`${hor.id}|${jug}|${num}`);
                let effective = perNumber!==undefined ? perNumber : limVal;
                pushRow(hor.id, jug, num, 0, effective, hor, lotName, lotId);
              }
            });
          };
          if(jug==='fijo' || jug==='corrido') enumerate(2);
          else if(jug==='centena') enumerate(3);
          // parle y tripleta NO se enumeran totalmente por tamaño explosivo; sólo aparecen si tienen uso o límite explícito.
        });
      }

      // c) Incluir filas para límites por número (limite_numero) aunque no haya uso ni limite específico (o aunque lo haya), evitando duplicados
      const presentSet = new Set(rows.map(r => `${r.horarioId}|${r.jugada}|${r.numero}`));
      (limits||[]).forEach(r => {
        const h = r.id_horario; const jug = r.jugada; const numero = r.numero;
        const hor = horarioMeta[h]; if(!hor) return;
        if(!isOpen(hor.hora_inicio, hor.hora_fin)) return;
        const key = `${h}|${jug}|${numero}`;
        if(presentSet.has(key)) return; // ya agregado por uso o enumeración de específico
        const lotId = hor.id_loteria; const lotName = (lots||[]).find(l=>l.id===lotId)?.nombre || lotId;
        const perNumber = r.limite;
        const specLimit = specificLimits && specificLimits[jug];
        let effective;
        if(perNumber!==undefined && specLimit!==undefined) effective = Math.min(perNumber, specLimit);
        else if(perNumber!==undefined) effective = perNumber;
        else if(specLimit!==undefined) effective = specLimit;
        if(!effective) return;
        const padLen = expectedLenFor(jug);
        pushRow(h, jug, String(numero).padStart(padLen,'0'), 0, effective, hor, lotName, lotId);
        presentSet.add(key);
      });

  // 9. Ordenar por porcentaje desc y conservar todos (incluye usado=0 para ver capacidad disponible)
  rows.sort((a,b)=> b.porcentaje - a.porcentaje);
  let finalRows = includeClosed ? rows : rows.filter(r=> r.abierto);
  if(hideZero) finalRows = finalRows.filter(r=> r.usado > 0);
  setCapacityData(finalRows);
    } catch(e){ setError(e.message||'Error cargando capacidad'); }
    setLoading(false);
  }, [bankId, includeClosed, hideZero]);

  // Auto fetch si se pide y cambia banco
  useEffect(()=>{
    if(auto && bankId && bankId !== lastBankRef.current){
      lastBankRef.current = bankId;
      fetchCapacities();
    }
  }, [auto, bankId, fetchCapacities]);

  return { capacityData, loading, error, refresh: fetchCapacities };
}

export default useCapacityData;
