// Solo para plataformas nativas (iOS/Android)
import 'react-native-gesture-handler';
import 'react-native-reanimated';
// Desactivar logs en producción
import './src/utils/disableLogs';
import React, { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/contexts/AuthContext';
import { AppStateProvider } from './src/contexts/AppStateContext';
import AppNavigator from './src/navigation/AppNavigator';
import ConnectionStatusIndicator from './src/components/ConnectionStatusIndicator';
import OfflineTestingPanel from './src/components/OfflineTestingPanel';
import * as OfflineStorage from './src/services/offlineStorageService';

function AppContent() {
  useEffect(() => {
    // Inicializar base de datos offline
    const initializeOfflineDB = async () => {
      try {
        if (Platform.OS !== 'web') {
          await OfflineStorage.initOfflineDB();
          console.log('[App] Offline database initialized');
        }
      } catch (error) {
        console.error('[App] Error initializing offline database:', error);
      }
    };

    initializeOfflineDB();

    if (Platform.OS === 'android') {
      // Configurando app para Android con soporte de segundo plano
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar 
        style="dark"
        backgroundColor="transparent"
        translucent={true}
        hidden={false}
      />
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
      <ConnectionStatusIndicator />
      <OfflineTestingPanel />
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 0 : 0, // Sin padding para que la app use toda la pantalla
  },
});
