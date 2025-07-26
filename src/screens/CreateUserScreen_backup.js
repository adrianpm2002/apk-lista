// src/screens/ManageUsersScreen.js

import React, { useState, useEffect } from 'react';
import { View, Text, Alert, Modal, StyleSheet, TextInput, Button, FlatList, TouchableOpacity, Switch } from 'react-native';
import { Picker } from '../components/PickerWrapper';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';

const ManageUsersScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  const [users, setUsers] = useState([]);
  const [hierarchicalUsers, setHierarchicalUsers] = useState([]);
  const [expandedCollectors, setExpandedCollectors] = useState(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [selectedCollector, setSelectedCollector] = useState('');
  const [ganancia, setGanancia] = useState('0');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('User from auth:', user);
      if (user) {
        setCurrentUserId(user.id); // Mover aquí la asignación del currentUserId
        
        const { data, error } = await supabase
          .from('profiles')
          .select('role, id_banco')
          .eq('id', user.id)
          .single();

        console.log('Profile data:', data);
        console.log('Profile error:', error);
        
        if (data) {
          // Validar autorización
          if (data.role !== 'admin' && data.role !== 'collector') {
            Alert.alert('No Autorizado', 'Solo los administradores pueden gestionar usuarios');
            return;
          }
          
          setUserRole(data.role);
          // Si es admin (banco), su propio ID es el banco ID, si es colector usa id_banco
          const bankId = data.role === 'admin' ? user.id : data.id_banco;
          console.log('Calculated bankId:', bankId, 'for role:', data.role);
          setCurrentBankId(bankId);
        } else {
          console.error('Error cargando rol:', error);
        }
      }
    };

    fetchUserRole();
  }, []);

  useEffect(() => {
    if (currentBankId) {
      console.log('currentBankId changed, fetching users:', currentBankId);
      fetchUsers(); // Cargar usuarios cuando tengamos el banco ID
    }
  }, [currentBankId]);

  const fetchUsers = async () => {
    console.log('fetchUsers called with currentBankId:', currentBankId);
    if (!currentBankId) {
      console.log('No currentBankId, not loading users');
      return; // No cargar usuarios si no tenemos el banco ID
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, id_banco, id_collector, activo, ganancia')
      .eq('id_banco', currentBankId) // Solo usuarios del mismo banco
      .order('role', { ascending: false }) // Primero admins, luego collectors, luego listeros
      .order('username'); // Después por nombre de usuario
    
    console.log('Users query result:', { data, error });
    if (!error && data) {
      setUsers(data);
      
      // Crear estructura jerárquica
      const hierarchical = [];
      const collectors = data.filter(user => user.role === 'collector');
      const listeros = data.filter(user => user.role === 'listero');
      const admins = data.filter(user => user.role === 'admin');
      
      // Agregar admins primero
      admins.forEach(admin => {
        hierarchical.push({
          ...admin,
          type: 'user',
          level: 0
        });
      });
      
      // Agregar collectors con sus listeros
      collectors.forEach(collector => {
        // Agregar el collector
        hierarchical.push({
          ...collector,
          type: 'collector',
          level: 0,
          hasListeros: listeros.some(listero => listero.id_collector === collector.id)
        });
        
        // Si está expandido, agregar sus listeros
        if (expandedCollectors.has(collector.id)) {
          const collectorListeros = listeros.filter(listero => listero.id_collector === collector.id);
          collectorListeros.forEach(listero => {
            hierarchical.push({
              ...listero,
              type: 'listero',
              level: 1,
              parentCollector: collector.username
            });
          });
        }
      });
      
      // Agregar listeros sin collector asignado
      const orphanListeros = listeros.filter(listero => !listero.id_collector);
      orphanListeros.forEach(listero => {
        hierarchical.push({
          ...listero,
          type: 'orphan_listero',
          level: 0
        });
      });
      
      setHierarchicalUsers(hierarchical);
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

    // Validar ganancia
    const gananciaNum = parseFloat(ganancia);
    if (isNaN(gananciaNum) || gananciaNum < 0 || gananciaNum > 100) {
      Alert.alert('Error', 'La ganancia debe ser un número entre 0 y 100.');
      return;
    }

    const fakeEmail = `${username.toLowerCase()}@example.com`;

    if (isEditing && editingUser) {
      // Usar función de base de datos para actualizar tanto profiles como auth
      console.log('Actualizando usuario:', editingUser.id, 'con datos:', { username, role, selectedCollector });
      
      const { data, error } = await supabase.rpc('fn_actualizar_perfil_y_autenticacion', {
        p_usuario_id: editingUser.id,
        p_nuevo_username: username,
        p_nuevo_rol: role,
        p_nuevo_collector: selectedCollector || null,
        p_activo: editingUser.activo !== undefined ? editingUser.activo : true,
        p_ganancia: parseFloat(ganancia) || 0
      });

      if (error) {
        console.error('RPC Error:', error);
        return Alert.alert('Error al actualizar', `Error de conexión: ${error.message}`);
      }

      // Verificar si la función retornó un error en formato JSON
      if (data && typeof data === 'object') {
        console.log('Respuesta de la función:', data);
        
        if (!data.success) {
          console.error('Function Error:', data.error);
          return Alert.alert('Error al actualizar', data.message || data.error || 'Error desconocido');
        }
        
        // Si la función fue exitosa
        if (data.success) {
          console.log('Usuario actualizado exitosamente:', data);
          Alert.alert('Éxito', data.message || 'Usuario actualizado correctamente');
        }
      } else {
        // Si data no es un objeto JSON válido, asumimos éxito
        console.log('Respuesta no JSON, asumiendo éxito:', data);
        Alert.alert('Éxito', 'Usuario actualizado correctamente');
      }
    } else {
      // Verificar si ya existe un usuario con ese username
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (existingUser) {
        return Alert.alert('Error', 'Ya existe un usuario con ese nombre. Por favor elige otro nombre.');
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: fakeEmail,
        password,
      });

      if (signUpError) {
        console.error('SignUp Error:', signUpError);
        if (signUpError.message.includes('User already registered')) {
          return Alert.alert('Error', 'Ya existe un usuario con ese nombre. Por favor elige otro nombre.');
        }
        return Alert.alert('Error al registrar', signUpError.message);
      }

      const newUserId = signUpData.user?.id;

      if (newUserId) {
        // Determinar id_banco e id_collector según la jerarquía
        let id_banco = null;
        let id_collector = null;

        if (role === 'collector') {
          // Colector: id_banco = ID del admin autenticado, id_collector = null
          id_banco = currentBankId;
          id_collector = null;
        } else if (role === 'listero') {
          // Listero: id_banco = ID del admin autenticado, id_collector = ID del colector seleccionado
          id_banco = currentBankId;
          id_collector = selectedCollector;
        }
        // Los admins no se crean aquí, se crean directamente en la base de datos

        const insertData = {
          id: newUserId,
          username,
          role,
          id_banco,
          id_collector,
          ganancia: parseFloat(ganancia) || 0,
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
    console.log('handleDelete called with id:', id); // Debug log
    
    // Usar confirm nativo para web en lugar de Alert.alert
    const shouldDelete = window.confirm('¿Estás seguro de que quieres eliminar este usuario?');
    
    if (shouldDelete) {
      try {
        console.log('Attempting to delete user:', id); // Debug log
        // Usar función de base de datos para eliminar tanto profiles como auth
        const { data, error } = await supabase.rpc('delete_user_complete', {
          user_id: id
        });

        if (error) {
          console.error('Delete Error:', error);
          return Alert.alert('Error al eliminar', error.message);
        }

        // Verificar si la función retornó un error
        if (data && !data.success) {
          console.error('Function Delete Error:', data.error);
          return Alert.alert('Error al eliminar', data.message || data.error);
        }

        Alert.alert('Éxito', 'Usuario eliminado completamente');
        fetchUsers();
      } catch (error) {
        console.error('Unexpected Delete Error:', error);
        Alert.alert('Error inesperado', error.message || 'Ocurrió un problema al eliminar el usuario.');
      }
    } else {
      console.log('User cancelled deletion');
    }
  };

  // Función para activar/desactivar usuario
  const handleToggleActive = async (userId, currentStatus) => {
    const newStatus = !currentStatus;
    const action = newStatus ? 'activar' : 'desactivar';
    
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Usuario`,
      `¿Estás seguro de que quieres ${action} este usuario?${!newStatus ? ' No podrá iniciar sesión.' : ''}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: newStatus ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc('fn_toggle_usuario_activo', {
                p_usuario_id: userId,
                p_activo: newStatus
              });

              if (error) {
                console.error('Toggle Active Error:', error);
                return Alert.alert('Error', `Error al ${action} usuario: ${error.message}`);
              }

              // Verificar si la función retornó un error
              if (data && !data.success) {
                console.error('Function Toggle Error:', data.error);
                return Alert.alert('Error', data.message || data.error);
              }

              Alert.alert('Éxito', data?.message || `Usuario ${action === 'activar' ? 'activado' : 'desactivado'} correctamente`);
              fetchUsers(); // Recargar la lista
            } catch (error) {
              console.error('Unexpected Toggle Error:', error);
              Alert.alert('Error inesperado', error.message || `Ocurrió un problema al ${action} el usuario.`);
            }
          }
        }
      ]
    );
  };

  const toggleCollectorExpansion = (collectorId) => {
    const newExpanded = new Set(expandedCollectors);
    if (newExpanded.has(collectorId)) {
      newExpanded.delete(collectorId);
    } else {
      newExpanded.add(collectorId);
    }
    setExpandedCollectors(newExpanded);
    fetchUsers(); // Reconstruir la vista jerárquica
  };

  const openEditModal = (user) => {
    setIsEditing(true);
    setEditingUser(user);
    setUsername(user.username);
    setRole(user.role);
    setSelectedCollector(user.id_collector || '');
    setGanancia(user.ganancia?.toString() || '0');
    setModalVisible(true);
  };

  const clearForm = () => {
    setUsername('');
    setPassword('');
    setRole('');
    setSelectedCollector('');
    setGanancia('0');
    setIsEditing(false);
    setEditingUser(null);
  };

  return (
    <View style={styles.container}>
      {/* Header personalizado - arriba del todo */}
      <View style={styles.customHeader}>
        <SideBarToggle onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>Gestionar Usuarios</Text>
      </View>

      <View style={styles.content}>

      <Button title="Crear Usuario" onPress={() => { clearForm(); setModalVisible(true); }} />

  const renderUserItem = ({ item }) => {
    const isCollector = item.type === 'collector';
    const isListero = item.type === 'listero';
    const isExpanded = expandedCollectors.has(item.id);
    
    return (
      <View style={[
        styles.userItem,
        isListero && styles.listeroItem
      ]}>
        {/* Indicador visual para listeros */}
        {isListero && (
          <View style={styles.listeroIndicator}>
            <Text style={styles.listeroConnector}>└─</Text>
          </View>
        )}
        
        <View style={[styles.userInfo, isListero && styles.listeroInfo]}>
          {/* Header del usuario con botón expandir para collectors */}
          <View style={styles.userHeader}>
            {isCollector && item.hasListeros && (
              <TouchableOpacity 
                onPress={() => toggleCollectorExpansion(item.id)}
                style={styles.expandButton}
              >
                <Text style={styles.expandIcon}>
                  {isExpanded ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.userTitleContainer}>
              <Text style={[
                styles.userText, 
                !item.activo && styles.userTextInactive,
                isCollector && styles.collectorText,
                isListero && styles.listeroText
              ]}>
                {isCollector && '👑 '}
                {isListero && `└─ `}
                {item.username} - {item.role}
                {isListero && item.parentCollector && ` (${item.parentCollector})`}
              </Text>
              
              <Text style={[
                styles.userStatus,
                item.activo ? styles.statusActive : styles.statusInactive
              ]}>
                {item.activo ? '● Activo' : '● Inactivo'}
              </Text>
              
              <Text style={styles.userGanancia}>
                💰 Ganancia: {item.ganancia || 0}%
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.userControls}>
          {/* Switch para activar/desactivar */}
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>
              {item.activo ? 'Activo' : 'Inactivo'}
            </Text>
            <Switch
              value={item.activo}
              onValueChange={() => handleToggleActive(item.id, item.activo)}
              trackColor={{ false: '#ff6b6b', true: '#51cf66' }}
              thumbColor={item.activo ? '#2b8a3e' : '#e03131'}
            />
          </View>
          
          {/* Botones de acción */}
          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={() => openEditModal(item)} style={styles.editButton}>
              <Text style={styles.buttonText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                console.log('Delete button pressed for user:', item.id, item.username);
                handleDelete(item.id);
              }} 
              style={styles.deleteButton}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header personalizado - arriba del todo */}
      <View style={styles.customHeader}>
        <SideBarToggle onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>Gestionar Usuarios</Text>
      </View>

      <View style={styles.content}>

      <Button title="Crear Usuario" onPress={() => { clearForm(); setModalVisible(true); }} />

      <FlatList
        data={hierarchicalUsers}
        keyExtractor={(item) => `${item.id}-${item.type}`}
        renderItem={renderUserItem}
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

          <Text>Ganancia (%):</Text>
          <TextInput
            placeholder="Porcentaje de ganancia (0-100)"
            value={ganancia}
            onChangeText={setGanancia}
            keyboardType="numeric"
            style={styles.input}
          />

          <Button title={isEditing ? 'Guardar Cambios' : 'Crear Usuario'} onPress={handleCreateOrUpdate} />
          <Button title="Cancelar" color="grey" onPress={() => setModalVisible(false)} />
        </View>
      </Modal>
      </View>

      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
        role={userRole}
      />
    </View>
  );
};

export default ManageUsersScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
  },
  customHeader: {
    height: 100, // 56 + 44 para status bar
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'flex-end', // Alinear al final para que el botón esté abajo
    paddingHorizontal: 16,
    paddingBottom: 12, // Espacio desde el borde inferior
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  sidebarButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
    textAlign: 'center',
    marginRight: 44, // Para centrar el texto compensando el botón
  },
  content: {
    flex: 1,
    padding: 20,
    marginTop: 100, // Espacio para el header fijo
    backgroundColor: '#fff',
  },
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
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
    marginBottom: 5,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userInfo: {
    flex: 1,
    marginRight: 10,
  },
  userControls: {
    alignItems: 'flex-end',
    minWidth: 120,
  },
  userText: { 
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
  },
  userTextInactive: {
    color: '#95a5a6',
    textDecorationLine: 'line-through',
  },
  userStatus: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  statusActive: {
    color: '#27ae60',
  },
  statusInactive: {
    color: '#e74c3c',
  },
  userGanancia: {
    fontSize: 12,
    marginTop: 2,
    color: '#f39c12',
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 12,
    marginRight: 8,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  buttonRow: { 
    flexDirection: 'row',
    marginTop: 5,
  },
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
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Estilos para vista jerárquica
  listeroItem: {
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: '#e8e8e8',
  },
  listeroInfo: {
    paddingLeft: 10,
  },
  listeroIndicator: {
    position: 'absolute',
    left: -2,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  listeroConnector: {
    color: '#bbb',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  userTitleContainer: {
    flex: 1,
  },
  expandButton: {
    marginRight: 8,
    padding: 4,
  },
  expandIcon: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
  collectorText: {
    fontWeight: '600',
    color: '#2c3e50',
  },
  listeroText: {
    color: '#7f8c8d',
    marginLeft: 8,
  },
});
