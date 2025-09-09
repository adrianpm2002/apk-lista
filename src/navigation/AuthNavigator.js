import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
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

const Stack = createNativeStackNavigator();

const AuthNavigator = () => {
  const { user, loading } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);

  // Obtener el rol del usuario cuando se autentica
  useEffect(() => {
    const getUserRole = async () => {
      if (user) {
        setRoleLoading(true);
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          if (!error && profile) {
            setUserRole(profile.role);
          }
        } catch (error) {
          console.error('Error al obtener el rol del usuario:', error);
        } finally {
          setRoleLoading(false);
        }
      } else {
        setUserRole(null);
      }
    };

    getUserRole();
  }, [user]);

  // Mostrar pantalla de carga mientras se verifica la autenticación o el rol
  if (loading || roleLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#27AE60" />
      </View>
    );
  }

  // Determinar la pantalla inicial basada en el rol
  const getInitialRouteName = () => {
    if (!user) return 'Login';
    
    switch (userRole) {
      case 'admin':
      case 'collector':
        return 'Statistics';
      case 'listero':
        return 'MainApp';
      default:
        return 'MainApp';
    }
  };

  return (
    <Stack.Navigator
      initialRouteName={getInitialRouteName()}
      screenOptions={{
        headerStyle: {
          backgroundColor: '#F8F9FA',
        },
        headerTintColor: '#2C3E50',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      {user ? (
        // Usuario autenticado - mostrar pantallas principales
        <>
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
            name="ManageUsers" 
            component={CreateUserScreen} 
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="Prices" 
            component={ManagePricesScreen} 
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="Jugadas" 
            component={JugadasScreen} 
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="LotteryLimits" 
            component={LotteryLimitsScreen} 
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
            component={StatisticsScreen} 
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
            component={StatisticsScreen} 
            options={{
              headerShown: false,
            }}
          />
        </>
      ) : (
        // Usuario no autenticado - mostrar pantalla de login
        <Stack.Screen 
          name="Login" 
          component={LoginScreen}
          options={{
            headerShown: false,
          }}
        />
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
});

export default AuthNavigator;
