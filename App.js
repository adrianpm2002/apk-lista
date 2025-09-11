// Solo para plataformas nativas (iOS/Android)
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

// Debug AsyncStorage en desarrollo (solo Android)
if (__DEV__ && Platform.OS === 'android') {
  import('./src/utils/debugAsyncStorage');
}

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Configuración adicional para Android si es necesaria
      console.log('Configurando barra de estado para Android');
    }
  }, []);

  return (
    <AuthProvider>
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
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 0 : 0, // Sin padding para que la app use toda la pantalla
  },
});
