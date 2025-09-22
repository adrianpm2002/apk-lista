import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Hook centralizado para cargar capacidades (uso vs límite) por número/jugada/horario/lotería.
 * Combina límites específicos del listero (profiles.limite_especifico) con limite_numero y uso en numero_limitado.
 *
 * Retorna siempre sólo horarios abiertos (misma lógica que BatteryButton original) salvo que se pase options.includeClosed.
 */
export function useCapacityData(bankId, options = {}) {
  const { auto = false, hideZero = true } = options;
  const [capacityData, setCapacityData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastBankRef = useRef(null);

  const fetchCapacities = useCallback(async () => {
    if (!bankId) return;
    setLoading(true); setError(null);
    try {
      // Obtener el usuario actual para filtrar por listero específico
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Consultar v_capacidades filtrada por banco y listero
      const { data: capacities, error: capErr } = await supabase
        .from('v_capacidades')
        .select('*')
        .eq('id_banco', bankId)
        .eq('id_listero', user.id);
      
      if (capErr) throw capErr;

      if (!capacities || capacities.length === 0) {
        setCapacityData([]);
        setLoading(false);
        return;
      }

      // Convertir datos de la vista al formato esperado
      const rows = capacities.map(cap => {
        const pct = Math.min(100, cap.effective_limit_listero ? (cap.used_today_listero / cap.effective_limit_listero) * 100 : 0);
        
        // Formatear número según la jugada
        let formattedNumber = cap.numero;
        if (cap.jugada === 'centena' && formattedNumber.length < 3) {
          formattedNumber = formattedNumber.padStart(3, '0');
        } else if (cap.jugada === 'parle' && formattedNumber.length < 4) {
          formattedNumber = formattedNumber.padStart(4, '0');
        } else if (cap.jugada === 'tripleta' && formattedNumber.length < 6) {
          formattedNumber = formattedNumber.padStart(6, '0');
        } else if ((cap.jugada === 'fijo' || cap.jugada === 'corrido') && formattedNumber.length < 2) {
          formattedNumber = formattedNumber.padStart(2, '0');
        }

        return {
          loteriaId: String(cap.id_loteria),
          loteriaNombre: cap.nombre_loteria,
          horarioId: cap.id_horario,
          horarioNombre: cap.nombre_horario,
          jugada: cap.jugada,
          numero: formattedNumber,
          limite: cap.effective_limit_listero || 0,
          usado: cap.used_today_listero || 0,
          porcentaje: pct,
          abierto: true // La vista ya filtra por horarios abiertos
        };
      });

      // Filtrar según opciones
      let finalRows = rows;
      
      // Ya no necesitamos filtrar por abierto, la vista lo hace
      if (hideZero) {
        finalRows = finalRows.filter(r => r.usado > 0);
      }

      // Ordenar por porcentaje descendente
      finalRows.sort((a, b) => b.porcentaje - a.porcentaje);
      
      setCapacityData(finalRows);
    } catch(e){ setError(e.message||'Error cargando capacidad'); }
    setLoading(false);
  }, [bankId, hideZero]);

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
