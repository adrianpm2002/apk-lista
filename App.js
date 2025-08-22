import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { OfflineProvider } from './src/context/OfflineContext';
import { NotificationsProvider } from './src/context/NotificationsContext';

export default function App() {
  return (
    <OfflineProvider>
      <NotificationsProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </NotificationsProvider>
    </OfflineProvider>
  );
}
