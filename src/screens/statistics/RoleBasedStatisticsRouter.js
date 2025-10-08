import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import AdminStatisticsScreen from './AdminStatisticsScreen';
import CollectorStatisticsScreen from './CollectorStatisticsScreen';
import ListeroStatisticsScreen from './ListeroStatisticsScreen';

const RoleBasedStatisticsRouter = ({ navigation, route, onModeVisibilityChange }) => {
  const { user, loading: authLoading, isInitialized } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roleDetected, setRoleDetected] = useState(false);

  // Memoizar el userId para evitar re-renders innecesarios
  const userId = useMemo(() => user?.id, [user?.id]);

  useEffect(() => {
    const detectUserRole = async () => {
      try {
        setLoading(true);
        setError(null);

        // Esperar a que la autenticación termine de inicializar
        if (!isInitialized || authLoading) {
          console.log('Esperando inicialización de auth...', { isInitialized, authLoading });
          return;
        }

        // Si ya detectamos el rol y el usuario no cambió, no hacer nada
        if (roleDetected && userId) {
          setLoading(false);
          return;
        }

        if (!userId) {
          console.log('Usuario no autenticado después de inicialización, usando rol por defecto: listero');
          setUserRole('listero');
          setRoleDetected(true);
          setLoading(false);
          return;
        }

        console.log('Usuario autenticado detectado:', userId);

        // Usar el patrón estándar que funciona en toda la aplicación
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role, id_banco, id_collector')
            .eq('id', userId)
            .single();

          if (!error && profile) {
            console.log('✅ Perfil encontrado:', profile);
            
            // Determinar el rol basado en los campos del perfil o usar el rol explícito
            let role = profile.role || 'listero'; // Usar rol explícito si existe
            
            // Si no hay rol explícito, determinarlo por los campos
            if (!profile.role) {
              if (profile.id_banco && !profile.id_collector) {
                role = 'admin';
              } else if (profile.id_collector && !profile.id_banco) {
                role = 'collector';
              } else {
                role = 'listero';
              }
            }
            
            console.log('Rol detectado:', role, { 
              userId: userId, 
              banco: profile.id_banco, 
              collector: profile.id_collector 
            });
            
            setUserRole(role);
            setRoleDetected(true);
            setLoading(false);
            return;
          } else {
            console.log('❌ Error obteniendo perfil:', error);
          }
        } catch (err) {
          console.log('❌ Error en consulta profiles:', err.message);
        }
        
        console.log('⚠️ No se encontró perfil, usando rol por defecto');
        setUserRole('listero');
        setRoleDetected(true);
      } catch (err) {
        console.error('Error detectando rol del usuario:', err);
        setError(err.message);
        // En caso de error o usuario no autenticado, defaultear a listero como fallback
        console.log('Usando rol por defecto: listero debido al error');
        setUserRole('listero');
        setRoleDetected(true);
      } finally {
        setLoading(false);
      }
    };

    detectUserRole();
  }, [userId, isInitialized, authLoading, roleDetected]); // Optimizar dependencias

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
      </View>
    );
  }

  if (error && !userRole) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Problema de conexión</Text>
        <Text style={styles.errorSubText}>
          Mostrando vista de listero por defecto
        </Text>
      </View>
    );
  }

  // Renderizar la pantalla correspondiente según el rol
  switch (userRole) {
    case 'admin':
      return (
        <AdminStatisticsScreen
          navigation={navigation}
          route={route}
          onModeVisibilityChange={onModeVisibilityChange}
        />
      );
    case 'collector':
      return (
        <CollectorStatisticsScreen
          navigation={navigation}
          route={route}
          onModeVisibilityChange={onModeVisibilityChange}
        />
      );
    case 'listero':
    default:
      return (
        <ListeroStatisticsScreen
          navigation={navigation}
          route={route}
          onModeVisibilityChange={onModeVisibilityChange}
        />
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
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default RoleBasedStatisticsRouter;