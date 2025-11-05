import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

/**
 * Servicio para detectar y monitorear estado de conexión a internet
 * Usa @react-native-community/netinfo para obtener estado de red
 */

let connectionListeners = [];
let currentConnectionState = null;

/**
 * Inicializar listener de conexión
 * Debe llamarse al inicio de la app
 */
export const initConnectionMonitor = () => {
  // Suscribirse a cambios de estado de red
  const unsubscribe = NetInfo.addEventListener(state => {
    const wasOnline = currentConnectionState?.isConnected;
    const isOnline = state.isConnected && state.isInternetReachable;
    
    currentConnectionState = {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      details: state.details,
    };

    // Solo notificar (sin logging pesado) cuando cambia el estado
    // Comentamos logs ruidosos para evitar saturar adb logcat durante pruebas.
    // if (wasOnline !== isOnline) {
    //   console.log('[ConnectionService] 🔄 Cambio de conexión:', {
    //     anterior: wasOnline ? 'ONLINE' : 'OFFLINE',
    //     actual: isOnline ? 'ONLINE' : 'OFFLINE',
    //     type: state.type,
    //   });
    // }

    // Notificar a todos los listeners
    connectionListeners.forEach(listener => {
      try {
        listener(isOnline, wasOnline);
      } catch (error) {
        console.error('[ConnectionService] Error en listener:', error);
      }
    });
  });

  return unsubscribe;
};

/**
 * Obtener estado actual de conexión
 * @returns {Promise<boolean>} true si hay conexión a internet
 */
export const checkConnection = async () => {
  try {
    const state = await NetInfo.fetch();
    const isOnline = state.isConnected && state.isInternetReachable;
    
  // No log por defecto para evitar saturación de consola en dev

    return isOnline;
  } catch (error) {
    console.error('[ConnectionService] Error checking connection:', error);
    // En caso de error, asumir que no hay conexión
    return false;
  }
};

/**
 * Suscribirse a cambios de conexión
 * @param {Function} callback - Función que recibe (isOnline, wasOnline)
 * @returns {Function} Función para desuscribirse
 */
export const subscribeToConnection = (callback) => {
  connectionListeners.push(callback);
  
  // Retornar función de cleanup
  return () => {
    connectionListeners = connectionListeners.filter(listener => listener !== callback);
  };
};

/**
 * Obtener estado de conexión desde cache (sin llamar a NetInfo)
 * Útil para verificaciones rápidas sin async
 * @returns {boolean|null} true/false o null si aún no se ha inicializado
 */
export const getConnectionState = () => {
  if (!currentConnectionState) {
    return null;
  }
  return currentConnectionState.isConnected && currentConnectionState.isInternetReachable;
};

/**
 * Simular modo offline (para testing)
 * Solo funciona en desarrollo
 */
let forceOfflineMode = false;

export const setForceOffline = (offline) => {
  if (__DEV__) {
    forceOfflineMode = offline;
    console.log('[ConnectionService] Modo offline forzado:', offline);
    
    // Notificar a listeners del cambio
    connectionListeners.forEach(listener => {
      try {
        listener(!offline, true);
      } catch (error) {
        console.error('[ConnectionService] Error en listener:', error);
      }
    });
  }
};

export const isForceOffline = () => {
  return __DEV__ && forceOfflineMode;
};

/**
 * Verificar conexión considerando modo offline forzado
 * @returns {Promise<boolean>}
 */
export const isOnline = async () => {
  if (isForceOffline()) {
    return false;
  }
  return await checkConnection();
};
