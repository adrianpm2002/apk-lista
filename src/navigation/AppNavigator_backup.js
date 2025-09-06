import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'rea    <Stack.Screen 
      name="CollectorStatistics" 
      component={StatisticsScreen} 
      options={{
        headerShown: false,
        gestureEnabled: Platform.OS === 'ios',
      }}
    />

    <Stack.Screen 
      name="BankCapacity" 
      component={BankCapacityScreen} 
      options={{
        headerShown: false,
        gestureEnabled: Platform.OS === 'ios',
      }}
    />


  </Stack.Navigator>);
import LoginScreen from '../screens/LoginScreen';
import MainAppScreen from '../screens/MainAppScreen';
import CreateUserScreen from '../screens/CreateUserScreen';
import InsertResultsScreen from '../screens/InsertResultsScreen';
import ManageLotteriesScreen from '../screens/ManageLotteriesScreen';
import ManagePricesScreen from '../screens/ManagePricesScreen';
import JugadasScreen from '../screens/JugadasScreen';
import LotteryLimitsScreen from '../screens/LotteryLimitsScreen';
import LimitNumero from '../screens/limitNumero';
import StatisticsScreen from '../screens/StatisticsScreen';
import SavedPlaysScreen from '../screens/SavedPlaysScreen';
import BankCapacityScreen from '../screens/BankCapacityScreen';


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
      name="ManageLotteries" 
      component={ManageLotteriesScreen}
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
      name="ManageUsers" 
      component={CreateUserScreen} 
      options={{
        headerShown: false,
        gestureEnabled: Platform.OS === 'ios',
      }}
    />

    <Stack.Screen 
      name="Prices" 
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

    <Stack.Screen 
      name="Statistics" 
      component={StatisticsScreen} 
      options={{
        headerShown: false,
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

    <Stack.Screen 
      name="CollectorStatistics" 
      component={StatisticsScreen} 
      options={{
        headerShown: false,
        gestureEnabled: Platform.OS === 'ios',
      }}
    />


  </Stack.Navigator>
);

export default AppNavigator;
