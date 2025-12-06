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
    const lastCheckDate = await AsyncStorage.getItem(LAST_CHECK_DATE_KEY);// Si es la primera vez o cambió el día
    if (!lastCheckDate || lastCheckDate !== today) {return true;
    }return false;
  } catch (error) {return false;
  }
};

/**
 * Paso 10.2: Limpiar TODAS las jugadas del día anterior
 * 
 * REGLAS DE NEGOCIO: Al cambiar el día, se deben eliminar TODAS las jugadas
 * sin importar su estado (pending, success, failed)
 */
export const cleanOldPlays = async () => {
  try {const db = await OfflineStorage.getDatabase();
    if (!db) {return 0;
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Contar jugadas antes de limpiar (todas, sin filtro de status)
    const countBefore = await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `SELECT COUNT(*) as total FROM offline_plays`,
          [],
          (_, { rows }) => resolve(rows._array[0].total),
          (_, error) => {reject(error);
            return false;
          }
        );
      });
    });// Eliminar TODAS las jugadas del día anterior (sin filtro de status)
    await new Promise((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql(
          `DELETE FROM offline_plays 
           WHERE DATE(created_at) < DATE(?)`,
          [today],
          (_, result) => {resolve(result);
          },
          (_, error) => {reject(error);
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
          (_, error) => {reject(error);
            return false;
          }
        );
      });
    });

    const deleted = countBefore - countAfter;return deleted;
  } catch (error) {return 0;
  }
};

/**
 * Paso 10.3: Actualizar fecha de última verificación
 */
export const updateLastCheckDate = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem(LAST_CHECK_DATE_KEY, today);} catch (error) {}
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
  try {const dayChanged = await detectDayChange();
    
    if (dayChanged) {// Limpiar TODAS las jugadas antiguas (sin importar estado)
      const deleted = await cleanOldPlays();
      
      // Actualizar fecha de última verificación
      await updateLastCheckDate();return { dayChanged: true, deleted };
    } else {return { dayChanged: false, deleted: 0 };
    }
  } catch (error) {return { dayChanged: false, deleted: 0, error };
  }
};

/**
 * Inicializar servicio (establecer fecha inicial si no existe)
 */
export const initDayChangeService = async () => {
  try {
    const lastCheckDate = await AsyncStorage.getItem(LAST_CHECK_DATE_KEY);
    
    if (!lastCheckDate) {await updateLastCheckDate();
    } else {}
  } catch (error) {}
};
