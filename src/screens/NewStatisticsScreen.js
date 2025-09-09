import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { supabase } from '../supabaseClient';
import ScreenWrapper from '../components/ScreenWrapper';
import ListeroStatisticsScreen from './ListeroStatisticsScreen';
// import CollectorStatisticsScreen from './CollectorStatisticsScreen'; // Se creará después
// import AdminStatisticsScreen from './AdminStatisticsScreen'; // Se creará después

const StatisticsScreen = ({ navigation, onModeVisibilityChange }) => {
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Detectar el rol del usuario autenticado
  useEffect(() => {
    const detectUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          Alert.alert('Error', 'Usuario no autenticado');
          return;
        }

        // Obtener el rol del usuario desde la tabla profiles
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error obteniendo rol del usuario:', error);
          setUserRole('listero'); // Por defecto listero
        } else {
          setUserRole(profile.role || 'listero');
        }
        
        console.log('🔍 [StatisticsScreen] Rol detectado:', profile?.role || 'listero');
        
      } catch (error) {
        console.error('Error detectando rol:', error);
        setUserRole('listero'); // Por defecto listero
      } finally {
        setIsLoading(false);
      }
    };

    detectUserRole();
  }, []);

  // Mostrar loading mientras se detecta el rol
  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  // Renderizar la pantalla según el rol
  switch (userRole) {
    case 'listero':
      return (
        <ListeroStatisticsScreen 
          navigation={navigation} 
          onModeVisibilityChange={onModeVisibilityChange}
        />
      );
    
    case 'collector':
    case 'colector':
      // TODO: Crear CollectorStatisticsScreen
      return (
        <ScreenWrapper>
          <View style={styles.comingSoonContainer}>
            <Text style={styles.comingSoonTitle}>Vista de Colector</Text>
            <Text style={styles.comingSoonText}>
              La vista específica para colectores está en desarrollo.
            </Text>
            <Text style={styles.comingSoonText}>
              Por ahora, puedes usar la vista de listero.
            </Text>
          </View>
        </ScreenWrapper>
      );
    
    case 'admin':
      // TODO: Crear AdminStatisticsScreen
      return (
        <ScreenWrapper>
          <View style={styles.comingSoonContainer}>
            <Text style={styles.comingSoonTitle}>Vista de Administrador</Text>
            <Text style={styles.comingSoonText}>
              La vista específica para administradores está en desarrollo.
            </Text>
            <Text style={styles.comingSoonText}>
              Se incluirá la vista jerárquica completa: Colectores → Listeros → Jugadas.
            </Text>
          </View>
        </ScreenWrapper>
      );
    
    default:
      return (
        <ScreenWrapper>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Rol no reconocido</Text>
            <Text style={styles.errorText}>
              El rol "{userRole}" no está configurado correctamente.
            </Text>
            <Text style={styles.errorText}>
              Contacta al administrador del sistema.
            </Text>
          </View>
        </ScreenWrapper>
      );
  }
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  comingSoonText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 24,
  },
});

export default StatisticsScreen;
