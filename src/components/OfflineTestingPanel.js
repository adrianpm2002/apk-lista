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
 */
const OfflineTestingPanel = ({ inline = false, allowWeb = false }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { isOnline, isChecking } = useConnection();

  // No mostrar en web a menos que se permita explícitamente
  if (Platform.OS === 'web' && !allowWeb) {
    return null;
  }

  const handleOpenPanel = () => {
    console.log('[OfflineTestingPanel] Opening panel...');
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
      
      if (hasCredentials) {
        // Mostrar más detalles
        const credentials = await OfflineStorage.getCredentials();
        if (credentials) {
          Alert.alert(
            '✅ Credenciales Guardadas',
            `Usuario: ${credentials.username || 'N/A'}\n` +
            `User ID: ${credentials.user_id || 'N/A'}\n` +
            `Rol: ${credentials.role || 'N/A'}\n` +
            `ID Banco: ${credentials.id_banco || 'N/A'}\n` +
            `Último Login: ${credentials.last_login ? new Date(parseInt(credentials.last_login)).toLocaleString() : 'N/A'}`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('✅ Credenciales Guardadas', 'Existen pero no se pudieron leer');
        }
      } else {
        Alert.alert('❌ Sin Credenciales', 'No hay credenciales guardadas. Haz login online primero.');
      }
    } catch (error) {
      Alert.alert('Error', `No se pudo verificar: ${error.message}`);
    }
  };

  const testValidateOfflineSession = async () => {
    try {
      const result = await authService.validateOfflineSession();
      
      if (result.valid) {
        const expiresIn = Math.floor((result.expiresAt - Date.now()) / (1000 * 60 * 60));
        Alert.alert(
          '✅ Sesión Válida',
          `La sesión es válida (<24h)\n\n` +
          `Expira en: ${expiresIn} horas\n` +
          `Fecha de expiración: ${new Date(result.expiresAt).toLocaleString()}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          '❌ Sesión Expirada',
          result.error || 'La sesión ha expirado (>24h) o no existe',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', `No se pudo validar: ${error.message}`);
    }
  };

  const testClearCredentials = async () => {
    Alert.alert(
      'Confirmar',
      '¿Eliminar todas las credenciales guardadas?\n\nEsto cerrará tu sesión offline.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[TestingPanel] Solicitando eliminar TODAS las credenciales...');
              const result = await OfflineStorage.deleteAllCredentials();
              if (result) {
                console.log('[TestingPanel] ✅ Credenciales eliminadas exitosamente');
                Alert.alert('Éxito', '✅ Credenciales eliminadas correctamente');
              } else {
                console.error('[TestingPanel] ❌ deleteAllCredentials retornó false');
                Alert.alert('Error', 'No se pudieron eliminar las credenciales');
              }
            } catch (error) {
              console.error('[TestingPanel] Error al eliminar:', error);
              Alert.alert('Error', `No se pudo eliminar: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const testViewLastLogin = async () => {
    try {
      const credentials = await OfflineStorage.getCredentials();
      
      if (credentials && credentials.last_login) {
        const timestamp = parseInt(credentials.last_login);
        const date = new Date(timestamp);
        const hoursAgo = ((Date.now() - timestamp) / (1000 * 60 * 60)).toFixed(1);
        const daysAgo = ((Date.now() - timestamp) / (1000 * 60 * 60 * 24)).toFixed(2);
        
        Alert.alert(
          '📅 Último Login',
          `Fecha: ${date.toLocaleDateString()}\n` +
          `Hora: ${date.toLocaleTimeString()}\n\n` +
          `Hace: ${hoursAgo} horas\n` +
          `(${daysAgo} días)`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Info', '❌ No hay registro de último login');
      }
    } catch (error) {
      Alert.alert('Error', `No se pudo obtener: ${error.message}`);
    }
  };

  const testEncryption = async () => {
    try {
      const { encryptPassword, decryptPassword } = require('../services/encryptionService');
      const testPassword = 'MiPassword123!';
      
      // Encriptar
      const encrypted = await encryptPassword(testPassword);
      
      // Desencriptar
      const decrypted = await decryptPassword(encrypted);
      
      const success = decrypted === testPassword;
      
      Alert.alert(
        success ? '✅ Encriptación OK' : '❌ Error de Encriptación',
        `Original: ${testPassword}\n` +
        `Encriptado: ${encrypted.substring(0, 30)}...\n` +
        `Desencriptado: ${decrypted}\n\n` +
        `Estado: ${success ? 'CORRECTO' : 'FALLÓ'}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', `Prueba de encriptación falló: ${error.message}`);
    }
  };

  const testForceExpireSession = async () => {
    Alert.alert(
      'Confirmar',
      '¿Forzar expiración de sesión?\n\nEsto hará que la sesión aparezca como expirada (útil para testing).',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Expirar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Cambiar session_expires a hace 25 horas
              const expiredTime = Date.now() - (25 * 60 * 60 * 1000);
              await OfflineStorage.updateSessionExpiry(expiredTime);
              Alert.alert('Éxito', '✅ Sesión marcada como expirada. Prueba validar sesión ahora.');
            } catch (error) {
              Alert.alert('Error', `No se pudo expirar: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const testDatabaseInfo = async () => {
    try {
      const info = await OfflineStorage.getDatabaseInfo();
      
      Alert.alert(
        '🗄️ Info de Base de Datos',
        `Credenciales: ${info.credentials || 0}\n` +
        `Logs: ${info.logs || 0}\n` +
        `Jugadas pendientes: ${info.pendingPlays || 0}\n` +
        `Loterías en caché: ${info.lotteries || 0}\n` +
        `Horarios en caché: ${info.schedules || 0}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', `No se pudo obtener info: ${error.message}`);
    }
  };

  const testInsertFakeCredentials = async () => {
    Alert.alert(
      'Insertar Credenciales de Prueba',
      '¿Insertar credenciales fake para testing?\n\nEsto te permitirá probar las funcionalidades offline sin necesidad de hacer login online.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Insertar',
          onPress: async () => {
            try {
              // Datos de prueba
              const testUsername = 'test_user';
              const testPassword = 'test123';
              
              // Contraseña "encriptada" fake (solo para testing de visualización)
              // NO usar expo-crypto aquí porque puede fallar, solo string simple
              const fakeEncryptedPassword = 'FAKE_ENCRYPTED_' + testPassword;
              
              const now = Date.now();
              const expiresAt = now + (24 * 60 * 60 * 1000); // 24 horas
              
              console.log('[TestingPanel] Insertando credenciales de prueba...');
              
              // Guardar en SQLite
              await OfflineStorage.saveCredentials({
                user_id: 999,
                encrypted_data: JSON.stringify({
                  username: testUsername,
                  password: fakeEncryptedPassword,
                }),
                role: 'listero',
                id_banco: 1,
                last_login: now.toString(),
                session_expires: expiresAt.toString(),
              });
              
              console.log('[TestingPanel] ✅ Credenciales de prueba insertadas');
              
              Alert.alert(
                '✅ Credenciales Insertadas',
                `Usuario: ${testUsername}\n` +
                `Contraseña: ${testPassword}\n` +
                `Rol: listero\n` +
                `ID Banco: 1\n\n` +
                `Ahora puedes probar:\n` +
                `- Ver Credenciales\n` +
                `- Validar Sesión\n` +
                `- Ver Último Login\n` +
                `- Info de BD\n\n` +
                `NOTA: Login Offline NO funcionará\n` +
                `con estas credenciales fake (solo\n` +
                `para probar visualización de datos)`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('[TestingPanel] Error al insertar credenciales:', error);
              Alert.alert('Error', `No se pudo insertar: ${error.message}\n\nStack: ${error.stack}`);
            }
          }
        }
      ]
    );
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

  /**
   * FASE 5: Test de sincronización de caché
   */
  const testSyncCache = async () => {
    try {
      Alert.alert('Sincronizando...', 'Descargando loterías y horarios del servidor');
      
      const backgroundTask = require('../services/backgroundTaskService');
      const result = await backgroundTask.syncOfflineCache();
      
      if (result.success) {
        Alert.alert(
          'Éxito',
          `✅ Caché sincronizado\n\n` +
          `Loterías: ${result.lotteries}\n` +
          `Horarios: ${result.schedules}\n\n` +
          `Timestamp: ${new Date(result.timestamp).toLocaleString()}`
        );
      } else {
        Alert.alert('Error', `❌ ${result.error}`);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  /**
   * FASE 5: Test para ver loterías cacheadas
   */
  const testViewCachedLotteries = async () => {
    try {
      // Llamar sin parámetro para obtener todas las loterías
      const lotteries = await OfflineStorage.getLotteries(null);
      const lastUpdate = await OfflineStorage.getLastCacheUpdate('lotteries');
      
      // DEBUG: Ver qué datos realmente vienen
      console.log('[TestPanel] Loterías obtenidas:', JSON.stringify(lotteries, null, 2));
      
      if (!lotteries || lotteries.length === 0) {
        Alert.alert('Sin datos', 'No hay loterías en caché.\n\nPrimero sincroniza el caché.');
        return;
      }

      const lastUpdateStr = lastUpdate 
        ? new Date(lastUpdate).toLocaleString() 
        : 'Nunca';

      const lotteriesStr = lotteries
        .map(lot => {
          console.log('[TestPanel] Lotería:', lot);
          return `• ${lot.nombre || 'Sin nombre'} (ID: ${lot.id})`;
        })
        .join('\n');

      Alert.alert(
        'Loterías en Caché',
        `Total: ${lotteries.length}\n` +
        `Última actualización: ${lastUpdateStr}\n\n` +
        `${lotteriesStr}`
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  /**
   * FASE 5: Test para ver horarios cacheados
   */
  const testViewCachedSchedules = async () => {
    try {
      // Llamar sin parámetro para obtener todos los horarios
      const schedules = await OfflineStorage.getSchedules(null);
      const lastUpdate = await OfflineStorage.getLastCacheUpdate('schedules');
      
      // DEBUG: Ver qué datos realmente vienen
      console.log('[TestPanel] Horarios obtenidos:', JSON.stringify(schedules, null, 2));
      
      if (!schedules || schedules.length === 0) {
        Alert.alert('Sin datos', 'No hay horarios en caché.\n\nPrimero sincroniza el caché.');
        return;
      }

      const lastUpdateStr = lastUpdate 
        ? new Date(lastUpdate).toLocaleString() 
        : 'Nunca';

      // Agrupar por lotería
      const byLottery = schedules.reduce((acc, sch) => {
        console.log('[TestPanel] Horario:', sch);
        const lotId = sch.id_loteria;
        if (!acc[lotId]) acc[lotId] = [];
        acc[lotId].push(sch);
        return acc;
      }, {});

      const schedulesStr = Object.entries(byLottery)
        .map(([lotId, scheds]) => {
          const times = scheds
            .map(s => `${s.nombre || s.hora_inicio} (${s.hora_inicio}-${s.hora_fin})`)
            .join('\n  ');
          return `Lotería ${lotId}:\n  ${times}`;
        })
        .join('\n\n');

      Alert.alert(
        'Horarios en Caché',
        `Total: ${schedules.length}\n` +
        `Última actualización: ${lastUpdateStr}\n\n` +
        `${schedulesStr}`,
        [{ text: 'OK' }],
        { cancelable: true }
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  /**
   * FASE 5: Test para ver datos RAW del caché (debug)
   */
  const testViewRawCacheData = async () => {
    try {
      const lotteries = await OfflineStorage.getLotteries(null);
      const schedules = await OfflineStorage.getSchedules(null);
      
      if ((!lotteries || lotteries.length === 0) && (!schedules || schedules.length === 0)) {
        Alert.alert('Sin datos', 'No hay datos en caché.\n\nPrimero sincroniza el caché.');
        return;
      }

      // Mostrar datos raw de la primera lotería
      const lotSample = lotteries && lotteries.length > 0 ? lotteries[0] : null;
      const schSample = schedules && schedules.length > 0 ? schedules[0] : null;

      let message = '📊 DATOS RAW (primer registro de cada tabla):\n\n';
      
      if (lotSample) {
        message += '🎰 LOTERÍA:\n';
        message += `Columnas: ${Object.keys(lotSample).join(', ')}\n\n`;
        message += 'Valores:\n';
        Object.entries(lotSample).forEach(([key, value]) => {
          message += `  ${key}: ${value}\n`;
        });
        message += '\n';
      }

      if (schSample) {
        message += '⏰ HORARIO:\n';
        message += `Columnas: ${Object.keys(schSample).join(', ')}\n\n`;
        message += 'Valores:\n';
        Object.entries(schSample).forEach(([key, value]) => {
          message += `  ${key}: ${value}\n`;
        });
      }

      Alert.alert(
        '🔍 Datos RAW del Caché',
        message,
        [{ text: 'OK' }],
        { cancelable: true }
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      {/* Botón inline - MÁS VISIBLE */}
      {inline && (
        <Pressable
          style={({ pressed }) => [
            styles.inlineButton,
            pressed && styles.inlineButtonPressed
          ]}
          onPress={handleOpenPanel}
        >
          <Text style={styles.inlineButtonText}>🧪 Testing</Text>
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
            {console.log('[OfflineTestingPanel] Modal visible:', modalVisible)}
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
            <ScrollView 
              style={styles.scrollContent}
              contentContainerStyle={styles.scrollContentContainer}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              bounces={false}
              overScrollMode="never"
              keyboardShouldPersistTaps="handled"
            >
              {/* FASE 5: Caché de Loterías y Horarios - MOVIDO AL INICIO */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎰 FASE 5: Caché Offline</Text>
                
                <TestButton 
                  title="🔄 Sincronizar Caché (Loterías + Horarios)"
                  onPress={testSyncCache}
                />
                
                <TestButton 
                  title="👁️ Ver Loterías Cacheadas"
                  onPress={testViewCachedLotteries}
                />
                
                <TestButton 
                  title="⏰ Ver Horarios Cacheados"
                  onPress={testViewCachedSchedules}
                />
                
                <TestButton 
                  title="🔍 Ver Datos RAW (Debug)"
                  onPress={testViewRawCacheData}
                />
              </View>

              {/* FASE 4: Login Offline */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📱 FASE 4: Login Offline</Text>
                
                <TestButton 
                  title="✅ Ver Credenciales Guardadas"
                  onPress={testCheckStoredCredentials}
                />
                
                <TestButton 
                  title="⏰ Validar Sesión Offline"
                  onPress={testValidateOfflineSession}
                />
                
                <TestButton 
                  title="📅 Ver Último Login"
                  onPress={testViewLastLogin}
                />
                
                <TestButton 
                  title="🔐 Probar Encriptación"
                  onPress={testEncryption}
                />
                
                <TestButton 
                  title="⏳ Forzar Sesión Expirada"
                  onPress={testForceExpireSession}
                  danger
                />
                
                <TestButton 
                  title="🗑️ Eliminar Credenciales"
                  onPress={testClearCredentials}
                  danger
                />
              </View>

              {/* Base de Datos */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🗄️ Base de Datos SQLite</Text>
                
                <TestButton 
                  title="📊 Ver Info de BD"
                  onPress={testDatabaseInfo}
                />
                
                <TestButton 
                  title="🧪 Insertar Credenciales de Prueba"
                  onPress={testInsertFakeCredentials}
                />
              </View>

              {/* Logs */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📋 Logs del Sistema</Text>
                
                <TestButton 
                  title="👁️ Ver Últimos Logs"
                  onPress={testViewLogs}
                />
                
                <TestButton 
                  title="🗑️ Limpiar Logs"
                  onPress={testClearLogs}
                  danger
                />
              </View>

              {/* Información */}
              <View style={styles.infoSection}>
                <Text style={styles.infoText}>
                  ℹ️ Panel de testing para funcionalidades offline.
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
  // Botón inline - MÁS VISIBLE
  inlineButton: {
    backgroundColor: '#9b59b6', // Morado para destacar
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 5,
    borderWidth: 2,
    borderColor: '#8e44ad',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inlineButtonPressed: {
    backgroundColor: '#8e44ad',
    transform: [{ scale: 0.98 }],
  },
  inlineButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center', // Centrado vertical
    alignItems: 'center', // Centrado horizontal
    padding: 20, // Padding para evitar que toque los bordes
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    height: '85%', // Usar height en lugar de maxHeight
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20, // Agregado padding superior
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
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
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
    flex: 1, // Usar flex: 1 para ocupar todo el espacio disponible
  },
  scrollContentContainer: {
    paddingBottom: 120, // Aumentado para ver contenido completo al final
    paddingTop: 5, // Pequeño padding superior
    flexGrow: 1, // Permitir que el contenido crezca
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
