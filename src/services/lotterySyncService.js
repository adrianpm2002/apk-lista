import { supabase } from '../supabaseClient';
import * as OfflineStorage from './offlineStorageService';
import { isOnline } from './connectionService';

/**
 * Servicio para sincronizar loterías y horarios con Supabase
 */

/**
 * Sincronizar loterías desde Supabase a SQLite
 * @param {number} id_banco - ID del banco (opcional)
 * @returns {Promise<boolean>} true si se sincronizó correctamente
 */
export const syncLotteries = async (id_banco = null) => {
  try {
    // Verificar conexión
    const online = await isOnline();
    if (!online) {
      console.log('[LotterySync] Sin conexión, usando datos offline');
      return false;
    }

    console.log('[LotterySync] 🔄 Sincronizando loterías...');

    // Obtener loterías desde Supabase
    let query = supabase
      .from('loterias')
      .select('id_loteria, nombre, id_banco, activo')
      .eq('activo', true);

    if (id_banco) {
      query = query.eq('id_banco', id_banco);
    }

    const { data: lotteries, error } = await query;

    if (error) {
      console.error('[LotterySync] Error obteniendo loterías:', error);
      await OfflineStorage.addLog('error', 'Error sincronizando loterías', { 
        error: error.message 
      });
      return false;
    }

    if (!lotteries || lotteries.length === 0) {
      console.log('[LotterySync] No hay loterías activas');
      return false;
    }

    // Guardar en SQLite
    const saved = await OfflineStorage.saveLotteries(lotteries, id_banco);

    if (saved) {
      // Guardar timestamp de última sincronización
      await OfflineStorage.setConfig(
        'last_lottery_sync',
        Date.now().toString()
      );

      console.log(`[LotterySync] ✅ ${lotteries.length} loterías sincronizadas`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[LotterySync] Error inesperado:', error);
    await OfflineStorage.addLog('error', 'Error en sincronización de loterías', {
      error: error.message
    });
    return false;
  }
};

/**
 * Sincronizar horarios desde Supabase a SQLite
 * @returns {Promise<boolean>} true si se sincronizó correctamente
 */
export const syncSchedules = async () => {
  try {
    // Verificar conexión
    const online = await isOnline();
    if (!online) {
      console.log('[LotterySync] Sin conexión, usando datos offline');
      return false;
    }

    console.log('[LotterySync] 🔄 Sincronizando horarios...');

    // Obtener horarios desde Supabase
    const { data: schedules, error } = await supabase
      .from('horarios')
      .select('id_horario, id_loteria, hora_cierre, activo')
      .eq('activo', true);

    if (error) {
      console.error('[LotterySync] Error obteniendo horarios:', error);
      await OfflineStorage.addLog('error', 'Error sincronizando horarios', {
        error: error.message
      });
      return false;
    }

    if (!schedules || schedules.length === 0) {
      console.log('[LotterySync] No hay horarios activos');
      return false;
    }

    // Guardar en SQLite
    const saved = await OfflineStorage.saveSchedules(schedules);

    if (saved) {
      // Guardar timestamp de última sincronización
      await OfflineStorage.setConfig(
        'last_schedule_sync',
        Date.now().toString()
      );

      console.log(`[LotterySync] ✅ ${schedules.length} horarios sincronizados`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[LotterySync] Error inesperado:', error);
    await OfflineStorage.addLog('error', 'Error en sincronización de horarios', {
      error: error.message
    });
    return false;
  }
};

/**
 * Sincronizar todo (loterías + horarios)
 * @param {number} id_banco - ID del banco (opcional)
 * @returns {Promise<Object>} Resultado de sincronización
 */
export const syncAll = async (id_banco = null) => {
  console.log('[LotterySync] 🔄 Iniciando sincronización completa...');

  const results = {
    lotteries: false,
    schedules: false,
    timestamp: Date.now()
  };

  try {
    results.lotteries = await syncLotteries(id_banco);
    results.schedules = await syncSchedules();

    if (results.lotteries || results.schedules) {
      await OfflineStorage.addLog('info', 'Sincronización completa', results);
      console.log('[LotterySync] ✅ Sincronización completa exitosa');
    }

    return results;
  } catch (error) {
    console.error('[LotterySync] Error en sincronización completa:', error);
    await OfflineStorage.addLog('error', 'Error en sincronización completa', {
      error: error.message
    });
    return results;
  }
};

/**
 * Verificar si necesita sincronizar (última sync > 1 hora)
 * @returns {Promise<boolean>} true si necesita sincronizar
 */
export const needsSync = async () => {
  try {
    const lastSync = await OfflineStorage.getConfig('last_lottery_sync');
    
    if (!lastSync) {
      return true; // Nunca sincronizado
    }

    const lastSyncTime = parseInt(lastSync, 10);
    const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hora

    return lastSyncTime < oneHourAgo;
  } catch (error) {
    console.error('[LotterySync] Error verificando necesidad de sync:', error);
    return true; // Por seguridad, sincronizar
  }
};

/**
 * Auto-sincronizar si es necesario
 * @param {number} id_banco - ID del banco (opcional)
 */
export const autoSync = async (id_banco = null) => {
  try {
    const needs = await needsSync();
    
    if (!needs) {
      console.log('[LotterySync] ℹ️ Sincronización no necesaria (última sync < 1 hora)');
      return false;
    }

    console.log('[LotterySync] 🔄 Auto-sincronización iniciada...');
    return await syncAll(id_banco);
  } catch (error) {
    console.error('[LotterySync] Error en auto-sincronización:', error);
    return false;
  }
};

export default {
  syncLotteries,
  syncSchedules,
  syncAll,
  needsSync,
  autoSync
};
