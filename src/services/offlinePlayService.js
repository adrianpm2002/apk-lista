/**
 * Servicio para manejar jugadas en modo offline
 * Guarda las jugadas en SQLite cuando no hay conexión a internet
 */

import { offlineStorage } from './offlineStorageService';

/**
 * Guardar una jugada en modo offline
 * @param {Object} play - Datos de la jugada
 * @returns {Promise<Object>} - Resultado con id local de la jugada
 */
export async function saveOfflinePlay(play) {
  try {
    const {
      user_id,
      loteria_id,
      horario_id,
      numero,
      jugada,
      monto_unitario,
      monto_total,
      fecha_jugada,
      created_at
    } = play;

    const query = `
      INSERT INTO offline_plays (
        user_id, loteria_id, horario_id, numero, jugada,
        monto_unitario, monto_total, fecha_jugada, created_at,
        sync_status, sync_attempts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
    `;

    const params = [
      user_id,
      loteria_id,
      horario_id || null,
      numero,
      jugada,
      monto_unitario,
      monto_total,
      fecha_jugada,
      created_at || new Date().toISOString()
    ];

    const result = await offlineStorage.executeSql(query, params);
    const localId = result.insertId;

    console.log('✅ Jugada guardada offline con ID local:', localId);

    return {
      success: true,
      localId,
      message: 'Jugada guardada offline. Se sincronizará cuando haya conexión.'
    };
  } catch (error) {
    console.error('❌ Error al guardar jugada offline:', error);
    throw new Error('No se pudo guardar la jugada offline: ' + error.message);
  }
}

/**
 * Guardar múltiples jugadas en modo offline (batch)
 * @param {Array} plays - Array de jugadas
 * @returns {Promise<Object>} - Resultado con IDs locales
 */
export async function saveOfflinePlays(plays) {
  try {
    const localIds = [];

    // Ejecutar inserts en transacción para mejor performance
    await offlineStorage.transaction(async (tx) => {
      for (const play of plays) {
        const {
          user_id,
          loteria_id,
          horario_id,
          numero,
          jugada,
          monto_unitario,
          monto_total,
          fecha_jugada,
          created_at
        } = play;

        const query = `
          INSERT INTO offline_plays (
            user_id, loteria_id, horario_id, numero, jugada,
            monto_unitario, monto_total, fecha_jugada, created_at,
            sync_status, sync_attempts
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
        `;

        const params = [
          user_id,
          loteria_id,
          horario_id || null,
          numero,
          jugada,
          monto_unitario,
          monto_total,
          fecha_jugada,
          created_at || new Date().toISOString()
        ];

        const result = await tx.executeSql(query, params);
        localIds.push(result.insertId);
      }
    });

    console.log(`✅ ${plays.length} jugadas guardadas offline`);

    return {
      success: true,
      localIds,
      count: plays.length,
      message: `${plays.length} jugadas guardadas offline. Se sincronizarán cuando haya conexión.`
    };
  } catch (error) {
    console.error('❌ Error al guardar jugadas offline (batch):', error);
    throw new Error('No se pudo guardar las jugadas offline: ' + error.message);
  }
}

/**
 * Obtener todas las jugadas pendientes de sincronización
 * @returns {Promise<Array>} - Array de jugadas pendientes
 */
export async function getPendingPlays() {
  try {
    const query = `
      SELECT 
        op.*,
        l.nombre as loteria_nombre,
        h.hora as horario_hora
      FROM offline_plays op
      LEFT JOIN lotteries l ON op.loteria_id = l.id
      LEFT JOIN lottery_schedules h ON op.horario_id = h.id
      WHERE op.sync_status = 'pending'
      ORDER BY op.created_at DESC
    `;

    const result = await offlineStorage.executeSql(query, []);
    const plays = [];

    for (let i = 0; i < result.rows.length; i++) {
      plays.push(result.rows.item(i));
    }

    console.log(`📋 ${plays.length} jugadas pendientes de sincronización`);
    return plays;
  } catch (error) {
    console.error('❌ Error al obtener jugadas pendientes:', error);
    return [];
  }
}

/**
 * Obtener conteo de jugadas pendientes
 * @returns {Promise<number>} - Cantidad de jugadas pendientes
 */
export async function getPendingPlayCount() {
  try {
    const query = `SELECT COUNT(*) as count FROM offline_plays WHERE sync_status = 'pending'`;
    const result = await offlineStorage.executeSql(query, []);
    const count = result.rows.item(0).count;
    return count;
  } catch (error) {
    console.error('❌ Error al contar jugadas pendientes:', error);
    return 0;
  }
}

/**
 * Actualizar estado de sincronización de una jugada
 * @param {number} localId - ID local de la jugada
 * @param {string} status - Nuevo estado (synced, error, pending)
 * @param {string} remoteId - ID remoto de Supabase (opcional)
 * @param {string} errorMessage - Mensaje de error (opcional)
 */
export async function updateSyncStatus(localId, status, remoteId = null, errorMessage = null) {
  try {
    const query = `
      UPDATE offline_plays
      SET sync_status = ?,
          remote_id = ?,
          sync_error = ?,
          synced_at = CASE WHEN ? = 'synced' THEN datetime('now') ELSE synced_at END,
          sync_attempts = sync_attempts + 1
      WHERE local_id = ?
    `;

    await offlineStorage.executeSql(query, [status, remoteId, errorMessage, status, localId]);

    console.log(`✅ Estado de sincronización actualizado para jugada ${localId}: ${status}`);
  } catch (error) {
    console.error('❌ Error al actualizar estado de sincronización:', error);
  }
}

/**
 * Eliminar jugadas sincronizadas exitosamente
 * @param {number} daysOld - Eliminar jugadas sincronizadas hace más de X días (default: 7)
 */
export async function cleanupSyncedPlays(daysOld = 7) {
  try {
    const query = `
      DELETE FROM offline_plays
      WHERE sync_status = 'synced'
      AND datetime(synced_at) < datetime('now', '-${daysOld} days')
    `;

    const result = await offlineStorage.executeSql(query, []);
    const deletedCount = result.rowsAffected;

    console.log(`🧹 Limpieza: ${deletedCount} jugadas sincronizadas eliminadas`);
    return deletedCount;
  } catch (error) {
    console.error('❌ Error al limpiar jugadas sincronizadas:', error);
    return 0;
  }
}

/**
 * Eliminar una jugada específica (por ID local)
 * @param {number} localId - ID local de la jugada
 */
export async function deleteOfflinePlay(localId) {
  try {
    const query = `DELETE FROM offline_plays WHERE local_id = ?`;
    await offlineStorage.executeSql(query, [localId]);
    console.log(`🗑️ Jugada offline ${localId} eliminada`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error al eliminar jugada offline:', error);
    throw error;
  }
}

/**
 * Obtener jugadas con error de sincronización
 * @returns {Promise<Array>} - Array de jugadas con error
 */
export async function getFailedPlays() {
  try {
    const query = `
      SELECT 
        op.*,
        l.nombre as loteria_nombre,
        h.hora as horario_hora
      FROM offline_plays op
      LEFT JOIN lotteries l ON op.loteria_id = l.id
      LEFT JOIN lottery_schedules h ON op.horario_id = h.id
      WHERE op.sync_status = 'error'
      ORDER BY op.created_at DESC
    `;

    const result = await offlineStorage.executeSql(query, []);
    const plays = [];

    for (let i = 0; i < result.rows.length; i++) {
      plays.push(result.rows.item(i));
    }

    return plays;
  } catch (error) {
    console.error('❌ Error al obtener jugadas fallidas:', error);
    return [];
  }
}
