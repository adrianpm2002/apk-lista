import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONNECTION_SIMULATION_KEY = 'connection_simulation';

// Simulador de NetInfo para testing
export const useConnectionSimulator = () => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedConnection, setSimulatedConnection] = useState(true);
  const [originalNetInfo, setOriginalNetInfo] = useState(null);

  useEffect(() => {
    loadSimulationState();
  }, []);

  const loadSimulationState = async () => {
    try {
      const saved = await AsyncStorage.getItem(CONNECTION_SIMULATION_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        setIsSimulating(state.isSimulating || false);
        setSimulatedConnection(state.simulatedConnection !== undefined ? state.simulatedConnection : true);
      }
    } catch (error) {
      console.error('Error cargando estado de simulación:', error);
    }
  };

  const saveSimulationState = async (isSimulating, simulatedConnection) => {
    try {
      await AsyncStorage.setItem(CONNECTION_SIMULATION_KEY, JSON.stringify({
        isSimulating,
        simulatedConnection
      }));
    } catch (error) {
      console.error('Error guardando estado de simulación:', error);
    }
  };

  const startSimulation = () => {
    if (!originalNetInfo) {
      // Guardar referencia original de NetInfo
      const NetInfo = require('@react-native-community/netinfo').default;
      setOriginalNetInfo(NetInfo);
      
      // Monkey patch NetInfo para simular
      NetInfo.fetch = () => Promise.resolve({
        isConnected: simulatedConnection,
        isInternetReachable: simulatedConnection,
        type: simulatedConnection ? 'wifi' : 'none'
      });

      NetInfo.addEventListener = (listener) => {
        // Simular listener
        const unsubscribe = () => {};
        setTimeout(() => {
          listener({
            isConnected: simulatedConnection,
            isInternetReachable: simulatedConnection,
            type: simulatedConnection ? 'wifi' : 'none'
          });
        }, 100);
        return unsubscribe;
      };
    }
    
    setIsSimulating(true);
    saveSimulationState(true, simulatedConnection);
    console.log('🔧 Simulación de conexión activada:', simulatedConnection ? 'CONECTADO' : 'DESCONECTADO');
  };

  const stopSimulation = () => {
    setIsSimulating(false);
    saveSimulationState(false, true);
    
    // Restaurar NetInfo original si es posible
    if (originalNetInfo) {
      // En un entorno real, esto requeriría reiniciar la app
      console.log('🔧 Simulación desactivada - Reinicia la app para usar conexión real');
    }
  };

  const setConnectionState = (connected) => {
    setSimulatedConnection(connected);
    saveSimulationState(isSimulating, connected);
    
    if (isSimulating) {
      console.log('🔧 Estado de conexión simulado cambiado a:', connected ? 'CONECTADO' : 'DESCONECTADO');
      
      // Disparar evento simulado para listeners activos
      setTimeout(() => {
        // Esto simularía el cambio en tiempo real
        console.log('📶 Evento de cambio de conexión simulado');
      }, 100);
    }
  };

  const toggleConnection = () => {
    setConnectionState(!simulatedConnection);
  };

  return {
    isSimulating,
    simulatedConnection,
    startSimulation,
    stopSimulation,
    setConnectionState,
    toggleConnection
  };
};

// Hook para simular estados de AppState
export const useAppStateSimulator = () => {
  const [simulatedAppState, setSimulatedAppState] = useState('active');

  const simulateAppStateChange = (newState) => {
    console.log(`🔧 Simulando cambio de AppState: ${simulatedAppState} -> ${newState}`);
    setSimulatedAppState(newState);
    
    // Disparar evento simulado
    const AppState = require('react-native').AppState;
    if (AppState._eventHandlers && AppState._eventHandlers.change) {
      AppState._eventHandlers.change.forEach(handler => {
        setTimeout(() => handler(newState), 100);
      });
    }
  };

  const simulateMinimizeApp = () => simulateAppStateChange('background');
  const simulateRestoreApp = () => simulateAppStateChange('active');
  const simulateInactiveApp = () => simulateAppStateChange('inactive');

  return {
    simulatedAppState,
    simulateMinimizeApp,
    simulateRestoreApp,
    simulateInactiveApp,
    simulateAppStateChange
  };
};

export default {
  useConnectionSimulator,
  useAppStateSimulator
};