import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import * as OfflineStorage from '../services/offlineStorageService';

/**
 * Componente de testing para probar funcionalidades offline
 * Siempre visible (sin restricción de desarrollo/producción)
 * @param {boolean} inline - Si es true, muestra botón inline en lugar de flotante
 * @param {boolean} allowWeb - Permite mostrar en web (por defecto false)
 */
const OfflineTestingPanel = ({ inline = false, allowWeb = false }) => {
  const [visible, setVisible] = useState(false);
  const [testResults, setTestResults] = useState([]);
  
  // Si no se permite web y estamos en web, no mostrar
  if (!allowWeb && Platform.OS === 'web') {
    return null;
  }

  const addResult = (test, success, data) => {
    const result = {
      test,
      success,
      data,
      timestamp: new Date().toLocaleTimeString(),
    };
    setTestResults(prev => [result, ...prev].slice(0, 10)); // Mantener últimos 10
  };

  const runTest = async (testName, testFn) => {
    try {
      const result = await testFn();
      addResult(testName, result.success, result.data || result.error);
      
      if (result.success) {
        Alert.alert('✅ Test Exitoso', `${testName}\n\n${JSON.stringify(result.data, null, 2)}`);
      } else {
        Alert.alert('❌ Test Fallido', `${testName}\n\nError: ${result.error}`);
      }
    } catch (error) {
      addResult(testName, false, error.message);
      Alert.alert('❌ Error', `${testName}\n\n${error.message}`);
    }
  };

  const testInsertRecord = () => {
    runTest('Insertar Registro', () => OfflineStorage.insertTestRecord());
  };

  const testReadRecords = () => {
    runTest('Leer Registros', () => OfflineStorage.readTestRecords());
  };

  const testGetLogs = async () => {
    try {
      const logs = await OfflineStorage.getLogs(10);
      addResult('Obtener Logs', true, `${logs.length} logs encontrados`);
      Alert.alert(
        '✅ Logs Obtenidos (Últimos 10)',
        `Total: ${logs.length} logs\n\n${logs.slice(0, 3).map(l => 
          `[${l.level}] ${l.message}`
        ).join('\n')}`
      );
    } catch (error) {
      addResult('Obtener Logs', false, error.message);
      Alert.alert('❌ Error', error.message);
    }
  };

  const testGetAllLogs = async () => {
    try {
      const logs = await OfflineStorage.getLogs(1000); // Obtener hasta 1000 logs
      addResult('Obtener Todos los Logs', true, `${logs.length} logs encontrados`);
      
      const logsText = logs.map((l, i) => 
        `${i + 1}. [${l.level}] ${l.timestamp}\n   ${l.message}${l.data ? `\n   Data: ${JSON.stringify(l.data)}` : ''}`
      ).join('\n\n');
      
      Alert.alert(
        '✅ Todos los Logs',
        `Total: ${logs.length} logs\n\n${logsText}`,
        [{ text: 'OK' }],
        { cancelable: true }
      );
    } catch (error) {
      addResult('Obtener Todos los Logs', false, error.message);
      Alert.alert('❌ Error', error.message);
    }
  };

  const showAllConsoleLogs = () => {
    // Mostrar información sobre cómo ver los logs de la aplicación
    Alert.alert(
      '📱 Ver Logs de la Aplicación',
      Platform.select({
        android: 'Para ver todos los logs de la aplicación:\n\n1. Abre una terminal\n2. Ejecuta: adb logcat *:S ReactNative:V ReactNativeJS:V\n\nO en Metro Bundler verás los console.log()',
        ios: 'Para ver todos los logs de la aplicación:\n\n1. Abre Xcode\n2. Window → Devices and Simulators\n3. Selecciona tu dispositivo\n4. Click en "Open Console"\n\nO en Metro Bundler verás los console.log()',
        default: 'Los logs de la aplicación se muestran en la consola del navegador (F12)',
      }),
      [{ text: 'Entendido' }]
    );
  };

  const testClearLogs = async () => {
    try {
      await OfflineStorage.clearLogs();
      addResult('Limpiar Logs', true, 'Logs eliminados');
      Alert.alert('✅ Logs Limpiados', 'Todos los logs han sido eliminados');
    } catch (error) {
      addResult('Limpiar Logs', false, error.message);
      Alert.alert('❌ Error', error.message);
    }
  };

  const testConfig = async () => {
    try {
      const testKey = 'test_config_key';
      const testValue = `Test value ${Date.now()}`;
      
      await OfflineStorage.setConfig(testKey, testValue);
      const retrieved = await OfflineStorage.getConfig(testKey);
      
      const success = retrieved === testValue;
      addResult('Config Set/Get', success, { set: testValue, got: retrieved });
      
      if (success) {
        Alert.alert('✅ Config Test', `Valor guardado y recuperado correctamente:\n\n${retrieved}`);
      } else {
        Alert.alert('❌ Config Test', `Error: valor no coincide\nSet: ${testValue}\nGot: ${retrieved}`);
      }
    } catch (error) {
      addResult('Config Test', false, error.message);
      Alert.alert('❌ Error', error.message);
    }
  };

  // Botón que abre el modal (inline o flotante)
  const TriggerButton = inline ? (
    <TouchableOpacity
      style={styles.inlineButton}
      onPress={() => setVisible(true)}
    >
      <Text style={styles.inlineButtonText}>🔧</Text>
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      style={styles.floatingButton}
      onPress={() => setVisible(true)}
    >
      <Text style={styles.floatingButtonText}>🔧</Text>
    </TouchableOpacity>
  );

  return (
    <>
      {/* Botón para abrir panel (inline o flotante) */}
      {TriggerButton}

      {/* Modal con panel de testing */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.panel}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>🔧 Offline Testing Panel</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setVisible(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Botones de testing */}
            <ScrollView style={styles.content}>
              <Text style={styles.sectionTitle}>FASE 1: SQLite Básico</Text>
              
              <TouchableOpacity style={styles.testButton} onPress={testInsertRecord}>
                <Text style={styles.testButtonText}>📝 Insertar Registro de Prueba</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.testButton} onPress={testReadRecords}>
                <Text style={styles.testButtonText}>📖 Leer Registros de Prueba</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.testButton} onPress={testConfig}>
                <Text style={styles.testButtonText}>⚙️ Test Config (Set/Get)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.testButton} onPress={testGetLogs}>
                <Text style={styles.testButtonText}>📋 Ver Últimos 10 Logs</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.testButton} onPress={testGetAllLogs}>
                <Text style={styles.testButtonText}>📚 Ver TODOS los Logs SQLite</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testButton, styles.infoButton]}
                onPress={showAllConsoleLogs}
              >
                <Text style={styles.testButtonText}>
                  🖥️ Cómo Ver Logs de la App
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testButton, styles.dangerButton]}
                onPress={testClearLogs}
              >
                <Text style={[styles.testButtonText, styles.dangerButtonText]}>
                  🗑️ Limpiar Logs
                </Text>
              </TouchableOpacity>

              {/* Resultados */}
              {testResults.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Resultados Recientes:</Text>
                  {testResults.map((result, index) => (
                    <View
                      key={index}
                      style={[
                        styles.resultItem,
                        result.success ? styles.resultSuccess : styles.resultError
                      ]}
                    >
                      <Text style={styles.resultTitle}>
                        {result.success ? '✅' : '❌'} {result.test}
                      </Text>
                      <Text style={styles.resultTime}>{result.timestamp}</Text>
                      <Text style={styles.resultData}>
                        {typeof result.data === 'object' 
                          ? JSON.stringify(result.data, null, 2)
                          : result.data}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 9999,
  },
  floatingButtonText: {
    fontSize: 28,
  },
  inlineButton: {
    backgroundColor: '#FF6B6B',
    borderWidth: 2,
    borderColor: '#FF6B6B',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  inlineButtonText: {
    fontSize: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  dangerButtonText: {
    color: '#FFFFFF',
  },
  infoButton: {
    backgroundColor: '#2196F3',
  },
  resultItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  resultSuccess: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  resultError: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultTime: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  resultData: {
    fontSize: 12,
    color: '#444',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

export default OfflineTestingPanel;
