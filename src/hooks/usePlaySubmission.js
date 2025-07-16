import { Alert } from 'react-native';
import { useSavedPlays } from './useStorage';

// Hook para manejar el guardado de jugadas desde los formularios
export const usePlaySubmission = () => {
  const { addPlay } = useSavedPlays();

  const submitPlay = async (formData) => {
    try {
      // Validar datos obligatorios
      if (!formData.lottery || !formData.schedule || !formData.playType || !formData.numbers) {
        throw new Error('Faltan datos obligatorios');
      }

      // Calcular cantidad de números y total
      const numbersArray = formData.numbers.split(/[,*\-\s]+/).filter(num => num.trim() !== '');
      const calculatedTotal = formData.amount * numbersArray.length;

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

      // Guardar la jugada
      const savedPlay = await addPlay(playData);
      
      return {
        success: true,
        play: savedPlay,
        message: 'Jugada guardada exitosamente'
      };
    } catch (error) {
      console.error('Error al guardar jugada:', error);
      return {
        success: false,
        error: error.message || 'No se pudo guardar la jugada',
        message: 'Error al guardar la jugada'
      };
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
