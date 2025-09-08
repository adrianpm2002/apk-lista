import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import { authService } from '../services/authService';
import { secureStorage } from '../utils/storage';
import { sessionMonitor } from '../services/sessionMonitorService';

/**
 * Componente de prueba para verificar la funcionalidad de sesión persistente
 * Solo para desarrollo - remover en producción
 */
const AuthTestScreen = () => {
  const [status, setStatus] = useState({});
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-20), `[${timestamp}] ${message}`]);
  };

  const updateStatus = async () => {
    try {
      const sessionStatus = await sessionMonitor.checkSessionStatus();
      const persistentEnabled = await secureStorage.isPersistentSessionEnabled();
      const hasCredentials = await secureStorage.hasStoredCredentials();
      
      setStatus({
        hasActiveSession: sessionStatus.hasActiveSession,
        isPersistentEnabled: persistentEnabled,
        hasStoredCredentials: hasCredentials,
        userRole: sessionStatus.userSession?.role,
        userId: sessionStatus.sessionUser?.id,
      });
      
      addLog('Estado actualizado');
    } catch (error) {
      addLog(`Error al actualizar estado: ${error.message}`);
    }
  };

  useEffect(() => {
    updateStatus();
    
    // Listener para cambios de sesión
    const handleSessionChange = (event, session) => {
      addLog(`Cambio de sesión: ${event}`);
      updateStatus();
    };
    
    sessionMonitor.addListener(handleSessionChange);
    
    return () => {
      sessionMonitor.removeListener(handleSessionChange);
    };
  }, []);

  const testLogin = async () => {
    try {
      addLog('Iniciando login de prueba...');
      const result = await authService.login('admin', 'admin123', true);
      
      if (result.success) {
        addLog('Login exitoso');
      } else {
        addLog(`Login falló: ${result.error}`);
      }
      
      updateStatus();
    } catch (error) {
      addLog(`Error en login: ${error.message}`);
    }
  };

  const testLogout = async () => {
    try {
      addLog('Cerrando sesión...');
      await authService.logout(false);
      addLog('Sesión cerrada');
      updateStatus();
    } catch (error) {
      addLog(`Error en logout: ${error.message}`);
    }
  };

  const testRestoreSession = async () => {
    try {
      addLog('Intentando restaurar sesión...');
      const result = await authService.restoreSessionIfNeeded();
      
      if (result) {
        addLog('Sesión restaurada exitosamente');
      } else {
        addLog('No se pudo restaurar sesión');
      }
      
      updateStatus();
    } catch (error) {
      addLog(`Error al restaurar sesión: ${error.message}`);
    }
  };

  const togglePersistentSession = async () => {
    try {
      const currentState = await secureStorage.isPersistentSessionEnabled();
      const newState = !currentState;
      
      addLog(`Cambiando sesión persistente a: ${newState}`);
      await authService.onPersistentSessionToggle(newState);
      addLog('Sesión persistente actualizada');
      updateStatus();
    } catch (error) {
      addLog(`Error al cambiar sesión persistente: ${error.message}`);
    }
  };

  const clearAllData = async () => {
    Alert.alert(
      'Limpiar Datos',
      '¿Está seguro de que desea limpiar todos los datos de sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Limpiar', 
          style: 'destructive',
          onPress: async () => {
            try {
              addLog('Limpiando todos los datos...');
              await secureStorage.clearAllSessionData();
              await authService.logout(true);
              addLog('Datos limpiados');
              updateStatus();
            } catch (error) {
              addLog(`Error al limpiar datos: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Prueba de Autenticación</Text>
      
      {/* Estado actual */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estado Actual</Text>
        <Text>Sesión activa: {status.hasActiveSession ? '✅' : '❌'}</Text>
        <Text>Persistencia habilitada: {status.isPersistentEnabled ? '✅' : '❌'}</Text>
        <Text>Credenciales almacenadas: {status.hasStoredCredentials ? '✅' : '❌'}</Text>
        <Text>Rol de usuario: {status.userRole || 'N/A'}</Text>
        <Text>ID de usuario: {status.userId || 'N/A'}</Text>
      </View>

      {/* Controles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Controles</Text>
        <View style={styles.buttonContainer}>
          <Button title="Login de Prueba" onPress={testLogin} />
          <Button title="Logout" onPress={testLogout} />
          <Button title="Restaurar Sesión" onPress={testRestoreSession} />
          <Button title="Toggle Persistencia" onPress={togglePersistentSession} />
          <Button title="Actualizar Estado" onPress={updateStatus} />
          <Button title="Limpiar Todo" onPress={clearAllData} color="red" />
        </View>
      </View>

      {/* Logs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Logs</Text>
        <ScrollView style={styles.logsContainer}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logItem}>{log}</Text>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  buttonContainer: {
    gap: 10,
  },
  logsContainer: {
    maxHeight: 200,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
  },
  logItem: {
    fontSize: 12,
    marginBottom: 2,
    fontFamily: 'monospace',
  },
});

export default AuthTestScreen;
