import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useOfflineContext } from '../contexts/OfflineContext';

/**
 * Banner que muestra estado de sincronización y jugadas pendientes
 * Se muestra cuando hay jugadas pendientes o sincronización en progreso
 */
export const SyncStatusBanner = () => {
  // Intentar obtener contexto offline (puede no estar disponible al inicio)
  let offlineContext;
  try {
    offlineContext = useOfflineContext();
  } catch (error) {
    // Contexto no disponible, no mostrar banner
    return null;
  }

  const { 
    isOnline, 
    isSyncing, 
    pendingPlaysCount, 
    syncError,
    lastSyncTime,
    startSync 
  } = offlineContext;

  // Debug log
  console.log('[SyncStatusBanner] Estado:', { 
    isOnline, 
    isSyncing, 
    pendingPlaysCount, 
    syncError 
  });

  // No mostrar si no hay jugadas pendientes y no hay error
  if (pendingPlaysCount === 0 && !syncError && !isSyncing) {
    console.log('[SyncStatusBanner] No mostrar - sin jugadas pendientes');
    return null;
  }
  
  console.log('[SyncStatusBanner] MOSTRANDO BANNER');

  // Calcular mensaje y color según estado
  let message = '';
  let backgroundColor = '#2196F3'; // Azul por defecto
  let showAction = false;

  if (syncError) {
    message = `❌ Error al sincronizar: ${syncError}`;
    backgroundColor = '#F44336'; // Rojo
    showAction = isOnline;
  } else if (isSyncing) {
    message = `🔄 Sincronizando ${pendingPlaysCount} jugada${pendingPlaysCount !== 1 ? 's' : ''}...`;
    backgroundColor = '#FF9800'; // Naranja
  } else if (!isOnline && pendingPlaysCount > 0) {
    message = `📱 ${pendingPlaysCount} jugada${pendingPlaysCount !== 1 ? 's' : ''} pendiente${pendingPlaysCount !== 1 ? 's' : ''} (sin conexión)`;
    backgroundColor = '#9E9E9E'; // Gris
  } else if (isOnline && pendingPlaysCount > 0) {
    message = `⏳ ${pendingPlaysCount} jugada${pendingPlaysCount !== 1 ? 's' : ''} pendiente${pendingPlaysCount !== 1 ? 's' : ''} de sincronizar`;
    backgroundColor = '#FF9800'; // Naranja
    showAction = true;
  }

  // Formatear última sincronización
  const lastSyncText = lastSyncTime 
    ? `Última sincronización: ${new Date(lastSyncTime).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })}`
    : 'No hay sincronizaciones previas';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.content}>
        <View style={styles.messageContainer}>
          {isSyncing && (
            <ActivityIndicator 
              size="small" 
              color="white" 
              style={styles.spinner}
            />
          )}
          <View style={styles.textContainer}>
            <Text style={styles.message}>{message}</Text>
            {!isSyncing && pendingPlaysCount > 0 && (
              <Text style={styles.subtext}>{lastSyncText}</Text>
            )}
          </View>
        </View>

        {showAction && !isSyncing && (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={startSync}
          >
            <Text style={styles.actionButtonText}>Sincronizar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinner: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  subtext: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    marginLeft: 12,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SyncStatusBanner;
