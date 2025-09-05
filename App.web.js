import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { DarkModeProvider } from './src/contexts/UnifiedDarkModeContext';

export default function App() {
  return (
    <DarkModeProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </DarkModeProvider>
  );
}
