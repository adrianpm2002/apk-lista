import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, Modal, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Formik } from 'formik';
import Svg, { Path, G } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';
import { authService } from '../services/authService';
import { useAuthContext } from '../contexts/AuthContext';

const LoginScreen = ({ navigation }) => {
  return (
    <ScreenWrapper>
      <LoginContent navigation={navigation} />
    </ScreenWrapper>
  );
};

const LoginContent = ({ navigation }) => {
  const { setUserRole } = useAuthContext();
  const [isPreloading, setIsPreloading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const validateForm = (values) => {
    const errors = {};
    if (!values.username || !values.password) {
      errors.general = 'Por favor ingrese sus credenciales.';
    }
    return errors;
  };

  const handleLogin = async (values, { setFieldError, setSubmitting }) => {
    try {
      const { username, password } = values;
      
      if (!username || !password) {
        setFieldError('general', 'Por favor ingrese sus credenciales.');
        setSubmitting(false);
        return;
      }

      // Usar el nuevo sistema de autenticación
      const result = await authService.login(username, password, true); // Persistencia habilitada

      if (!result.success) {
        // Verificar si el usuario existe para dar un mensaje más específico
        if (result.error.includes('Credenciales incorrectas')) {
          // TODO: Implementar verificación de existencia de usuario si es necesario
          setFieldError('general', 'Credenciales incorrectas.');
        } else {
          setFieldError('general', result.error);
        }
        setSubmitting(false);
        return;
      }

      const { profile } = result;

      // Actualizar el rol en el contexto inmediatamente
      setUserRole(profile.role);
      console.log('🔑 LoginScreen: Rol establecido en contexto:', profile.role);

      // Configurar información del usuario en el storage local si es necesario
      // (Para este ejemplo, navegamos directamente sin precarga)
      
      // Si es admin o collector, navegar a Statistics
      if (profile.role === 'admin' || profile.role === 'collector') {
        setIsPreloading(true);
        // Navegación inmediata para mejor UX
        setTimeout(() => {
          setIsPreloading(false);
          navigation.navigate('Statistics');
        }, 100); // Reducido a 100ms
      } else if (profile.role === 'listero' || profile.role === 'client') {
        navigation.navigate('MainApp');
      } else {
        setFieldError('general', 'Rol de usuario no reconocido.');
      }
      
      setSubmitting(false);
    } catch (error) {
      console.error('Login error details:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      setFieldError('general', `Error inesperado: ${error.message}`);
      setSubmitting(false);
    }
  };


  return (
    <View style={styles.container}>
      {isPreloading ? (
        // Pantalla de carga completa - sin formulario para evitar aria-hidden conflicts
        <View 
          style={styles.form}
          accessibilityViewIsModal={true}
          accessibilityLiveRegion="polite"
        >
          <View 
            style={styles.loadingContent}
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel="Iniciando sesión"
          >
            <ActivityIndicator size="large" color="#27AE60" />
            <Text style={styles.loadingText}>Iniciando sesión...</Text>
          </View>
        </View>
      ) : (
        // Formulario de login normal
        <View style={styles.form}>
          <Text style={styles.title}>Iniciar sesión</Text>

        <Formik
          initialValues={{ username: '', password: '' }}
          validate={validateForm}
          onSubmit={handleLogin}
        >
          {({ 
            handleChange, 
            handleBlur, 
            handleSubmit, 
            values, 
            errors, 
            isSubmitting 
          }) => (
            <>
              <View style={styles.flexColumn}>
                <Text style={styles.label}>Nombre de Usuario</Text>
              </View>
              <View style={styles.inputForm}>
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="#151717"/>
                </Svg>
                <TextInput
                  style={styles.input}
                  placeholder="Ingresa tu nombre de usuario"
                  placeholderTextColor="#B8B8B8"
                  value={values.username}
                  onChangeText={handleChange('username')}
                  onBlur={handleBlur('username')}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.flexColumn}>
                <Text style={styles.label}>Contraseña</Text>
              </View>
              <View style={styles.inputForm}>
                <Svg width={20} height={20} viewBox="-64 0 512 512">
                  <Path d="M336 512h-288c-26.453125 0-48-21.523438-48-48v-224c0-26.476562 21.546875-48 48-48h288c26.453125 0 48 21.523438 48 48v224c0 26.476562-21.546875 48-48 48zm-288-288c-8.8125 0-16 7.167969-16 16v224c0 8.832031 7.1875 16 16 16h288c8.8125 0 16-7.167969 16-16v-224c0-8.832031-7.1875-16-16-16zm0 0" fill="#151717"/>
                  <Path d="M304 224c-8.832031 0-16-7.167969-16-16v-80c0-52.929688-43.070312-96-96-96s-96 43.070312-96 96v80c0 8.832031-7.167969 16-16 16s-16-7.167969-16-16v-80c0-70.59375 57.40625-128 128-128s128 57.40625 128 128v80c0 8.832031-7.167969 16-16 16zm0 0" fill="#151717"/>
                </Svg>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Ingresa tu contraseña"
                  placeholderTextColor="#B8B8B8"
                  value={values.password}
                  onChangeText={handleChange('password')}
                  onBlur={handleBlur('password')}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.passwordToggleButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.passwordToggleText}>
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Mensaje de error */}
              {errors.general && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errors.general}</Text>
                </View>
              )}

              {/* Eliminado Recordarme y Olvidaste tu contraseña */}

              <Pressable 
                style={({ pressed }) => [
                  styles.buttonSubmit,
                  pressed && styles.buttonPressed,
                  isSubmitting && styles.buttonDisabled
                ]} 
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.buttonText}>
                  {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
                </Text>
              </Pressable>
            </>
          )}
        </Formik>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    backgroundColor: '#fff',
    padding: 30,
    width: 350,
    borderRadius: 20,
    fontFamily: 'System',
    ...createShadowStyle({
      color: '#000',
      offsetY: 4,
      opacity: 0.05,
      radius: 10,
      elevation: 4,
    }),
  },
  formDisabled: {
    opacity: 0.6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#151717',
    marginBottom: 16,
    textAlign: 'center',
  },
  flexColumn: {
    flexDirection: 'column',
    marginBottom: 4,
  },
  label: {
    color: '#151717',
    fontWeight: '600',
    marginBottom: 2,
  },
  inputForm: {
    borderWidth: 1.5,
    borderColor: '#ecedec',
    borderRadius: 10,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  input: {
    marginLeft: 10,
    borderRadius: 10,
    borderWidth: 0,
    width: '85%',
    height: '100%',
    fontSize: 16,
    color: '#2C3E50',
  },
  passwordToggleButton: {
    position: 'absolute',
    right: 15,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  passwordToggleText: {
    fontSize: 12,
    color: '#27AE60',
    fontWeight: '600',
  },
  // estilos de Recordarme y Olvidaste removidos
  buttonSubmit: {
    marginVertical: 20,
    backgroundColor: '#151717',
    borderRadius: 10,
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  p: {
    textAlign: 'center',
    color: 'black',
    fontSize: 14,
    marginVertical: 5,
  },
  pLine: {
    textAlign: 'center',
    color: 'black',
    fontSize: 14,
    marginVertical: 5,
  },
  btn: {
    flex: 1,
    marginTop: 10,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ededef',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  // checkbox removido
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorContainer: {
    marginBottom: 10,
    marginTop: -10,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'left',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
});

export default LoginScreen;