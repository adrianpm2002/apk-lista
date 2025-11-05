import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useConnection } from '../hooks/useConnection';
import * as OfflineStorage from '../services/offlineStorageService';
import { authService } from '../services/authService';

/**
 * Panel de Testing para funcionalidades offline
 * Solo visible en modo desarrollo (__DEV__)
 */
const OfflineTestingPanel = ({ inline = false, allowWeb = false }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { isOnline, isChecking } = useConnection();

  // No mostrar en producción
  if (!__DEV__) {
    return null;
  }

  // No mostrar en web a menos que se permita explícitamente
  if (Platform.OS === 'web' && !allowWeb) {
    return null;
  }

  const handleOpenPanel = () => {
    setModalVisible(true);
  };

  const handleClosePanel = () => {
    setModalVisible(false);
  };

  // ============================================
  // PRUEBAS FASE 4: LOGIN OFFLINE
  // ============================================

  const testCheckStoredCredentials = async () => {
    try {
      const hasCredentials = await OfflineStorage.hasStoredCredentials();
      Alert.alert(
        'Credenciales Guardadas',
        hasCredentials 
          ? '✅ Hay credenciales guardadas' 
          : '❌ No hay credenciales guardadas',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const testValidateOfflineSession = async () => {
    try {
      const isValid = await authService.validateOfflineSession();
      Alert.alert(
        'Validación de Sesión',
        isValid 
          ? '✅ Sesión válida (<24h)' 
          : '❌ Sesión expirada o no existe',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const testClearCredentials = async () => {
    Alert.alert(
      'Confirmar',
      '¿Eliminar todas las credenciales guardadas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await OfflineStorage.default.getDatabase?.();
              if (db) {
                await db.executeSql('DELETE FROM offline_credentials');
                Alert.alert('Éxito', 'Credenciales eliminadas');
              }
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const testViewLastLogin = async () => {
    try {
      const timestamp = await OfflineStorage.getLastLoginTimestamp();
      if (timestamp) {
        const date = new Date(timestamp);
        const hoursAgo = ((Date.now() - timestamp) / (1000 * 60 * 60)).toFixed(1);
        Alert.alert(
          'Último Login',
          `📅 ${date.toLocaleString()}\n⏱️ Hace ${hoursAgo} horas`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Info', 'No hay registro de último login');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // ============================================
  // PRUEBAS GENERALES
  // ============================================

  const testViewLogs = async () => {
    try {
      const logs = await OfflineStorage.getLogs(10);
      if (logs.length === 0) {
        Alert.alert('Logs', 'No hay logs registrados');
        return;
      }
      
      const logText = logs.map(log => 
        `[${log.level}] ${log.message}\n${log.created_at}`
      ).join('\n\n');
      
      Alert.alert('Últimos 10 Logs', logText, [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const testClearLogs = async () => {
    Alert.alert(
      'Confirmar',
      '¿Eliminar todos los logs?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await OfflineStorage.clearLogs();
              Alert.alert('Éxito', 'Logs eliminados');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      {/* Botón inline (icono de herramientas) */}
      {inline && (
        <Pressable
          style={({ pressed }) => [
            styles.inlineButton,
            pressed && styles.inlineButtonPressed
          ]}
          onPress={handleOpenPanel}
        >
          <Text style={styles.inlineButtonText}>🔧</Text>
        </Pressable>
      )}

      {/* Modal del panel */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleClosePanel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>🔧 Panel de Testing Offline</Text>
              <Pressable onPress={handleClosePanel} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>

            {/* Estado de conexión */}
            <View style={styles.statusSection}>
              <Text style={styles.sectionTitle}>Estado de Conexión</Text>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Conexión:</Text>
                <Text style={[styles.statusValue, isOnline ? styles.online : styles.offline]}>
                  {isChecking ? '⏳ Verificando...' : (isOnline ? '🟢 Online' : '🔴 Offline')}
                </Text>
              </View>
            </View>

            {/* Contenido scrolleable */}
            <ScrollView style={styles.scrollContent}>
              {/* FASE 4: Login Offline */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📱 FASE 4: Login Offline</Text>
                
                <TestButton 
                  title="Ver Credenciales Guardadas"
                  onPress={testCheckStoredCredentials}
                />
                
                <TestButton 
                  title="Validar Sesión Offline"
                  onPress={testValidateOfflineSession}
                />
                
                <TestButton 
                  title="Ver Último Login"
                  onPress={testViewLastLogin}
                />
                
                <TestButton 
                  title="Eliminar Credenciales"
                  onPress={testClearCredentials}
                  danger
                />
              </View>

              {/* Logs */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📋 Logs del Sistema</Text>
                
                <TestButton 
                  title="Ver Últimos Logs"
                  onPress={testViewLogs}
                />
                
                <TestButton 
                  title="Limpiar Logs"
                  onPress={testClearLogs}
                  danger
                />
              </View>

              {/* Información */}
              <View style={styles.infoSection}>
                <Text style={styles.infoText}>
                  ℹ️ Este panel solo es visible en desarrollo.
                </Text>
                <Text style={styles.infoText}>
                  Use las pruebas para verificar funcionalidades offline.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

// Componente auxiliar para botones de prueba
const TestButton = ({ title, onPress, danger = false }) => (
  <Pressable
    style={({ pressed }) => [
      styles.testButton,
      danger && styles.testButtonDanger,
      pressed && styles.testButtonPressed
    ]}
    onPress={onPress}
  >
    <Text style={[styles.testButtonText, danger && styles.testButtonTextDanger]}>
      {title}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  // Botón inline
  inlineButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  inlineButtonPressed: {
    backgroundColor: '#2980b9',
    transform: [{ scale: 0.98 }],
  },
  inlineButtonText: {
    fontSize: 18,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingTop: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#7f8c8d',
    fontWeight: '600',
  },

  // Estado
  statusSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  statusLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginRight: 10,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  online: {
    color: '#27ae60',
  },
  offline: {
    color: '#e74c3c',
  },

  // Contenido
  scrollContent: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 12,
  },

  // Botones de prueba
  testButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  testButtonDanger: {
    backgroundColor: '#e74c3c',
  },
  testButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  testButtonTextDanger: {
    color: '#fff',
  },

  // Info
  infoSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  infoText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 5,
    lineHeight: 18,
  },
});

export default OfflineTestingPanel;
