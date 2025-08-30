// Hook simplificado para insertar UNA jugada (sin lógica de límites legacy ni tablas inexistentes)
// Se asume que la pantalla (visual o texto) ya validó límites usando limitUtils antes de llamar aquí.
import { supabase } from '../supabaseClient';

export const usePlaySubmission = () => {

  // Obtener IDs de lotería y horario desde la base de datos
  const getLotteryAndScheduleIds = async (lotteryRef, scheduleRef) => {
    try {
      if(!lotteryRef || !scheduleRef) return null;
      const isUUID = (val) => typeof val === 'string' && /^[0-9a-fA-F-]{36}$/.test(val);
      let lotteryId = null;
      // Obtener lotteryId
      if (isUUID(lotteryRef)) {
        lotteryId = lotteryRef;
      } else {
        const { data: lotteryData, error: lotteryError } = await supabase
          .from('loteria')
          .select('id')
          .ilike('nombre', lotteryRef)
          .maybeSingle();
        if (lotteryError || !lotteryData) {
          console.warn(`Lotería no encontrada por nombre: ${lotteryRef}`);
          return null;
        }
        lotteryId = lotteryData.id;
      }

      // Obtener scheduleId
      let scheduleId = null;
      if (isUUID(scheduleRef)) {
        scheduleId = scheduleRef;
      } else {
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('horario')
          .select('id')
          .eq('id_loteria', lotteryId)
          .ilike('nombre', scheduleRef)
          .maybeSingle();
        if (scheduleError || !scheduleData) {
          console.warn(`Horario no encontrado: ${scheduleRef} para lotería ${lotteryRef}`);
          return null;
        }
        scheduleId = scheduleData.id;
      }

      return { lotteryId, scheduleId };
    } catch (error) {
      console.error('Error obteniendo IDs:', error);
      return null;
    }
  };

  const submitPlay = async (formData) => {
    try {
      // Validar datos obligatorios
      if (!formData.lottery || !formData.schedule || !formData.playType || !formData.numbers) {
        throw new Error('Faltan datos obligatorios');
      }

      // Calcular cantidad de números y total
      const numbersArray = formData.numbers.split(/[,*\-\s]+/).filter(num => num.trim() !== '');
      // Validar que no existan números incompletos según el tipo de jugada
      const playTypeValue = typeof formData.playType === 'object' ? formData.playType?.value : formData.playType;
      const selectedPlayTypes = formData.selectedPlayTypes || [];
      const getRequiredLength = () => {
        // Combo centena + fijo obliga a longitud 3 (centena) para token completo
        if (selectedPlayTypes.includes('centena') && selectedPlayTypes.includes('fijo')) return 3;
        switch (playTypeValue) {
          case 'fijo':
          case 'corrido':
          case 'posicion':
            return 2;
          case 'parle':
            return 4;
          case 'centena':
            return 3;
          case 'tripleta':
            return 6;
          default:
            return null; // desconocido -> sin validación estricta
        }
      };
      const reqLen = getRequiredLength();

      if (reqLen) {
        // Extraer solo dígitos para detectar resto incompleto
        const allDigits = formData.numbers.replace(/[^0-9]/g, '');
        const remainder = allDigits.length % reqLen;
        // También validar token a token por si algún separador deja un fragmento interno incompleto
        const incompleteTokens = numbersArray.filter(n => {
          const d = n.replace(/[^0-9]/g, '');
          return d.length > 0 && d.length < reqLen;
        });
        if (remainder !== 0 || incompleteTokens.length > 0) {
          // Identificar fragmento final (si remainder>0)
          let fragment = '';
          if (remainder > 0) {
            fragment = allDigits.slice(allDigits.length - remainder);
          }
            const lista = [...new Set([...incompleteTokens, fragment].filter(Boolean))];
          throw new Error(`Números incompletos: ${lista.join(', ')}`);
        }
      }
      // Total calculado estándar (monto unitario * cantidad de números)
      let calculatedTotal = formData.amount * numbersArray.length;
      // Permitir override si viene total explícito (caso parle con candado: total original antes de dividir unitario)
      if(typeof formData.total === 'number' && formData.total > 0) {
        calculatedTotal = formData.total;
      }

      // Obtener IDs (aunque actualmente solo necesitamos id_horario para insertar)
      const ids = await getLotteryAndScheduleIds(formData.lottery, formData.schedule);
      if(!ids) {
        return { success:false, error:'Lotería u horario inválido', message:'Verifique lotería y horario.' };
      }
      return await savePlay(formData, numbersArray, calculatedTotal, ids);

    } catch (error) {
      console.error('Error al guardar jugada:', error);
      return {
        success: false,
        error: error.message || 'No se pudo guardar la jugada',
        message: 'Error al guardar la jugada'
      };
    }
  };

  // Función auxiliar para guardar jugada (sin tracking adicional)
  const savePlay = async (formData, numbersArray, calculatedTotal, ids) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const insertPayload = {
        id_horario: ids.scheduleId,
        jugada: formData.playType,
        numeros: formData.numbers,
        monto_unitario: formData.amount || 0,
        monto_total: calculatedTotal,
        nota: (formData.note && formData.note.trim()) || 'Sin nombre',
        id_listero: user?.id || null
      };
      const { error: insertError } = await supabase.from('jugada').insert(insertPayload);
      if (insertError) {
        console.error('Error insertando jugada:', insertError);
        return { success:false, error:'Error insertando jugada', message: insertError.message };
      }
      return { success:true, play: insertPayload, message:'Jugada insertada' };
    } catch (error) {
      console.error('Error guardando jugada y registrando apuestas:', error);
      throw error;
    }
  };

  const submitPlayWithConfirmation = async (formData) => submitPlay(formData);

  return {
    submitPlay,
  submitPlayWithConfirmation
  };
};

export default usePlaySubmission;
