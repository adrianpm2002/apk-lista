import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useConnection } from '../hooks/useConnection';
import * as OfflineStorage from '../services/offlineStorageService';

/**
 * Context para gestionar estado offline global de la aplicación
 * Maneja cola de sincronización, estado de conexión y jugadas pendientes
 */
const OfflineContext = createContext(null);

export const OfflineProvider = ({ children }) => {
  // Estado de conexión desde hook
  const { isOnline, isChecking } = useConnection();
  
  // Estado local
  const [syncQueue, setSyncQueue] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [pendingPlaysCount, setPendingPlaysCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  /**
   * Cargar contador de jugadas pendientes desde SQLite
   */
  const loadPendingPlaysCount = useCallback(async () => {
    try {
      const logs = await OfflineStorage.getLogs(1000);
      const pendingLogs = logs.filter(log => 
        log.message?.includes('pending') || log.data?.pending === true
      );
      setPendingPlaysCount(pendingLogs.length);
      console.log('[OfflineContext] Jugadas pendientes:', pendingLogs.length);
    } catch (error) {
      console.error('[OfflineContext] Error cargando jugadas pendientes:', error);
    }
  }, []);

  /**
   * Agregar item a la cola de sincronización
   * @param {Object} item - Item a sincronizar (jugada, config, etc)
   */
  const addToSyncQueue = useCallback((item) => {
    console.log('[OfflineContext] Agregando a cola de sincronización:', item);
    setSyncQueue(prev => {
      // Evitar duplicados por ID
      const exists = prev.some(queueItem => queueItem.id === item.id);
      if (exists) {
        console.log('[OfflineContext] Item ya existe en cola, actualizando...');
        return prev.map(queueItem => 
          queueItem.id === item.id ? { ...queueItem, ...item } : queueItem
        );
      }
      return [...prev, { ...item, addedAt: Date.now() }];
    });
    setPendingPlaysCount(prev => prev + 1);
  }, []);

  /**
   * Limpiar toda la cola de sincronización
   */
  const clearSyncQueue = useCallback(() => {
    console.log('[OfflineContext] Limpiando cola de sincronización');
    setSyncQueue([]);
    setPendingPlaysCount(0);
    setSyncError(null);
  }, []);

  /**
   * Eliminar un item específico de la cola
   * @param {string} itemId - ID del item a eliminar
   */
  const removeFromSyncQueue = useCallback((itemId) => {
    console.log('[OfflineContext] Eliminando de cola:', itemId);
    setSyncQueue(prev => prev.filter(item => item.id !== itemId));
    setPendingPlaysCount(prev => Math.max(0, prev - 1));
  }, []);

  /**
   * Actualizar timestamp de última sincronización
   */
  const updateLastSync = useCallback(() => {
    const now = Date.now();
    setLastSyncTime(now);
    console.log('[OfflineContext] Última sincronización actualizada:', new Date(now).toLocaleString());
    
    // Guardar en config de SQLite
    OfflineStorage.setConfig('last_sync_time', now.toString())
      .catch(err => console.error('[OfflineContext] Error guardando last_sync_time:', err));
  }, []);

  /**
   * Iniciar proceso de sincronización
   * En FASE 7 se implementará la lógica completa
   */
  const startSync = useCallback(async () => {
    if (!isOnline || isSyncing || syncQueue.length === 0) {
      console.log('[OfflineContext] No se puede sincronizar:', { 
        isOnline, 
        isSyncing, 
        queueLength: syncQueue.length 
      });
      return;
    }

    console.log('[OfflineContext] Iniciando sincronización de', syncQueue.length, 'items...');
    setIsSyncing(true);
    setSyncError(null);

    try {
      // TODO FASE 7: Implementar lógica de sincronización con Supabase
      // Por ahora solo simulamos éxito
      console.log('[OfflineContext] ⚠️ Sincronización simulada (FASE 7 pendiente)');
      
      // Simular delay de red
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Marcar como sincronizado
      updateLastSync();
      clearSyncQueue();
      
      await OfflineStorage.addLog('info', 'Sincronización completada (simulada)', {
        itemCount: syncQueue.length,
        timestamp: Date.now()
      });

      console.log('[OfflineContext] ✅ Sincronización completada');
    } catch (error) {
      console.error('[OfflineContext] ❌ Error en sincronización:', error);
      setSyncError(error.message);
      
      await OfflineStorage.addLog('error', 'Error en sincronización', {
        error: error.message,
        itemCount: syncQueue.length
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, syncQueue, updateLastSync, clearSyncQueue]);

  /**
   * Cargar última sincronización desde SQLite al montar
   */
  useEffect(() => {
    const loadLastSync = async () => {
      try {
        const lastSync = await OfflineStorage.getConfig('last_sync_time');
        if (lastSync) {
          setLastSyncTime(parseInt(lastSync, 10));
          console.log('[OfflineContext] Última sincronización cargada:', new Date(parseInt(lastSync, 10)).toLocaleString());
        }
      } catch (error) {
        console.error('[OfflineContext] Error cargando última sincronización:', error);
      }
    };

    loadLastSync();
    loadPendingPlaysCount();
  }, [loadPendingPlaysCount]);

  /**
   * Auto-sincronizar cuando vuelve la conexión
   */
  useEffect(() => {
    if (isOnline && !isChecking && syncQueue.length > 0 && !isSyncing) {
      console.log('[OfflineContext] 🔄 Conexión restaurada, iniciando auto-sincronización...');
      // Esperar 2 segundos antes de sincronizar para estabilizar conexión
      const timer = setTimeout(() => {
        startSync();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, isChecking, syncQueue.length, isSyncing, startSync]);

  const value = {
    // Estado de conexión
    isOnline,
    isChecking,
    
    // Cola de sincronización
    syncQueue,
    addToSyncQueue,
    removeFromSyncQueue,
    clearSyncQueue,
    
    // Estado de sincronización
    isSyncing,
    syncError,
    lastSyncTime,
    startSync,
    updateLastSync,
    
    // Contadores
    pendingPlaysCount,
    loadPendingPlaysCount,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

/**
 * Hook para usar el contexto offline
 * @returns {Object} Contexto offline con todas las funciones y estado
 */
export const useOfflineContext = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOfflineContext debe usarse dentro de OfflineProvider');
  }
  return context;
};

export default OfflineContext;
