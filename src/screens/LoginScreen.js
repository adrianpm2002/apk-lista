import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { supabase } from '../supabaseClient';
import Svg, { Path, G } from 'react-native-svg';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
  if (!email || !password) {
    Alert.alert('Error', 'Por favor ingresa email y contraseña');
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    Alert.alert('Error de autenticación', 'Usuario o contraseña incorrectos');
    return;
  }

  navigation.navigate('VisualMode');
};

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>Iniciar sesión</Text>

        <View style={styles.flexColumn}>
          <Text style={styles.label}>Email</Text>
        </View>
        <View style={styles.inputForm}>
          <Svg width={20} height={20} viewBox="0 0 32 32">
            <G>
              <Path d="M30.853 13.87a15 15 0 0 0 -29.729 4.082 15.1 15.1 0 0 0 12.876 12.918 15.6 15.6 0 0 0 2.016.13 14.85 14.85 0 0 0 7.715-2.145 1 1 0 1 0 -1.031-1.711 13.007 13.007 0 1 1 5.458-6.529 2.149 2.149 0 0 1 -4.158-.759v-10.856a1 1 0 0 0 -2 0v1.726a8 8 0 1 0 .2 10.325 4.135 4.135 0 0 0 7.83.274 15.2 15.2 0 0 0 .823-7.455zm-14.853 8.13a6 6 0 1 1 6-6 6.006 6.006 0 0 1 -6 6z" fill="#151717"/>
            </G>
          </Svg>
          <TextInput
            style={styles.input}
            placeholder="Ingresa tu email"
            placeholderTextColor="#B8B8B8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
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
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <View style={styles.flexRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable style={styles.checkbox} />
            <Text style={styles.remember}>Recordarme</Text>
          </View>
          <Text style={styles.span}>¿Olvidaste tu contraseña?</Text>
        </View>

        <Pressable 
          style={({ pressed }) => [
            styles.buttonSubmit,
            pressed && styles.buttonPressed
          ]} 
          onPress={handleLogin}
        >
          <Text style={styles.buttonText}>Iniciar sesión</Text>
        </Pressable>

        
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
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
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
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  remember: {
    fontSize: 14,
    color: 'black',
    fontWeight: '400',
    marginLeft: 5,
  },
  span: {
    fontSize: 14,
    color: '#2d79f3',
    fontWeight: '500',
  },
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
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#ecedec',
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});