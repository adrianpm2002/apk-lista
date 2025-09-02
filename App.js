// Solo para plataformas nativas (iOS/Android)
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { DarkModeProvider } from './src/contexts/DarkModeContext';

export default function App() {
  return (
    <DarkModeProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </DarkModeProvider>
  );
}
