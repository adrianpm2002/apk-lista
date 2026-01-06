import { useState, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { subscribeToConnection, checkConnection, checkRealConnectivity, invalidateConnectivityCache } from '../services/connectionService';

// Intervalo de verificación periódica (30 segundos)
const PERIODIC_CHECK_INTERVAL = 30000;

/**
 * Hook para monitorear estado de conexión a internet
 * Incluye verificación periódica de conectividad real
 * @returns {{ isOnline: boolean, isChecking: boolean, forceCheck: Function }}
 */
export const useConnection = () => {
  const [isOnline, setIsOnline] = useState(true); // Optimista por defecto
  const [isChecking, setIsChecking] = useState(true);
  const appState = useRef(AppState.currentState);
  const intervalRef = useRef(null);

  // Función para forzar verificación de conectividad real
  const forceCheck = async () => {
    if (Platform.OS === 'web') return;
    
    invalidateConnectivityCache();
    const reallyOnline = await checkRealConnectivity();
    setIsOnline(reallyOnline);
    return reallyOnline;
  };

  useEffect(() => {
    // Check inicial con verificación real
    const initialCheck = async () => {
      try {
        const online = await checkConnection(true); // Forzar verificación real
        setIsOnline(online);
      } catch (error) {
        console.error('[useConnection] Error en check inicial:', error);
        setIsOnline(false);
      } finally {
        setIsChecking(false);
      }
    };

    initialCheck();

    // Suscribirse a cambios de conexión
    const unsubscribe = subscribeToConnection((online, wasOnline) => {
      setIsOnline(online);
      setIsChecking(false);
    });

    // Verificación periódica de conectividad real (solo en móvil)
    if (Platform.OS !== 'web') {
      intervalRef.current = setInterval(async () => {
        // Solo verificar si la app está activa
        if (appState.current === 'active') {
          const reallyOnline = await checkRealConnectivity();
          setIsOnline(reallyOnline);
        }
      }, PERIODIC_CHECK_INTERVAL);
    }

    // Listener de AppState para verificar al volver al foreground
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App volvió al foreground, verificar conectividad real
        if (Platform.OS !== 'web') {
          invalidateConnectivityCache();
          const reallyOnline = await checkRealConnectivity();
          setIsOnline(reallyOnline);
        }
      }
      appState.current = nextAppState;
    });

    // Cleanup
    return () => {
      unsubscribe();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      appStateSubscription.remove();
    };
  }, []);

  return { isOnline, isChecking, forceCheck };
};
