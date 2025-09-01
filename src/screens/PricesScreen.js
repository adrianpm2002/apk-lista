import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert, 
  StyleSheet, 
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal
} from 'react-native';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';
import { useCache } from '../contexts/CacheContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';

const PricesScreen = ({ navigation, isDarkMode, onToggleDarkMode }) => {
  return (
    <ScreenWrapper>
      <PricesContent
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
      />
    </ScreenWrapper>
  );
};

const PricesContent = ({ navigation, isDarkMode, onToggleDarkMode }) => {
  const { cache, userRole: cacheUserRole, currentBankId: cacheBankId, fetchPrices, fetchPriceConfigurations } = useCache();
  const { refreshing: cacheRefreshing, onRefresh: cacheOnRefresh } = usePullToRefresh('prices');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!(cache.prices && cache.prices.length > 0));
  
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [editingBatch, setEditingBatch] = useState(false);
  
  // Estado de precios
  const [winningPrices, setWinningPrices] = useState({
    fijo: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    corrido: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    posicion: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    parle: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    centena: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    tripleta: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
  });

  const [priceEntries, setPriceEntries] = useState([]);
  const [priceConfigName, setPriceConfigName] = useState('');
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [priceConfigs, setPriceConfigs] = useState(cache.prices || []);
  const [expandedConfigs, setExpandedConfigs] = useState(new Set());
  const [modalError, setModalError] = useState('');
  const [modalFieldErrors, setModalFieldErrors] = useState({});
  const [editingConfigId, setEditingConfigId] = useState(null);

  // Usar datos del cache si están disponibles
  useEffect(() => {
    if (cache.prices && cache.prices.length > 0) {
      console.log('Using cached prices:', cache.prices.length);
      setPriceConfigs(cache.prices);
      setInitialLoading(false);
      
      // Prefill modal con la última config disponible en cache
      const latest = cache.prices[0];
      if (latest) {
        setPriceConfigName(latest.nombre || '');
        if (latest.precios) {
          const json = latest.precios;
          const newWinning = { ...winningPrices };
          const newEntries = [];
          Object.keys(json).forEach(key => {
            const obj = json[key] || {};
            if (newWinning[key]) {
              newWinning[key] = {
                regular: obj.regular?.toString() || '',
                limited: obj.limited?.toString() || '',
                collectorPct: obj.collectorPct?.toString() || '',
                listeroPct: obj.listeroPct?.toString() || ''
              };
            }
            const anyVal = ['regular','limited','collectorPct','listeroPct'].some(k => obj[k] !== undefined && obj[k] !== null && obj[k] !== '');
            if (anyVal) {
              newEntries.push({
                id: key + '-' + Date.now(),
                jugada: key,
                regular: obj.regular ?? null,
                limited: obj.limited ?? null,
                collectorPct: obj.collectorPct ?? null,
                listeroPct: obj.listeroPct ?? null,
              });
            }
          });
          setWinningPrices(newWinning);
          setPriceEntries(newEntries);
        }
      }
    } else if (cacheBankId && initialLoading) {
      console.log('No cached prices, fetching from database...');
      loadPriceConfigsFromCache();
    }
  }, [cache.prices, cacheBankId, initialLoading]);

  useEffect(() => { initializeScreen(); }, []);

  const initializeScreen = async () => {
    try {
      setLoading(true);
      await fetchUserRole();
    } catch (error) {
      console.error('Error inicializando pantalla:', error);
      Alert.alert('Error', 'No se pudo cargar la información del usuario');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, id_banco')
        .eq('id', user.id)
        .single();

      if (data) {
        setUserRole(data.role);
        const bankId = data.role === 'admin' ? user.id : data.id_banco;
        setCurrentBankId(bankId);
        
        if (data.role !== 'admin') {
          Alert.alert('Acceso Denegado', 'Solo los administradores pueden configurar precios');
          navigation.goBack();
          return;
        }
      } else {
        console.error('Error cargando rol:', error);
        Alert.alert('Error', 'No se pudo cargar el perfil del usuario');
      }
    }
  };

  const loadPriceConfigsFromCache = async () => {
    try {
      if (cache.prices && cache.prices.length > 0) {
        console.log('loadPriceConfigsFromCache: Using cached data');
        setPriceConfigs(cache.prices);
        return;
      }

      console.log('loadPriceConfigsFromCache: Fetching from database via cache context');
      setLoadingPrices(true);
      const data = await fetchPriceConfigurations();
      setPriceConfigs(data || []);
      
      if (data && data.length > 0) {
        const latest = data[0];
        setPriceConfigName(latest.nombre || '');
        if (latest.precios) {
          const json = latest.precios;
          const newWinning = { ...winningPrices };
          const newEntries = [];
          Object.keys(json).forEach(key => {
            const obj = json[key] || {};
            if (newWinning[key]) {
              newWinning[key] = {
                regular: obj.regular?.toString() || '',
                limited: obj.limited?.toString() || '',
                collectorPct: obj.collectorPct?.toString() || '',
                listeroPct: obj.listeroPct?.toString() || ''
              };
            }
            const anyVal = ['regular','limited','collectorPct','listeroPct'].some(k => obj[k] !== undefined && obj[k] !== null && obj[k] !== '');
            if (anyVal) {
              newEntries.push({
                id: key + '-' + Date.now(),
                jugada: key,
                regular: obj.regular ?? null,
                limited: obj.limited ?? null,
                collectorPct: obj.collectorPct ?? null,
                listeroPct: obj.listeroPct ?? null,
              });
            }
          });
          setWinningPrices(newWinning);
          setPriceEntries(newEntries);
        }
      }
    } catch (error) {
      console.error('Error loading price configs from cache:', error);
    } finally {
      setLoadingPrices(false);
    }
  };

  const handleRefresh = async () => {
    if (cacheUserRole === 'admin') {
      await cacheOnRefresh();
      await loadPriceConfigsFromCache();
    }
  };

  // Funciones de precios simplificadas para la nueva pantalla
  const savePriceConfiguration = async () => {
    // Implementación de guardado de precios
    // ... (código existente)
  };

  const deleteConfiguration = async (configId) => {
    // Implementación de eliminación
    // ... (código existente)
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#27AE60" />
        <Text style={styles.loadingText}>Cargando configuración...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header personalizado */}
      <View style={styles.customHeader}>
        <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>Precios</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={cacheUserRole === 'admin' ? (loading || loadingPrices) : false}
            onRefresh={cacheUserRole === 'admin' ? handleRefresh : undefined}
            colors={['#27AE60']}
            tintColor="#27AE60"
          />
        }
      >
        {/* Botón para abrir modal de precios */}
        <ActionButton
          title="Nueva Configuración de Precios"
          onPress={() => {
            console.log('🚨🚨🚨 BOTÓN NUEVA CONFIGURACIÓN PRESIONADO EN PRICESSCREEN 🚨🚨🚨');
            console.log('Estado actual priceModalVisible:', priceModalVisible);
            setEditingBatch(false);
            setEditingConfigId(null);
            // Limpiar campos para nueva config
            const cleared = { ...winningPrices };
            Object.keys(cleared).forEach(k => {
              cleared[k] = { regular: '', limited: '', collectorPct: '', listeroPct: '' };
            });
            setWinningPrices(cleared);
            setPriceConfigName('');
            setPriceEntries([]);
            setPriceModalVisible(true);
            console.log('🚨🚨🚨 DESPUÉS DE setPriceModalVisible(true) EN PRICESSCREEN 🚨🚨🚨');
          }}
          variant="primary"
          size="medium"
          style={{ marginBottom: 16 }}
        />

        {/* Listado de configuraciones guardadas */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#2c3e50' }]}>
            Configuraciones Guardadas
          </Text>
          
          {/* Indicador de datos del cache */}
          {!loadingPrices && priceConfigs.length > 0 && !initialLoading && (
            <View style={styles.cacheIndicator}>
              <Text style={styles.cacheIndicatorText}>
                📦 Datos desde cache • Desliza hacia abajo para actualizar
              </Text>
            </View>
          )}
          
          {loadingPrices && <Text style={{ color: '#7f8c8d' }}>Cargando configuraciones...</Text>}
          {!loadingPrices && priceConfigs.length === 0 && (
            <Text style={{ color: '#7f8c8d' }}>No hay configuraciones guardadas aún.</Text>
          )}
          
          {priceConfigs.map(cfg => {
            const expanded = expandedConfigs.has(cfg.id);
            const toggle = () => {
              setExpandedConfigs(prev => {
                const n = new Set(prev);
                if (n.has(cfg.id)) n.delete(cfg.id); else n.add(cfg.id);
                return n;
              });
            };
            const precios = cfg.precios || {};
            const jugadasKeys = Object.keys(precios).filter(k => 
              precios[k] && (
                precios[k].regular !== undefined || 
                precios[k].limited !== undefined || 
                precios[k].collectorPct !== undefined || 
                precios[k].listeroPct !== undefined
              )
            );

            return (
              <View key={cfg.id} style={[styles.configCard, { backgroundColor: isDarkMode ? '#34495e' : '#f8f9fa' }]}>
                <TouchableOpacity onPress={toggle} style={styles.configHeader}>
                  <View style={styles.configHeaderLeft}>
                    <Text style={[styles.configName, { color: isDarkMode ? '#ecf0f1' : '#2c3e50' }]}>
                      {cfg.nombre || 'Sin nombre'}
                    </Text>
                    <Text style={[styles.configMeta, { color: isDarkMode ? '#bdc3c7' : '#7f8c8d' }]}>
                      {jugadasKeys.length} tipos • {new Date(cfg.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={[styles.expandIcon, { color: isDarkMode ? '#ecf0f1' : '#2c3e50' }]}>
                    {expanded ? '▼' : '▶'}
                  </Text>
                </TouchableOpacity>

                {expanded && (
                  <View style={styles.configDetails}>
                    {jugadasKeys.map(jugada => {
                      const p = precios[jugada];
                      return (
                        <View key={jugada} style={[styles.priceRow, { borderColor: isDarkMode ? '#7f8c8d' : '#e0e0e0' }]}>
                          <Text style={[styles.jugadaLabel, { color: isDarkMode ? '#ecf0f1' : '#2c3e50' }]}>
                            {jugada}
                          </Text>
                          <View style={styles.priceValues}>
                            {p.regular !== undefined && (
                              <Text style={[styles.priceValue, { color: isDarkMode ? '#bdc3c7' : '#34495e' }]}>
                                Regular: ${p.regular}
                              </Text>
                            )}
                            {p.limited !== undefined && (
                              <Text style={[styles.priceValue, { color: isDarkMode ? '#bdc3c7' : '#34495e' }]}>
                                Limitado: ${p.limited}
                              </Text>
                            )}
                            {p.collectorPct !== undefined && (
                              <Text style={[styles.priceValue, { color: isDarkMode ? '#bdc3c7' : '#34495e' }]}>
                                Collector: {p.collectorPct}%
                              </Text>
                            )}
                            {p.listeroPct !== undefined && (
                              <Text style={[styles.priceValue, { color: isDarkMode ? '#bdc3c7' : '#34495e' }]}>
                                Listero: {p.listeroPct}%
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                    
                    <View style={styles.configActions}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => {
                          // Cargar configuración para editar
                          setEditingBatch(true);
                          setEditingConfigId(cfg.id);
                          const newEntries = [];
                          Object.keys(precios).forEach(key => {
                            const obj = precios[key] || {};
                            const anyVal = ['regular','limited','collectorPct','listeroPct'].some(k => obj[k] !== undefined && obj[k] !== null && obj[k] !== '');
                            if (anyVal) {
                              newEntries.push({
                                id: key + '-' + Date.now(),
                                jugada: key,
                                regular: obj.regular ?? null,
                                limited: obj.limited ?? null,
                                collectorPct: obj.collectorPct ?? null,
                                listeroPct: obj.listeroPct ?? null,
                              });
                            }
                          });
                          setPriceEntries(newEntries);
                          setPriceConfigName(cfg.nombre || '');
                          setWinningPrices(precios);
                          setPriceModalVisible(true);
                        }}
                      >
                        <Text style={styles.editButtonText}>Editar</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => {
                          Alert.alert(
                            'Confirmar eliminación',
                            `¿Estás seguro de que deseas eliminar "${cfg.nombre || 'Sin nombre'}"?`,
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              { 
                                text: 'Eliminar', 
                                style: 'destructive',
                                onPress: () => deleteConfiguration(cfg.id)
                              }
                            ]
                          );
                        }}
                      >
                        <Text style={styles.deleteButtonText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        navigation={navigation}
        role={userRole}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7f8c8d',
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    ...createShadowStyle(2),
  },
  sidebarButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2c3e50',
  },
  cacheIndicator: {
    backgroundColor: '#e8f5e8',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  cacheIndicatorText: {
    fontSize: 12,
    color: '#27ae60',
    textAlign: 'center',
  },
  configCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    ...createShadowStyle(2),
  },
  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  configHeaderLeft: {
    flex: 1,
  },
  configName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  configMeta: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  expandIcon: {
    fontSize: 16,
    color: '#2c3e50',
  },
  configDetails: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  jugadaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    textTransform: 'capitalize',
  },
  priceValues: {
    flex: 1,
    marginLeft: 12,
  },
  priceValue: {
    fontSize: 12,
    color: '#34495e',
    marginBottom: 2,
  },
  configActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default PricesScreen;
