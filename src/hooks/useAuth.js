import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { sessionMonitor } from '../services/sessionMonitorService';
import { secureStorage } from '../utils/storage';

/**
 * Hook personalizado para manejo de autenticación
 */
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    // Inicializar el monitoreo de sesión
    sessionMonitor.startMonitoring();

    // Listener para cambios de estado de autenticación
    const handleAuthStateChange = async (event, session) => {
      
      if (event === 'SIGNED_IN' && session) {
        setSession(session);
        setUser(session.user);
        
        // Obtener perfil del usuario
        const profile = await authService.getUserProfile(session.user.id);
        setUserProfile(profile);
        
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setUserProfile(null);
        
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session);
        setUser(session.user);
      }
      
      setLoading(false);
    };

    sessionMonitor.addListener(handleAuthStateChange);

    // Inicializar autenticación
    const initializeAuth = async () => {
      try {
        setLoading(true);
        
        // Intentar restaurar sesión si está habilitada
        const restoredSession = await authService.restoreSessionIfNeeded();
        
        if (restoredSession && restoredSession.session) {
          setSession(restoredSession.session);
          setUser(restoredSession.session.user);
          setUserProfile(restoredSession.profile);
        } else {
          // Verificar si hay sesión activa
          const currentSession = await authService.getCurrentSession();
          if (currentSession) {
            setSession(currentSession);
            setUser(currentSession.user);
            
            const profile = await authService.getUserProfile(currentSession.user.id);
            setUserProfile(profile);
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
      sessionMonitor.removeListener(handleAuthStateChange);
    };
  }, []);

  /**
   * Función de login
   */
  const login = async (username, password, keepSession = false) => {
    try {
      setLoading(true);
      
      const result = await authService.login(username, password, keepSession);
      
      if (result.success) {
        setSession(result.session);
        setUser(result.session.user);
        setUserProfile(result.profile);
        
        return {
          success: true,
          profile: result.profile
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Función de logout
   */
  const logout = async (clearPersistentPreference = false) => {
    try {
      setLoading(true);
      await authService.logout(clearPersistentPreference);
      
      setSession(null);
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Obtener información de sesión almacenada
   */
  const getStoredSession = async () => {
    try {
      return await secureStorage.getUserSession();
    } catch (error) {
      console.error('Error obteniendo sesión almacenada:', error);
      return null;
    }
  };

  /**
   * Verificar si la sesión persistente está habilitada
   */
  const isPersistentSessionEnabled = async () => {
    try {
      return await secureStorage.isPersistentSessionEnabled();
    } catch (error) {
      console.error('Error verificando sesión persistente:', error);
      return false;
    }
  };

  /**
   * Cambiar estado de sesión persistente
   */
  const togglePersistentSession = async (enabled) => {
    try {
      await authService.onPersistentSessionToggle(enabled);
    } catch (error) {
      console.error('Error cambiando sesión persistente:', error);
      throw error;
    }
  };

  /**
   * Verificar estado de la sesión
   */
  const checkSessionStatus = async () => {
    try {
      return await sessionMonitor.checkSessionStatus();
    } catch (error) {
      console.error('Error verificando estado de sesión:', error);
      return null;
    }
  };

  return {
    // Estado
    user,
    session,
    loading,
    isInitialized,
    userProfile,
    
    // Funciones
    login,
    logout,
    getStoredSession,
    isPersistentSessionEnabled,
    togglePersistentSession,
    checkSessionStatus,
    
    // Servicios
    authService,
    sessionMonitor,
  };
};

export default useAuth;

