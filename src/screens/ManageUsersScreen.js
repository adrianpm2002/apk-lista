import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { useCache } from '../contexts/CacheContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import ScreenWrapper from '../components/ScreenWrapper';

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
  const { cache, userRole: cacheUserRole, updateCacheData } = useCache();
  const { refreshing, onRefresh } = usePullToRefresh('users');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [users, setUsers] = useState([]);

  // Sincronizar con cache para admins
  useEffect(() => {
    if (cacheUserRole === 'admin' && cache.users) {
      setUsers(cache.users);
    }
  }, [cacheUserRole, cache.users]);

  const handleUserAction = async (action, userId) => {
    // Aquí implementarías las acciones específicas (activar/desactivar, editar, etc.)
    Alert.alert('Acción', `${action} usuario ${userId}`);
    
    // Actualizar cache después de la acción
    if (cacheUserRole === 'admin') {
      await updateCacheData('users');
    }
  };

  return (
    <View style={styles.container}>
      <SideBar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        userRole={cacheUserRole}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
      />
      
      <View style={styles.header}>
        <SideBarToggle 
          inline 
          onToggle={() => setSidebarVisible(!sidebarVisible)} 
          style={styles.sidebarButton} 
        />
        <Text style={styles.headerTitle}>Gestionar Usuarios</Text>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#27AE60']}
            tintColor="#27AE60"
          />
        }
      >
        {cache.isLoading ? (
          <Text style={styles.loadingText}>Cargando usuarios...</Text>
        ) : users.length === 0 ? (
          <Text style={styles.emptyText}>No hay usuarios disponibles</Text>
        ) : (
          users.map((user, index) => (
            <View key={user.id || index} style={styles.userCard}>
              <Text style={styles.username}>{user.username}</Text>
              <Text style={styles.userRole}>{user.role}</Text>
              <Text style={styles.userStatus}>
                {user.activo ? 'Activo' : 'Inactivo'}
              </Text>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleUserAction('editar', user.id)}
              >
                <Text style={styles.actionButtonText}>Editar</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sidebarButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
  userCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  userRole: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  userStatus: {
    fontSize: 14,
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: '#27AE60',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ManageUsersScreen;