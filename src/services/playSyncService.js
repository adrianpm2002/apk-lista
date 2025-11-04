import { supabase } from '../supabaseClient';
import * as OfflineStorage from './offlineStorageService';
import { isOnline } from './connectionService';

/**
 * Servicio para sincronizar jugadas pendientes con Supabase
 */

/**
 * Sincronizar jugadas pendientes con Supabase
 * @returns {Promise<Object>} Resultado de la sincronización
 */
export const syncPendingPlays = async () => {
  try {
    // Verificar conexión
    const online = await isOnline();
    if (!online) {
      console.log('[PlaySync] Sin conexión, no se puede sincronizar');
      return {
        success: false,
        error: 'Sin conexión a internet',
        synced: 0,
        failed: 0
      };
    }

    console.log('[PlaySync] 🔄 Iniciando sincronización de jugadas...');

    // Obtener jugadas pendientes
    const pendingPlays = await OfflineStorage.getPendingPlays();

    if (pendingPlays.length === 0) {
      console.log('[PlaySync] No hay jugadas pendientes');
      return {
        success: true,
        synced: 0,
        failed: 0
      };
    }

    console.log(`[PlaySync] 📋 ${pendingPlays.length} jugadas pendientes a sincronizar`);

    let synced = 0;
    let failed = 0;
    const errors = [];

    // Sincronizar cada jugada
    for (const play of pendingPlays) {
      try {
        // Preparar datos para Supabase
        const playData = {
          id_loteria: play.id_loteria,
          id_horario: play.id_horario,
          tipo_jugada: play.tipo_jugada,
          numeros: play.numeros,
          monto_unitario: parseFloat(play.monto_unitario),
          monto_total: parseFloat(play.monto_total),
          user_id: play.user_id,
          id_banco: play.id_banco
        };

        // Insertar en Supabase
        const { data, error } = await supabase
          .from('jugadas')
          .insert([playData])
          .select();

        if (error) {
          console.error(`[PlaySync] Error sincronizando jugada ${play.id}:`, error);
          failed++;
          errors.push({
            play_id: play.id,
            error: error.message
          });
          
          await OfflineStorage.addLog('error', 'Error sincronizando jugada', {
            play_id: play.id,
            error: error.message
          });
        } else {
          // Marcar como sincronizada
          await OfflineStorage.markPlayAsSynced(play.id);
          synced++;
          
          console.log(`[PlaySync] ✅ Jugada ${play.id} sincronizada`);
        }
      } catch (playError) {
        console.error(`[PlaySync] Error procesando jugada ${play.id}:`, playError);
        failed++;
        errors.push({
          play_id: play.id,
          error: playError.message
        });
      }
    }

    const result = {
      success: failed === 0,
      synced,
      failed,
      total: pendingPlays.length,
      errors: errors.length > 0 ? errors : undefined
    };

    await OfflineStorage.addLog('info', 'Sincronización completada', result);

    console.log(`[PlaySync] ✅ Sincronización completada: ${synced} exitosas, ${failed} fallidas`);

    return result;
  } catch (error) {
    console.error('[PlaySync] Error en sincronización:', error);
    await OfflineStorage.addLog('error', 'Error en sincronización de jugadas', {
      error: error.message
    });
    
    return {
      success: false,
      error: error.message,
      synced: 0,
      failed: 0
    };
  }
};

/**
 * Eliminar todas las jugadas pendientes
 * @returns {Promise<boolean>}
 */
export const clearPendingPlays = async () => {
  try {
    const pendingPlays = await OfflineStorage.getPendingPlays();
    
    for (const play of pendingPlays) {
      await OfflineStorage.deleteOfflinePlay(play.id);
    }

    await OfflineStorage.addLog('info', 'Jugadas pendientes eliminadas', {
      count: pendingPlays.length
    });

    console.log(`[PlaySync] 🗑️ ${pendingPlays.length} jugadas eliminadas`);
    return true;
  } catch (error) {
    console.error('[PlaySync] Error clearing pending plays:', error);
    return false;
  }
};

/**
 * Reintentar sincronización de jugadas fallidas
 * @returns {Promise<Object>}
 */
export const retryFailedPlays = async () => {
  console.log('[PlaySync] 🔄 Reintentando jugadas fallidas...');
  return await syncPendingPlays();
};

export default {
  syncPendingPlays,
  clearPendingPlays,
  retryFailedPlays
};
