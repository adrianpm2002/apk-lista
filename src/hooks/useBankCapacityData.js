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
      // Consultar v_capacidades agregando por banco
      const { data: capacities, error: capErr } = await supabase
        .from('v_capacidades')
        .select('*')
        .eq('id_banco', bankId);
      
      if (capErr) throw capErr;

      if (!capacities || capacities.length === 0) {
        setCapacityData([]);
        setLoading(false);
        return;
      }

      // Agrupar por horario+jugada+numero y sumar límites y uso
      const aggregated = new Map();
      
      capacities.forEach(cap => {
        const key = `${cap.id_horario}|${cap.jugada}|${cap.numero_canonico}`;
        
        if (!aggregated.has(key)) {
          aggregated.set(key, {
            loteriaId: String(cap.id_loteria),
            loteriaNombre: cap.loteria_nombre,
            horarioId: cap.id_horario,
            horarioNombre: cap.horario_nombre,
            jugada: cap.jugada,
            numero: cap.numero_canonico,
            limite: 0,
            usado: 0,
            abierto: cap.abierto
          });
        }
        
        const item = aggregated.get(key);
        item.limite += cap.limite_efectivo || 0;
        item.usado += cap.uso_actual || 0;
      });

      // Convertir a array y calcular porcentajes
      const rows = Array.from(aggregated.values()).map(item => {
        const pct = Math.min(100, item.limite ? (item.usado / item.limite) * 100 : 0);
        
        // Formatear número según la jugada
        let formattedNumber = item.numero;
        if (item.jugada === 'centena' && formattedNumber.length < 3) {
          formattedNumber = formattedNumber.padStart(3, '0');
        } else if (item.jugada === 'parle' && formattedNumber.length < 4) {
          formattedNumber = formattedNumber.padStart(4, '0');
        } else if (item.jugada === 'tripleta' && formattedNumber.length < 6) {
          formattedNumber = formattedNumber.padStart(6, '0');
        } else if ((item.jugada === 'fijo' || item.jugada === 'corrido') && formattedNumber.length < 2) {
          formattedNumber = formattedNumber.padStart(2, '0');
        }
        
        return {
          ...item,
          numero: formattedNumber,
          porcentaje: pct
        };
      });

      // Filtrar según opciones
      const filteredRows = rows.filter(row => {
        if (!includeClosed && !row.abierto) return false;
        if (hideZero && row.usado === 0) return false;
        return true;
      });

      // Ordenar por porcentaje descendente
      filteredRows.sort((a, b) => b.porcentaje - a.porcentaje);
      
      setCapacityData(filteredRows);
      
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
