// src/screens/HomeScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  Alert,
  Platform 
} from 'react-native';

import { supabase } from '../supabaseClient';
import { useCache } from '../contexts/CacheContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import ScreenWrapper from '../components/ScreenWrapper';
import { SideBar, SideBarToggle } from '../components/SideBar';
import KPICard from '../components/KPICard';
import StatisticsChart from '../components/StatisticsChart';
import FeedbackBanner from '../components/FeedbackBanner';
import { createShadowStyle } from '../utils/shadowUtils';

const HomeScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  return (
    <ScreenWrapper>
      <HomeContent
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
      />
    </ScreenWrapper>
  );
};

const HomeContent = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  // ========== CACHE-FIRST OPTIMIZATION ==========
  const { 
    cache, 
    userRole: cacheUserRole, 
    currentBankId: cacheBankId, 
    updateCacheData, 
    fetchLotteries: cacheFetchLotteries,
    fetchUsers: cacheFetchUsers,
    fetchStatistics: cacheFetchStatistics
  } = useCache();
  
  const { refreshing: cacheRefreshing, onRefresh: cacheOnRefresh } = usePullToRefresh('home');
  
  // ========== STATES WITH CACHE-FIRST INITIALIZATION ==========
  // Inicializar con datos del cache para carga instantánea
  const [userRole, setUserRole] = useState(cacheUserRole || null);
  const [currentBankId, setCurrentBankId] = useState(cacheBankId || null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [statistics, setStatistics] = useState(cache.statistics || {});
  const [users, setUsers] = useState(cache.users || []);
  const [lotteries, setLotteries] = useState(cache.lotteries || []);
  
  // No loading inicial si hay datos en cache
  const [initialLoading, setInitialLoading] = useState(!(cache.statistics && Object.keys(cache.statistics).length > 0));
  const [loading, setLoading] = useState(false);

  // ========== CACHE SYNCHRONIZATION ==========
  useEffect(() => {
    if (cache.statistics) {
      setStatistics(cache.statistics);
    }
  }, [cache.statistics]);

  useEffect(() => {
    if (cache.users) {
      setUsers(cache.users);
    }
  }, [cache.users]);

  useEffect(() => {
    if (cache.lotteries) {
      setLotteries(cache.lotteries);
    }
  }, [cache.lotteries]);

  useEffect(() => {
    if (cacheUserRole) {
      setUserRole(cacheUserRole);
    }
  }, [cacheUserRole]);

  useEffect(() => {
    if (cacheBankId) {
      setCurrentBankId(cacheBankId);
    }
  }, [cacheBankId]);

  // ========== OPTIMIZED DATA FETCHING ==========
  const fetchHomeDataFromCache = async () => {
    if (!cacheBankId) {
      console.log('No bank ID available for fetching home data');
      setInitialLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Cargar datos desde cache en paralelo
      await Promise.all([
        cacheFetchLotteries(),
        cacheFetchUsers(),
        cacheFetchStatistics()
      ]);
      
      setInitialLoading(false);
    } catch (error) {
      console.error('Error fetching home data from cache:', error);
      setInitialLoading(false);
    } finally {
      setLoading(false);
    }
  };

  // Función legacy para cargar estadísticas directamente
  const fetchStatisticsDirect = async () => {
    if (!currentBankId) return;
    
    try {
      setLoading(true);
      
      // Obtener estadísticas básicas
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      // Total de jugadas hoy
      const { data: todayPlays, error: playsError } = await supabase
        .from('jugada')
        .select('monto_unitario')
        .gte('created_at', `${todayStr}T00:00:00`)
        .lt('created_at', `${todayStr}T23:59:59`);
      
      if (playsError) {
        console.error('Error fetching today plays:', playsError);
      }

      // Total de usuarios activos
      const { data: activeUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id_banco', currentBankId)
        .neq('role', 'admin');
      
      if (usersError) {
        console.error('Error fetching active users:', usersError);
      }

      // Loterías activas
      const { data: activeLotteries, error: lotteriesError } = await supabase
        .from('loteria')
        .select('id, nombre')
        .eq('id_banco', currentBankId);
      
      if (lotteriesError) {
        console.error('Error fetching lotteries:', lotteriesError);
      }

      const stats = {
        todayRevenue: (todayPlays || []).reduce((sum, play) => sum + (play.monto_unitario || 0), 0),
        todayPlays: (todayPlays || []).length,
        activeUsers: (activeUsers || []).length,
        activeLotteries: (activeLotteries || []).length,
        lastUpdate: new Date().toISOString()
      };

      setStatistics(stats);
      updateCacheData('statistics', stats);
      
    } catch (error) {
      console.error('Error fetching statistics:', error);
      Alert.alert('Error', 'No se pudieron cargar las estadísticas');
    } finally {
      setLoading(false);
    }
  };

  // Navegación rápida
  const quickNavigation = [
    {
      title: 'Visual',
      description: 'Crear jugadas de forma visual',
      icon: '👁️',
      onPress: () => navigation.navigate('VisualMode'),
      color: '#3498db'
    },
    {
      title: 'Texto',
      description: 'Crear jugadas con texto',
      icon: '📝',
      onPress: () => navigation.navigate('TextMode'),
      color: '#2ecc71'
    },
    {
      title: 'Guardadas',
      description: 'Ver jugadas anteriores',
      icon: '💾',
      onPress: () => navigation.navigate('SavedPlays'),
      color: '#f39c12'
    },
    {
      title: 'Estadísticas',
      description: 'Ver reportes y análisis',
      icon: '📊',
      onPress: () => navigation.navigate('Statistics'),
      color: '#9b59b6'
    }
  ];

  // Navegación de administrador
  const adminNavigation = [
    {
      title: 'Loterías',
      description: 'Administrar loterías y horarios',
      icon: '🎯',
      onPress: () => navigation.navigate('ManageLotteries'),
      color: '#e74c3c'
    },
    {
      title: 'Usuarios',
      description: 'Administrar colectores',
      icon: '👥',
      onPress: () => navigation.navigate('ManageUsers'),
      color: '#34495e'
    },
    {
      title: 'Precios',
      description: 'Configurar precios ganadores',
      icon: '💰',
      onPress: () => navigation.navigate('Prices'),
      color: '#16a085'
    },
    {
      title: 'Jugadas',
      description: 'Gestionar tipos de jugada',
      icon: '🎯',
      onPress: () => navigation.navigate('Jugadas'),
      color: '#8e44ad'
    },
    {
      title: 'Límites',
      description: 'Configurar límites de lotería',
      icon: '⚠️',
      onPress: () => navigation.navigate('LotteryLimits'),
      color: '#e67e22'
    }
  ];

  const handleRefresh = async () => {
    await fetchHomeDataFromCache();
  };

  // ========== FOCUS REFRESH OPTIMIZATION ==========
  const focusRefresh = useCallback(() => {
    if (currentBankId) {
      fetchHomeDataFromCache();
    }
  }, [currentBankId]);

  useFocusEffect(
    useCallback(() => {
      focusRefresh();
    }, [focusRefresh])
  );

  // ========== COMPONENT RENDERING ==========
  const renderQuickNavCard = (item, index) => (
    <TouchableOpacity
      key={index}
      style={[styles.navCard, { backgroundColor: isDarkMode ? '#2c3e50' : '#fff' }]}
      onPress={item.onPress}
    >
      <View style={[styles.navCardIcon, { backgroundColor: `${item.color}20` }]}>
        <Text style={styles.navCardEmoji}>{item.icon}</Text>
      </View>
      <View style={styles.navCardContent}>
        <Text style={[styles.navCardTitle, { color: isDarkMode ? '#fff' : '#2c3e50' }]}>
          {item.title}
        </Text>
        <Text style={[styles.navCardDescription, { color: isDarkMode ? '#bdc3c7' : '#7f8c8d' }]}>
          {item.description}
        </Text>
      </View>
      <Text style={[styles.navCardArrow, { color: item.color }]}>›</Text>
    </TouchableOpacity>
  );

  const renderKPICards = () => (
    <View style={styles.kpiContainer}>
      <KPICard
        title="Ingresos Hoy"
        value={`$${(statistics.todayRevenue || 0).toLocaleString()}`}
        icon="💰"
        color="#2ecc71"
        isDarkMode={isDarkMode}
      />
      <KPICard
        title="Jugadas Hoy"
        value={(statistics.todayPlays || 0).toString()}
        icon="🎯"
        color="#3498db"
        isDarkMode={isDarkMode}
      />
      <KPICard
        title="Usuarios Activos"
        value={(statistics.activeUsers || 0).toString()}
        icon="👥"
        color="#9b59b6"
        isDarkMode={isDarkMode}
      />
      <KPICard
        title="Loterías"
        value={(statistics.activeLotteries || 0).toString()}
        icon="🎲"
        color="#f39c12"
        isDarkMode={isDarkMode}
      />
    </View>
  );

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
          Panel Principal
        </Text>
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
        {/* Mensaje de bienvenida */}
        <View style={[styles.welcomeCard, { backgroundColor: isDarkMode ? '#2c3e50' : '#fff' }]}>
          <Text style={[styles.welcomeTitle, { color: isDarkMode ? '#fff' : '#2c3e50' }]}>
            ¡Bienvenido al Sistema de Loterías!
          </Text>
          <Text style={[styles.welcomeSubtitle, { color: isDarkMode ? '#bdc3c7' : '#7f8c8d' }]}>
            {userRole === 'admin' ? 'Panel de Administración' : 'Panel de Colector'}
          </Text>
        </View>

        {/* KPI Cards */}
        {userRole === 'admin' && renderKPICards()}

        {/* Acceso rápido */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#2c3e50' }]}>
            Acceso Rápido
          </Text>
          {quickNavigation.map(renderQuickNavCard)}
        </View>

        {/* Navegación de administrador */}
        {userRole === 'admin' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#2c3e50' }]}>
              Administración
            </Text>
            {adminNavigation.map(renderQuickNavCard)}
          </View>
        )}

        {/* Resumen rápido */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#2c3e50' }]}>
            Resumen del Sistema
          </Text>
          
          <View style={[styles.summaryCard, { backgroundColor: isDarkMode ? '#2c3e50' : '#fff' }]}>
            <Text style={[styles.summaryTitle, { color: isDarkMode ? '#fff' : '#2c3e50' }]}>
              Estado Actual
            </Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDarkMode ? '#bdc3c7' : '#7f8c8d' }]}>
                Loterías disponibles:
              </Text>
              <Text style={[styles.summaryValue, { color: isDarkMode ? '#3498db' : '#2c3e50' }]}>
                {lotteries.length}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: isDarkMode ? '#bdc3c7' : '#7f8c8d' }]}>
                Última actualización:
              </Text>
              <Text style={[styles.summaryValue, { color: isDarkMode ? '#3498db' : '#2c3e50' }]}>
                {statistics.lastUpdate ? new Date(statistics.lastUpdate).toLocaleTimeString() : 'N/A'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

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
    ...Platform.select({
      web: {
        userSelect: 'none',
      }
    }),
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  welcomeCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    ...createShadowStyle(2),
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  navCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    ...createShadowStyle(2),
  },
  navCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  navCardEmoji: {
    fontSize: 24,
  },
  navCardContent: {
    flex: 1,
  },
  navCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  navCardDescription: {
    fontSize: 14,
  },
  navCardArrow: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    ...createShadowStyle(2),
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HomeScreen;
