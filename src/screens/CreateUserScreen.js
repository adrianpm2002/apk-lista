import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Alert, Modal, StyleSheet, TextInput, Button, FlatList, TouchableOpacity, Switch } from 'react-native';
import { Picker } from '../components/PickerWrapper';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';

const CreateUserScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
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

  const createHierarchicalStructure = useCallback((userData) => {
    const hierarchical = [];
    const collectors = userData.filter(user => user.role === 'collector');
    const listeros = userData.filter(user => user.role === 'listero');
    const admins = userData.filter(user => user.role === 'admin');
    
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
      const collectorListeros = listeros.filter(listero => listero.id_collector === collector.id);
      
      hierarchical.push({
        ...collector,
        type: 'collector',
        level: 0,
        hasListeros: collectorListeros.length > 0,
        isExpanded: expandedCollectors.has(collector.id)
      });
      
      if (expandedCollectors.has(collector.id)) {
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
  }, [expandedCollectors]);

  const fetchUsers = useCallback(async () => {
    if (!currentBankId) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, id_banco, id_collector, activo, ganancia')
      .eq('id_banco', currentBankId)
      .order('role', { ascending: false })
      .order('username');
    
    if (!error && data) {
      setUsers(data);
      createHierarchicalStructure(data);
    }
  }, [currentBankId, createHierarchicalStructure]);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('role, id_banco')
          .eq('id', user.id)
          .single();
        
        if (data) {
          if (data.role !== 'admin' && data.role !== 'collector') {
            Alert.alert('No Autorizado', 'Solo los administradores pueden gestionar usuarios');
            return;
          }
          
          setUserRole(data.role);
          const bankId = data.role === 'admin' ? user.id : data.id_banco;
          setCurrentBankId(bankId);
        } else if (error) {
          console.error('Error cargando rol:', error);
        }
      }
    };

    fetchUserRole();
  }, []);

  useEffect(() => {
    if (currentBankId) {
      fetchUsers();
    }
  }, [currentBankId, fetchUsers]);

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

      const gananciaNum = parseFloat(ganancia);
      if (isNaN(gananciaNum) || gananciaNum < 0 || gananciaNum > 100) {
        Alert.alert('Error', 'La ganancia debe ser un número entre 0 y 100.');
        return;
      }

      const fakeEmail = `${username.toLowerCase()}@example.com`;

      if (isEditing && editingUser) {
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

        if (data && typeof data === 'object') {
          if (!data.success) {
            console.error('Function Error:', data.error);
            return Alert.alert('Error al actualizar', data.message || data.error || 'Error desconocido');
          }
          
          if (data.success) {
            Alert.alert('Éxito', data.message || 'Usuario actualizado correctamente');
          }
        } else {
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
          let id_banco = null;
          let id_collector = null;

          if (role === 'collector') {
            id_banco = currentBankId;
            id_collector = null;
          } else if (role === 'listero') {
            id_banco = currentBankId;
            id_collector = selectedCollector;
          }

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

  const handleDelete = useCallback(async (id) => {
    const shouldDelete = window.confirm('¿Estás seguro de que quieres eliminar este usuario?');
    
    if (shouldDelete) {
      try {
        const { data, error } = await supabase.rpc('delete_user_complete', {
          user_id: id
        });

        if (error) {
          console.error('Delete Error:', error);
          return Alert.alert('Error al eliminar', error.message);
        }

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
    }
  }, []);

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

              if (data && !data.success) {
                console.error('Function Toggle Error:', data.error);
                return Alert.alert('Error', data.message || data.error);
              }

              Alert.alert('Éxito', data?.message || `Usuario ${action === 'activar' ? 'activado' : 'desactivado'} correctamente`);
              fetchUsers();
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
    // Solo recrear estructura si hay datos
    if (users.length > 0) {
      createHierarchicalStructure(users);
    }
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

  // Optimizar filtros con useMemo
  const collectors = useMemo(() => 
    users.filter(u => u.role === 'collector'), 
    [users]
  );

  const clearForm = () => {
    setUsername('');
    setPassword('');
    setRole('');
    setSelectedCollector('');
    setGanancia('0');
    setIsEditing(false);
    setEditingUser(null);
  };

  const renderUserItem = ({ item }) => {
    const isCollector = item.type === 'collector';
    const isListero = item.type === 'listero';
    const isExpanded = expandedCollectors.has(item.id);
    
    return (
      <View style={[
        styles.userItem,
        isListero && styles.listeroItem
      ]}>
        {isListero && (
          <Text style={styles.listeroConnector}>└─</Text>
        )}
        
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
        
        <View style={[styles.userInfo, isListero && styles.listeroInfo]}>
          <Text style={[
            styles.userText, 
            !item.activo && styles.userTextInactive,
            isCollector && styles.collectorText,
            isListero && styles.listeroText
          ]}>
            {isCollector && '👑 '}
            {isListero && `   `}
            {item.username} - {item.role}
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
        
        <View style={styles.userControls}>
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
          
          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={() => openEditModal(item)} style={styles.editButton}>
              <Text style={styles.buttonText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleDelete(item.id)} 
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
                  {collectors.map((col) => (
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

export default CreateUserScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
  },
  customHeader: {
    height: 100,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    marginRight: 44,
  },
  content: {
    flex: 1,
    padding: 20,
    marginTop: 100,
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
    borderBottomColor: '#e8e8e8',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginVertical: 2,
  },
  listeroItem: {
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: '#3498db',
    backgroundColor: '#f8f9fa',
  },
  listeroConnector: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  userInfo: {
    flex: 1,
  },
  listeroInfo: {
    paddingLeft: 10,
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
  userText: { 
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
  },
  userTextInactive: {
    color: '#95a5a6',
    textDecorationLine: 'line-through',
  },
  collectorText: {
    fontWeight: '600',
    color: '#2c3e50',
  },
  listeroText: {
    color: '#7f8c8d',
    fontWeight: '400',
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
  userControls: {
    alignItems: 'center',
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
  buttonText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 12,
  },
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
