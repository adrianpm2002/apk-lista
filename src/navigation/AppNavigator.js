import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import MainAppScreen from '../screens/MainAppScreen';
import CreateUserScreen from '../screens/CreateUserScreen';
import InsertResultsScreen from '../screens/InsertResultsScreen';


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
      name="MainApp" 
      component={MainAppScreen}
      options={{
        headerShown: false,
        headerBackVisible: false,
      }}
    />
    <Stack.Screen 
      name="Bankview" 
      component={InsertResultsScreen}
      options={{
        headerShown: false,
        headerBackVisible: false,
      }}
    />

    <Stack.Screen name="CreateUser" component={CreateUserScreen} />

  </Stack.Navigator>
);

export default AppNavigator;
