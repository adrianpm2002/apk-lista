import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { Formik } from 'formik';
import { supabase } from '../supabaseClient';
import Svg, { Path, G } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen({ navigation }) {
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

      const email = `${username.toLowerCase()}@example.com`;

      const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        // Verificar si el usuario existe
        const { data: userExists } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .maybeSingle();

        if (!userExists) {
          setFieldError('general', 'El usuario no existe.');
        } else {
          setFieldError('general', 'Credenciales incorrectas.');
        }
        setSubmitting(false);
        return;
      }

      const userId = authData.user?.id;

      if (!userId) {
        setFieldError('general', 'Error interno del sistema.');
        setSubmitting(false);
        return;
      }

      // Obtener rol y estado activo del perfil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, activo')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profile) {
        setFieldError('general', 'Error al obtener el perfil del usuario.');
        setSubmitting(false);
        return;
      }

      // Verificar si el usuario está activo
      if (profile.activo === false) {
        // Cerrar sesión inmediatamente si el usuario está inactivo
        await supabase.auth.signOut();
        setFieldError('general', 'Cuenta desactivada, contacte con su administrador.');
        setSubmitting(false);
        return;
      }

      const userRole = profile.role;

      // Navegación basada en rol
      if (userRole === 'admin') {
        navigation.navigate('Statistics');
      } else if (userRole === 'collector') {
        navigation.navigate('MainApp');
      } else if (userRole === 'listero') {
        navigation.navigate('MainApp');
      } else {
        setFieldError('general', 'Rol de usuario no reconocido.');
      }
      
      setSubmitting(false);
    } catch (error) {
      console.error('Login error:', error);
      setFieldError('general', 'Error inesperado. Inténtalo de nuevo.');
      setSubmitting(false);
    }
  };


  return (
    <View style={styles.container}>
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
                  style={styles.input}
                  placeholder="Ingresa tu contraseña"
                  placeholderTextColor="#B8B8B8"
                  value={values.password}
                  onChangeText={handleChange('password')}
                  onBlur={handleBlur('password')}
                  secureTextEntry
                />
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
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.05)',
    } : {
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 4,
    }),
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
});