import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

const OfflineContext = createContext(null);

const STORAGE_KEYS = {
  offlineMode: 'app.offline.mode',
  queue: 'app.offline.queue',
};

export function OfflineProvider({ children }) {
  const [offlineMode, setOfflineMode] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  // Load initial flags
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.offlineMode);
        if (raw != null) setOfflineMode(raw === '1');
        const q = await AsyncStorage.getItem(STORAGE_KEYS.queue);
        const arr = q ? JSON.parse(q) : [];
        setPendingCount(Array.isArray(arr) ? arr.length : 0);
      } catch {}
    })();
  }, []);

  // Monitor connectivity as a hint (user still controls offlineMode)
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (mounted) setIsOnline(!!(state?.isConnected && state?.isInternetReachable));
      } catch {}
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const setOffline = async (value) => {
    setOfflineMode(value);
    try { await AsyncStorage.setItem(STORAGE_KEYS.offlineMode, value ? '1' : '0'); } catch {}
  };

  const addToQueue = async (item) => {
    try {
      const q = await AsyncStorage.getItem(STORAGE_KEYS.queue);
      const arr = q ? JSON.parse(q) : [];
      arr.push({ ...item, __id: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
      await AsyncStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(arr));
      setPendingCount(arr.length);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    }
  };

  const getQueue = async () => {
    try {
      const q = await AsyncStorage.getItem(STORAGE_KEYS.queue);
      const arr = q ? JSON.parse(q) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };

  const clearFromQueue = async (__ids) => {
    try {
      const q = await AsyncStorage.getItem(STORAGE_KEYS.queue);
      const arr = q ? JSON.parse(q) : [];
      const filtered = arr.filter(it => !__ids.includes(it.__id));
      await AsyncStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(filtered));
      setPendingCount(filtered.length);
    } catch {}
  };

  const value = useMemo(() => ({
    offlineMode,
    setOffline,
    pendingCount,
    isOnline,
    addToQueue,
    getQueue,
    clearFromQueue,
  }), [offlineMode, pendingCount, isOnline]);

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
}
