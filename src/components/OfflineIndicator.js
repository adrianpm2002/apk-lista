import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useOffline } from '../contexts/OfflineContext';
import * as OfflineStorage from '../services/offlineStorageService';

/**
 * Indicador de estado offline con badge de jugadas pendientes
 * Muestra en la esquina superior derecha junto a notificaciones
 */
const OfflineIndicator = ({ onPress, isDarkMode = false }) => {
  const [pendingCount, setPendingCount] = useState(0);
  const isMountedRef = useRef(true); // Para evitar memory leaks
  
  // Intentar obtener contexto offline (puede no estar disponible en web)
  let offlineContext = null;
  try {
    offlineContext = useOffline();
  } catch (error) {
    // Si no está disponible, no mostrar el indicador
    return null;
  }

  const { isOnline, isOfflineModeEnabled, isSyncing, pendingPlays } = offlineContext;

  // Usar el contador del contexto si está disponible (más eficiente)
  useEffect(() => {
    if (pendingPlays && Array.isArray(pendingPlays)) {
      const pending = pendingPlays.filter(p => p.status === 'pending').length;
      if (isMountedRef.current) {
        setPendingCount(pending);
      }
    }
  }, [pendingPlays]);

  // Fallback: Actualizar contador cada 5 segundos si no hay datos del contexto
  useEffect(() => {
    // Solo usar fallback si el contexto no proporciona pendingPlays
    if (pendingPlays && pendingPlays.length > 0) {
      return; // Usar datos del contexto
    }

    const updatePendingCount = async () => {
      try {
        // Solo en plataformas con SQLite
        if (Platform.OS === 'web') {
          if (isMountedRef.current) setPendingCount(0);
          return;
        }

        // Usar la función del servicio en lugar de acceso directo a DB
        const plays = await OfflineStorage.getPendingPlays();
        if (isMountedRef.current) {
          const pending = (plays || []).filter(p => p.status === 'pending').length;
          setPendingCount(pending);
        }
      } catch (error) {
        console.error('[OfflineIndicator] Error obteniendo jugadas pendientes:', error);
        if (isMountedRef.current) setPendingCount(0);
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000); // Reducido a cada 5s

    return () => clearInterval(interval);
  }, [pendingPlays]);

  // Cleanup: marcar como desmontado
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Determinar icono y color según estado
  const getIndicatorState = () => {
    if (isSyncing) {
      return {
        icon: '🔄',
        color: '#3498db',
        label: 'Sincronizando',
      };
    }
    
    if (!isOnline || isOfflineModeEnabled) {
      return {
        icon: '🔴',
        color: '#e74c3c',
        label: isOfflineModeEnabled ? 'Modo Offline' : 'Sin conexión',
      };
    }

    return {
      icon: '🟢',
      color: '#27ae60',
      label: 'Online',
    };
  };

  const state = getIndicatorState();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      accessibilityLabel={`Estado: ${state.label}${pendingCount > 0 ? `, ${pendingCount} jugadas pendientes` : ''}`}
      accessibilityRole="button"
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{state.icon}</Text>
        
        {/* Badge con contador de pendientes */}
        {pendingCount > 0 && (
          <View style={[styles.badge, { backgroundColor: state.color }]}>
            <Text style={styles.badgeText}>
              {pendingCount > 99 ? '99+' : pendingCount}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 8,
    padding: 4,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.6,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  iconContainer: {
    position: 'relative',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
});

export default OfflineIndicator;
