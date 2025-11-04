import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useConnection } from '../hooks/useConnection';
import * as OfflineStorage from '../services/offlineStorageService';
import { syncOfflinePlays, getSyncStats } from '../services/syncService';
import { getPendingPlayCount } from '../services/offlinePlayService';

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
   * Cargar contador de jugadas pendientes desde offline_plays
   * FASE 6: Ahora lee de la tabla offline_plays en lugar de logs
   */
  const loadPendingPlaysCount = useCallback(async () => {
    try {
      const count = await getPendingPlayCount();
      setPendingPlaysCount(count);
      console.log('[OfflineContext] Jugadas pendientes:', count);
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
   * FASE 7: Sincronización real con syncService
   */
  const startSync = useCallback(async () => {
    if (!isOnline || isSyncing) {
      console.log('[OfflineContext] No se puede sincronizar:', { 
        isOnline, 
        isSyncing
      });
      return;
    }

    console.log('[OfflineContext] Iniciando sincronización de jugadas pendientes...');
    setIsSyncing(true);
    setSyncError(null);

    try {
      // Sincronizar jugadas pendientes usando syncService
      const result = await syncOfflinePlays();
      
      if (result.success || result.synced > 0) {
        console.log('[OfflineContext] ✅ Sincronización completada:', result);
        
        // Actualizar última sincronización
        updateLastSync();
        
        // Recargar conteo de pendientes
        await loadPendingPlaysCount();
        
        // Limpiar cola de sincronización si todo se sincronizó
        if (result.failed === 0) {
          clearSyncQueue();
        }
        
        await OfflineStorage.addLog('info', 'Sincronización completada', {
          synced: result.synced,
          failed: result.failed,
          total: result.total,
          timestamp: Date.now()
        });
      } else {
        throw new Error(result.message || 'Error desconocido en sincronización');
      }
    } catch (error) {
      console.error('[OfflineContext] ❌ Error en sincronización:', error);
      setSyncError(error.message);
      
      await OfflineStorage.addLog('error', 'Error en sincronización', {
        error: error.message,
        timestamp: Date.now()
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, updateLastSync, loadPendingPlaysCount, clearSyncQueue]);

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
   * FASE 7: Sincronización automática cuando se detecta conexión
   */
  useEffect(() => {
    if (isOnline && !isChecking && pendingPlaysCount > 0 && !isSyncing) {
      console.log(`[OfflineContext] 🔄 Conexión restaurada con ${pendingPlaysCount} jugadas pendientes, iniciando auto-sincronización...`);
      // Esperar 2 segundos antes de sincronizar para estabilizar conexión
      const timer = setTimeout(() => {
        startSync();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, isChecking, pendingPlaysCount, isSyncing, startSync]);

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
