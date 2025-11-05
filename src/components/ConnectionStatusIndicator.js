import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAppState } from '../contexts/AppStateContext';

const ConnectionStatusIndicator = ({ style }) => {
  const { 
    isConnected, 
    pendingPlaysCount, 
    forceProcessPendingPlays, 
    clearAllPendingPlays 
  } = useAppState();

  // Mostrar un indicador breve cuando la conexión se restaura
  const [showConnected, setShowConnected] = useState(false);

  useEffect(() => {
    let t;
    if (isConnected) {
      setShowConnected(true);
      t = setTimeout(() => setShowConnected(false), 3000);
    } else {
      setShowConnected(false);
    }
    return () => clearTimeout(t);
  }, [isConnected]);

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

  if (isConnected && pendingPlaysCount === 0 && !showConnected) {
    // No mostrar nada si está conectado y no hay jugadas pendientes
    // y no estamos en el breve periodo de notificación
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {!isConnected && (
        <View style={styles.offlineIndicator}>
          <Text style={styles.offlineText}>Sin conexión</Text>
        </View>
      )}
      {isConnected && showConnected && (
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
  onlineIndicator: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  onlineText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ConnectionStatusIndicator;