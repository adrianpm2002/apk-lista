import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl, Alert, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as OfflineStorage from '../services/offlineStorageService';
import { useOfflineSafe } from '../contexts/OfflineContext';
import * as SyncService from '../services/syncService';
import SideBarWrapper, { SideBarToggle } from '../components/SideBarWrapper';

/**
 * Pantalla para visualizar y gestionar jugadas offline pendientes
 * FASE 7: Registro de Jugadas Offline
 */

const getPlayTypeLabel = (playType) => ({
  fijo: 'Fijo',
  corrido: 'Corrido',
  parle: 'Parle',
  centena: 'Centena',
  tripleta: 'Tripleta'
}[playType] || playType || 'N/A');

const getStatusInfo = (status) => {
  switch (status) {
    case 'pending':
      return { label: 'Pendiente', color: '#FF9800', icon: '⏳' };
    case 'sending':
      return { label: 'Enviando', color: '#2196F3', icon: '📤' };
    case 'success':
      return { label: 'Exitosa', color: '#4CAF50', icon: '✓' };
    case 'failed':
      return { label: 'Fallida', color: '#F44336', icon: '✗' };
    default:
      return { label: status, color: '#757575', icon: '?' };
  }
};

const OfflinePlayRegistryScreen = ({ navigation }) => {
  const offlineContext = useOfflineSafe();
  const loadPendingPlays = offlineContext?.loadPendingPlays || (() => {});
  
  const [plays, setPlays] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  // Estados para sincronización
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncResults, setSyncResults] = useState([]);
  const [showSyncModal, setShowSyncModal] = useState(false);

  /**
   * Cargar jugadas offline desde SQLite
   */
  const loadPlays = async () => {
    try {
      setIsLoading(true);
      const allPlays = await OfflineStorage.getAllOfflinePlays();
      setPlays(allPlays || []);
    } catch (error) {
      console.error('[OfflineRegistry] Error cargando jugadas:', error);
      Alert.alert('Error', 'No se pudieron cargar las jugadas offline');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * Recargar al enfocar la pantalla
   */
  useFocusEffect(
    useCallback(() => {
      loadPlays();
    }, [])
  );

  /**
   * Pull to refresh
   */
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadPlays();
  };

  /**
   * Calcular estadísticas
   */
  const getStats = () => {
    const pending = plays.filter(p => p.status === 'pending').length;
    const success = plays.filter(p => p.status === 'success').length;
    const failed = plays.filter(p => p.status === 'failed').length;
    const totalAmount = plays.reduce((sum, p) => sum + (parseFloat(p.monto_total) || 0), 0);

    return { pending, success, failed, total: plays.length, totalAmount };
  };

  /**
   * Eliminar una jugada
   */
  const handleDelete = async (playId) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de eliminar esta jugada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await OfflineStorage.deleteOfflinePlay(playId);
              await loadPlays();
              await loadPendingPlays(); // Actualizar context
              Alert.alert('Éxito', 'Jugada eliminada');
            } catch (error) {
              console.error('[OfflineRegistry] Error eliminando:', error);
              Alert.alert('Error', 'No se pudo eliminar la jugada');
            }
          }
        }
      ]
    );
  };

  /**
   * Eliminar jugadas exitosas
   */
  const handleClearSuccessful = async () => {
    const successCount = plays.filter(p => p.status === 'success').length;
    
    if (successCount === 0) {
      Alert.alert('Info', 'No hay jugadas exitosas para limpiar');
      return;
    }

    Alert.alert(
      'Limpiar exitosas',
      `¿Eliminar ${successCount} jugada(s) exitosa(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await OfflineStorage.clearSuccessfulPlays();
              await loadPlays();
              await loadPendingPlays();
              Alert.alert('Éxito', `${successCount} jugada(s) eliminada(s)`);
            } catch (error) {
              console.error('[OfflineRegistry] Error limpiando exitosas:', error);
              Alert.alert('Error', 'No se pudieron eliminar las jugadas');
            }
          }
        }
      ]
    );
  };

  /**
   * FASE 8.5: Sincronizar todas las jugadas pendientes
   */
  const handleSyncAll = async () => {
    const pendingPlays = plays.filter(p => p.status === 'pending');
    
    if (pendingPlays.length === 0) {
      Alert.alert('Info', 'No hay jugadas pendientes para sincronizar');
      return;
    }

    const totalAmount = pendingPlays.reduce((sum, p) => sum + (parseFloat(p.monto_total) || 0), 0);

    Alert.alert(
      '🔄 Sincronizar jugadas',
      `${pendingPlays.length} jugada(s) pendiente(s)\nTotal: RD$${totalAmount.toFixed(2)}\n\n¿Enviar al servidor?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sincronizar',
          onPress: () => startSyncProcess()
        }
      ]
    );
  };

  /**
   * FASE 8.6: Proceso de sincronización con modal de progreso
   */
  const startSyncProcess = async () => {
    try {
      setIsSyncing(true);
      setShowSyncModal(true);
      setSyncResults([]);
      setSyncProgress({ current: 0, total: 0 });

      // Callback de progreso
      const onProgress = (current, total, currentPlay) => {
        setSyncProgress({ current, total });
        setSyncResults(prev => [...prev, {
          id: currentPlay.id,
          numeros: currentPlay.numeros,
          status: 'processing',
          monto: currentPlay.monto_total
        }]);
      };

      // Ejecutar sincronización (sin cancelación)
      const result = await SyncService.syncAllPlays(onProgress, null);

      // Actualizar resultados finales
      const finalResults = await OfflineStorage.getAllOfflinePlays();
      setSyncResults(finalResults.map(p => ({
        id: p.id,
        numeros: p.numeros,
        status: p.status,
        monto: p.monto_total,
        error: p.last_error
      })));

      // Recargar jugadas
      await loadPlays();
      await loadPendingPlays();

      // FASE 8.7: Notificación post-sync
      setIsSyncing(false);
      
      if (result.failedCount > 0) {
        Alert.alert(
          'Sincronización completada',
          `✅ ${result.successCount} exitosa(s)\n❌ ${result.failedCount} fallida(s)\n\nRevisa las jugadas fallidas para ver los errores.`
        );
      } else {
        Alert.alert('✅ Éxito', `${result.successCount} jugada(s) sincronizada(s) correctamente`);
      }

    } catch (error) {
      console.error('[OfflineRegistry] Error en sincronización:', error);
      Alert.alert('Error', 'Ocurrió un error durante la sincronización');
      setIsSyncing(false);
    } finally {
      setShowSyncModal(false);
    }
  };

  /**
   * FASE 8.8: Sincronizar una jugada individual
   */
  const handleSyncSingle = async (playId) => {
    try {
      const result = await SyncService.syncSinglePlay(playId);
      
      await loadPlays();
      await loadPendingPlays();

      if (result.success) {
        Alert.alert('✅ Éxito', 'Jugada sincronizada correctamente');
      } else {
        Alert.alert('❌ Error', result.error || 'No se pudo sincronizar la jugada');
      }
    } catch (error) {
      console.error('[OfflineRegistry] Error sincronizando:', error);
      Alert.alert('Error', error.message);
    }
  };

  /**
   * FASE 8.9: Reintentar jugada fallida
   */
  const handleRetry = async (playId) => {
    try {
      const result = await SyncService.retryFailedPlay(playId);
      
      await loadPlays();
      await loadPendingPlays();

      if (result.success) {
        Alert.alert('✅ Éxito', 'Jugada sincronizada correctamente');
      } else {
        Alert.alert('❌ Error', result.error || 'No se pudo sincronizar la jugada');
      }
    } catch (error) {
      console.error('[OfflineRegistry] Error reintentando:', error);
      Alert.alert('Error', error.message);
    }
  };

  /**
   * Eliminar jugadas seleccionadas
   */
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    Alert.alert(
      'Confirmar eliminación',
      `¿Eliminar ${selectedIds.size} jugada(s) seleccionada(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const id of selectedIds) {
                await OfflineStorage.deleteOfflinePlay(id);
              }
              setSelectedIds(new Set());
              setSelectionMode(false);
              await loadPlays();
              await loadPendingPlays();
              Alert.alert('Éxito', `${selectedIds.size} jugada(s) eliminada(s)`);
            } catch (error) {
              console.error('[OfflineRegistry] Error eliminando seleccionadas:', error);
              Alert.alert('Error', 'No se pudieron eliminar las jugadas');
            }
          }
        }
      ]
    );
  };

  /**
   * Toggle selección de una jugada
   */
  const toggleSelection = (id) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  /**
   * Toggle modo selección
   */
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedIds(new Set());
  };

  /**
   * Seleccionar o deseleccionar todas las jugadas
   */
  const handleSelectAll = () => {
    if (selectedIds.size === plays.length) {
      // Si todas están seleccionadas, deseleccionar todas
      setSelectedIds(new Set());
    } else {
      // Seleccionar todas
      setSelectedIds(new Set(plays.map(p => p.id)));
    }
  };

  /**
   * Renderizar item de jugada
   */
  const renderPlayItem = ({ item }) => {
    const statusInfo = getStatusInfo(item.status);
    const isExpanded = expandedId === item.id;
    const isSelected = selectedIds.has(item.id);

    const handlePress = () => {
      if (selectionMode) {
        toggleSelection(item.id);
      } else {
        setExpandedId(isExpanded ? null : item.id);
      }
    };

    const handleLongPress = () => {
      if (!selectionMode) {
        setSelectionMode(true);
        toggleSelection(item.id);
      }
    };

    return (
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={[
          styles.playCard,
          isSelected && styles.playCardSelected
        ]}
      >
        {/* Header */}
        <View style={styles.playHeader}>
          <View style={styles.playHeaderLeft}>
            <Text style={[styles.statusIcon, { color: statusInfo.color }]}>
              {statusInfo.icon}
            </Text>
            <View style={styles.playHeaderInfo}>
              <Text style={styles.playNumbers} numberOfLines={1}>
                {item.numeros || 'Sin números'}
              </Text>
              <Text style={styles.playMeta}>
                {getPlayTypeLabel(item.tipo_jugada)} • ${parseFloat(item.monto_unitario || 0).toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.playHeaderRight}>
            <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
            <Text style={styles.playTotal}>
              ${parseFloat(item.monto_total || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Info adicional */}
        <View style={styles.playInfo}>
          <Text style={styles.playInfoText} numberOfLines={1}>
            📍 {item.nota || 'Sin nota'}
          </Text>
          <Text style={styles.playInfoText}>
            🕐 {new Date(item.created_at).toLocaleString('es-DO')}
          </Text>
        </View>

        {/* Detalle expandido */}
        {isExpanded && (
          <View style={styles.playExpanded}>
            <View style={styles.playExpandedRow}>
              <Text style={styles.playExpandedLabel}>Números:</Text>
              <Text style={styles.playExpandedValue}>{item.numeros}</Text>
            </View>
            <View style={styles.playExpandedRow}>
              <Text style={styles.playExpandedLabel}>Jugada:</Text>
              <Text style={styles.playExpandedValue}>{item.jugada || 'N/A'}</Text>
            </View>
            {item.last_error && (
              <View style={styles.playExpandedRow}>
                <Text style={[styles.playExpandedLabel, styles.errorLabel]}>Error:</Text>
                <Text style={[styles.playExpandedValue, styles.errorValue]}>
                  {item.last_error}
                </Text>
              </View>
            )}
            <View style={styles.playExpandedRow}>
              <Text style={styles.playExpandedLabel}>Intentos:</Text>
              <Text style={styles.playExpandedValue}>{item.sync_attempts || 0}</Text>
            </View>

            {/* Botones de acción */}
            <View style={styles.playActions}>
              {item.status === 'pending' && (
                <>
                  <Pressable
                    style={[styles.actionButton, styles.actionButtonPrimary]}
                    onPress={() => handleSyncSingle(item.id)}
                    disabled={isSyncing}
                  >
                    <Text style={styles.actionButtonText}>📤 Enviar ahora</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.actionButtonDanger]}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
                  </Pressable>
                </>
              )}
              {item.status === 'failed' && (
                <>
                  <Pressable
                    style={[styles.actionButton, styles.actionButtonWarning]}
                    onPress={() => handleRetry(item.id)}
                    disabled={isSyncing}
                  >
                    <Text style={styles.actionButtonText}>🔄 Reintentar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.actionButtonDanger]}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
                  </Pressable>
                </>
              )}
              {item.status === 'success' && (
                <Pressable
                  style={[styles.actionButton, styles.actionButtonDanger]}
                  onPress={() => handleDelete(item.id)}
                >
                  <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Checkbox en modo selección */}
        {selectionMode && (
          <View style={styles.checkbox}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}
      </Pressable>
    );
  };

  const stats = getStats();

  return (
    <View style={styles.container}>
      {/* Header con estadísticas */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
          <Text style={styles.title}>Registro Offline</Text>
          <View style={styles.backButtonPlaceholder} />
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>{stats.success}</Text>
            <Text style={styles.statLabel}>Exitosas</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#F44336' }]}>{stats.failed}</Text>
            <Text style={styles.statLabel}>Fallidas</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>${stats.totalAmount.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      </View>

      {/* Botones de acción */}
      <View style={styles.actionBar}>
        {selectionMode ? (
          <>
            <Pressable
              style={[styles.topButton, styles.topButtonSecondary]}
              onPress={toggleSelectionMode}
            >
              <Text style={styles.topButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.topButton, styles.topButtonPrimary]}
              onPress={handleSelectAll}
              disabled={plays.length === 0}
            >
              <Text style={styles.topButtonText}>
                {selectedIds.size === plays.length ? '☐ Deseleccionar' : '☑ Seleccionar Todo'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.topButton, styles.topButtonDanger]}
              onPress={handleDeleteSelected}
              disabled={selectedIds.size === 0}
            >
              <Text style={styles.topButtonText}>
                Eliminar ({selectedIds.size})
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              style={[styles.topButton, styles.topButtonPrimary]}
              onPress={handleSyncAll}
              disabled={stats.pending === 0 || isSyncing}
            >
              <Text style={styles.topButtonText}>
                {isSyncing ? '⏳ Sincronizando...' : `📤 Enviar Todo (${stats.pending})`}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.topButton, styles.topButtonSecondary]}
              onPress={handleClearSuccessful}
              disabled={stats.success === 0}
            >
              <Text style={styles.topButtonText}>🧹 Limpiar Exitosas</Text>
            </Pressable>
            <Pressable
              style={[styles.topButton, styles.topButtonSecondary]}
              onPress={toggleSelectionMode}
              disabled={plays.length === 0}
            >
              <Text style={styles.topButtonText}>☑️ Seleccionar</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Lista de jugadas */}
      {isLoading && plays.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Cargando jugadas...</Text>
        </View>
      ) : plays.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No hay jugadas offline</Text>
          <Text style={styles.emptySubtext}>
            Las jugadas creadas sin conexión aparecerán aquí
          </Text>
        </View>
      ) : (
        <FlatList
          data={plays}
          renderItem={renderPlayItem}
          keyExtractor={item => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#2196F3']}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* FASE 8.6: Modal de progreso de sincronización */}
      <Modal
        visible={showSyncModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          // No permitir cerrar mientras está sincronizando
          if (!isSyncing) {
            setShowSyncModal(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sincronizando jugadas</Text>
            
            {/* Barra de progreso */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(syncProgress.current / syncProgress.total) * 100}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {syncProgress.current} / {syncProgress.total}
              </Text>
              {isSyncing && (
                <Text style={styles.progressNote}>
                  ⏳ Procesando... No cierres esta pantalla
                </Text>
              )}
            </View>

            {/* Lista de resultados en tiempo real */}
            <ScrollView style={styles.syncResultsList}>
              {syncResults.map((result, index) => {
                const resultStatus = getStatusInfo(result.status);
                return (
                  <View key={result.id || index} style={styles.syncResultItem}>
                    <Text style={[styles.syncResultIcon, { color: resultStatus.color }]}>
                      {resultStatus.icon}
                    </Text>
                    <View style={styles.syncResultInfo}>
                      <Text style={styles.syncResultNumbers}>{result.numeros}</Text>
                      {result.error && (
                        <Text style={styles.syncResultError} numberOfLines={1}>
                          {result.error}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.syncResultAmount}>
                      ${parseFloat(result.monto || 0).toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            {/* Botón de cerrar (solo cuando termina) */}
            {!isSyncing && (
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={() => setShowSyncModal(false)}
                >
                  <Text style={styles.modalButtonText}>Cerrar</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Barra lateral */}
      <SideBarWrapper
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        role="listero"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8ff',
  },
  header: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    flexDirection: 'column',
    zIndex: 3000,
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E6EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sidebarButton: {
    padding: 8,
  },
  backButtonPlaceholder: {
    width: 60, // Para centrar el título
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 10,
    color: '#757575',
    marginTop: 1,
  },
  actionBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 12,
    paddingTop: 135,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  topButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topButtonPrimary: {
    backgroundColor: '#2196F3',
  },
  topButtonSecondary: {
    backgroundColor: '#757575',
  },
  topButtonDanger: {
    backgroundColor: '#F44336',
  },
  topButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
    paddingTop: 12,
  },
  playCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    position: 'relative',
  },
  playCardSelected: {
    borderColor: '#2196F3',
    borderWidth: 2,
    backgroundColor: '#E3F2FD',
  },
  playHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  playHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  playHeaderInfo: {
    flex: 1,
  },
  playNumbers: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  playMeta: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  playHeaderRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  playTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  playInfo: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 8,
  },
  playInfoText: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 4,
  },
  playExpanded: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 8,
    paddingTop: 8,
  },
  playExpandedRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  playExpandedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#424242',
    width: 80,
  },
  playExpandedValue: {
    fontSize: 12,
    color: '#757575',
    flex: 1,
  },
  errorLabel: {
    color: '#F44336',
  },
  errorValue: {
    color: '#F44336',
  },
  playActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: '#2196F3',
  },
  actionButtonWarning: {
    backgroundColor: '#FF9800',
  },
  actionButtonDanger: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkmark: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    paddingTop: 200,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
  },
  // Estilos del modal de sincronización
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 20,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
  },
  progressNote: {
    fontSize: 12,
    color: '#FF9800',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  syncResultsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  syncResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
  },
  syncResultIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  syncResultInfo: {
    flex: 1,
  },
  syncResultNumbers: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  syncResultError: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 2,
  },
  syncResultAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212121',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#2196F3',
  },
  modalButtonCancel: {
    backgroundColor: '#F44336',
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OfflinePlayRegistryScreen;
