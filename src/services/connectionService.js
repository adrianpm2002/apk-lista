import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

/**
 * Servicio para detectar y monitorear estado de conexión a internet
 * Usa @react-native-community/netinfo para obtener estado de red
 * Incluye verificación real de conectividad mediante ping
 */

let connectionListeners = [];
let currentConnectionState = null;
let throttleTimer = null;
let pendingNotification = null;
let lastRealConnectivityCheck = 0;
let lastRealConnectivityResult = null;

// Intervalo mínimo entre verificaciones reales (3 segundos)
const REAL_CHECK_INTERVAL = 3000;
// Timeout para ping de verificación (5 segundos)
const PING_TIMEOUT = 5000;

/**
 * Verificar conectividad REAL haciendo un ping a un servidor
 * @returns {Promise<boolean>} true si hay conectividad real
 */
export const checkRealConnectivity = async () => {
  const now = Date.now();
  
  // Si verificamos recientemente, usar cache
  if (lastRealConnectivityResult !== null && (now - lastRealConnectivityCheck) < REAL_CHECK_INTERVAL) {
    return lastRealConnectivityResult;
  }
  
  try {
    // Usar AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT);
    
    // Hacer ping a Google (muy confiable y rápido)
    const response = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    lastRealConnectivityCheck = now;
    lastRealConnectivityResult = true;
    return true;
  } catch (error) {
    lastRealConnectivityCheck = now;
    lastRealConnectivityResult = false;
    return false;
  }
};

/**
 * Invalidar cache de conectividad real (para forzar nueva verificación)
 */
export const invalidateConnectivityCache = () => {
  lastRealConnectivityCheck = 0;
  lastRealConnectivityResult = null;
};

/**
 * Inicializar listener de conexión
 * Debe llamarse al inicio de la app
 */
export const initConnectionMonitor = () => {
  // Suscribirse a cambios de estado de red con throttling agresivo
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    const wasOnline = currentConnectionState?.isConnected && 
      (currentConnectionState?.isInternetReachable !== false);
    
    // isInternetReachable puede ser null en web, tratarlo como true si isConnected es true
    let isOnline = state.isConnected && (state.isInternetReachable !== false);
    
    currentConnectionState = {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      details: state.details,
    };

    // Si NetInfo dice que hay conexión pero isInternetReachable es null o dudoso,
    // verificar conectividad real (solo en móvil)
    if (isOnline && state.isInternetReachable === null && Platform.OS !== 'web') {
      // Invalidar cache para forzar verificación
      invalidateConnectivityCache();
      const reallyOnline = await checkRealConnectivity();
      if (!reallyOnline) {
        isOnline = false;
      }
    }

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
 * @param {boolean} forceRealCheck - Si es true, fuerza verificación real de conectividad
 * @returns {Promise<boolean>} true si hay conexión a internet
 */
export const checkConnection = async (forceRealCheck = false) => {
  try {
    // En web, usar navigator.onLine como fallback más confiable
    if (Platform.OS === 'web') {
      return navigator.onLine;
    }
    
    const state = await NetInfo.fetch();
    // isInternetReachable puede ser null en algunas plataformas
    let isOnline = state.isConnected && (state.isInternetReachable !== false);
    
    // Si forzamos verificación real o isInternetReachable es dudoso
    if (isOnline && (forceRealCheck || state.isInternetReachable === null)) {
      isOnline = await checkRealConnectivity();
    }

    return isOnline;
  } catch (error) {
    // En caso de error, asumir que hay conexión en web, sin conexión en móvil
    if (Platform.OS === 'web') {
      return navigator.onLine;
    }
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
    // En web, usar navigator.onLine como fallback
    if (Platform.OS === 'web') {
      return navigator.onLine;
    }
    return null;
  }
  // isInternetReachable puede ser null, tratarlo como true si isConnected es true
  return currentConnectionState.isConnected && (currentConnectionState.isInternetReachable !== false);
};
