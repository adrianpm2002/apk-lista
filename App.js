import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { OfflineProvider } from './src/context/OfflineContext';

export default function App() {
  return (
    <OfflineProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </OfflineProvider>
  );
}
