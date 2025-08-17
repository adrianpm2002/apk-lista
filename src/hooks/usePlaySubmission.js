import { Alert } from 'react-native';
import { useNumberLimits } from './useNumberLimits';
import { supabase } from '../supabaseClient';

// Hook para manejar el guardado de jugadas desde los formularios
export const usePlaySubmission = () => {
  const { checkBetLimits, registerBet } = useNumberLimits();

  // Obtener IDs de lotería y horario desde la base de datos
  const getLotteryAndScheduleIds = async (lotteryName, scheduleName) => {
    try {
      // Buscar lotería
      const { data: lotteryData, error: lotteryError } = await supabase
        .from('loteria')
        .select('id')
        .ilike('nombre', lotteryName)
        .single();

      if (lotteryError || !lotteryData) {
        console.warn(`Lotería no encontrada: ${lotteryName}`);
        return null;
      }

      // Buscar horario
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('horario')
        .select('id')
        .eq('id_loteria', lotteryData.id)
        .ilike('nombre', scheduleName)
        .single();

      if (scheduleError || !scheduleData) {
        console.warn(`Horario no encontrado: ${scheduleName} para lotería ${lotteryName}`);
        return null;
      }

      return {
        lotteryId: lotteryData.id,
        scheduleId: scheduleData.id
      };
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
      const calculatedTotal = formData.amount * numbersArray.length;

      // Obtener IDs de lotería y horario para verificación de límites
      const ids = await getLotteryAndScheduleIds(formData.lottery, formData.schedule);
      
      // Si tenemos IDs válidos, verificar límites
      if (ids) {
        const limitViolations = [];

        // Verificar límites para cada número
        for (const number of numbersArray) {
          const cleanNumber = number.trim();
          if (cleanNumber) {
            const limitCheck = await checkBetLimits(
              ids.lotteryId,
              ids.scheduleId,
              formData.playType,
              cleanNumber,
              formData.amount
            );

            if (!limitCheck.allowed) {
              limitViolations.push({
                number: cleanNumber,
                reason: limitCheck.reason,
                limitType: limitCheck.limitType
              });
            }
          }
        }

        // Si hay violaciones de límites, mostrar advertencia
        if (limitViolations.length > 0) {
          const violationMessages = limitViolations.map(v => `• ${v.reason}`).join('\n');
          
          return new Promise((resolve) => {
            Alert.alert(
              '⚠️ Límites Excedidos',
              `Los siguientes números exceden sus límites:\n\n${violationMessages}\n\n¿Deseas continuar de todos modos?`,
              [
                { 
                  text: 'Cancelar', 
                  style: 'cancel',
                  onPress: () => resolve({
                    success: false,
                    error: 'Operación cancelada por el usuario',
                    limitViolations: limitViolations
                  })
                },
                { 
                  text: 'Continuar',
                  style: 'destructive',
                  onPress: async () => {
                    const result = await savePlayAndRegisterBets(formData, numbersArray, calculatedTotal, ids);
                    resolve(result);
                  }
                }
              ]
            );
          });
        }
      }

      // Si no hay violaciones o no se pudieron verificar límites, continuar normalmente
      return await savePlayAndRegisterBets(formData, numbersArray, calculatedTotal, ids);

    } catch (error) {
      console.error('Error al guardar jugada:', error);
      return {
        success: false,
        error: error.message || 'No se pudo guardar la jugada',
        message: 'Error al guardar la jugada'
      };
    }
  };

  // Función auxiliar para guardar jugada y registrar apuestas
  const savePlayAndRegisterBets = async (formData, numbersArray, calculatedTotal, ids) => {
    try {
      // Preparar datos de la jugada
      const playData = {
        lottery: formData.lottery,
        schedule: formData.schedule,
        playType: formData.playType,
        numbers: formData.numbers,
        amount: formData.amount || 0,
        total: calculatedTotal,
        note: formData.note || 'Sin nombre',
        result: 'no disponible',
        prize: 'desconocido',
        hasPrize: false
      };

      // Las jugadas se guardan directamente en la base de datos
      // Ya no necesitamos almacenamiento local

      // Si tenemos IDs válidos, registrar las apuestas en el tracking de límites
      if (ids) {
        for (const number of numbersArray) {
          const cleanNumber = number.trim();
          if (cleanNumber) {
            await registerBet(
              ids.lotteryId,
              ids.scheduleId,
              formData.playType,
              cleanNumber,
              formData.amount,
              formData.note || 'Sin nombre'
            );
          }
        }
      }
      
      return {
        success: true,
        play: savedPlay,
        message: 'Jugada guardada exitosamente'
      };
    } catch (error) {
      console.error('Error guardando jugada y registrando apuestas:', error);
      throw error;
    }
  };

  const submitPlayWithConfirmation = async (formData) => {
    const result = await submitPlay(formData);
    
    if (result.success) {
      Alert.alert(
        '✅ Jugada Guardada',
        `La jugada ha sido guardada exitosamente.\n\nCliente: ${formData.note || 'Sin nombre'}\nNúmeros: ${formData.numbers}\nTotal: $${result.play.total}`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        '❌ Error',
        result.error,
        [{ text: 'OK' }]
      );
    }
    
    return result;
  };

  return {
    submitPlay,
    submitPlayWithConfirmation
  };
};

export default usePlaySubmission;
