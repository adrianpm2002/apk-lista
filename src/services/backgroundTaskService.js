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

    await processPendingPlays();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    // Error silencioso para producción
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
        // Error silencioso para producción
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
    // Error silencioso para producción
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
      // Error silencioso para producción
      return { success: false, error: insertError.message };
    }
    
    return { success: true, play: insertPayload };
  } catch (error) {
    // Error silencioso para producción
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

    }
  } catch (error) {
    // Error silencioso para producción
  }
};

// Desregistrar tarea en segundo plano
export const unregisterBackgroundFetch = async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);

    }
  } catch (error) {
    // Error silencioso para producción
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

    
    // Mostrar notificación informativa
    await sendNotification(
      NOTIFICATION_TYPES.PLAY_PENDING,
      'Jugada en cola',
      'La jugada se enviará cuando haya conexión'
    );
    
    return true;
  } catch (error) {
    // Error silencioso para producción
    return false;
  }
};

// Obtener jugadas pendientes
export const getPendingPlays = async () => {
  try {
    const pendingPlaysData = await AsyncStorage.getItem(PENDING_PLAYS_KEY);
    return pendingPlaysData ? JSON.parse(pendingPlaysData) : [];
  } catch (error) {
    // Error silencioso para producción
    return [];
  }
};

// Limpiar jugadas pendientes
export const clearPendingPlays = async () => {
  try {
    await AsyncStorage.removeItem(PENDING_PLAYS_KEY);

  } catch (error) {
    // Error silencioso para producción
  }
};

// Verificar estado de la conexión y procesar jugadas pendientes manualmente
export const processPendingPlaysManually = async () => {

  await processPendingPlays();
};

/**
 * Sincronizar caché offline de loterías y horarios
 * FASE 5.2 - Background sync
 */
export const syncOfflineCache = async () => {
  try {
    console.log('[BackgroundTask] Iniciando sincronización de caché offline...');
    
    // Importar servicios necesarios
    const OfflineStorage = require('./offlineStorageService');
    
    // 1. Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[BackgroundTask] No hay usuario autenticado, omitiendo sync');
      return { success: false, error: 'No autenticado' };
    }

    // 2. Obtener perfil del usuario para saber su id_banco
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id_banco')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('[BackgroundTask] Error obteniendo perfil:', profileError);
      console.error('[BackgroundTask] User ID:', user.id);
      await OfflineStorage.addLog('ERROR', 'Cache sync failed - profile error', { 
        error: profileError?.message,
        user_id: user.id 
      });
      return { success: false, error: `Error obteniendo perfil: ${profileError?.message || 'Perfil no encontrado'}` };
    }

    // Determinar el banco_id correcto según el rol
    let id_banco;
    if (profile.role === 'admin') {
      id_banco = user.id; // El admin ES el banco
    } else if (profile.role === 'collector' || profile.role === 'listero') {
      id_banco = profile.id_banco;
    } else {
      console.error('[BackgroundTask] Rol desconocido:', profile.role);
      await OfflineStorage.addLog('ERROR', 'Cache sync failed - unknown role', { role: profile.role });
      return { success: false, error: `Rol desconocido: ${profile.role}` };
    }

    console.log('[BackgroundTask] Rol del usuario:', profile.role);
    console.log('[BackgroundTask] ID Banco del usuario:', id_banco);

    // 3. Fetch loterías del banco del usuario
    const { data: lotteries, error: lotteriesError } = await supabase
      .from('loteria')
      .select('*')
      .eq('id_banco', id_banco)
      .order('nombre');

    if (lotteriesError) {
      console.error('[BackgroundTask] Error fetching loterías:', lotteriesError);
      await OfflineStorage.addLog('ERROR', 'Cache sync failed - lotteries fetch error', { error: lotteriesError.message });
      return { success: false, error: 'Error fetching loterías' };
    }

    console.log(`[BackgroundTask] Loterías obtenidas: ${lotteries?.length || 0}`);

    // 4. Guardar loterías en SQLite
    if (lotteries && lotteries.length > 0) {
      const savedLotteries = await OfflineStorage.saveLotteries(lotteries);
      if (!savedLotteries) {
        console.error('[BackgroundTask] ❌ No se pudieron guardar loterías');
        console.error('[BackgroundTask] Platform.OS:', require('react-native').Platform.OS);
        
        await OfflineStorage.addLog('ERROR', 'Cache sync failed - cannot save lotteries', { 
          reason: 'Database error',
          platform: require('react-native').Platform.OS
        });
        
        return { 
          success: false, 
          error: `Error al guardar loterías en SQLite. Plataforma: ${require('react-native').Platform.OS}. Verifica que la base de datos esté correctamente inicializada.` 
        };
      }
      await OfflineStorage.setLastCacheUpdate('lotteries', Date.now());
      console.log('[BackgroundTask] ✅ Loterías guardadas en caché');
    }

    // 5. Obtener IDs de loterías para fetch de horarios
    const lotteryIds = lotteries?.map(lot => lot.id) || [];

    if (lotteryIds.length === 0) {
      console.log('[BackgroundTask] No hay loterías para sincronizar horarios');
      await OfflineStorage.addLog('INFO', 'Cache sync completed', { lotteries: 0, schedules: 0 });
      return { success: true, lotteries: 0, schedules: 0 };
    }

    // 6. Fetch horarios de todas las loterías del banco
    const { data: schedules, error: schedulesError } = await supabase
      .from('horario')
      .select('*')
      .in('id_loteria', lotteryIds)
      .order('hora_inicio');

    if (schedulesError) {
      console.error('[BackgroundTask] Error fetching horarios:', schedulesError);
      await OfflineStorage.addLog('ERROR', 'Cache sync failed - schedules fetch error', { error: schedulesError.message });
      return { success: false, error: 'Error fetching horarios' };
    }

    console.log(`[BackgroundTask] Horarios obtenidos: ${schedules?.length || 0}`);

    // 7. Guardar horarios en SQLite
    if (schedules && schedules.length > 0) {
      const savedSchedules = await OfflineStorage.saveSchedules(schedules);
      if (!savedSchedules) {
        console.error('[BackgroundTask] ❌ No se pudieron guardar horarios');
        console.error('[BackgroundTask] Platform.OS:', require('react-native').Platform.OS);
        
        await OfflineStorage.addLog('ERROR', 'Cache sync failed - cannot save schedules', { 
          reason: 'Database error',
          platform: require('react-native').Platform.OS
        });
        
        return { 
          success: false, 
          error: `Error al guardar horarios en SQLite. Plataforma: ${require('react-native').Platform.OS}. Verifica que la base de datos esté correctamente inicializada.` 
        };
      }
      await OfflineStorage.setLastCacheUpdate('schedules', Date.now());
      console.log('[BackgroundTask] ✅ Horarios guardados en caché');
    }

    // 8. Log de operación exitosa
    const timestamp = Date.now();
    await OfflineStorage.addLog('INFO', 'Cache sync completed successfully', {
      lotteries: lotteries?.length || 0,
      schedules: schedules?.length || 0,
      timestamp
    });

    console.log('[BackgroundTask] ✅ Sincronización de caché completada exitosamente');

    return {
      success: true,
      lotteries: lotteries?.length || 0,
      schedules: schedules?.length || 0,
      timestamp
    };

  } catch (error) {
    console.error('[BackgroundTask] Error en syncOfflineCache:', error);
    const OfflineStorage = require('./offlineStorageService');
    await OfflineStorage.addLog('ERROR', 'Cache sync failed - unexpected error', { 
      error: error.message,
      stack: error.stack 
    });
    return { success: false, error: error.message };
  }
};

export default {
  registerBackgroundFetch,
  unregisterBackgroundFetch,
  addPendingPlay,
  getPendingPlays,
  clearPendingPlays,
  processPendingPlaysManually,
  syncOfflineCache
};