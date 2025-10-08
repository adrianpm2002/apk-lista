import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import MainAppScreen from '../screens/MainAppScreen';
import CreateUserScreen from '../screens/CreateUserScreen';
import InsertResultsScreen from '../screens/InsertResultsScreen';
import ManageLotteriesScreen from '../screens/ManageLotteriesScreen';
import ManagePricesScreen from '../screens/ManagePricesScreen';
import JugadasScreen from '../screens/JugadasScreen';
import LotteryLimitsScreen from '../screens/LotteryLimitsScreen';
import LimitNumero from '../screens/limitNumero';
import SavedPlaysScreen from '../screens/SavedPlaysScreen';
import BankCapacityScreen from '../screens/BankCapacityScreen';
// CAMBIO: Reemplazar imports antiguos de estadísticas por el nuevo router
import RoleBasedStatisticsRouter from '../screens/statistics/RoleBasedStatisticsRouter';

const Stack = createNativeStackNavigator();

const AppNavigator = () => (
  <Stack.Navigator
    initialRouteName="Splash"
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
      name="Splash" 
      component={SplashScreen}
      options={{
        headerShown: false,
      }}
    />
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
        gestureEnabled: Platform.OS === 'ios',
      }}
    />
    <Stack.Screen 
      name="Bankview" 
      component={InsertResultsScreen}
      options={{
        headerShown: false,
        gestureEnabled: Platform.OS === 'ios',
      }}
    />
    <Stack.Screen 
      name="CreateUser" 
      component={CreateUserScreen}
      options={{
        headerShown: false,
        gestureEnabled: Platform.OS === 'ios',
      }}
    />
    <Stack.Screen 
      name="ManageLotteries" 
      component={ManageLotteriesScreen}
      options={{
        headerShown: false,
        gestureEnabled: Platform.OS === 'ios',
      }}
    />
    <Stack.Screen 
      name="ManagePrices" 
      component={ManagePricesScreen}
      options={{
        headerShown: false,
        gestureEnabled: Platform.OS === 'ios',
      }}
    />

    <Stack.Screen 
      name="Jugadas" 
      component={JugadasScreen} 
      options={{
        headerShown: false,
        gestureEnabled: Platform.OS === 'ios',
      }}
    />

    <Stack.Screen 
      name="LotteryLimits" 
      component={LotteryLimitsScreen} 
      options={{
        headerShown: false,
        gestureEnabled: Platform.OS === 'ios',
      }}
    />

    <Stack.Screen 
      name="NumberLimits" 
      component={LimitNumero} 
      options={{
        headerShown: false,
        gestureEnabled: Platform.OS === 'ios',
      }}
    />

    {/* CAMBIO: Usar el nuevo RoleBasedStatisticsRouter que maneja todos los roles automáticamente */}
    <Stack.Screen 
      name="Statistics" 
      component={RoleBasedStatisticsRouter}
      options={{
        title: 'Estadísticas',
        headerShown: false, // Cada pantalla de estadísticas maneja su propio header
        gestureEnabled: Platform.OS === 'ios',
      }}
    />
    
    <Stack.Screen 
      name="SavedPlays" 
      component={SavedPlaysScreen} 
      options={{
        headerShown: false,
        gestureEnabled: Platform.OS === 'ios',
      }}
    />

    {/* ELIMINADO: CollectorStatistics ya no es necesario, el RoleBasedStatisticsRouter maneja todos los roles */}

    <Stack.Screen 
      name="BankCapacity" 
      component={BankCapacityScreen} 
      options={{
        headerShown: false,
        gestureEnabled: Platform.OS === 'ios',
      }}
    />

  </Stack.Navigator>
);

export default AppNavigator;