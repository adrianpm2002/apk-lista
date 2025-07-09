import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Animaciones para los campos
  const usernameAnimation = useRef(new Animated.Value(1)).current;
  const passwordAnimation = useRef(new Animated.Value(1)).current;

  const animateField = (animation, isFocused) => {
    Animated.timing(animation, {
      toValue: isFocused ? 1.05 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleUsernameFocus = () => {
    setIsUsernameFocused(true);
    animateField(usernameAnimation, true);
  };

  const handleUsernameBlur = () => {
    setIsUsernameFocused(false);
    animateField(usernameAnimation, false);
  };

  const handlePasswordFocus = () => {
    setIsPasswordFocused(true);
    animateField(passwordAnimation, true);
  };

  const handlePasswordBlur = () => {
    setIsPasswordFocused(false);
    animateField(passwordAnimation, false);
  };

  const handleLogin = () => {
    // Aquí puedes agregar tu lógica de autenticación
    console.log('Login:', { username, password });
    navigation.navigate('Home');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Bienvenido</Text>
            <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Campo de usuario */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Usuario</Text>
              <Animated.View
                style={[
                  styles.inputContainer,
                  isUsernameFocused && styles.inputContainerFocused,
                  { transform: [{ scale: usernameAnimation }] },
                ]}>
                <TextInput
                  style={styles.input}
                  placeholder="Ingresa tu usuario"
                  placeholderTextColor="#B8B8B8"
                  value={username}
                  onChangeText={setUsername}
                  onFocus={handleUsernameFocus}
                  onBlur={handleUsernameBlur}
                  autoCapitalize="none"
                />
              </Animated.View>
            </View>

            {/* Campo de contraseña */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Contraseña</Text>
              <Animated.View
                style={[
                  styles.inputContainer,
                  isPasswordFocused && styles.inputContainerFocused,
                  { transform: [{ scale: passwordAnimation }] },
                ]}>
                <TextInput
                  style={styles.input}
                  placeholder="Ingresa tu contraseña"
                  placeholderTextColor="#B8B8B8"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={handlePasswordFocus}
                  onBlur={handlePasswordBlur}
                  secureTextEntry
                />
              </Animated.View>
            </View>

            {/* Botón de login */}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              activeOpacity={0.8}>
              <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
            </TouchableOpacity>

            {/* Enlaces adicionales */}
            <View style={styles.linksContainer}>
              <TouchableOpacity>
                <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495E',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainerFocused: {
    borderColor: '#A8DADC',
    shadowColor: '#A8DADC',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#2C3E50',
  },
  loginButton: {
    backgroundColor: '#A8DADC',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#A8DADC',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#2C3E50',
    fontSize: 16,
    fontWeight: '600',
  },
  linksContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  linkText: {
    color: '#7F8C8D',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;
