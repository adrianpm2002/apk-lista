// Solo para plataformas nativas (iOS/Android)
import 'react-native-gesture-handler';
import 'react-native-reanimated';
// Desactivar logs en producción
import './src/utils/disableLogs';
import React, { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/contexts/AuthContext';
import { AppStateProvider } from './src/contexts/AppStateContext';
import AppNavigator from './src/navigation/AppNavigator';
import ConnectionStatusIndicator from './src/components/ConnectionStatusIndicator';

// Configuración de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Datos frescos por 5 minutos
      cacheTime: 60 * 60 * 1000, // Cache en memoria por 1 hora
      retry: 2, // Reintentar 2 veces en caso de error
      refetchOnWindowFocus: false, // No refetch al cambiar de ventana
      refetchOnMount: false, // No refetch al montar si hay cache válido
    },
  },
});

function AppContent() {
  useEffect(() => {
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
    </View>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppStateProvider>
          <AppContent />
        </AppStateProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 0 : 0, // Sin padding para que la app use toda la pantalla
  },
});
