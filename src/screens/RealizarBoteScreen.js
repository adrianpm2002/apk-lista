import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { supabase } from '../supabaseClient';
import SideBarWrapper, { SideBarToggle } from '../components/SideBarWrapper';
import ScreenWrapper from '../components/ScreenWrapper';
import ErrorBoundary from '../components/ErrorBoundary';

const RealizarBoteScreen = ({ navigation, onModeVisibilityChange }) => {
  return (
    <ErrorBoundary>
      <ScreenWrapper>
        <RealizarBoteContent
          navigation={navigation}
          onModeVisibilityChange={onModeVisibilityChange}
        />
      </ScreenWrapper>
    </ErrorBoundary>
  );
};

const RealizarBoteContent = ({ navigation, onModeVisibilityChange }) => {
  const [currentBankId, setCurrentBankId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  // Estados para los filtros y datos
  const [lotteryFilter, setLotteryFilter] = useState(null);
  const [scheduleFilter, setScheduleFilter] = useState(null);
  const [playTypeFilter, setPlayTypeFilter] = useState(null);
  const [searchNumber, setSearchNumber] = useState('');
  const [boteAmount, setBoteAmount] = useState('');
  
  // Estados de expansión para los filtros
  const [lotteryExpanded, setLotteryExpanded] = useState(false);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [playTypeExpanded, setPlayTypeExpanded] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [boteExpanded, setBoteExpanded] = useState(false);

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

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const handleSidebarOption = (option) => {
    setSidebarVisible(false);
    // Navegación según opción seleccionada
    if (option === 'play') {
      navigation.navigate('MainApp');
    } else if (option === 'statistics') {
      navigation.navigate('Statistics');
    } else if (option === 'insertResults') {
      navigation.navigate('InsertResults');
    } else if (option === 'createUser') {
      navigation.navigate('CreateUser');
    } else if (option === 'lotteries') {
      navigation.navigate('ManageLotteries');
    } else if (option === 'prices') {
      navigation.navigate('ManagePrices');
    } else if (option === 'limitedNumbers') {
      navigation.navigate('LotteryLimits');
    } else if (option === 'bankCapacity') {
      navigation.navigate('BankCapacity');
    } else if (option === 'realizarBote') {
      navigation.navigate('RealizarBote');
    } else if (option === 'jugadas') {
      navigation.navigate('Jugadas');
    } else if (option === 'offlineRegistry') {
      navigation.navigate('SavedPlays');
    }
  };

  if (loading) {
    return (
      <SideBarWrapper
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        onOptionSelect={handleSidebarOption}
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <SideBarToggle onPress={toggleSidebar} />
            <Text style={styles.title}>Realizar Bote</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Cargando...</Text>
          </View>
        </View>
      </SideBarWrapper>
    );
  }

  return (
    <SideBarWrapper
      isVisible={sidebarVisible}
      onClose={() => setSidebarVisible(false)}
      onOptionSelect={handleSidebarOption}
      navigation={navigation}
      onModeVisibilityChange={onModeVisibilityChange}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <SideBarToggle onPress={toggleSidebar} />
          <Text style={styles.title}>Realizar Bote</Text>
        </View>

        {/* Filtros */}
        <View style={styles.filtersContainer}>
          {/* Filtro de Lotería */}
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setLotteryExpanded(!lotteryExpanded)}
          >
            <Text style={styles.filterButtonText}>
              {lotteryFilter ? `Lotería: ${lotteryFilter}` : 'Todas las Loterías'}
            </Text>
            <Text style={styles.filterButtonIcon}>
              {lotteryExpanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {/* Filtro de Horario */}
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setScheduleExpanded(!scheduleExpanded)}
          >
            <Text style={styles.filterButtonText}>
              {scheduleFilter ? `Horario: ${scheduleFilter}` : 'Todos los Horarios'}
            </Text>
            <Text style={styles.filterButtonIcon}>
              {scheduleExpanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {/* Filtro de Tipo de Jugada */}
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setPlayTypeExpanded(!playTypeExpanded)}
          >
            <Text style={styles.filterButtonText}>
              {playTypeFilter ? playTypeLabels[playTypeFilter] : 'Todos los Tipos'}
            </Text>
            <Text style={styles.filterButtonIcon}>
              {playTypeExpanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {/* Búsqueda por Número */}
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setSearchExpanded(!searchExpanded)}
          >
            <Text style={styles.filterButtonText}>
              {searchNumber ? `Buscar: ${searchNumber}` : 'Buscar Número'}
            </Text>
            <Text style={styles.filterButtonIcon}>
              {searchExpanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          
          {searchExpanded && (
            <View style={styles.expandedFilter}>
              <TextInput
                style={styles.searchInput}
                placeholder="Ingresa el número..."
                value={searchNumber}
                onChangeText={setSearchNumber}
                keyboardType="numeric"
              />
            </View>
          )}

          {/* Campo de Monto del Bote */}
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setBoteExpanded(!boteExpanded)}
          >
            <Text style={styles.filterButtonText}>
              {boteAmount ? `Bote: $${boteAmount}` : 'Monto del Bote'}
            </Text>
            <Text style={styles.filterButtonIcon}>
              {boteExpanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          
          {boteExpanded && (
            <View style={styles.expandedFilter}>
              <TextInput
                style={styles.searchInput}
                placeholder="Ingresa el monto..."
                value={boteAmount}
                onChangeText={setBoteAmount}
                keyboardType="numeric"
              />
            </View>
          )}
        </View>

        {/* Contenido Principal */}
        <ScrollView style={styles.content}>
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>💸 Realizar Bote</Text>
            <Text style={styles.infoText}>
              Selecciona los filtros necesarios y configura el monto del bote.
            </Text>
            <Text style={styles.infoText}>
              Aquí podrás gestionar los botes de las jugadas.
            </Text>
          </View>

          {/* Botón de Acción Principal */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => Alert.alert('Info', 'Funcionalidad en desarrollo')}
          >
            <Text style={styles.primaryButtonText}>Aplicar Bote</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SideBarWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  filterButtonIcon: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  expandedFilter: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default RealizarBoteScreen;
