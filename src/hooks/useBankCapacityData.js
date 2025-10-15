import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Hook para cargar capacidades agregadas del banco (suma de todos los listeros).
 * Muestra qué tan llenos están los números considerando la suma total de uso y límites de todos los listeros.
 */
export function useBankCapacityData(bankId, options = {}) {
  const { auto = false, hideZero = true } = options;
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

      // Filtrar filas con numero = null (son límites por defecto, no para mostrar)
      const validCapacities = capacities.filter(cap => cap.numero !== null && cap.numero !== '' && cap.numero !== undefined);
      
      // Agrupar por horario+jugada+numero
      const aggregated = new Map();
      
      validCapacities.forEach(cap => {
        const key = `${cap.id_horario}|${cap.jugada}|${cap.numero}`;
        
        if (!aggregated.has(key)) {
          aggregated.set(key, {
            loteriaId: String(cap.id_loteria),
            loteriaNombre: cap.nombre_loteria,
            horarioId: cap.id_horario,
            horarioNombre: cap.nombre_horario,
            jugada: cap.jugada,
            numero: cap.numero,
            usado: cap.bank_used_total || 0, // Uso total del banco
            abierto: true // La vista ya filtra por horarios abiertos
          });
        }
      });

      // Convertir a array
      const rows = Array.from(aggregated.values()).map(item => {
        
        // Formatear número según la jugada (con validación adicional)
        let formattedNumber = item.numero || '';
        if (formattedNumber && item.jugada === 'centena' && formattedNumber.length < 3) {
          formattedNumber = formattedNumber.padStart(3, '0');
        } else if (formattedNumber && item.jugada === 'parle' && formattedNumber.length < 4) {
          formattedNumber = formattedNumber.padStart(4, '0');
        } else if (formattedNumber && item.jugada === 'tripleta' && formattedNumber.length < 6) {
          formattedNumber = formattedNumber.padStart(6, '0');
        } else if (formattedNumber && (item.jugada === 'fijo' || item.jugada === 'corrido') && formattedNumber.length < 2) {
          formattedNumber = formattedNumber.padStart(2, '0');
        }
        
        return {
          ...item,
          numero: formattedNumber
        };
      });

      // Filtrar según opciones - ya no filtramos por abierto, la vista lo hace
      const filteredRows = rows.filter(row => {
        if (hideZero && row.usado === 0) return false;
        return true;
      });

      // Ordenar por usado descendente
      filteredRows.sort((a, b) => b.usado - a.usado);
      
      setCapacityData(filteredRows);
      
    } catch (e) {
      setError(e.message || 'Error cargando capacidad del banco');
    }
    setLoading(false);
  }, [bankId, hideZero]);

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
