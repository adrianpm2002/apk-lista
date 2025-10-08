import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '../../supabaseClient';
import AdminStatisticsScreen from './AdminStatisticsScreen';
import CollectorStatisticsScreen from './CollectorStatisticsScreen';
import ListeroStatisticsScreen from './ListeroStatisticsScreen';

const RoleBasedStatisticsRouter = ({ navigation, onModeVisibilityChange }) => {
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    determineUserRole();
  }, []);

  const determineUserRole = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener el usuario autenticado
      const { data: userRes, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw userError;
      }

      if (!userRes?.user?.id) {
        throw new Error('Usuario no autenticado');
      }

      const userId = userRes.user.id;

      // Obtener el perfil del usuario
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, id_colector, id_banco')
        .eq('id', userId)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (!profile) {
        throw new Error('Perfil de usuario no encontrado');
      }

      // Determinar el rol según la lógica del negocio
      let role = 'listero'; // Por defecto

      if (profile.role === 'admin' || (!profile.id_colector && !profile.id_banco)) {
        role = 'admin';
      } else if (profile.id_banco && !profile.id_colector) {
        role = 'collector';
      } else if (profile.id_colector) {
        role = 'listero';
      }

      setUserRole(role);
    } catch (err) {
      console.error('Error determining user role:', err);
      setError(err.message || 'Error al determinar el rol del usuario');
    } finally {
      setLoading(false);
    }
  };

  // Renderizar pantalla de carga
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#27AE60" />
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
      </View>
    );
  }

  // Renderizar error
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={determineUserRole}
        >
          <Text style={styles.retryButtonText}>🔄 Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Renderizar la pantalla correspondiente según el rol
  const renderStatisticsScreen = () => {
    const commonProps = {
      navigation,
      onModeVisibilityChange,
    };

    switch (userRole) {
      case 'admin':
        return <AdminStatisticsScreen {...commonProps} />;
      case 'collector':
        return <CollectorStatisticsScreen {...commonProps} />;
      case 'listero':
        return <ListeroStatisticsScreen {...commonProps} />;
      default:
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>❓</Text>
            <Text style={styles.errorTitle}>Rol no reconocido</Text>
            <Text style={styles.errorMessage}>
              No se pudo determinar el tipo de usuario. Contacte al administrador.
            </Text>
          </View>
        );
    }
  };

  return renderStatisticsScreen();
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default RoleBasedStatisticsRouter;