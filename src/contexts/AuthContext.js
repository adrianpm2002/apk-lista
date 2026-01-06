import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { sessionMonitor } from '../services/sessionMonitorService';
import { supabase } from '../supabaseClient';

/**
 * Contexto de autenticación
 */
const AuthContext = createContext({});

/**
 * Hook para usar el contexto de autenticación
 */
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext debe ser usado dentro de un AuthProvider');
  }
  return context;
};

/**
 * Helper para cargar el perfil del usuario y combinarlo con el objeto user
 */
const loadUserProfile = async (sessionUser) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, id_banco, username')
      .eq('id', sessionUser.id)
      .single();
    
    if (!error && profile) {
      // Combinar el usuario de sesión con los datos del perfil
      return {
        ...sessionUser,
        role: profile.role,
        bankId: profile.id_banco,
        id_banco: profile.id_banco,
        username: profile.username,
        userId: sessionUser.id,
      };
    }
  } catch (e) {
    // Ignorar errores de conexión
  }
  return sessionUser;
};

/**
 * Provider del contexto de autenticación
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Agregar listener para cambios de estado de autenticación
    const handleAuthStateChange = async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setSession(session);
        // Cargar perfil con rol para usuarios online
        const userWithProfile = await loadUserProfile(session.user);
        setUser(userWithProfile);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session);
        // Cargar perfil con rol para usuarios online
        const userWithProfile = await loadUserProfile(session.user);
        setUser(userWithProfile);
      }
      
      setLoading(false);
    };

    // Verificar sesión inicial
    const initializeAuth = async () => {
      try {
        setLoading(true);
        
        // Intentar restaurar sesión online si está habilitada
        const restoredSession = await authService.restoreSessionIfNeeded();
        
        if (restoredSession && restoredSession.session) {
          setSession(restoredSession.session);
          // Cargar perfil con rol para usuarios online
          const userWithProfile = await loadUserProfile(restoredSession.session.user);
          setUser(userWithProfile);
        } else {
          // Verificar si hay sesión online activa
          const currentSession = await authService.getCurrentSession();
          if (currentSession) {
            setSession(currentSession);
            // Cargar perfil con rol para usuarios online
            const userWithProfile = await loadUserProfile(currentSession.user);
            setUser(userWithProfile);
          } else {
            // Si no hay sesión online, intentar auto-login offline
            const offlineResult = await authService.tryAutoLoginOffline();
            if (offlineResult && offlineResult.success && offlineResult.profile) {
              // Establecer usuario offline (solo el profile)
              setUser(offlineResult.profile);
              setSession(null); // No hay sesión de Supabase en modo offline
            }
          }
        }
      } catch (error) {
        console.error('Error inicializando autenticación:', error);
      } finally {
        setLoading(false);
        setIsInitialized(true);
        
        // Iniciar el monitoreo DESPUÉS de completar la inicialización
        // Esto evita bloqueos en el auto-login offline
        sessionMonitor.startMonitoring();
        sessionMonitor.addListener(handleAuthStateChange);
      }
    };

    initializeAuth();

    // Cleanup
    return () => {
      try {
        if (handleAuthStateChange) {
          sessionMonitor.removeListener(handleAuthStateChange);
        }
        sessionMonitor.stopMonitoring();
      } catch (error) {
        console.error('Error en cleanup de AuthContext:', error);
      }
    };
  }, []);

  // Efecto adicional: Si el usuario existe pero no tiene rol, cargar el perfil
  useEffect(() => {
    const enrichUserWithProfile = async () => {
      // Solo si hay usuario pero no tiene rol (sesión preexistente sin perfil cargado)
      if (user && !user.role) {
        const userId = user.id || user.userId;
        if (userId) {
          const userWithProfile = await loadUserProfile({ ...user, id: userId });
          if (userWithProfile.role) {
            setUser(userWithProfile);
          }
        }
      }
    };
    
    enrichUserWithProfile();
  }, [user]);

  /**
   * Establecer usuario offline manualmente (para login offline manual)
   */
  const setOfflineUser = (profile) => {
    setUser(profile);
    setSession(null);
  };

  const value = {
    user,
    session,
    loading,
    isInitialized,
    authService,
    sessionMonitor,
    setOfflineUser, // Exportar para uso en LoginScreen
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * HOC para requerir autenticación
 */
export const withAuth = (Component) => {
  return function AuthenticatedComponent(props) {
    const { user, loading } = useAuthContext();
    
    if (loading) {
      return null; // O componente de loading
    }
    
    if (!user) {
      return null; // Será manejado por el navigation
    }
    
    return <Component {...props} />;
  };
};

/**
 * HOC para requerir un rol específico
 */
export const withRole = (Component, requiredRoles) => {
  return function RoleRestrictedComponent(props) {
    const { user, loading } = useAuthContext();
    
    if (loading) {
      return null;
    }
    
    if (!user) {
      return null;
    }
    
    // Aquí podrías verificar roles si los tienes en el user object
    // Por ahora, solo verificamos que esté autenticado
    
    return <Component {...props} />;
  };
};

export default AuthContext;
