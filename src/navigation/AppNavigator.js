import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import MainAppScreen from '../screens/MainAppScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => (
  <Stack.Navigator
    initialRouteName="MainApp"
    screenOptions={{
      headerStyle: {
        backgroundColor: '#F8F9FA',
      },
      headerTintColor: '#2C3E50',
      headerTitleStyle: {
        fontWeight: '600',
      },
    }}>
    <Stack.Screen 
      name="Login" 
      component={LoginScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="MainApp" 
      component={MainAppScreen}
      options={{
        headerShown: false,
        headerBackVisible: false,
      }}
    />
  </Stack.Navigator>
);

export default AppNavigator;
