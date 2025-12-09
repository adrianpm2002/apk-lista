import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { authService } from '../services/authService';
import { supabase } from '../supabaseClient';

/**
 * Componente de Splash Screen que maneja la restauración de sesión
 * Actualizado con mejor manejo de errores y logs mejorados
 */
const SplashScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('Verificando sesión...');

  useEffect(() => {
    const checkSession = async () => {
      try {
        setStatus('Verificando sesión...');
        
        // FASE 14: PRIMERO verificar sesión offline (rápido, SQLite local)
        setStatus('Verificando sesión offline...');
        const offlineResult = await authService.tryAutoLoginOffline();
        
        if (offlineResult && offlineResult.success && offlineResult.profile) {
          const { profile } = offlineResult;
          setStatus('Sesión offline restaurada...');
          
          // Navegar según el rol del usuario
          setTimeout(() => {
            if (profile.role === 'admin' || profile.role === 'collector') {
              navigation.replace('Statistics');
            } else if (profile.role === 'listero') {
              navigation.replace('MainApp');
            } else {
              console.error('Rol de usuario no reconocido:', profile.role);
              navigation.replace('Login');
            }
          }, 500);
          return;
        }
        
        // Si no hay sesión offline, intentar sesión online con timeout
        try {
          setStatus('Verificando sesión online...');
          
          // Crear un timeout de 3 segundos para no esperar indefinidamente sin conexión
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 3000)
          );
          
          const { data: { session: currentSession } } = await Promise.race([
            sessionPromise,
            timeoutPromise
          ]);
          
          if (currentSession?.user) {
            setStatus('Sesión activa encontrada...');
            
            // Verificar perfil del usuario activo (también con timeout)
            const profilePromise = authService.getUserProfile(currentSession.user.id);
            const profileTimeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 3000)
            );
            
            const userProfile = await Promise.race([
              profilePromise,
              profileTimeoutPromise
            ]);
            
            if (userProfile && userProfile.activo !== false) {
              setStatus('Verificando permisos...');
              
              setTimeout(() => {
                if (userProfile.role === 'admin' || userProfile.role === 'collector') {
                  navigation.replace('Statistics');
                } else if (userProfile.role === 'listero') {
                  navigation.replace('MainApp');
                } else {
                  console.error('Rol de usuario no reconocido:', userProfile.role);
                  navigation.replace('Login');
                }
              }, 500);
              return;
            } else {
              setStatus('Usuario inactivo, cerrando sesión...');
              await authService.logout(false);
            }
          }
          
          // Si no hay sesión activa, intentar restaurar con timeout
          setStatus('Verificando sesión persistente...');
          const restorePromise = authService.restoreSessionIfNeeded();
          const restoreTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 3000)
          );
          
          const restoredSession = await Promise.race([
            restorePromise,
            restoreTimeoutPromise
          ]);
          
          if (restoredSession && restoredSession.profile) {
            const { profile } = restoredSession;
            setStatus('Restaurando sesión...');
            
            // Verificar que el usuario siga activo
            if (profile.activo === false) {
              setStatus('Cuenta desactivada, redirigiendo...');
              await authService.logout(false);
              setTimeout(() => {
                navigation.replace('Login');
              }, 1500);
              return;
            }
            
            // Navegar según el rol del usuario
            setTimeout(() => {
              if (profile.role === 'admin' || profile.role === 'collector') {
                navigation.replace('Statistics');
              } else if (profile.role === 'listero') {
                navigation.replace('MainApp');
              } else {
                console.error('Rol de usuario no reconocido:', profile.role);
                navigation.replace('Login');
              }
            }, 500);
            return;
          }
        } catch (onlineError) {
          // Error o timeout en verificación online - ir directamente a login
          console.log('[SplashScreen] Error/timeout en verificación online:', onlineError.message);
        }
        
        // No hay sesión para restaurar (ni offline ni online) o hubo timeout
        setStatus('Redirigiendo al login...');
        setTimeout(() => {
          navigation.replace('Login');
        }, 300);
      } catch (error) {
        console.error('Error al verificar sesión:', error);
        setStatus('Error al verificar sesión, redirigiendo...');
        setTimeout(() => {
          navigation.replace('Login');
        }, 1500);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#27AE60" />
        <Text style={styles.statusText}>{status}</Text>
        <Text style={styles.appName}>Lista App</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  statusText: {
    marginTop: 20,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  appName: {
    marginTop: 30,
    fontSize: 24,
    color: '#151717',
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default SplashScreen;
