import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { authService } from '../services/authService';
import { secureStorage } from '../utils/storage';
import { sessionMonitor } from '../services/sessionMonitorService';

/**
 * Hook personalizado para manejar la autenticación y sesión persistente
 */
export const useAuth = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Función para actualizar el estado del usuario
  const updateUserState = useCallback(async (currentSession) => {
    if (currentSession?.user) {
      const profile = await authService.getUserProfile(currentSession.user.id);
      setUser(currentSession.user);
      setUserProfile(profile);
      setSession(currentSession);
    } else {
      setUser(null);
      setUserProfile(null);
      setSession(null);
    }
  }, []);

  // Listener para cambios de sesión del monitor
  const handleSessionChange = useCallback(async (event, currentSession) => {
    console.log(`useAuth: Manejando cambio de sesión - ${event}`);
    await updateUserState(currentSession);
  }, [updateUserState]);

  // Efecto para inicializar y monitorear autenticación
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('useAuth: Inicializando autenticación...');
        
        // Iniciar el monitoreo de sesión
        sessionMonitor.startMonitoring();
        sessionMonitor.addListener(handleSessionChange);
        
        // Verificar estado actual de la sesión
        const sessionStatus = await sessionMonitor.checkSessionStatus();
        console.log('useAuth: Estado de sesión:', sessionStatus);
        
        if (sessionStatus.hasActiveSession && sessionStatus.sessionUser) {
          // Ya hay una sesión activa válida
          console.log('useAuth: Sesión activa encontrada');
          const profile = await authService.getUserProfile(sessionStatus.sessionUser.id);
          if (mounted && profile) {
            setUser(sessionStatus.sessionUser);
            setUserProfile(profile);
            setSession({ user: sessionStatus.sessionUser });
          }
        } else if (sessionStatus.isPersistentEnabled && sessionStatus.hasStoredCredentials) {
          // Intentar restaurar sesión persistente
          console.log('useAuth: Intentando restaurar sesión persistente...');
          const restoredSession = await authService.restoreSessionIfNeeded();
          
          if (mounted && restoredSession) {
            console.log('useAuth: Sesión restaurada exitosamente');
            await updateUserState(restoredSession.session);
          } else {
            console.log('useAuth: No se pudo restaurar sesión');
          }
        } else {
          console.log('useAuth: No hay sesión para restaurar');
        }
      } catch (error) {
        console.error('useAuth: Error al inicializar autenticación:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Cleanup function
    return () => {
      mounted = false;
      sessionMonitor.removeListener(handleSessionChange);
    };
  }, [updateUserState, handleSessionChange]);

  // Función para login
  const login = useCallback(async (username, password, persistSession = false) => {
    setLoading(true);
    try {
      console.log(`useAuth: Iniciando login para ${username}...`);
      const result = await authService.login(username, password, persistSession);
      
      if (result.success) {
        console.log('useAuth: Login exitoso');
      }
      
      return result;
    } catch (error) {
      console.error('useAuth: Error en login:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Función para logout
  const logout = useCallback(async (clearPersistentPreference = false) => {
    setLoading(true);
    try {
      console.log('useAuth: Cerrando sesión...');
      await authService.logout(clearPersistentPreference);
    } catch (error) {
      console.error('useAuth: Error en logout:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Función para verificar si hay sesión activa
  const hasActiveSession = useCallback(async () => {
    return await authService.hasActiveSession();
  }, []);

  // Función para manejar cambios en sesión persistente
  const togglePersistentSession = useCallback(async (enabled) => {
    try {
      console.log(`useAuth: ${enabled ? 'Habilitando' : 'Deshabilitando'} sesión persistente`);
      await authService.onPersistentSessionToggle(enabled);
      return true;
    } catch (error) {
      console.error('useAuth: Error al cambiar sesión persistente:', error);
      return false;
    }
  }, []);

  // Función para obtener estado de sesión persistente
  const getPersistentSessionState = useCallback(async () => {
    try {
      return await secureStorage.isPersistentSessionEnabled();
    } catch (error) {
      console.error('useAuth: Error al obtener estado de sesión persistente:', error);
      return false;
    }
  }, []);

  // Función para refrescar perfil del usuario
  const refreshUserProfile = useCallback(async () => {
    if (!user?.id) return null;
    
    try {
      const profile = await authService.getUserProfile(user.id);
      setUserProfile(profile);
      return profile;
    } catch (error) {
      console.error('useAuth: Error al refrescar perfil:', error);
      return null;
    }
  }, [user?.id]);

  return {
    // Estado
    session,
    user,
    userProfile,
    loading,
    
    // Funciones de autenticación
    login,
    logout,
    hasActiveSession,
    togglePersistentSession,
    getPersistentSessionState,
    refreshUserProfile,
    
    // Información útil derivada
    isAuthenticated: !!session,
    userId: user?.id,
    userRole: userProfile?.role,
    bankId: userProfile?.bankId,
    isUserActive: userProfile?.activo !== false,
    username: userProfile?.username,
  };
};

export default useAuth;
