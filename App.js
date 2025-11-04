// Solo para plataformas nativas (iOS/Android)
import 'react-native-gesture-handler';
import 'react-native-reanimated';
// Desactivar logs en producción
import './src/utils/disableLogs';
import React, { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuthContext } from './src/contexts/AuthContext';
import { AppStateProvider } from './src/contexts/AppStateContext';
import { OfflineProvider } from './src/contexts/OfflineContext';
import AppNavigator from './src/navigation/AppNavigator';
import ConnectionStatusIndicator from './src/components/ConnectionStatusIndicator';
import ConnectionIndicator from './src/components/ConnectionIndicator';
import SyncStatusBanner from './src/components/SyncStatusBanner';
import OfflineTestingPanel from './src/components/OfflineTestingPanel';
import * as OfflineStorage from './src/services/offlineStorageService';
import * as ConnectionService from './src/services/connectionService';

function AppContent() {
  const { user } = useAuthContext();
  const [userRole, setUserRole] = React.useState(null);

  // Obtener rol del usuario cuando cambie
  React.useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        try {
          const { supabase } = require('./src/supabaseClient');
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          
          if (profile) {
            setUserRole(profile.role);
          }
        } catch (error) {
          console.error('[App] Error fetching user role:', error);
        }
      } else {
        setUserRole(null);
      }
    };

    fetchUserRole();
  }, [user]);
  
  useEffect(() => {
    // Inicializar base de datos offline
    const initDB = async () => {
      console.log('[App] 🔄 Starting offline database initialization...');
      try {
        const initResult = await OfflineStorage.initOfflineDB();
        if (initResult) {
          console.log('[App] ✅ Offline database initialized successfully');
        } else {
          console.log('[App] ⚠️ Offline database not initialized (platform not supported or error)');
        }
      } catch (error) {
        console.error('[App] ❌ Error initializing offline database:', error);
      }
    };

    initDB();

    // Inicializar monitor de conexión
    console.log('[App] 🔄 Starting connection monitor...');
    const unsubscribe = ConnectionService.initConnectionMonitor();
    console.log('[App] ✅ Connection monitor initialized');

    if (Platform.OS === 'android') {
      // Configurando app para Android con soporte de segundo plano
    }

    // Cleanup
    return () => {
      if (unsubscribe) {
        unsubscribe();
        console.log('[App] 🔌 Connection monitor unsubscribed');
      }
    };
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
      <ConnectionIndicator />
      <SyncStatusBanner />
      <ConnectionStatusIndicator />
      <OfflineTestingPanel userRole={userRole} />
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <OfflineProvider>
        <AppStateProvider>
          <AppContent />
        </AppStateProvider>
      </OfflineProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 0 : 0, // Sin padding para que la app use toda la pantalla
  },
});
