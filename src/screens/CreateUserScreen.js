import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Alert, Modal, StyleSheet, TextInput, Button, FlatList, TouchableOpacity, Switch, Platform } from 'react-native';
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
  // Eliminado campo de ganancia en creación/edición: el listero la elegirá luego en su propia vista
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);
  const [updatingUsers, setUpdatingUsers] = useState(new Set()); // Para tracking de actualizaciones

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
      console.log('Usuarios cargados:', data);
      setUsers(data);
      createHierarchicalStructure(data);
    } else if (error) {
      console.error('Error fetching users:', error);
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

  // Recrear estructura jerárquica cuando cambien los usuarios
  useEffect(() => {
    if (users.length > 0) {
      createHierarchicalStructure(users);
    }
  }, [users, createHierarchicalStructure]);

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
        const { data, error } = await supabase.rpc('update_user_profile_and_auth', {
          user_id: editingUser.id,
          new_username: username,
          new_role: role,
          new_assigned_collector: selectedCollector || null,
          new_ganancia: null, // La ganancia será elegida posteriormente por el listero
          new_activo: editingUser.activo !== undefined ? editingUser.activo : true
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
        const { data: existingUsers, error: checkError } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username);

        if (checkError) {
          console.error('Check Error:', checkError);
          return Alert.alert('Error', 'Error al verificar usuario existente');
        }

        if (existingUsers && existingUsers.length > 0) {
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
          }; // sin ganancia; el listero la fijará después

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

  const handleDelete = useCallback((id) => {
    const executeDeletion = async () => {
      // Eliminación optimista local
      setUsers(prev => {
        const toDelete = prev.find(u => u.id === id);
        const filtered = prev.filter(u => u.id !== id);
        // Si era colector y el backend también elimina/ajusta listeros, dejamos que fetch sincronice.
        // Si no, esos listeros quedarán como huérfanos tras fetch si siguen existiendo.
        return filtered;
      });
      // Si estaba expandido quitarlo
      setExpandedCollectors(prev => {
        if (prev.has(id)) {
          const n = new Set(prev);
            n.delete(id);
            return n;
        }
        return prev;
      });
      // Recalcular estructura rápidamente con el estado actualizado (esperar siguiente tick)
      setTimeout(() => {
        createHierarchicalStructure(
          (prevUsersRef => prevUsersRef)(users.filter(u => u.id !== id))
        );
      }, 0);

      try {
        const { data, error } = await supabase.rpc('delete_user_complete', { user_id: id });
        if (error) throw error;
        if (data && data.success === false) {
          throw new Error(data.message || data.error || 'Fallo al eliminar');
        }
      } catch (e) {
        console.error('Delete Error:', e);
        Alert.alert('Error', e.message || 'No se pudo eliminar. Refrescando.');
        // Re-sincronizar lista real
      } finally {
        fetchUsers();
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar definitivamente este usuario?')) {
        executeDeletion();
      }
    } else {
      Alert.alert(
        'Eliminar Usuario',
        '¿Eliminar definitivamente este usuario?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: executeDeletion }
        ]
      );
    }
  }, [users, fetchUsers, createHierarchicalStructure]);

  const handleToggleActive = async (userId, currentStatus) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const newStatus = !currentStatus;
    const action = newStatus ? 'activar' : 'desactivar';
    const isCollector = targetUser.role === 'collector';
    const isListero = targetUser.role === 'listero';

    // Bloqueo: no permitir activar listero si su colector está inactivo
    if (isListero && newStatus) {
      const parentCollector = users.find(u => u.id === targetUser.id_collector);
      if (parentCollector && parentCollector.activo === false) {
        Alert.alert('Acción no permitida', 'No puedes activar un listero cuyo colector está inactivo.');
        return;
      }
    }

    console.log(`handleToggleActive -> userId: ${userId} (${targetUser.role}) -> ${currentStatus} => ${newStatus}`);

    // IDs afectados (cascade si colector)
    let affectedIds = [userId];
    if (isCollector) {
      const collectorListeros = users.filter(u => u.id_collector === userId && u.role === 'listero');
      affectedIds = [userId, ...collectorListeros.map(l => l.id)];
    }

    // Marcar todos como en actualización
    setUpdatingUsers(prev => new Set([...prev, ...affectedIds]));

    // Actualización local optimista
    setUsers(prev => prev.map(u => (
      affectedIds.includes(u.id) ? { ...u, activo: newStatus } : u
    )));

    try {
      if (isCollector) {
        // Actualizar colector y listeros vinculados en cascada
        const { error: cascadeError } = await supabase
          .from('profiles')
          .update({ activo: newStatus })
          .in('id', affectedIds);

        if (cascadeError) throw cascadeError;
        console.log(`Colector y ${affectedIds.length - 1} listeros ${action}ados`);
      } else {
        // Actualización simple para listero / admin
        const { error: singleError } = await supabase
          .from('profiles')
          .update({ activo: newStatus })
          .eq('id', userId);
        if (singleError) throw singleError;
        console.log(`Usuario ${action}ado`);
      }
    } catch (err) {
      console.error('Error toggle activo:', err);
      Alert.alert('Error', `No se pudo ${action} el usuario: ${err.message}`);
      // Revertir local
      setUsers(prev => prev.map(u => (
        affectedIds.includes(u.id) ? { ...u, activo: currentStatus } : u
      )));
      fetchUsers();
    } finally {
      // Limpiar updating set
      setUpdatingUsers(prev => {
        const newSet = new Set(prev);
        affectedIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
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
  // ganancia eliminada del formulario
    setIsEditing(false);
    setEditingUser(null);
  };

  const renderUserItem = ({ item }) => {
    const isCollector = item.type === 'collector';
    const isListero = item.type === 'listero';
    const isExpanded = expandedCollectors.has(item.id);
    const isUpdating = updatingUsers.has(item.id);
  const parentCollectorInactive = isListero && item.id_collector ? (users.find(u => u.id === item.id_collector)?.activo === false) : false;
    
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
            {item.username} - {item.role === 'collector' ? 'colector' : item.role}
          </Text>
          
          <Text style={[
            styles.userStatus,
            item.activo ? styles.statusActive : styles.statusInactive
          ]}>
            {item.activo ? '● Activo' : '● Inactivo'}
            {isUpdating && ' (Actualizando...)'}
          </Text>
          
          {isListero && (
            <Text style={styles.userGanancia}>
              {(() => {
                const g = item.ganancia;
                if (g === null || g === undefined) return '💰 Ganancia: no seleccionada';
                if (typeof g === 'string' && g.trim() === '') return '💰 Ganancia: no seleccionada';
                return `💰 Ganancia: ${g}`; // ya no es porcentaje, se muestra tal cual
              })()}
            </Text>
          )}
        </View>
        
        <View style={styles.userControls}>
          {parentCollectorInactive ? (
            <View style={[styles.switchContainer, styles.blockedContainer]}>
              <Text style={styles.blockedBadge}>Colector inactivo</Text>
            </View>
          ) : (
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>
                {item.activo ? 'Activo' : 'Inactivo'}
              </Text>
              <Switch
                value={item.activo}
                disabled={isUpdating}
                onValueChange={() => {
                  console.log(`Cambiando estado de ${item.username} de ${item.activo} a ${!item.activo}`);
                  handleToggleActive(item.id, item.activo);
                }}
                trackColor={{ false: '#ff6b6b', true: '#51cf66' }}
                thumbColor={item.activo ? '#2b8a3e' : '#e03131'}
              />
            </View>
          )}
          
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

            {/* Campo de ganancia removido: el listero lo configurará después en su propia interfaz */}

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
  blockedContainer: {
    backgroundColor: '#fff5f5',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  blockedBadge: {
    color: '#e03131',
    fontSize: 11,
    fontWeight: '600',
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
