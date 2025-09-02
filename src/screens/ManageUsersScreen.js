import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { useCache } from '../contexts/CacheContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import ScreenWrapper from '../components/ScreenWrapper';
import DropdownPicker from '../components/DropdownPicker';
import { createShadowStyle } from '../utils/shadowUtils';

const ManageUsersScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  return (
    <ScreenWrapper>
      <ManageUsersContent
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
      />
    </ScreenWrapper>
  );
};

const ManageUsersContent = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  // ========== CACHE-FIRST OPTIMIZATION ==========
  const { 
    cache, 
    userRole: cacheUserRole, 
    currentBankId: cacheBankId, 
    updateCacheData, 
    fetchUsers: cacheFetchUsers 
  } = useCache();
  
  const { refreshing: cacheRefreshing, onRefresh: cacheOnRefresh } = usePullToRefresh('users');
  
  // ========== STATES ==========
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [users, setUsers] = useState(cache.users || []);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!(cache.users && cache.users.length > 0));
  
  // Estados para formulario
  const [newUser, setNewUser] = useState({
    usuario: '',
    contrasena: '',
    role: 'colector'
  });
  
  const [editingUser, setEditingUser] = useState({
    id: '',
    usuario: '',
    contrasena: '',
    role: 'colector',
    activo: true
  });

  // ========== CACHE SYNCHRONIZATION ==========
  useEffect(() => {
    if (cache.users) {
      setUsers(cache.users);
    }
  }, [cache.users]);

  // ========== DATA FETCHING ==========
  const fetchUsersFromCache = async () => {
    if (!cacheBankId) {
      console.log('No bank ID available for fetching users');
      setInitialLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      await cacheFetchUsers();
      setInitialLoading(false);
    } catch (error) {
      console.error('Error fetching users from cache:', error);
      setInitialLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchUsersFromCache();
  };

  // ========== FOCUS REFRESH ==========
  const focusRefresh = useCallback(() => {
    if (cacheBankId && cacheUserRole === 'admin') {
      fetchUsersFromCache();
    }
  }, [cacheBankId, cacheUserRole]);

  useFocusEffect(
    useCallback(() => {
      focusRefresh();
    }, [focusRefresh])
  );

  // ========== USER MANAGEMENT FUNCTIONS ==========
  const validateUserData = (userData, isEdit = false) => {
    // Validar que no haya espacios en usuario
    if (userData.usuario.includes(' ')) {
      Alert.alert('Error', 'El nombre de usuario no puede contener espacios');
      return false;
    }
    
    // Validar que no haya espacios en contraseña (solo si no está vacía en edición)
    if (userData.contrasena && userData.contrasena.includes(' ')) {
      Alert.alert('Error', 'La contraseña no puede contener espacios');
      return false;
    }
    
    // Validaciones adicionales
    if (!userData.usuario.trim()) {
      Alert.alert('Error', 'El nombre de usuario es requerido');
      return false;
    }
    
    if (!isEdit && !userData.contrasena.trim()) {
      Alert.alert('Error', 'La contraseña es requerida');
      return false;
    }
    
    return true;
  };

  const handleAddUser = async () => {
    if (!validateUserData(newUser)) {
      return;
    }

    if (!cacheBankId) {
      Alert.alert('Error', 'No se puede determinar el banco actual');
      return;
    }

    try {
      setLoading(true);
      
      // Verificar si el usuario ya existe
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('usuario')
        .eq('usuario', newUser.usuario.trim())
        .eq('id_banco', cacheBankId)
        .single();

      if (existingUser) {
        Alert.alert('Error', 'Ya existe un usuario con ese nombre');
        setLoading(false);
        return;
      }

      // Crear usuario en auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: `${newUser.usuario.trim()}@${cacheBankId}.local`,
        password: newUser.contrasena,
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        Alert.alert('Error', 'No se pudo crear el usuario');
        setLoading(false);
        return;
      }

      // Crear perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            usuario: newUser.usuario.trim(),
            role: newUser.role,
            id_banco: cacheBankId,
            activo: true
          }
        ]);

      if (profileError) {
        console.error('Error creating profile:', profileError);
        Alert.alert('Error', 'No se pudo crear el perfil del usuario');
        setLoading(false);
        return;
      }

      Alert.alert('Éxito', 'Usuario creado correctamente');
      setModalVisible(false);
      setNewUser({ usuario: '', contrasena: '', role: 'colector' });
      await fetchUsersFromCache();
      
    } catch (error) {
      console.error('Error general creating user:', error);
      Alert.alert('Error', 'Error general al crear el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!validateUserData(editingUser, true)) {
      return;
    }

    try {
      setLoading(true);
      
      const updateData = {
        usuario: editingUser.usuario.trim(),
        role: editingUser.role,
        activo: editingUser.activo
      };

      // Si se proporciona nueva contraseña, actualizarla
      if (editingUser.contrasena) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: editingUser.contrasena
        });

        if (passwordError) {
          console.error('Error updating password:', passwordError);
          Alert.alert('Error', 'No se pudo actualizar la contraseña');
          setLoading(false);
          return;
        }
      }

      // Actualizar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', editingUser.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        Alert.alert('Error', 'No se pudo actualizar el perfil del usuario');
        setLoading(false);
        return;
      }

      Alert.alert('Éxito', 'Usuario actualizado correctamente');
      setEditModalVisible(false);
      setEditingUser({ id: '', usuario: '', contrasena: '', role: 'colector', activo: true });
      await fetchUsersFromCache();
      
    } catch (error) {
      console.error('Error general updating user:', error);
      Alert.alert('Error', 'Error general al actualizar el usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de que deseas eliminar al usuario "${username}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Eliminar perfil (el auth user se puede mantener inactivo)
              const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

              if (error) {
                console.error('Error deleting user:', error);
                Alert.alert('Error', 'No se pudo eliminar el usuario');
                return;
              }

              Alert.alert('Éxito', 'Usuario eliminado correctamente');
              await fetchUsersFromCache();
              
            } catch (error) {
              console.error('Error general deleting user:', error);
              Alert.alert('Error', 'Error general al eliminar el usuario');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleEditUser = (user) => {
    setEditingUser({
      id: user.id,
      usuario: user.usuario || '',
      contrasena: '',
      role: user.role || 'colector',
      activo: user.activo !== false
    });
    setEditModalVisible(true);
  };

  const handleToggleUserStatus = async (user) => {
    try {
      setLoading(true);
      
      const newStatus = !user.activo;
      
      const { error } = await supabase
        .from('profiles')
        .update({ activo: newStatus })
        .eq('id', user.id);

      if (error) {
        console.error('Error toggling user status:', error);
        Alert.alert('Error', 'No se pudo cambiar el estado del usuario');
        return;
      }

      Alert.alert('Éxito', `Usuario ${newStatus ? 'activado' : 'desactivado'} correctamente`);
      await fetchUsersFromCache();
      
    } catch (error) {
      console.error('Error general toggling user status:', error);
      Alert.alert('Error', 'Error general al cambiar el estado del usuario');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar espacios automáticamente en inputs
  const handleUserInputChange = (field, text) => {
    const cleanText = text.replace(/\s/g, ''); // Remover todos los espacios
    setNewUser({ ...newUser, [field]: cleanText });
  };

  const handleEditInputChange = (field, text) => {
    const cleanText = text.replace(/\s/g, ''); // Remover todos los espacios
    setEditingUser({ ...editingUser, [field]: cleanText });
  };

  const handleChangePassword = (user) => {
    Alert.alert(
      'Cambiar Contraseña',
      `¿Deseas cambiar la contraseña del usuario "${user.usuario}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cambiar', 
          onPress: () => {
            // Aquí puedes implementar la lógica para cambiar contraseña
            // Por ejemplo, abrir un modal específico para cambio de contraseña
            Alert.alert('Info', 'Funcionalidad de cambio de contraseña por implementar');
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#F8FDF5' }]}>
      {/* Header personalizado */}
      <View style={[styles.customHeader, { backgroundColor: isDarkMode ? '#2c3e50' : '#F8F9FA' }]}>
        <SideBarToggle 
          inline 
          onToggle={() => setSidebarVisible(!sidebarVisible)} 
          style={styles.sidebarButton} 
        />
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
          Usuarios
        </Text>
        {cacheUserRole === 'admin' && (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: isDarkMode ? '#27ae60' : '#2ecc71' }]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.addButtonText}>➕ Agregar</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={cacheRefreshing || loading}
            onRefresh={cacheOnRefresh}
            colors={[isDarkMode ? '#3498db' : '#2ecc71']}
            tintColor={isDarkMode ? '#3498db' : '#2ecc71'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {initialLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: isDarkMode ? '#bdc3c7' : '#7f8c8d' }]}>
              Cargando usuarios...
            </Text>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: isDarkMode ? '#bdc3c7' : '#7f8c8d' }]}>
              No hay usuarios registrados
            </Text>
          </View>
        ) : (
          users.map((user) => (
            <View key={user.id} style={[styles.userCard, { backgroundColor: isDarkMode ? '#2c3e50' : '#fff' }]}>
              {/* Nombre de usuario y rol en línea completa */}
              <View style={styles.userNameContainer}>
                <Text 
                  style={[styles.username, { color: isDarkMode ? '#ecf0f1' : '#2c3e50' }]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {user.usuario}
                </Text>
                <Text style={[styles.userRole, { color: isDarkMode ? '#bdc3c7' : '#7f8c8d' }]}>
                  {user.role === 'admin' ? 'Administrador' : 'Colector'} • {user.activo ? 'Habilitado' : 'Deshabilitado'}
                </Text>
              </View>
              
              {/* Botones de acción organizados en filas */}
              {cacheUserRole === 'admin' && (
                <View style={styles.userActions}>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => handleEditUser(user)}
                    >
                      <Text style={styles.actionButtonText}>✏️ Editar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.actionButton, 
                        user.activo ? styles.deactivateButton : styles.activateButton
                      ]}
                      onPress={() => handleToggleUserStatus(user)}
                    >
                      <Text style={styles.actionButtonText}>
                        {user.activo ? '🔒 Deshabilitar' : '� Habilitar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteUser(user.id, user.usuario)}
                    >
                      <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.actionButton, styles.passwordButton]}
                      onPress={() => handleChangePassword(user)}
                    >
                      <Text style={styles.actionButtonText}>🔑 Contraseña</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal para agregar usuario */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? '#2c3e50' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                Agregar Usuario
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.inputLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                Nombre de Usuario:
              </Text>
              <TextInput
                style={[
                  styles.input, 
                  { 
                    backgroundColor: isDarkMode ? '#34495e' : '#fff',
                    color: isDarkMode ? '#fff' : '#000',
                    borderColor: isDarkMode ? '#555' : '#ddd'
                  }
                ]}
                placeholder="Ingrese el nombre de usuario"
                placeholderTextColor={isDarkMode ? '#bdc3c7' : '#7f8c8d'}
                value={newUser.usuario}
                onChangeText={(text) => handleUserInputChange('usuario', text)}
                autoCapitalize="none"
              />

              <Text style={[styles.inputLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                Contraseña:
              </Text>
              <TextInput
                style={[
                  styles.input, 
                  { 
                    backgroundColor: isDarkMode ? '#34495e' : '#fff',
                    color: isDarkMode ? '#fff' : '#000',
                    borderColor: isDarkMode ? '#555' : '#ddd'
                  }
                ]}
                placeholder="Ingrese la contraseña"
                placeholderTextColor={isDarkMode ? '#bdc3c7' : '#7f8c8d'}
                value={newUser.contrasena}
                onChangeText={(text) => handleUserInputChange('contrasena', text)}
                secureTextEntry
              />

              <Text style={[styles.inputLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                Rol:
              </Text>
              <DropdownPicker
                data={[
                  { label: 'Colector', value: 'colector' },
                  { label: 'Administrador', value: 'admin' }
                ]}
                selectedValue={newUser.role}
                onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                placeholder="Seleccionar rol"
                isDarkMode={isDarkMode}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  onPress={() => setModalVisible(false)} 
                  style={[styles.modalButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleAddUser} 
                  style={[styles.modalButton, styles.saveButton]}
                  disabled={loading}
                >
                  <Text style={styles.saveButtonText}>
                    {loading ? 'Creando...' : 'Crear Usuario'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para editar usuario */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? '#2c3e50' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                Editar Usuario
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.inputLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                Nombre de Usuario:
              </Text>
              <TextInput
                style={[
                  styles.input, 
                  { 
                    backgroundColor: isDarkMode ? '#34495e' : '#fff',
                    color: isDarkMode ? '#fff' : '#000',
                    borderColor: isDarkMode ? '#555' : '#ddd'
                  }
                ]}
                placeholder="Ingrese el nombre de usuario"
                placeholderTextColor={isDarkMode ? '#bdc3c7' : '#7f8c8d'}
                value={editingUser.usuario}
                onChangeText={(text) => handleEditInputChange('usuario', text)}
                autoCapitalize="none"
              />

              <Text style={[styles.inputLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                Nueva Contraseña (opcional):
              </Text>
              <TextInput
                style={[
                  styles.input, 
                  { 
                    backgroundColor: isDarkMode ? '#34495e' : '#fff',
                    color: isDarkMode ? '#fff' : '#000',
                    borderColor: isDarkMode ? '#555' : '#ddd'
                  }
                ]}
                placeholder="Dejar vacío para mantener actual"
                placeholderTextColor={isDarkMode ? '#bdc3c7' : '#7f8c8d'}
                value={editingUser.contrasena}
                onChangeText={(text) => handleEditInputChange('contrasena', text)}
                secureTextEntry
              />

              <Text style={[styles.inputLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                Rol:
              </Text>
              <DropdownPicker
                data={[
                  { label: 'Colector', value: 'colector' },
                  { label: 'Administrador', value: 'admin' }
                ]}
                selectedValue={editingUser.role}
                onValueChange={(value) => setEditingUser({ ...editingUser, role: value })}
                placeholder="Seleccionar rol"
                isDarkMode={isDarkMode}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  onPress={() => setEditModalVisible(false)} 
                  style={[styles.modalButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleUpdateUser} 
                  style={[styles.modalButton, styles.saveButton]}
                  disabled={loading}
                >
                  <Text style={styles.saveButtonText}>
                    {loading ? 'Actualizando...' : 'Actualizar Usuario'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
        role={cacheUserRole}
      />
    </View>
  );
};

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
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }
    }),
  },
  sidebarButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
    marginLeft: 15,
    ...Platform.select({
      web: {
        userSelect: 'none',
      }
    }),
  },
  addButton: {
    backgroundColor: '#2ecc71',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  userCard: {
    backgroundColor: '#fff',
    padding: Platform.OS === 'android' ? 16 : 15,
    marginBottom: 10,
    marginHorizontal: Platform.OS === 'android' ? 2 : 0,
    borderRadius: 12,
    flexDirection: 'column',
    ...createShadowStyle(2),
  },
  userNameContainer: {
    width: '100%',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: Platform.OS === 'android' ? 1.5 : 1,
    borderBottomColor: Platform.OS === 'android' ? '#e8e8e8' : '#f0f0f0',
  },
  username: {
    fontSize: Platform.OS === 'android' ? 18 : 18,
    fontWeight: 'bold',
    lineHeight: Platform.OS === 'android' ? 24 : 26,
    flexWrap: 'wrap',
    textAlign: 'left',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  userActions: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  editButton: {
    backgroundColor: '#f39c12',
  },
  activateButton: {
    backgroundColor: '#27ae60',
  },
  deactivateButton: {
    backgroundColor: '#e67e22',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  passwordButton: {
    backgroundColor: '#9b59b6',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: Platform.OS === 'android' ? 12 : 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 0,
    maxHeight: Platform.OS === 'android' ? '85%' : '80%', // Más altura en Android
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40, // Espacio extra para que el botón sea visible
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#27ae60',
    marginLeft: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ManageUsersScreen;