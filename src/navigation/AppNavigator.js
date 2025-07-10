import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import VisualModeScreen from '../screens/VisualModeScreen';
import TextModeScreen from '../screens/TextModeScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => (
  <Stack.Navigator
    initialRouteName="Login"
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
      name="Home" 
      component={HomeScreen}
      options={{
        title: 'Inicio',
        headerBackVisible: false,
      }}
    />
    <Stack.Screen 
      name="VisualMode" 
      component={VisualModeScreen}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="TextMode" 
      component={TextModeScreen}
      options={{
        headerShown: false,
      }}
    />
  </Stack.Navigator>
);

export default AppNavigator;
