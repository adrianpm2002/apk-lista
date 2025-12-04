import AsyncStorage from '@react-native-async-storage/async-storage';
import * as OfflineStorage from './offlineStorageService';

/**
 * FASE 10: Day Change Handler
 * 
 * Detecta cambio de día y limpia TODAS las jugadas del día anterior
 * (pending, success, failed) según reglas de negocio.
 * Mantiene solo jugadas del día actual en la base de datos SQLite.
 */

const LAST_CHECK_DATE_KEY = '@offline_last_check_date';

/**
 * Paso 10.1: Detectar si cambió el día desde la última verificación
 */
export const detectDayChange = async () => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastCheckDate = await AsyncStorage.getItem(LAST_CHECK_DATE_KEY);

    console.log('[DayChangeService] Verificando cambio de día:', { today, lastCheckDate });

    // Si es la primera vez o cambió el día
    if (!lastCheckDate || lastCheckDate !== today) {
      console.log('[DayChangeService] ✅ Detectado cambio de día');
      return true;
    }

    console.log('[DayChangeService] Sin cambio de día');
    return false;
  } catch (error) {
    console.error('[DayChangeService] Error detectando cambio de día:', error);
    return false;
  }
};

/**
 * Paso 10.2: Limpiar TODAS las jugadas del día anterior
 * 
 * REGLAS DE NEGOCIO: Al cambiar el día, se deben eliminar TODAS las jugadas
 * sin importar su estado (pending, success, failed)
 */
export const cleanOldPlays = async () => {
  try {
    console.log('[DayChangeService] 🧹 Iniciando limpieza de TODAS las jugadas del día anterior...');

    const db = await OfflineStorage.getDatabase();
    if (!db) {
      console.log('[DayChangeService] ⚠️ Base de datos no disponible, saltando limpieza');
      return 0;
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Contar jugadas antes de limpiar (todas, sin filtro de status)
    const countBefore = await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `SELECT COUNT(*) as total FROM offline_plays`,
          [],
          (_, { rows }) => resolve(rows._array[0].total),
          (_, error) => {
            console.error('[DayChangeService] Error contando jugadas:', error);
            reject(error);
            return false;
          }
        );
      });
    });

    console.log('[DayChangeService] Total de jugadas antes de limpieza:', countBefore);

    // Eliminar TODAS las jugadas del día anterior (sin filtro de status)
    await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `DELETE FROM offline_plays 
           WHERE DATE(created_at) < DATE(?)`,
          [today],
          (_, result) => {
            console.log('[DayChangeService] ✅ Jugadas eliminadas:', result.rowsAffected);
            resolve(result);
          },
          (_, error) => {
            console.error('[DayChangeService] ❌ Error eliminando jugadas:', error);
            reject(error);
            return false;
          }
        );
      });
    });

    // Contar jugadas después de limpiar
    const countAfter = await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `SELECT COUNT(*) as total FROM offline_plays`,
          [],
          (_, { rows }) => resolve(rows._array[0].total),
          (_, error) => {
            console.error('[DayChangeService] Error contando jugadas:', error);
            reject(error);
            return false;
          }
        );
      });
    });

    const deleted = countBefore - countAfter;
    console.log('[DayChangeService] ✅ Limpieza completada. Eliminadas:', deleted, 'jugadas de', countBefore, 'totales');
    console.log('[DayChangeService] Jugadas restantes (del día actual):', countAfter);

    return deleted;
  } catch (error) {
    console.error('[DayChangeService] ❌ Error en limpieza de jugadas:', error);
    return 0;
  }
};

/**
 * Paso 10.3: Actualizar fecha de última verificación
 */
export const updateLastCheckDate = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem(LAST_CHECK_DATE_KEY, today);
    console.log('[DayChangeService] 📅 Fecha actualizada:', today);
  } catch (error) {
    console.error('[DayChangeService] Error actualizando fecha:', error);
  }
};

/**
 * Función principal: Verificar y limpiar si es necesario
 * 
 * Debe llamarse:
 * - Al iniciar la app
 * - Cuando la app vuelve al foreground (desde background)
 * 
 * REGLA DE NEGOCIO: Elimina TODAS las jugadas del día anterior
 */
export const checkAndCleanIfDayChanged = async () => {
  try {
    console.log('[DayChangeService] 🔍 Verificando cambio de día...');

    const dayChanged = await detectDayChange();
    
    if (dayChanged) {
      console.log('[DayChangeService] 🗓️ Nuevo día detectado, ejecutando limpieza TOTAL...');
      
      // Limpiar TODAS las jugadas antiguas (sin importar estado)
      const deleted = await cleanOldPlays();
      
      // Actualizar fecha de última verificación
      await updateLastCheckDate();
      
      console.log('[DayChangeService] ✅ Proceso completado. Eliminadas:', deleted, 'jugadas');
      return { dayChanged: true, deleted };
    } else {
      console.log('[DayChangeService] Mismo día, sin acciones necesarias');
      return { dayChanged: false, deleted: 0 };
    }
  } catch (error) {
    console.error('[DayChangeService] ❌ Error en checkAndCleanIfDayChanged:', error);
    return { dayChanged: false, deleted: 0, error };
  }
};

/**
 * Inicializar servicio (establecer fecha inicial si no existe)
 */
export const initDayChangeService = async () => {
  try {
    const lastCheckDate = await AsyncStorage.getItem(LAST_CHECK_DATE_KEY);
    
    if (!lastCheckDate) {
      console.log('[DayChangeService] Primera inicialización, estableciendo fecha actual');
      await updateLastCheckDate();
    } else {
      console.log('[DayChangeService] Servicio ya inicializado. Última verificación:', lastCheckDate);
    }
  } catch (error) {
    console.error('[DayChangeService] Error inicializando servicio:', error);
  }
};
