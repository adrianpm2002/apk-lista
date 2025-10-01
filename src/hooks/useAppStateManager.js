import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import backgroundTaskService from '../services/backgroundTaskService';

export const useAppStateManager = () => {
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  const [isConnected, setIsConnected] = useState(true);
  const [pendingPlaysCount, setPendingPlaysCount] = useState(0);

  useEffect(() => {
    // Registrar tarea en segundo plano al iniciar la app
    if (Platform.OS !== 'web') {
      backgroundTaskService.registerBackgroundFetch();
    }

    // Suscribirse a cambios de estado de la app
    const handleAppStateChange = (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // La app se volvió activa
        handleAppBecameActive();
      } else if (nextAppState.match(/inactive|background/)) {
        // La app se fue a segundo plano
        handleAppWentToBackground();
      }

      appState.current = nextAppState;
      setAppStateVisible(appState.current);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Suscribirse a cambios de conectividad
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      
      // Si se recuperó la conexión, procesar jugadas pendientes
      if (state.isConnected && !isConnected) {
        backgroundTaskService.processPendingPlaysManually();
      }
    });

    // Actualizar contador de jugadas pendientes al iniciar
    updatePendingPlaysCount();

    // Cleanup
    return () => {
      subscription?.remove();
      unsubscribeNetInfo();
    };
  }, [isConnected]);

  const handleAppBecameActive = async () => {
    // Actualizar contador de jugadas pendientes
    await updatePendingPlaysCount();
    
    // Si hay conexión, procesar jugadas pendientes
    if (isConnected) {
      await backgroundTaskService.processPendingPlaysManually();
      await updatePendingPlaysCount();
    }
  };

  const handleAppWentToBackground = async () => {
    // Aquí puedes agregar lógica adicional si es necesaria
  };

  const updatePendingPlaysCount = async () => {
    try {
      const pendingPlays = await backgroundTaskService.getPendingPlays();
      setPendingPlaysCount(pendingPlays.length);
    } catch (error) {
      // Error silencioso para producción
    }
  };

  const forceProcessPendingPlays = async () => {
    await backgroundTaskService.processPendingPlaysManually();
    await updatePendingPlaysCount();
  };

  const clearAllPendingPlays = async () => {
    await backgroundTaskService.clearPendingPlays();
    await updatePendingPlaysCount();
  };

  return {
    appStateVisible,
    isConnected,
    pendingPlaysCount,
    forceProcessPendingPlays,
    clearAllPendingPlays,
    updatePendingPlaysCount
  };
};

export default useAppStateManager;