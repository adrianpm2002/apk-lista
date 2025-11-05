import React, { useState, useEffect, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAppState } from '../contexts/AppStateContext';
import { useConnection } from '../hooks/useConnection';

const ConnectionStatusIndicator = memo(({ style }) => {
  // Usar useConnection para detectar estado real (incluye forceOffline)
  const { isOnline, isChecking } = useConnection();
  
  const { 
    pendingPlaysCount, 
    forceProcessPendingPlays, 
    clearAllPendingPlays 
  } = useAppState();
  
  // isConnected viene de useConnection ahora (más preciso)
  const isConnected = isOnline;

  // Mostrar un indicador breve cuando la conexión se restaura
  const [showConnected, setShowConnected] = useState(false);
  const [debouncedConnected, setDebouncedConnected] = useState(isConnected);

  // Debounce para evitar lag en cambios rápidos
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedConnected(isConnected);
    }, 300); // 300ms de delay para estabilizar
    
    return () => clearTimeout(timer);
  }, [isConnected]);

  // Mostrar banner verde brevemente cuando se conecta
  useEffect(() => {
    let t;
    if (debouncedConnected && !isChecking) {
      setShowConnected(true);
      t = setTimeout(() => setShowConnected(false), 3000);
    } else {
      setShowConnected(false);
    }
    return () => clearTimeout(t);
  }, [debouncedConnected, isChecking]);

  const handlePendingPlaysPress = () => {
    if (pendingPlaysCount === 0) return;

    Alert.alert(
      'Jugadas Pendientes',
      `Tienes ${pendingPlaysCount} jugada(s) esperando ser enviada(s).`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Reintentar Envío',
          onPress: forceProcessPendingPlays
        },
        {
          text: 'Eliminar Todas',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmar',
              '¿Estás seguro que deseas eliminar todas las jugadas pendientes?',
              [
                { text: 'Cancelar', style: 'cancel' },
                { 
                  text: 'Eliminar', 
                  style: 'destructive', 
                  onPress: clearAllPendingPlays 
                }
              ]
            );
          }
        }
      ]
    );
  };

  // Usar debouncedConnected para decisiones de UI (evita lag)
  if (debouncedConnected && pendingPlaysCount === 0 && !showConnected) {
    // No mostrar nada si está conectado y no hay jugadas pendientes
    // y no estamos en el breve periodo de notificación
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {!debouncedConnected && (
        <View style={styles.offlineIndicator}>
          <Text style={styles.offlineText}>Sin conexión</Text>
        </View>
      )}
      {debouncedConnected && showConnected && (
        <View style={styles.onlineIndicator}>
          <Text style={styles.onlineText}>Conectado</Text>
        </View>
      )}
      
      {pendingPlaysCount > 0 && (
        <TouchableOpacity 
          style={styles.pendingIndicator}
          onPress={handlePendingPlaysPress}
        >
          <Text style={styles.pendingText}>
            {pendingPlaysCount} jugada{pendingPlaysCount > 1 ? 's' : ''} pendiente{pendingPlaysCount > 1 ? 's' : ''}
          </Text>
          <Text style={styles.tapText}>Toca para opciones</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    zIndex: 999,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'box-none', // Solo capturar eventos en los banners, no en el contenedor
  },
  offlineIndicator: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    elevation: 2, // Reducido de 3 a 2
  },
  offlineText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  pendingIndicator: {
    backgroundColor: '#FFA500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    elevation: 2,
  },
  pendingText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  tapText: {
    color: 'white',
    fontSize: 9,
    textAlign: 'center',
    opacity: 0.8,
  },
  onlineIndicator: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    elevation: 2,
  },
  onlineText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});

// Evitar re-renders innecesarios
export default ConnectionStatusIndicator;