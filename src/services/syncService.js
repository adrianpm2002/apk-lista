/**
 * Servicio para sincronizar jugadas offline con Supabase
 * Se ejecuta automáticamente cuando se detecta conexión a internet
 */

import { supabase } from '../supabaseClient';
import { offlineStorage } from './offlineStorageService';
import { 
  getPendingPlays, 
  updateSyncStatus, 
  cleanupSyncedPlays 
} from './offlinePlayService';

/**
 * Sincronizar todas las jugadas pendientes con Supabase
 * @returns {Promise<Object>} - Resultado de la sincronización
 */
export async function syncOfflinePlays() {
  try {
    console.log('🔄 Iniciando sincronización de jugadas offline...');

    const pendingPlays = await getPendingPlays();

    if (pendingPlays.length === 0) {
      console.log('✅ No hay jugadas pendientes de sincronización');
      return {
        success: true,
        synced: 0,
        failed: 0,
        message: 'No hay jugadas pendientes'
      };
    }

    console.log(`📤 Sincronizando ${pendingPlays.length} jugadas pendientes...`);

    let syncedCount = 0;
    let failedCount = 0;
    const errors = [];

    // Procesar jugadas en lotes para mejor performance
    const batchSize = 50; // Supabase permite hasta 1000, pero usamos 50 para mejor control
    
    for (let i = 0; i < pendingPlays.length; i += batchSize) {
      const batch = pendingPlays.slice(i, i + batchSize);
      
      // Preparar payloads para Supabase
      const payloads = batch.map(play => ({
        id_listero: play.user_id,
        id_horario: play.horario_id,
        jugada: play.jugada,
        numeros: play.numero,
        nota: null, // Las jugadas offline no guardan nota por ahora
        monto_unitario: play.monto_unitario,
        monto_total: play.monto_total,
        created_at: play.created_at
      }));

      try {
        // Intentar insertar el lote
        const { data, error } = await supabase
          .from('jugada')
          .insert(payloads)
          .select('id');

        if (error) {
          console.error(`❌ Error sincronizando lote ${i / batchSize + 1}:`, error);
          
          // Marcar todas las jugadas del lote como error
          for (const play of batch) {
            await updateSyncStatus(play.local_id, 'error', null, error.message);
            failedCount++;
            errors.push({
              localId: play.local_id,
              numero: play.numero,
              error: error.message
            });
          }
        } else {
          // Marcar todas las jugadas del lote como sincronizadas
          for (let j = 0; j < batch.length; j++) {
            const play = batch[j];
            const remoteId = data[j]?.id;
            await updateSyncStatus(play.local_id, 'synced', remoteId);
            syncedCount++;
          }
          console.log(`✅ Lote ${i / batchSize + 1} sincronizado: ${batch.length} jugadas`);
        }
      } catch (err) {
        console.error(`❌ Error inesperado en lote ${i / batchSize + 1}:`, err);
        
        // Marcar el lote como error
        for (const play of batch) {
          await updateSyncStatus(play.local_id, 'error', null, err.message);
          failedCount++;
          errors.push({
            localId: play.local_id,
            numero: play.numero,
            error: err.message
          });
        }
      }
    }

    // Limpiar jugadas sincronizadas hace más de 7 días
    await cleanupSyncedPlays(7);

    const result = {
      success: syncedCount > 0,
      synced: syncedCount,
      failed: failedCount,
      total: pendingPlays.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Sincronizadas: ${syncedCount}/${pendingPlays.length} jugadas${failedCount > 0 ? `. ${failedCount} fallaron.` : ''}`
    };

    console.log('🎉 Sincronización completada:', result);
    return result;

  } catch (error) {
    console.error('❌ Error fatal en sincronización:', error);
    return {
      success: false,
      synced: 0,
      failed: 0,
      message: 'Error al sincronizar: ' + error.message
    };
  }
}

/**
 * Reintentar sincronización de jugadas con error
 * @returns {Promise<Object>} - Resultado del reintento
 */
export async function retrySyncFailedPlays() {
  try {
    console.log('🔄 Reintentando sincronización de jugadas con error...');

    const query = `
      SELECT 
        op.*,
        l.nombre as loteria_nombre,
        h.hora as horario_hora
      FROM offline_plays op
      LEFT JOIN lotteries l ON op.loteria_id = l.id
      LEFT JOIN lottery_schedules h ON op.horario_id = h.id
      WHERE op.sync_status = 'error'
      AND op.sync_attempts < 3
      ORDER BY op.created_at DESC
    `;

    const result = await offlineStorage.executeSql(query, []);
    const failedPlays = [];

    for (let i = 0; i < result.rows.length; i++) {
      const play = result.rows.item(i);
      // Resetear a pending para que se vuelva a intentar
      await updateSyncStatus(play.local_id, 'pending', null, null);
      failedPlays.push(play);
    }

    if (failedPlays.length === 0) {
      return {
        success: true,
        retried: 0,
        message: 'No hay jugadas con error para reintentar'
      };
    }

    console.log(`📤 Reintentando ${failedPlays.length} jugadas...`);

    // Ejecutar sincronización normal
    const syncResult = await syncOfflinePlays();

    return {
      ...syncResult,
      retried: failedPlays.length
    };

  } catch (error) {
    console.error('❌ Error al reintentar sincronización:', error);
    return {
      success: false,
      retried: 0,
      message: 'Error al reintentar: ' + error.message
    };
  }
}

/**
 * Sincronizar una jugada específica
 * @param {number} localId - ID local de la jugada
 * @returns {Promise<Object>} - Resultado de la sincronización
 */
export async function syncSinglePlay(localId) {
  try {
    // Obtener la jugada de SQLite
    const query = `
      SELECT * FROM offline_plays 
      WHERE local_id = ? AND sync_status = 'pending'
    `;
    
    const result = await offlineStorage.executeSql(query, [localId]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        message: 'Jugada no encontrada o ya sincronizada'
      };
    }

    const play = result.rows.item(0);

    // Preparar payload para Supabase
    const payload = {
      id_listero: play.user_id,
      id_horario: play.horario_id,
      jugada: play.jugada,
      numeros: play.numero,
      nota: null,
      monto_unitario: play.monto_unitario,
      monto_total: play.monto_total,
      created_at: play.created_at
    };

    // Insertar en Supabase
    const { data, error } = await supabase
      .from('jugada')
      .insert([payload])
      .select('id');

    if (error) {
      await updateSyncStatus(localId, 'error', null, error.message);
      return {
        success: false,
        message: 'Error al sincronizar: ' + error.message
      };
    }

    const remoteId = data[0]?.id;
    await updateSyncStatus(localId, 'synced', remoteId);

    console.log(`✅ Jugada ${localId} sincronizada con ID remoto ${remoteId}`);

    return {
      success: true,
      remoteId,
      message: 'Jugada sincronizada exitosamente'
    };

  } catch (error) {
    console.error(`❌ Error al sincronizar jugada ${localId}:`, error);
    await updateSyncStatus(localId, 'error', null, error.message);
    return {
      success: false,
      message: 'Error al sincronizar: ' + error.message
    };
  }
}

/**
 * Obtener estadísticas de sincronización
 * @returns {Promise<Object>} - Estadísticas
 */
export async function getSyncStats() {
  try {
    const queries = {
      pending: `SELECT COUNT(*) as count FROM offline_plays WHERE sync_status = 'pending'`,
      synced: `SELECT COUNT(*) as count FROM offline_plays WHERE sync_status = 'synced'`,
      error: `SELECT COUNT(*) as count FROM offline_plays WHERE sync_status = 'error'`,
      total: `SELECT COUNT(*) as count FROM offline_plays`
    };

    const stats = {};

    for (const [key, query] of Object.entries(queries)) {
      const result = await offlineStorage.executeSql(query, []);
      stats[key] = result.rows.item(0).count;
    }

    return stats;
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    return {
      pending: 0,
      synced: 0,
      error: 0,
      total: 0
    };
  }
}
