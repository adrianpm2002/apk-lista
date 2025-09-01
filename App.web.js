import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { CacheProvider } from './src/contexts/CacheContext';

export default function App() {
  return (
    <CacheProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </CacheProvider>
  );
}
