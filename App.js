// Solo para plataformas nativas (iOS/Android)
import 'react-native-gesture-handler';
import 'react-native-reanimated';
// Desactivar logs en producción
import './src/utils/disableLogs';
import React, { useEffect, useRef } from 'react';
import { Platform, View, StyleSheet, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuthContext } from './src/contexts/AuthContext';
import { AppStateProvider } from './src/contexts/AppStateContext';
import { OfflineProvider } from './src/contexts/OfflineContext';
import AppNavigator from './src/navigation/AppNavigator';
import ConnectionStatusIndicator from './src/components/ConnectionStatusIndicator';
import ConnectionBanner from './src/components/ConnectionBanner';
import * as OfflineStorage from './src/services/offlineStorageService';
import * as ConnectionService from './src/services/connectionService';
import * as DayChangeService from './src/services/dayChangeService';

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
        } catch (error) {}
      } else {
        setUserRole(null);
      }
    };

    fetchUserRole();
  }, [user]);
  
  // FASE 10: AppState listener para detectar cambio de día
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Inicializar base de datos offline
    const initDB = async () => {try {
        const initResult = await OfflineStorage.initOfflineDB();
        if (initResult) {} else {}
      } catch (error) {}
    };

    initDB();

    // Inicializar monitor de conexiónconst unsubscribe = ConnectionService.initConnectionMonitor();// FASE 10: Inicializar servicio de cambio de díaDayChangeService.initDayChangeService();
    
    // FASE 10: Verificar cambio de día al iniciar
    DayChangeService.checkAndCleanIfDayChanged();

    // FASE 12.3: Recuperar jugadas interrumpidasOfflineStorage.recoverInterruptedPlays().then(count => {
      if (count > 0) {}
    }).catch(error => {});

    if (Platform.OS === 'android') {
      // Configurando app para Android con soporte de segundo plano
    }

    // Cleanup
    return () => {
      if (unsubscribe) {
        unsubscribe();}
    };
  }, []);

  // FASE 10: Listener de AppState para detectar cuando la app vuelve al foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // Cuando la app pasa de background/inactive a active (foreground)
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {DayChangeService.checkAndCleanIfDayChanged();
      }
      
      appState.current = nextAppState;});

    return () => {
      subscription.remove();
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
        {/* FASE 9: Banner de conexión (debe estar dentro de NavigationContainer) */}
        <ConnectionBanner />
      </NavigationContainer>
      <ConnectionStatusIndicator />
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
