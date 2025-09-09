import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Función para guardar la sesión en AsyncStorage
  const saveSession = async (session) => {
    try {
      if (session) {
        await AsyncStorage.setItem('@supabase_session', JSON.stringify(session));
      } else {
        await AsyncStorage.removeItem('@supabase_session');
      }
    } catch (error) {
      console.error('Error al guardar la sesión:', error);
    }
  };

  // Función para cargar la sesión desde AsyncStorage
  const loadSession = async () => {
    try {
      const sessionString = await AsyncStorage.getItem('@supabase_session');
      if (sessionString) {
        const savedSession = JSON.parse(sessionString);
        
        // Verificar si la sesión no ha expirado
        if (savedSession.expires_at && new Date(savedSession.expires_at * 1000) > new Date()) {
          // Restaurar la sesión en Supabase
          await supabase.auth.setSession({
            access_token: savedSession.access_token,
            refresh_token: savedSession.refresh_token
          });
          return savedSession;
        } else {
          // La sesión ha expirado, eliminarla
          await AsyncStorage.removeItem('@supabase_session');
        }
      }
    } catch (error) {
      console.error('Error al cargar la sesión:', error);
    }
    return null;
  };

  // Función para inicializar la autenticación
  const initializeAuth = async () => {
    try {
      setLoading(true);

      // Intentar cargar sesión guardada
      const savedSession = await loadSession();
      
      if (savedSession) {
        // Si hay una sesión guardada válida, obtener el usuario actual
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!error && user) {
          setUser(user);
          setSession(savedSession);
        } else {
          // Si hay error al obtener el usuario, limpiar la sesión guardada
          await AsyncStorage.removeItem('@supabase_session');
        }
      }
    } catch (error) {
      console.error('Error al inicializar autenticación:', error);
    } finally {
      setLoading(false);
    }
  };

  // Configurar listener para cambios de autenticación
  useEffect(() => {
    // Inicializar la autenticación al cargar el componente
    initializeAuth();

    // Escuchar cambios en el estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Guardar o eliminar la sesión según el evento
        if (event === 'SIGNED_IN' && session) {
          await saveSession(session);
        } else if (event === 'SIGNED_OUT') {
          await AsyncStorage.removeItem('@supabase_session');
        } else if (event === 'TOKEN_REFRESHED' && session) {
          await saveSession(session);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Función para iniciar sesión
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  };

  // Función para cerrar sesión
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    // Limpiar datos locales
    setUser(null);
    setSession(null);
    await AsyncStorage.removeItem('@supabase_session');
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
