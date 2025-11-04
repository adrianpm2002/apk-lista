import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAppState } from '../contexts/AppStateContext';
import { useConnection } from '../hooks/useConnection';
import { isForceOffline } from '../services/connectionService';

const ConnectionStatusIndicator = ({ style }) => {
  const { 
    isConnected, 
    pendingPlaysCount, 
    forceProcessPendingPlays, 
    clearAllPendingPlays 
  } = useAppState();
  
  // Usar el nuevo hook de conexión
  const { isOnline } = useConnection();
  const isForcedOffline = isForceOffline();

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

  // Determinar si mostrar indicador offline
  const showOffline = !isOnline || isForcedOffline;
  
  if (isOnline && !isForcedOffline && pendingPlaysCount === 0) {
    // No mostrar nada si está conectado, no forzado offline, y no hay jugadas pendientes
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {showOffline && (
        <View style={[styles.offlineIndicator, isForcedOffline && styles.forcedOfflineIndicator]}>
          <Text style={styles.offlineText}>
            {isForcedOffline ? '📵 Modo Offline (Forzado)' : 'Sin conexión'}
          </Text>
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
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    zIndex: 1000,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  offlineIndicator: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  forcedOfflineIndicator: {
    backgroundColor: '#FF9800', // Naranja para modo forzado
  },
  offlineText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  pendingIndicator: {
    backgroundColor: '#FFA500',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  pendingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tapText: {
    color: 'white',
    fontSize: 10,
    textAlign: 'center',
    opacity: 0.8,
  },
});

export default ConnectionStatusIndicator;