import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../supabaseClient';

const CreateUserScreen = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [collectors, setCollectors] = useState([]);
  const [selectedCollector, setSelectedCollector] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Obtener rol del usuario logeado
  /*useEffect(() => {
    const fetchCurrentUserRole = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) return;

      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (data) {
        setCurrentUserRole(data.role);
        if (data.role === 'collector') {
          setSelectedCollector(user.id); // autoseleccionarse como colector
        }
      }
    };
    
   


    fetchCurrentUserRole();
  }, []);*/

  useEffect(() => {
  // Modo desarrollo forzando el rol a 'admin'
  setCurrentUserRole('admin');
}, []);

  // Si el rol seleccionado es listero, cargar colectores
  useEffect(() => {
    const fetchCollectors = async () => {
      if (role !== 'listero') return;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('role', 'collector');

      if (data) {
        setCollectors(data);
      }
    };

    fetchCollectors();
  }, [role]);

  const handleCreateUser = async () => {
    if (!username || !password || !role) {
      Alert.alert('Error', 'Por favor completa todos los campos.');
      return;
    }

    if (role === 'listero' && !selectedCollector) {
      Alert.alert('Error', 'Debes seleccionar un colector para el listero.');
      return;
    }

    // Crear email sintético
    const fakeEmail = `${username.toLowerCase()}@example.com`;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: fakeEmail,
      password,
    });

    if (signUpError) {
      Alert.alert('Error al crear usuario', signUpError.message);
      return;
    }

    const newUserId = signUpData.user?.id;

    if (newUserId) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: newUserId,
        username,
        role,
        assigned_collector: role === 'listero' ? selectedCollector : null,
      });

      if (profileError) {
        Alert.alert('Error al guardar perfil', profileError.message);
        return;
      }

      Alert.alert('Éxito', 'Usuario creado correctamente.');
      setUsername('');
      setPassword('');
      setRole('');
      setSelectedCollector(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear Usuario</Text>

      <TextInput
        placeholder='Nombre de usuario'
        value={username}
        onChangeText={setUsername}
        style={styles.input}
      />

      <TextInput
        placeholder='Contraseña'
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <Text style={styles.label}>Rol:</Text>
      <Picker
        selectedValue={role}
        onValueChange={(itemValue) => setRole(itemValue)}
        enabled={currentUserRole === 'admin'} // solo admin puede elegir rol
        style={styles.picker}
      >
        <Picker.Item label='Selecciona un rol' value='' />
        <Picker.Item label='Colector' value='collector' />
        <Picker.Item label='Listero' value='listero' />
      </Picker>

      {role === 'listero' && currentUserRole === 'admin' && (
        <>
          <Text style={styles.label}>Seleccionar colector:</Text>
          <Picker
            selectedValue={selectedCollector}
            onValueChange={(itemValue) => setSelectedCollector(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label='Selecciona un colector' value={null} />
            {collectors.map((col) => (
              <Picker.Item key={col.id} label={col.username} value={col.id} />
            ))}
          </Picker>
        </>
      )}

      <Button title='Crear Usuario' onPress={handleCreateUser} />
    </View>
  );
};

export default CreateUserScreen;

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 15, borderRadius: 5 },
  label: { marginBottom: 5, fontWeight: 'bold' },
  picker: { borderWidth: 1, borderColor: '#ccc', marginBottom: 15 },
  input: {
  borderWidth: 1,
  borderColor: '#ccc',
  paddingHorizontal: 10,
  paddingVertical: 12,
  marginBottom: 15,
  borderRadius: 5,
  backgroundColor: '#fff',
},
});

