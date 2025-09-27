import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import { sendNotification, NOTIFICATION_TYPES, configureNotifications } from './notificationService';

const BACKGROUND_FETCH_TASK = 'background-fetch-plays';
const PENDING_PLAYS_KEY = 'pending_plays';

// Definir la tarea en segundo plano
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('Ejecutando tarea en segundo plano...');
    await processPendingPlays();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Error en tarea en segundo plano:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Procesar jugadas pendientes
const processPendingPlays = async () => {
  try {
    const pendingPlaysData = await AsyncStorage.getItem(PENDING_PLAYS_KEY);
    if (!pendingPlaysData) return;

    const pendingPlays = JSON.parse(pendingPlaysData);
    const successfulPlays = [];
    const failedPlays = [];

    for (const play of pendingPlays) {
      try {
        // Intentar subir la jugada
        const result = await submitPlayToServer(play);
        if (result.success) {
          successfulPlays.push(play);
          // Mostrar notificación de éxito
          await sendNotification(
            NOTIFICATION_TYPES.PLAY_SUCCESS,
            'Jugada enviada',
            `Jugada ${play.playData.numbers} enviada exitosamente`
          );
        } else {
          failedPlays.push({ ...play, error: result.error });
        }
      } catch (error) {
        console.error('Error procesando jugada:', error);
        failedPlays.push({ ...play, error: error.message });
      }
    }

    // Actualizar lista de jugadas pendientes (solo mantener las que fallaron)
    if (failedPlays.length > 0) {
      await AsyncStorage.setItem(PENDING_PLAYS_KEY, JSON.stringify(failedPlays));
    } else {
      await AsyncStorage.removeItem(PENDING_PLAYS_KEY);
    }

    // Si hay jugadas exitosas, mostrar resumen
    if (successfulPlays.length > 0) {
      await sendNotification(
        NOTIFICATION_TYPES.BATCH_PROCESSED,
        'Jugadas sincronizadas',
        `${successfulPlays.length} jugada(s) enviada(s) correctamente`
      );
    }

    // Si hay jugadas fallidas, mostrar error
    if (failedPlays.length > 0) {
      await sendNotification(
        NOTIFICATION_TYPES.PLAY_ERROR,
        'Error en sincronización',
        `${failedPlays.length} jugada(s) no pudieron enviarse`
      );
    }

  } catch (error) {
    console.error('Error procesando jugadas pendientes:', error);
  }
};

// Función para enviar jugada al servidor (reutiliza lógica de usePlaySubmission)
const submitPlayToServer = async (playEntry) => {
  try {
    const { playData, ids, numbersArray, calculatedTotal } = playEntry;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    const insertPayload = {
      id_horario: ids.scheduleId,
      jugada: playData.playType,
      numeros: playData.numbers,
      monto_unitario: playData.amount || 0,
      monto_total: calculatedTotal,
      nota: (playData.note && playData.note.trim()) || 'Sin nombre',
      id_listero: user.id
    };
    
    // Agregar comando si viene en playData
    if (playData.comando && playData.comando.trim()) {
      insertPayload.comando = playData.comando.trim();
    }
    
    const { error: insertError } = await supabase.from('jugada').insert(insertPayload);
    if (insertError) {
      console.error('Error insertando jugada:', insertError);
      return { success: false, error: insertError.message };
    }
    
    return { success: true, play: insertPayload };
  } catch (error) {
    console.error('Error enviando jugada al servidor:', error);
    return { success: false, error: error.message };
  }
};

// Mostrar notificación (mantener por compatibilidad)
const showNotification = async (title, body, type = 'info') => {
  await sendNotification(NOTIFICATION_TYPES.PLAY_PENDING, title, body, { type });
};

// Registrar tarea en segundo plano
export const registerBackgroundFetch = async () => {
  try {
    // Configurar notificaciones
    await configureNotifications();

    // Registrar tarea en segundo plano
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15000, // 15 segundos (mínimo permitido)
        stopOnTerminate: false, // Continuar después de cerrar la app
        startOnBoot: true, // Iniciar al reiniciar el dispositivo
      });
      console.log('Tarea en segundo plano registrada');
    }
  } catch (error) {
    console.error('Error registrando tarea en segundo plano:', error);
  }
};

// Desregistrar tarea en segundo plano
export const unregisterBackgroundFetch = async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      console.log('Tarea en segundo plano desregistrada');
    }
  } catch (error) {
    console.error('Error desregistrando tarea en segundo plano:', error);
  }
};

// Agregar jugada a la cola de pendientes
export const addPendingPlay = async (playData, numbersArray, calculatedTotal, ids) => {
  try {
    const pendingPlay = {
      id: Date.now().toString(),
      playData,
      numbersArray,
      calculatedTotal,
      ids,
      timestamp: Date.now(),
      attempts: 0
    };

    const existingPlays = await getPendingPlays();
    const updatedPlays = [...existingPlays, pendingPlay];
    
    await AsyncStorage.setItem(PENDING_PLAYS_KEY, JSON.stringify(updatedPlays));
    console.log('Jugada agregada a cola de pendientes');
    
    // Mostrar notificación informativa
    await sendNotification(
      NOTIFICATION_TYPES.PLAY_PENDING,
      'Jugada en cola',
      'La jugada se enviará cuando haya conexión'
    );
    
    return true;
  } catch (error) {
    console.error('Error agregando jugada pendiente:', error);
    return false;
  }
};

// Obtener jugadas pendientes
export const getPendingPlays = async () => {
  try {
    const pendingPlaysData = await AsyncStorage.getItem(PENDING_PLAYS_KEY);
    return pendingPlaysData ? JSON.parse(pendingPlaysData) : [];
  } catch (error) {
    console.error('Error obteniendo jugadas pendientes:', error);
    return [];
  }
};

// Limpiar jugadas pendientes
export const clearPendingPlays = async () => {
  try {
    await AsyncStorage.removeItem(PENDING_PLAYS_KEY);
    console.log('Cola de jugadas pendientes limpiada');
  } catch (error) {
    console.error('Error limpiando jugadas pendientes:', error);
  }
};

// Verificar estado de la conexión y procesar jugadas pendientes manualmente
export const processPendingPlaysManually = async () => {
  console.log('Procesando jugadas pendientes manualmente...');
  await processPendingPlays();
};

export default {
  registerBackgroundFetch,
  unregisterBackgroundFetch,
  addPendingPlay,
  getPendingPlays,
  clearPendingPlays,
  processPendingPlaysManually
};