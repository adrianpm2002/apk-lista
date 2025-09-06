import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Hook para cargar capacidades agregadas del banco (suma de todos los listeros).
 * Muestra qué tan llenos están los números considerando la suma total de uso y límites de todos los listeros.
 */
export function useBankCapacityData(bankId, options = {}) {
  const { includeClosed = false, auto = false, hideZero = true } = options;
  const [capacityData, setCapacityData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastBankRef = useRef(null);

  const fetchBankCapacities = useCallback(async () => {
    if (!bankId) return;
    setLoading(true); 
    setError(null);
    
    try {
      // 1. Obtener todos los listeros del banco
      const { data: listeros, error: listerosErr } = await supabase
        .from('profiles')
        .select('id, limite_especifico')
        .eq('id_banco', bankId)
        .eq('role', 'listero');
      
      if (listerosErr) throw listerosErr;
      
      if (!listeros || listeros.length === 0) {
        setCapacityData([]);
        setLoading(false);
        return;
      }

      // 2. Obtener loterías del banco
      const { data: lots, error: lotsErr } = await supabase
        .from('loteria')
        .select('id, nombre')
        .eq('id_banco', bankId);
      
      if (lotsErr) throw lotsErr;
      
      const lotIds = (lots || []).map(l => l.id);
      if (!lotIds.length) {
        setCapacityData([]);
        setLoading(false);
        return;
      }

      // 3. Límites específicos de lotería
      let lotteryLimits = {};
      try {
        const { data: lotteryLimitsData } = await supabase
          .from('limite_loteria')
          .select('id_loteria, limites')
          .in('id_loteria', lotIds);
        if (lotteryLimitsData) {
          lotteryLimitsData.forEach(item => {
            lotteryLimits[item.id_loteria] = item.limites || {};
          });
        }
      } catch (e) {
        console.warn('Error loading lottery limits, continuing without them:', e.message);
        lotteryLimits = {};
      }

      // 4. Horarios de esas loterías
      const { data: horariosRows, error: horErr } = await supabase
        .from('horario')
        .select('id, nombre, id_loteria, hora_inicio, hora_fin')
        .in('id_loteria', lotIds);
      
      if (horErr) throw horErr;
      
      const horarioMeta = {};
      (horariosRows || []).forEach(h => { horarioMeta[h.id] = h; });

      // 5. Límites por número para todos los horarios
      const { data: limits, error: limErr } = await supabase
        .from('limite_numero')
        .select('numero, limite, jugada, id_horario')
        .in('id_horario', (horariosRows || []).map(h => h.id));
      
      if (limErr) throw limErr;
      
      const limitNumberMap = new Map(); // key h|jugada|numero -> limite_numero.limite
      (limits || []).forEach(r => { 
        limitNumberMap.set(`${r.id_horario}|${r.jugada}|${r.numero}`, r.limite); 
      });

      // 6. Jugadas del día de todos los listeros (uso real)
      const nowLocal = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const y = nowLocal.getFullYear();
      const m = pad(nowLocal.getMonth() + 1);
      const d = pad(nowLocal.getDate());
      const startStr = `${y}-${m}-${d} 00:00:00`;
      const endStr = `${y}-${m}-${d} 23:59:59.999`;
      
      const listerosIds = listeros.map(l => l.id);
      const { data: jugadas, error: jugErr } = await supabase
        .from('jugada')
        .select('id_horario, jugada, numeros, monto_unitario, created_at, id_listero')
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .in('id_horario', (horariosRows || []).map(h => h.id))
        .in('id_listero', listerosIds);
      
      if (jugErr) throw jugErr;

      // 7. Calcular horarios abiertos
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const isOpen = (hi, hf) => {
        if (!hi || !hf) return false;
        const [shi, smi] = hi.split(':');
        const [shf, smf] = hf.split(':');
        const start = parseInt(shi, 10) * 60 + parseInt(smi || '0', 10);
        const end = parseInt(shf, 10) * 60 + parseInt(smf || '0', 10);
        if (start === end) return true;
        if (end > start) return nowMin >= start && nowMin < end;
        return (nowMin >= start) || (nowMin < end);
      };

      // 8. Agregar uso por número considerando todos los listeros
      const usageMap = new Map(); // key h|jugada|numeroCanonical -> uso acumulado total
      const parleCanonical = (n) => {
        if (n.length !== 4) return n;
        const a = n.slice(0, 2), b = n.slice(2);
        const alt = b + a;
        return alt < n ? alt : n;
      };

      (jugadas || []).forEach(j => {
        const h = j.id_horario;
        const jug = j.jugada;
        const monto = j.monto_unitario || 0;
        if (!h || !jug || monto <= 0) return;
        
        const hor = horarioMeta[h];
        if (!hor) return;
        if (!includeClosed && !isOpen(hor.hora_inicio, hor.hora_fin)) return;
        
        const nums = (j.numeros || '').split(',').map(s => s.trim()).filter(Boolean);
        nums.forEach(raw => {
          const digits = raw.replace(/[^0-9]/g, '');
          if (!digits) return;
          
          let canonical = digits;
          if (jug === 'parle' && digits.length === 4) {
            canonical = parleCanonical(digits);
          }
          
          const key = `${h}|${jug}|${canonical}`;
          usageMap.set(key, (usageMap.get(key) || 0) + monto);
        });
      });

      // 9. Calcular límites totales por número sumando todos los listeros
      const totalLimitsMap = new Map(); // key h|jugada|numero -> límite total

      // Función auxiliar para calcular el límite efectivo de un listero
      const calculateEffectiveLimit = (perNumber, lotteryLimit, specLimit) => {
        const limits = [];
        if (perNumber !== undefined && perNumber !== null) limits.push(perNumber);
        if (lotteryLimit !== undefined && lotteryLimit !== null) limits.push(lotteryLimit);
        if (specLimit !== undefined && specLimit !== null) limits.push(specLimit);
        return limits.length > 0 ? Math.min(...limits) : null;
      };

      // Para cada combinación horario|jugada|numero, sumar los límites de todos los listeros
      const expectedLenFor = (jug) => jug === 'centena' ? 3 : jug === 'parle' ? 4 : jug === 'tripleta' ? 6 : 2;
      
      // Obtener todos los números únicos que aparecen en uso o límites
      const allNumberKeys = new Set();
      
      // Agregar números que tienen uso
      usageMap.forEach((_, key) => {
        allNumberKeys.add(key);
      });
      
      // Agregar números que tienen límites específicos
      (limits || []).forEach(r => {
        const key = `${r.id_horario}|${r.jugada}|${r.numero}`;
        allNumberKeys.add(key);
      });

      // Para cada número único, calcular el límite total
      allNumberKeys.forEach(key => {
        const [h, jug, numero] = key.split('|');
        const hor = horarioMeta[h];
        if (!hor) return;
        if (!includeClosed && !isOpen(hor.hora_inicio, hor.hora_fin)) return;
        
        const lotId = hor.id_loteria;
        let totalLimit = 0;
        
        // Sumar límites de todos los listeros para este número
        listeros.forEach(listero => {
          const perNumber = limitNumberMap.get(`${h}|${jug}|${numero}`);
          const lotteryLimit = lotteryLimits[lotId] && lotteryLimits[lotId][jug];
          const specLimit = listero.limite_especifico && listero.limite_especifico[jug];
          
          const effective = calculateEffectiveLimit(perNumber, lotteryLimit, specLimit);
          if (effective) {
            totalLimit += effective;
          }
        });
        
        if (totalLimit > 0) {
          totalLimitsMap.set(key, totalLimit);
        }
      });

      // 10. Construir filas finales
      const rows = [];
      
      totalLimitsMap.forEach((totalLimit, key) => {
        const [h, jug, numero] = key.split('|');
        const hor = horarioMeta[h];
        if (!hor) return;
        
        const lotId = hor.id_loteria;
        const lotName = (lots || []).find(l => l.id === lotId)?.nombre || lotId;
        const used = usageMap.get(key) || 0;
        const pct = Math.min(100, totalLimit ? (used / totalLimit) * 100 : 0);
        
        if (hideZero && used === 0) return;
        
        const padLen = expectedLenFor(jug);
        rows.push({
          loteriaId: String(lotId),
          loteriaNombre: lotName,
          horarioId: h,
          horarioNombre: hor.nombre,
          jugada: jug,
          numero: String(numero).padStart(padLen, '0'),
          limite: totalLimit,
          usado: used,
          porcentaje: pct,
          abierto: includeClosed || isOpen(hor.hora_inicio, hor.hora_fin)
        });
      });

      // 11. Ordenar por porcentaje descendente
      rows.sort((a, b) => b.porcentaje - a.porcentaje);
      
      setCapacityData(rows);
      
    } catch (e) {
      setError(e.message || 'Error cargando capacidad del banco');
    }
    setLoading(false);
  }, [bankId, includeClosed, hideZero]);

  // Auto fetch si se pide y cambia banco
  useEffect(() => {
    if (auto && bankId && bankId !== lastBankRef.current) {
      lastBankRef.current = bankId;
      fetchBankCapacities();
    }
  }, [auto, bankId, fetchBankCapacities]);

  return { capacityData, loading, error, refresh: fetchBankCapacities };
}

export default useBankCapacityData;
