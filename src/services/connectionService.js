import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

/**
 * Servicio para detectar y monitorear estado de conexión a internet
 * Usa @react-native-community/netinfo para obtener estado de red
 */

let connectionListeners = [];
let currentConnectionState = null;
let throttleTimer = null;
let pendingNotification = null;

/**
 * Inicializar listener de conexión
 * Debe llamarse al inicio de la app
 */
export const initConnectionMonitor = () => {
  // Suscribirse a cambios de estado de red con throttling agresivo
  const unsubscribe = NetInfo.addEventListener(state => {
    const wasOnline = currentConnectionState?.isConnected;
    const isOnline = state.isConnected && state.isInternetReachable;
    
    currentConnectionState = {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      details: state.details,
    };

    // THROTTLING: Solo notificar cada 800ms para reducir lag
    // Guardar notificación pendiente
    pendingNotification = { isOnline, wasOnline };

    if (!throttleTimer) {
      // Primera notificación: inmediata
      notifyListeners(isOnline, wasOnline);
      
      // Establecer throttle para siguientes notificaciones
      throttleTimer = setTimeout(() => {
        // Si hay notificación pendiente, enviarla
        if (pendingNotification) {
          notifyListeners(pendingNotification.isOnline, pendingNotification.wasOnline);
          pendingNotification = null;
        }
        throttleTimer = null;
      }, 800); // 800ms de throttle agresivo
    }
  });

  return unsubscribe;
};

/**
 * Notificar a listeners (extraído para reutilizar con throttling)
 */
const notifyListeners = (isOnline, wasOnline) => {
  connectionListeners.forEach(listener => {
    try {
      listener(isOnline, wasOnline);
    } catch (error) {}
  });
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
  } catch (error) {// En caso de error, asumir que no hay conexión
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
