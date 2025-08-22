import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NotificationsContext = createContext(null);

const STORAGE_KEY = 'app.notifications.v1';

// type Notification = { id, key?, title, body, type: 'info'|'success'|'warning'|'error', roles: string[], source?: string, ts: number, unread: boolean }

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setNotifications(parsed);
        }
      } catch {}
    })();
  }, []);

  const persist = async (next) => {
    setNotifications(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const add = (notif) => {
    const n = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, unread: true, ts: Date.now(), ...notif };
    const next = [n, ...notifications].slice(0, 200); // cap
    persist(next);
    return n.id;
  };

  const addOrUpdateByKey = (key, build) => {
    const idx = notifications.findIndex(n => n.key === key);
    if (idx >= 0) {
      const updated = { ...notifications[idx], ...build(notifications[idx]), key, ts: Date.now(), unread: true };
      const next = notifications.slice();
      next[idx] = updated;
      persist(next);
      return updated.id;
    } else {
      const n = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, unread: true, ts: Date.now(), key, ...build(null) };
      const next = [n, ...notifications].slice(0, 200);
      persist(next);
      return n.id;
    }
  };

  const markRead = (id) => {
    const next = notifications.map(n => n.id === id ? { ...n, unread: false } : n);
    persist(next);
  };

  const markAllReadForRole = (role) => {
    const next = notifications.map(n => (n.roles?.includes(role) ? { ...n, unread: false } : n));
    persist(next);
  };

  const clearForRole = (role) => {
    const next = notifications.filter(n => !n.roles?.includes(role));
    persist(next);
  };

  const value = useMemo(() => ({
    notifications,
    add,
    addOrUpdateByKey,
    markRead,
    markAllReadForRole,
    clearForRole,
  }), [notifications]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}

// Helpers: templates por rol según catálogo definido
export const NotificationTemplates = {
  // Collector
  'collector.2': (payload) => ({
    title: 'Límite excedido',
    body: `Listero excedió límite en ${payload?.jugada || 'jugada'} (${payload?.detalle || ''}).`,
    type: 'warning', roles: ['collector'], source: 'limits'
  }),
  'collector.3': () => ({ title: 'Números limitados actualizados', body: 'Se actualizaron números limitados del banco.', type: 'info', roles: ['collector'], source: 'limits' }),
  'collector.4': (p) => ({ title: 'Precios actualizados', body: p?.detalle || 'Hay cambios en precios vigentes.', type: 'info', roles: ['collector'], source: 'prices' }),
  'collector.5': (p) => ({ title: 'Resultados insertados', body: p?.detalle || 'Resultados confirmados correctamente.', type: 'success', roles: ['collector'], source: 'results' }),
  'collector.10': (p) => ({ title: 'Objetivo de ventas', body: p?.detalle || 'Objetivo diario alcanzado/pendiente.', type: 'info', roles: ['collector'], source: 'stats' }),

  // Listero
  'listero.3': (p) => ({ title: 'Número limitado', body: p?.detalle || 'Se bloqueó o ajustó una jugada por límite de número.', type: 'warning', roles: ['listero'], source: 'limits' }),
  'listero.4': (p) => ({ title: 'Límite específico', body: p?.detalle || 'Límite alcanzado o cercano.', type: 'warning', roles: ['listero'], source: 'limits' }),
  'listero.5': (p) => ({ title: 'Horario', body: p?.detalle || 'Cierre inminente o cerrado.', type: 'info', roles: ['listero'], source: 'schedules' }),
  'listero.6': (p) => ({ title: 'Precios actualizados', body: p?.detalle || 'Precios vigentes cambiaron.', type: 'info', roles: ['listero'], source: 'prices' }),
  'listero.7': (p) => ({ title: 'Límites actualizados', body: p?.detalle || 'Tus límites fueron actualizados.', type: 'info', roles: ['listero'], source: 'limits' }),
  'listero.8': (p) => ({ title: 'Modo Offline', body: `Pendientes en cola: ${p?.pending ?? 0}`, type: 'info', roles: ['listero'], source: 'offline' }),
  'listero.10': (p) => ({ title: 'Resultados publicados', body: p?.detalle || 'Ya hay resultados disponibles.', type: 'info', roles: ['listero'], source: 'results' }),
  'listero.11': (p) => ({ title: 'Seguridad', body: p?.detalle || 'Tu sesión requiere atención (contraseña/caducidad).', type: 'warning', roles: ['listero'], source: 'security' }),
  'listero.12': (p) => ({ title: 'Actualización disponible', body: p?.detalle || 'Nueva versión o configuración disponible.', type: 'info', roles: ['listero'], source: 'system' }),
};

export const publishTemplate = (addFn, key, payload) => {
  const tpl = NotificationTemplates[key];
  if (!tpl) return null;
  const notif = tpl(payload);
  return addFn({ ...notif });
};

export const upsertTemplateByKey = (addOrUpdateFn, key, payload) => {
  const tpl = NotificationTemplates[key];
  if (!tpl) return null;
  const compose = () => ({ ...tpl(payload), key });
  return addOrUpdateFn(key, () => compose());
};
