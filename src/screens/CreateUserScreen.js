// src/screens/ManageUsersScreen.js

import React, { useState, useEffect } from 'react';
import { View, Text, Alert, Modal, StyleSheet, TextInput, Button, FlatList, TouchableOpacity } from 'react-native';
import { Picker } from '../components/PickerWrapper';
import { supabase } from '../supabaseClient';

const ManageUsersScreen = ({ isDarkMode }) => {
  const [users, setUsers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [collectors, setCollectors] = useState([]);
  const [selectedCollector, setSelectedCollector] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error) setUsers(data);
  };

  const fetchCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error || data.role !== 'collector') {
      Alert.alert('No Autorizado', 'Solo los administradores pueden gestionar usuarios');
      // Redirigir o bloquear la funcionalidad
    }
    setCurrentUserId(user.id);
  }
};

  const handleCreateOrUpdate = async () => {
  try {
    if (!username || (!isEditing && !password) || !role) {
      Alert.alert('Error', 'Todos los campos son obligatorios.');
      return;
    }

    if (username.includes('@')) {
      Alert.alert('Error', 'El nombre de usuario no debe contener "@".');
      return;
    }

    if (role === 'listero' && !selectedCollector) {
      Alert.alert('Error', 'Debes seleccionar un colector.');
      return;
    }

    const fakeEmail = `${username.toLowerCase()}@example.com`;

    if (isEditing && editingUser) {
      const { error } = await supabase
        .from('profiles')
        .update({
          username,
          role,
          assigned_collector: selectedCollector || null,
        })
        .eq('id', editingUser.id);

      if (error) {
        console.error('Update Error:', error);
        return Alert.alert('Error al actualizar', error.message);
      }

      Alert.alert('Éxito', 'Usuario actualizado');
    } else {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: fakeEmail,
        password,
      });

      if (signUpError) {
        console.error('SignUp Error:', signUpError);
        return Alert.alert('Error al registrar', signUpError.message);
      }

      const newUserId = signUpData.user?.id;

      if (newUserId) {
        const insertData = {
          id: newUserId,
          username,
          role,
          created_by: currentUserId,
          assigned_collector: role === 'listero' ? selectedCollector : null,
        };

        const { error: insertError } = await supabase
          .from('profiles')
          .insert(insertData, { returning: 'minimal' });

        if (insertError) {
          console.error('Insert Error:', insertError);
          // Eliminar el usuario de auth si falla el insert
          await supabase.auth.admin.deleteUser(newUserId);
          return Alert.alert('Error al guardar perfil', insertError.message);
        }

        Alert.alert('Éxito', 'Usuario creado');
      }
    }

    setModalVisible(false);
    clearForm();
    fetchUsers();
  } catch (error) {
    console.error('Unexpected Error:', error);
    Alert.alert('Error inesperado', error.message || 'Ocurrió un problema inesperado.');
  }
};


  const handleDelete = async (id) => {
    Alert.alert('Confirmar', '¿Eliminar este usuario?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('profiles').delete().eq('id', id);
          if (error) return Alert.alert('Error', error.message);
          fetchUsers();
        },
      },
    ]);
  };

  const openEditModal = (user) => {
    setIsEditing(true);
    setEditingUser(user);
    setUsername(user.username);
    setRole(user.role);
    setSelectedCollector(user.assigned_collector || '');
    setModalVisible(true);
  };

  const clearForm = () => {
    setUsername('');
    setPassword('');
    setRole('');
    setSelectedCollector('');
    setIsEditing(false);
    setEditingUser(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestión de Usuarios</Text>

      <Button title="Crear Usuario" onPress={() => { clearForm(); setModalVisible(true); }} />

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.userItem}>
            <Text style={styles.userText}>{item.username} - {item.role}</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={() => openEditModal(item)} style={styles.editButton}>
                <Text style={styles.buttonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
                <Text style={styles.buttonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{isEditing ? 'Editar Usuario' : 'Crear Usuario'}</Text>

          <TextInput
            placeholder="Nombre de usuario"
            value={username}
            onChangeText={setUsername}
            style={styles.input}
          />

          {!isEditing && (
            <TextInput
              placeholder="Contraseña"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
          )}

          <Text>Rol:</Text>
          <Picker
            selectedValue={role}
            onValueChange={setRole}
            style={styles.picker}
          >
            <Picker.Item label="Selecciona un rol" value="" />
            <Picker.Item label="Colector" value="collector" />
            <Picker.Item label="Listero" value="listero" />
          </Picker>

          {role === 'listero' && (
            <>
              <Text>Seleccionar colector:</Text>
              <Picker
                selectedValue={selectedCollector}
                onValueChange={setSelectedCollector}
                style={styles.picker}
              >
                <Picker.Item label="Selecciona un colector" value="" />
                {users.filter(u => u.role === 'collector').map((col) => (
                  <Picker.Item key={col.id} label={col.username} value={col.id} />
                ))}
              </Picker>
            </>
          )}

          <Button title={isEditing ? 'Guardar Cambios' : 'Crear Usuario'} onPress={handleCreateOrUpdate} />
          <Button title="Cancelar" color="grey" onPress={() => setModalVisible(false)} />
        </View>
      </Modal>
    </View>
  );
};

export default ManageUsersScreen;

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginBottom: 15,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  userItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  userText: { fontSize: 16 },
  buttonRow: { flexDirection: 'row' },
  editButton: {
    backgroundColor: '#3498db',
    padding: 8,
    borderRadius: 5,
    marginRight: 10,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    padding: 8,
    borderRadius: 5,
  },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  modalContent: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FDF5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});
