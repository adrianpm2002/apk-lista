import React, { createContext, useState, useEffect, useContext } from 'react';
import { useConnection } from '../hooks/useConnection';
import * as OfflineStorage from '../services/offlineStorageService';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Contexto para manejar el estado offline de la aplicación
 * Gestiona: conexión, modo offline manual, jugadas pendientes, sincronización
 */

const OfflineContext = createContext(null);

// Constantes
const OFFLINE_MODE_KEY = '@offline_mode_enabled';
const SESSION_DURATION_HOURS = 24;

export const OfflineProvider = ({ children }) => {
  // Estado de conexión real (NetInfo)
  const { isOnline: isConnected, isChecking } = useConnection();
  
  // Estado de modo offline manual (forzado por usuario)
  const [isOfflineModeEnabled, setIsOfflineModeEnabled] = useState(false);
  
  // Lista de jugadas pendientes de envío
  const [pendingPlays, setPendingPlays] = useState([]);
  
  // Estado de sincronización
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  
  // Estado final: ¿está la app en modo offline?
  // TRUE si: no hay conexión O el usuario activó modo offline manual
  const isOnline = isConnected && !isOfflineModeEnabled;

  /**
   * Cargar estado de modo offline desde AsyncStorage al iniciar
   */
  useEffect(() => {
    const loadOfflineMode = async () => {
      try {
        const value = await AsyncStorage.getItem(OFFLINE_MODE_KEY);
        if (value !== null) {
          setIsOfflineModeEnabled(JSON.parse(value));
        }
      } catch (error) {
        console.error('[OfflineContext] Error loading offline mode:', error);
      }
    };
    loadOfflineMode();
  }, []);

  /**
   * Cargar jugadas pendientes al iniciar y cada vez que cambie la conexión
   */
  useEffect(() => {
    loadPendingPlays();
  }, [isOnline, isSyncing]);

  /**
   * Verificar validez de sesión offline cada hora
   */
  useEffect(() => {
    const checkSessionValidity = async () => {
      // Solo verificar si estamos offline
      if (!isOnline) {
        const isValid = await validateOfflineSession();
        if (!isValid) {
          console.log('[OfflineContext] Sesión offline expirada (>24h)');
          // Aquí podrías forzar logout o mostrar alerta
          // Por ahora solo loguear
        }
      }
    };

    // Verificar inmediatamente
    checkSessionValidity();

    // Verificar cada hora
    const interval = setInterval(checkSessionValidity, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isOnline]);

  /**
   * Cargar jugadas pendientes desde SQLite
   */
  const loadPendingPlays = async () => {
    try {
      const plays = await OfflineStorage.getPendingPlays();
      setPendingPlays(plays || []);
    } catch (error) {
      console.error('[OfflineContext] Error loading pending plays:', error);
      setPendingPlays([]);
    }
  };

  /**
   * Activar/desactivar modo offline manual
   */
  const toggleOfflineMode = async () => {
    try {
      const newValue = !isOfflineModeEnabled;
      setIsOfflineModeEnabled(newValue);
      await AsyncStorage.setItem(OFFLINE_MODE_KEY, JSON.stringify(newValue));
      
      // Log para debug
      console.log('[OfflineContext] Modo offline manual:', newValue ? 'ACTIVADO' : 'DESACTIVADO');
      
      return newValue;
    } catch (error) {
      console.error('[OfflineContext] Error toggling offline mode:', error);
      return isOfflineModeEnabled;
    }
  };

  /**
   * Validar si la sesión offline sigue siendo válida (< 24h)
   * @returns {Promise<boolean>} true si es válida, false si expiró
   */
  const validateOfflineSession = async () => {
    try {
      // Obtener última fecha de login desde SQLite
      const lastLogin = await OfflineStorage.getLastLoginTimestamp();
      
      if (!lastLogin) {
        // No hay sesión guardada
        return false;
      }

      const now = Date.now();
      const hoursSinceLogin = (now - lastLogin) / (1000 * 60 * 60);

      return hoursSinceLogin < SESSION_DURATION_HOURS;
    } catch (error) {
      console.error('[OfflineContext] Error validating session:', error);
      return false;
    }
  };

  /**
   * Verificar si hay un cambio de día (para limpieza automática)
   * @returns {Promise<boolean>} true si cambió el día
   */
  const checkDayChange = async () => {
    try {
      const lastCheck = await OfflineStorage.getConfigValue('last_day_check');
      const today = new Date().toDateString();

      if (lastCheck !== today) {
        // Actualizar fecha de último check
        await OfflineStorage.setConfigValue('last_day_check', today);
        return lastCheck !== null; // true si había una fecha anterior
      }

      return false;
    } catch (error) {
      console.error('[OfflineContext] Error checking day change:', error);
      return false;
    }
  };

  /**
   * Limpiar todas las jugadas (cambio de día)
   */
  const clearAllPlays = async () => {
    try {
      await OfflineStorage.clearAllOfflinePlays();
      await loadPendingPlays();
      console.log('[OfflineContext] Todas las jugadas limpiadas');
    } catch (error) {
      console.error('[OfflineContext] Error clearing plays:', error);
    }
  };

  /**
   * Obtener estadísticas de jugadas pendientes
   */
  const getPendingStats = () => {
    const pending = pendingPlays.filter(p => p.status === 'pending').length;
    const success = pendingPlays.filter(p => p.status === 'success').length;
    const failed = pendingPlays.filter(p => p.status === 'failed').length;
    const total = pendingPlays.reduce((sum, p) => sum + (p.monto_total || 0), 0);

    return { pending, success, failed, total, totalPlays: pendingPlays.length };
  };

  // Valor del contexto
  const value = {
    // Estados
    isOnline,
    isConnected, // Conexión real (NetInfo)
    isOfflineModeEnabled, // Modo offline manual
    isChecking,
    pendingPlays,
    isSyncing,
    syncProgress,

    // Funciones
    toggleOfflineMode,
    validateOfflineSession,
    checkDayChange,
    clearAllPlays,
    loadPendingPlays,
    getPendingStats,

    // Setters para sincronización (se usarán en syncService)
    setIsSyncing,
    setSyncProgress,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

/**
 * Hook para usar el contexto offline
 */
export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline debe ser usado dentro de OfflineProvider');
  }
  return context;
};

export default OfflineContext;
