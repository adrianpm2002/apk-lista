import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { supabase } from '../supabaseClient';
import SideBarWrapper, { SideBarToggle } from '../components/SideBarWrapper';
import ScreenWrapper from '../components/ScreenWrapper';
import ErrorBoundary from '../components/ErrorBoundary';

const BankCapacityScreen = ({ navigation, onModeVisibilityChange }) => {
  return (
    <ErrorBoundary>
      <ScreenWrapper>
        <BankCapacityContent
          navigation={navigation}
          onModeVisibilityChange={onModeVisibilityChange}
        />
      </ScreenWrapper>
    </ErrorBoundary>
  );
};

const BankCapacityContent = ({ navigation, onModeVisibilityChange }) => {
  const [currentBankId, setCurrentBankId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [capacityData, setCapacityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  const playTypeLabels = {
    'fijo': 'FIJO',
    'corrido': 'CORRIDO',
    'parle': 'PARLÉ',
    'centena': 'CENTENA',
    'tripleta': 'TRIPLETA'
  };

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert(
            'Error de conexión',
            'No se pudo verificar tu sesión. Por favor, inicia sesión nuevamente.',
            [{ text: 'OK', onPress: () => navigation.replace('Login') }]
          );
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, id_banco')
          .eq('id', user.id)
          .single();

        if (error || !profile) {
          Alert.alert(
            'Error de conexión',
            'No se pudo obtener tu perfil. Por favor, inicia sesión nuevamente.',
            [{ text: 'OK', onPress: () => navigation.replace('Login') }]
          );
          return;
        }

        const bankId = profile.role === 'admin' ? user.id : profile.id_banco;
        setCurrentBankId(bankId);
        setUserRole(profile.role);
      } catch (error) {
        console.error('Error loading user profile:', error);
        Alert.alert('Error', 'Error al cargar el perfil del usuario');
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [navigation]);

  const fetchBankCapacities = useCallback(async () => {
    if (!currentBankId) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('v_capacidades_banco')
        .select('*')
        .eq('id_banco', currentBankId)
        .order('used_today_banco', { ascending: false });

      if (error) throw error;

      setCapacityData(data || []);
    } catch (error) {
      console.error('Error fetching bank capacities:', error);
      Alert.alert('Error', 'No se pudieron cargar las capacidades del banco');
    } finally {
      setLoading(false);
    }
  }, [currentBankId]);

  useEffect(() => {
    if (currentBankId) {
      fetchBankCapacities();
    }
  }, [currentBankId, fetchBankCapacities]);

  const renderCapacityItem = useCallback(({ item }) => {
    const playType = playTypeLabels[item.jugada] || item.jugada?.toUpperCase() || '';
    
    return (
      <View style={styles.capacityCard}>
        <View style={styles.firstLine}>
          <Text style={styles.numberText}>{item.numero}</Text>
          <Text style={styles.playTypeText}>{playType}</Text>
          <Text style={styles.amountText}>${(item.used_today_banco || 0).toFixed(2)}</Text>
        </View>

        <View style={styles.secondLine}>
          <Text style={styles.lotteryText}>{item.nombre_loteria}</Text>
          <Text style={styles.separator}> - </Text>
          <Text style={styles.scheduleText}>
            {item.nombre_horario} | {formatTime(item.hora_inicio)} - {formatTime(item.hora_fin)}
          </Text>
        </View>
      </View>
    );
  }, [playTypeLabels]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SideBarToggle onPress={() => setSidebarVisible(true)} />
          <Text style={styles.headerTitle}>Capacidad del Banco</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#27AE60" />
          <Text style={styles.loadingText}>Cargando capacidades...</Text>
        </View>
        <SideBarWrapper
          isVisible={sidebarVisible}
          onClose={() => setSidebarVisible(false)}
          navigation={navigation}
          onModeVisibilityChange={onModeVisibilityChange}
          role={userRole}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SideBarToggle onPress={() => setSidebarVisible(true)} />
        <Text style={styles.headerTitle}>Capacidad del Banco</Text>
      </View>

      {capacityData.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>No hay datos de capacidad</Text>
        </View>
      ) : (
        <FlatList
          data={capacityData}
          renderItem={renderCapacityItem}
          keyExtractor={(item, index) => 
            `${item.id_loteria}-${item.id_horario}-${item.jugada}-${item.numero}-${index}`
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <SideBarWrapper
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
        role={userRole}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2C3E50',
    marginLeft: 12,
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  capacityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  firstLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  numberText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2C3E50',
  },
  playTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7F8C8D',
    flex: 1,
  },
  amountText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#27AE60',
  },
  secondLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  lotteryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3498DB',
  },
  separator: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  scheduleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
});

export default BankCapacityScreen;
