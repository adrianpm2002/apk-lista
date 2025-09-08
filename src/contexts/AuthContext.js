import React, { createContext, useContext } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';

// Crear el contexto de autenticación
const AuthContext = createContext(null);

/**
 * Proveedor del contexto de autenticación
 */
export const AuthProvider = ({ children }) => {
  const authValue = useAuth();

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook para usar el contexto de autenticación
 */
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuthContext debe usarse dentro de un AuthProvider');
  }
  
  return context;
};

/**
 * HOC para proteger rutas que requieren autenticación
 */
export const withAuth = (WrappedComponent) => {
  return (props) => {
    const { isAuthenticated, loading, userRole } = useAuthContext();

    // Mostrar pantalla de carga mientras se verifica la autenticación
    if (loading) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#27AE60" />
          <Text style={{ marginTop: 10 }}>Verificando autenticación...</Text>
        </View>
      );
    }

    // Si no está autenticado, no renderizar el componente
    if (!isAuthenticated) {
      return null; // O redirigir al login
    }

    // Pasar la información de autenticación como props
    return (
      <WrappedComponent 
        {...props} 
        userRole={userRole}
        isAuthenticated={isAuthenticated}
      />
    );
  };
};

/**
 * HOC para proteger rutas según el rol del usuario
 */
export const withRole = (allowedRoles) => (WrappedComponent) => {
  return (props) => {
    const { isAuthenticated, loading, userRole } = useAuthContext();

    if (loading) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#27AE60" />
          <Text style={{ marginTop: 10 }}>Verificando permisos...</Text>
        </View>
      );
    }

    if (!isAuthenticated || !allowedRoles.includes(userRole)) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, color: '#e74c3c' }}>
            No tienes permisos para acceder a esta pantalla
          </Text>
        </View>
      );
    }

    return <WrappedComponent {...props} userRole={userRole} />;
  };
};

export default AuthContext;
