import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { sessionMonitor } from '../services/sessionMonitorService';

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
 * Provider del contexto de autenticación
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Inicializar el monitoreo de sesión
    sessionMonitor.startMonitoring();

    // Agregar listener para cambios de estado de autenticación
    const handleAuthStateChange = (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setSession(session);
        setUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session);
        setUser(session.user);
      }
      
      setLoading(false);
    };

    sessionMonitor.addListener(handleAuthStateChange);

    // Verificar sesión inicial
    const initializeAuth = async () => {
      try {
        setLoading(true);
        
        // Intentar restaurar sesión online si está habilitada
        const restoredSession = await authService.restoreSessionIfNeeded();
        
        if (restoredSession && restoredSession.session) {
          setSession(restoredSession.session);
          setUser(restoredSession.session.user);
        } else {
          // Verificar si hay sesión online activa
          const currentSession = await authService.getCurrentSession();
          if (currentSession) {
            setSession(currentSession);
            setUser(currentSession.user);
          } else {
            // Si no hay sesión online, intentar auto-login offline
            const offlineUser = await authService.tryAutoLoginOffline();
            if (offlineUser) {
              // Establecer usuario offline
              setUser(offlineUser);
              setSession(null); // No hay sesión de Supabase en modo offline
            }
          }
        }
      } catch (error) {
        console.error('Error inicializando autenticación:', error);
      } finally {
        setLoading(false);
        setIsInitialized(true);
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

  const value = {
    user,
    session,
    loading,
    isInitialized,
    authService,
    sessionMonitor,
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
