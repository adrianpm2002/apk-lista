import { supabase } from '../supabaseClient';
import * as OfflineStorage from './offlineStorageService';

/**
 * FASE 8: Servicio de sincronización de jugadas offline
 * 
 * Responsable de:
 * - Sincronizar jugadas pendientes con Supabase
 * - Validar horarios antes de enviar
 * - Manejar errores del servidor
 * - Actualizar estados de jugadas
 */

/**
 * Sincronizar todas las jugadas pendientes
 * @param {Function} onProgress - Callback (current, total, currentPlay)
 * @param {Function} shouldCancel - Función que retorna true si se debe cancelar
 * @returns {Promise<Object>} { success, successCount, failedCount, errors }
 */
export const syncAllPlays = async (onProgress = null, shouldCancel = null) => {
  try {// 1. Obtener jugadas pendientes
    const pendingPlays = await OfflineStorage.getPendingPlays();
    
    if (!pendingPlays || pendingPlays.length === 0) {return {
        success: true,
        successCount: 0,
        failedCount: 0,
        errors: [],
      };
    }// 2. Obtener caché de horarios para validación
    const cachedSchedules = await OfflineStorage.getSchedules(null);
    const scheduleMap = new Map();
    cachedSchedules.forEach(s => scheduleMap.set(s.id, s));

    // 3. Procesar cada jugada
    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    for (let i = 0; i < pendingPlays.length; i++) {
      const play = pendingPlays[i];
      
      // Verificar si se canceló la sincronización
      if (shouldCancel && shouldCancel()) {break;
      }

      // Notificar progreso
      if (onProgress) {
        onProgress(i + 1, pendingPlays.length, play);
      }

      try {
        // Marcar como "enviando"
        await OfflineStorage.updatePlayStatus(play.id, 'sending', null);

        // Pequeño delay para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 100));

        // Validar horario antes de enviar
        const schedule = scheduleMap.get(play.id_horario);
        if (schedule) {
          const validationError = validateScheduleTime(schedule, play.created_at);
          if (validationError) {await OfflineStorage.updatePlayStatus(play.id, 'failed', validationError);
            await OfflineStorage.incrementSyncAttempts(play.id);
            failedCount++;
            errors.push({ playId: play.id, error: validationError });
            continue;
          }
        }

        // Enviar a Supabase
        const result = await sendPlayToSupabase(play);

        if (result.success) {await OfflineStorage.updatePlayStatus(play.id, 'success', null);
          successCount++;
        } else {await OfflineStorage.updatePlayStatus(play.id, 'failed', result.error);
          await OfflineStorage.incrementSyncAttempts(play.id);
          failedCount++;
          errors.push({ playId: play.id, error: result.error });
        }

      } catch (error) {await OfflineStorage.updatePlayStatus(play.id, 'failed', error.message);
        await OfflineStorage.incrementSyncAttempts(play.id);
        failedCount++;
        errors.push({ playId: play.id, error: error.message });
      }
    }// Log de operación
    await OfflineStorage.addLog('INFO', 'Sync completed', {
      total: pendingPlays.length,
      success: successCount,
      failed: failedCount,
    });

    return {
      success: true,
      successCount,
      failedCount,
      errors,
    };

  } catch (error) {await OfflineStorage.addLog('ERROR', 'Sync failed', { error: error.message });
    return {
      success: false,
      successCount: 0,
      failedCount: 0,
      errors: [{ error: error.message }],
    };
  }
};

/**
 * Sincronizar una sola jugada
 * @param {number} playId - ID de la jugada en SQLite
 * @returns {Promise<Object>} { success, error? }
 */
export const syncSinglePlay = async (playId) => {
  try {// Obtener jugada
    const allPlays = await OfflineStorage.getAllOfflinePlays();
    const play = allPlays.find(p => p.id === playId);

    if (!play) {
      return { success: false, error: 'Jugada no encontrada' };
    }

    // Marcar como enviando
    await OfflineStorage.updatePlayStatus(playId, 'sending', null);

    // Validar horario
    const cachedSchedules = await OfflineStorage.getSchedules(null);
    const schedule = cachedSchedules.find(s => s.id === play.id_horario);
    
    if (schedule) {
      const validationError = validateScheduleTime(schedule, play.created_at);
      if (validationError) {
        await OfflineStorage.updatePlayStatus(playId, 'failed', validationError);
        await OfflineStorage.incrementSyncAttempts(playId);
        return { success: false, error: validationError };
      }
    }

    // Enviar a Supabase
    const result = await sendPlayToSupabase(play);

    if (result.success) {
      await OfflineStorage.updatePlayStatus(playId, 'success', null);return { success: true };
    } else {
      await OfflineStorage.updatePlayStatus(playId, 'failed', result.error);
      await OfflineStorage.incrementSyncAttempts(playId);return { success: false, error: result.error };
    }

  } catch (error) {await OfflineStorage.updatePlayStatus(playId, 'failed', error.message);
    await OfflineStorage.incrementSyncAttempts(playId);
    return { success: false, error: error.message };
  }
};

/**
 * Reintentar una jugada fallida
 * @param {number} playId - ID de la jugada
 * @returns {Promise<Object>} { success, error? }
 */
export const retryFailedPlay = async (playId) => {// Cambiar status a pending antes de sincronizar
  await OfflineStorage.updatePlayStatus(playId, 'pending', null);
  
  // Sincronizar
  return await syncSinglePlay(playId);
};

/**
 * Enviar jugada a Supabase
 * @param {Object} play - Datos de la jugada
 * @returns {Promise<Object>} { success, error? }
 */
const sendPlayToSupabase = async (play) => {
  try {
    // Preparar payload para Supabase
    const payload = {
      id_listero: play.id_listero,
      id_horario: play.id_horario,
      jugada: play.tipo_jugada || play.jugada,
      numeros: play.numeros,
      monto_unitario: play.monto_unitario,
      monto_total: play.monto_total,
      nota: play.nota || 'Sin nota',
      comando: play.comando || null,
      id_cliente: play.id_cliente || null,
      created_at: play.created_at,
    };// Insertar en Supabase
    const { data, error } = await supabase
      .from('jugada')
      .insert(payload)
      .select();

    if (error) {// Parsear errores específicos
      let errorMessage = error.message;
      
      if (error.message.includes('límite') || error.message.includes('limit')) {
        errorMessage = 'Límite de número excedido';
      } else if (error.message.includes('horario')) {
        errorMessage = 'Horario no válido';
      }
      
      return { success: false, error: errorMessage };
    }return { success: true, data };

  } catch (error) {return { success: false, error: error.message };
  }
};

/**
 * Validar si el horario está abierto para la fecha/hora de la jugada
 * @param {Object} schedule - Horario del caché
 * @param {string} playCreatedAt - Timestamp de creación de la jugada
 * @returns {string|null} - Mensaje de error o null si es válido
 */
const validateScheduleTime = (schedule, playCreatedAt) => {
  try {// Validar que existan los campos necesarios
    if (!schedule || !schedule.hora_inicio || !schedule.hora_fin) {return null;
    }

    // Obtener hora de la jugada en zona horaria de La Habana, Cuba (America/Havana)
    const playDate = new Date(playCreatedAt);
    
    // Validar que la fecha sea válida
    if (isNaN(playDate.getTime())) {return null; // Permitir envío si la fecha es inválida
    }

    // Convertir a hora de La Habana usando toLocaleString
    const havanaTime = playDate.toLocaleString('en-US', { 
      timeZone: 'America/Havana',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Parsear la hora de La Habana (formato "HH:MM")
    const [playHour, playMinute] = havanaTime.split(':').map(n => parseInt(n, 10));
    const playTime = playHour * 60 + playMinute; // minutos desde medianoche// Parsear hora_inicio y hora_fin del horario
    // Formato esperado: "HH:MM" o "HH:MM:SS"
    const startParts = schedule.hora_inicio.split(':').map(n => parseInt(n, 10));
    const endParts = schedule.hora_fin.split(':').map(n => parseInt(n, 10));

    const startHour = startParts[0];
    const startMinute = startParts[1] || 0;
    const endHour = endParts[0];
    const endMinute = endParts[1] || 0;

    // Validar que los valores sean números válidos
    if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {return null; // Permitir envío si los horarios son inválidos
    }
    
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;// Validar si está dentro del rango
    if (playTime < startTime || playTime > endTime) {
      const errorMsg = `Horario cerrado. Jugada creada a las ${playHour.toString().padStart(2, '0')}:${playMinute.toString().padStart(2, '0')}, pero el horario "${schedule.nombre}" es de ${schedule.hora_inicio} a ${schedule.hora_fin}`;return errorMsg;
    }return null; // Válido
  } catch (error) {// En caso de error en la validación, BLOQUEAR el envío por seguridad
    return 'Error al validar horario. Contacta soporte.';
  }
};

export default {
  syncAllPlays,
  syncSinglePlay,
  retryFailedPlay,
};
