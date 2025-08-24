import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import MainAppScreen from '../screens/MainAppScreen';
import CreateUserScreen from '../screens/CreateUserScreen';
import InsertResultsScreen from '../screens/InsertResultsScreen';
import ManageLotteriesScreen from '../screens/ManageLotteriesScreen';
import ManagePricesScreen from '../screens/ManagePricesScreen';
import LimitNumero from '../screens/limitNumero';
import StaticsBanck from '../screens/StatisticsScreen';
import SavedPlaysScreen from '../screens/SavedPlaysScreen';
import CollectorStatisticsScreen from '../screens/CollectorStatisticsScreen';


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
      }}
    />
    <Stack.Screen 
      name="ManageLotteries" 
      component={ManageLotteriesScreen}
      options={{
        headerShown: false,
      }}
    />

    <Stack.Screen 
      name="CreateUser" 
      component={CreateUserScreen} 
      options={{
        headerShown: false,
      }}
    />

    <Stack.Screen 
      name="ManagePrices" 
      component={ManagePricesScreen} 
      options={{
        headerShown: false,
      }}
    />

    <Stack.Screen 
      name="NumberLimits" 
      component={LimitNumero} 
      options={{
        headerShown: false,
      }}
    />

    <Stack.Screen 
      name="Statistics" 
      component={StaticsBanck} 
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen 
      name="SavedPlays" 
      component={SavedPlaysScreen} 
      options={{
        headerShown: false,
      }}
    />

    <Stack.Screen 
      name="CollectorStatistics" 
      component={CollectorStatisticsScreen} 
      options={{
        headerShown: false,
      }}
    />


  </Stack.Navigator>
);

export default AppNavigator;
