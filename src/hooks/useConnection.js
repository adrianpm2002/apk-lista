import { useState, useEffect } from 'react';
import { subscribeToConnection, checkConnection } from '../services/connectionService';

/**
 * Hook para monitorear estado de conexión a internet
 * @returns {{ isOnline: boolean, isChecking: boolean }}
 */
export const useConnection = () => {
  const [isOnline, setIsOnline] = useState(true); // Optimista por defecto
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check inicial
    const initialCheck = async () => {
      try {
        const online = await checkConnection();
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
      console.log('[useConnection] Cambio de conexión:', { online, wasOnline });
      setIsOnline(online);
      setIsChecking(false);
    });

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, []);

  return { isOnline, isChecking };
};
