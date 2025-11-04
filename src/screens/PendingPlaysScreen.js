import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useConnection } from '../hooks/useConnection';
import { useOfflineContext } from '../contexts/OfflineContext';
import { 
  getPendingPlays, 
  getFailedPlays,
  deleteOfflinePlay 
} from '../services/offlinePlayService';
import { syncSinglePlay, retrySyncFailedPlays } from '../services/syncService';

const PendingPlaysScreen = ({ navigation }) => {
  const { isConnected } = useConnection();
  const { loadPendingPlaysCount, isSyncing } = useOfflineContext();
  
  const [pendingPlays, setPendingPlays] = useState([]);
  const [failedPlays, setFailedPlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingIds, setSyncingIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'failed'

  useEffect(() => {
    loadPlays();
  }, [activeTab]);

  const loadPlays = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'pending') {
        const plays = await getPendingPlays();
        setPendingPlays(plays);
      } else {
        const plays = await getFailedPlays();
        setFailedPlays(plays);
      }
    } catch (error) {
      console.error('Error cargando jugadas:', error);
      Alert.alert('Error', 'No se pudieron cargar las jugadas pendientes');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPlays();
    await loadPendingPlaysCount();
    setRefreshing(false);
  };

  const handleSyncSingle = async (localId) => {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Necesitas conexión a internet para sincronizar jugadas');
      return;
    }

    try {
      setSyncingIds(prev => new Set(prev).add(localId));
      
      const result = await syncSinglePlay(localId);
      
      if (result.success) {
        Alert.alert('Éxito', 'Jugada sincronizada correctamente');
        await loadPlays();
        await loadPendingPlaysCount();
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo sincronizar la jugada');
    } finally {
      setSyncingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(localId);
        return newSet;
      });
    }
  };

  const handleDelete = (localId, numero) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Seguro que deseas eliminar la jugada ${numero}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOfflinePlay(localId);
              await loadPlays();
              await loadPendingPlaysCount();
              Alert.alert('Éxito', 'Jugada eliminada');
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la jugada');
            }
          }
        }
      ]
    );
  };

  const handleRetryAll = async () => {
    if (!isConnected) {
      Alert.alert('Sin conexión', 'Necesitas conexión a internet para reintentar la sincronización');
      return;
    }

    Alert.alert(
      'Reintentar sincronización',
      `¿Deseas reintentar la sincronización de ${failedPlays.length} jugadas con error?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reintentar',
          onPress: async () => {
            try {
              const result = await retrySyncFailedPlays();
              Alert.alert(
                'Resultado',
                result.message || `Sincronizadas: ${result.synced}/${result.retried}`
              );
              await loadPlays();
              await loadPendingPlaysCount();
            } catch (error) {
              Alert.alert('Error', 'No se pudo reintentar la sincronización');
            }
          }
        }
      ]
    );
  };

  const renderPlayItem = ({ item }) => {
    const isSyncing = syncingIds.has(item.local_id);
    const statusColor = item.sync_status === 'error' ? '#f44336' : item.sync_status === 'pending' ? '#ff9800' : '#4caf50';

    return (
      <View style={styles.playItem}>
        <View style={styles.playHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {item.sync_status === 'error' ? 'Error' : 'Pendiente'}
            </Text>
          </View>
          <Text style={styles.playDate}>
            {new Date(item.created_at).toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        <View style={styles.playDetails}>
          <Text style={styles.playType}>{item.jugada.toUpperCase()}</Text>
          <Text style={styles.playNumbers}>{item.numero}</Text>
          <Text style={styles.playAmount}>
            ${item.monto_unitario} × {item.numero.split(',').length} = ${item.monto_total}
          </Text>
          
          {item.loteria_nombre && (
            <Text style={styles.playLottery}>
              {item.loteria_nombre} {item.horario_hora ? `- ${item.horario_hora}` : ''}
            </Text>
          )}

          {item.sync_error && (
            <Text style={styles.errorText}>Error: {item.sync_error}</Text>
          )}

          {item.sync_attempts > 0 && (
            <Text style={styles.attemptsText}>
              Intentos de sincronización: {item.sync_attempts}
            </Text>
          )}
        </View>

        <View style={styles.playActions}>
          {isConnected && (
            <TouchableOpacity
              style={[styles.actionButton, styles.syncButton, isSyncing && styles.disabledButton]}
              onPress={() => handleSyncSingle(item.local_id)}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>🔄 Sincronizar</Text>
              )}
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item.local_id, item.numero)}
          >
            <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const currentPlays = activeTab === 'pending' ? pendingPlays : failedPlays;
  const showRetryAll = activeTab === 'failed' && failedPlays.length > 0 && isConnected;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Jugadas Offline</Text>
      </View>

      {/* Connection Status */}
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📴 Sin conexión - Las jugadas se sincronizarán automáticamente cuando haya internet
          </Text>
        </View>
      )}

      {/* Sync Status */}
      {isSyncing && (
        <View style={styles.syncingBanner}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.syncingText}>Sincronizando jugadas...</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pendientes ({pendingPlays.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'failed' && styles.activeTab]}
          onPress={() => setActiveTab('failed')}
        >
          <Text style={[styles.tabText, activeTab === 'failed' && styles.activeTabText]}>
            Con Error ({failedPlays.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Retry All Button */}
      {showRetryAll && (
        <View style={styles.retryAllContainer}>
          <TouchableOpacity style={styles.retryAllButton} onPress={handleRetryAll}>
            <Text style={styles.retryAllButtonText}>
              🔄 Reintentar Todas ({failedPlays.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Cargando jugadas...</Text>
        </View>
      ) : currentPlays.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {activeTab === 'pending' 
              ? '✅ No hay jugadas pendientes de sincronización'
              : '✅ No hay jugadas con error'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentPlays}
          keyExtractor={(item) => item.local_id.toString()}
          renderItem={renderPlayItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2196F3',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  offlineBanner: {
    backgroundColor: '#ff9800',
    padding: 12,
  },
  offlineBannerText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
  syncingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    padding: 12,
    gap: 8,
  },
  syncingText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  retryAllContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  retryAllButton: {
    backgroundColor: '#4caf50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  playItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  playHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playDate: {
    fontSize: 12,
    color: '#666',
  },
  playDetails: {
    marginBottom: 12,
  },
  playType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  playNumbers: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  playAmount: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  playLottery: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 8,
  },
  attemptsText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  playActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncButton: {
    backgroundColor: '#2196F3',
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default PendingPlaysScreen;
