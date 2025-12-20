import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { AppState } from 'react-native';
import { useConnection } from '../hooks/useConnection';
import * as OfflineStorage from '../services/offlineStorageService';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Contexto para manejar el estado offline de la aplicación
 * Gestiona: conexión, modo offline manual, jugadas pendientes, sincronización
 * Filtra automáticamente jugadas que no sean del día actual
 */

const OfflineContext = createContext(null);

// Constantes
const OFFLINE_MODE_KEY = '@offline_mode_enabled';
const SESSION_DURATION_HOURS = 24;

export const OfflineProvider = ({ children, onSessionExpired = null }) => {
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
      } catch (error) {}
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
   * Verificar cambio de día y limpiar cola cada 5 minutos
   * Esto asegura que la cola solo contenga jugadas del día actual
   */
  useEffect(() => {
    const checkDayAndRefresh = async () => {
      const hasChanged = await checkDayChange();
      if (hasChanged) {
        console.log('[OfflineContext] 🔄 Cambio de día detectado. Limpiando cola...');
        await loadPendingPlays(); // Recarga y filtra automáticamente
      }
    };

    // Verificar inmediatamente
    checkDayAndRefresh();

    // Verificar cada 5 minutos
    const interval = setInterval(checkDayAndRefresh, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Listener de AppState: verificar cambio de día cuando la app vuelve al foreground
   */
  const appState = useRef(AppState.currentState);
  
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // Si la app vuelve al foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[OfflineContext] 📱 App volvió al foreground. Verificando día...');
        const hasChanged = await checkDayChange();
        if (hasChanged) {
          console.log('[OfflineContext] 🔄 Cambio de día detectado. Refrescando cola...');
          await loadPendingPlays(); // Filtra automáticamente jugadas antiguas
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  /**
   * FASE 12.2: Verificar validez de sesión offline cada hora
   * Si la sesión expiró (>24h), se debe cerrar automáticamente
   */
  useEffect(() => {
    const checkSessionValidity = async () => {
      // Solo verificar si estamos offline
      if (!isOnline) {
        const isValid = await validateOfflineSession();
        if (!isValid) {// FASE 12.2: Trigger para cerrar sesión
          // El componente padre (App.js o AuthContext) debe escuchar este evento
          if (onSessionExpired) {
            onSessionExpired();
          }
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
   * Filtra automáticamente las jugadas que no sean del día actual
   */
  const loadPendingPlays = async () => {
    try {
      const plays = await OfflineStorage.getPendingPlays();
      
      // Filtrar solo jugadas del día actual (hora local)
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; // YYYY-MM-DD
      
      const todayPlays = (plays || []).filter(play => {
        if (!play.created_at) return false;
        
        // Extraer fecha de created_at
        // Formato puede ser: "YYYY-MM-DD HH:mm:ss" o "YYYY-MM-DDTHH:mm:ssZ"
        const playDate = play.created_at.split(' ')[0].split('T')[0]; // YYYY-MM-DD
        return playDate === today;
      });
      
      // Log si se filtraron jugadas antiguas
      const filteredCount = (plays || []).length - todayPlays.length;
      if (filteredCount > 0) {
        console.log(`[OfflineContext] ℹ️ Filtradas ${filteredCount} jugada(s) de días anteriores de la cola`);
      }
      
      setPendingPlays(todayPlays);
    } catch (error) {
      console.error('[OfflineContext] Error cargando jugadas pendientes:', error);
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
      
      // Log para debugreturn newValue;
    } catch (error) {return isOfflineModeEnabled;
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
    } catch (error) {return false;
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
    } catch (error) {return false;
    }
  };

  /**
   * Limpiar todas las jugadas (cambio de día)
   */
  const clearAllPlays = async () => {
    try {
      await OfflineStorage.clearAllOfflinePlays();
      await loadPendingPlays();} catch (error) {}
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

/**
 * Hook seguro que no lanza error si no está dentro del provider
 * Útil para componentes que pueden existir sin OfflineContext
 */
export const useOfflineSafe = () => {
  const context = useContext(OfflineContext);
  return context || null;
};

export default OfflineContext;
