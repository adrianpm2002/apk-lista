import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
  Pressable,
} from 'react-native';
import { supabase } from '../supabaseClient';
import ScreenWrapper from '../components/ScreenWrapper';
import ErrorBoundary from '../components/ErrorBoundary';

const ListerCapacityScreen = ({ navigation }) => {
  return (
    <ErrorBoundary>
      <ScreenWrapper>
        <ListerCapacityContent navigation={navigation} />
      </ScreenWrapper>
    </ErrorBoundary>
  );
};

const ListerCapacityContent = ({ navigation }) => {
  const [currentBankId, setCurrentBankId] = useState(null);
  const [currentListerId, setCurrentListerId] = useState(null);
  const [capacityData, setCapacityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('capacity'); // 'capacity' o 'number'
  const [lotteryFilter, setLotteryFilter] = useState(null);
  const [scheduleFilter, setScheduleFilter] = useState(null);
  const [playTypeFilter, setPlayTypeFilter] = useState(null);
  const [lotteryExpanded, setLotteryExpanded] = useState(false);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [playTypeExpanded, setPlayTypeExpanded] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchNumber, setSearchNumber] = useState('');

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  // Función para verificar si un número coincide con la búsqueda considerando permutaciones
  const matchesSearch = (numero, searchTerm) => {
    if (!searchTerm) return true;
    
    const numStr = numero.toString();
    const searchStr = searchTerm.toString();
    
    // Coincidencia exacta
    if (numStr === searchStr) return true;
    
    const length = searchStr.length;
    
    // Para números de 4 dígitos: ABCD = CDAB
    if (length === 4 && numStr.length === 4) {
      const ab = searchStr.substring(0, 2);
      const cd = searchStr.substring(2, 4);
      const permuted = cd + ab; // CDAB
      if (numStr === permuted) return true;
    }
    
    // Para números de 6 dígitos: todas las permutaciones de los 3 pares
    if (length === 6 && numStr.length === 6) {
      const pair1 = searchStr.substring(0, 2);
      const pair2 = searchStr.substring(2, 4);
      const pair3 = searchStr.substring(4, 6);
      
      const permutations = [
        pair1 + pair2 + pair3, // ABC (original)
        pair1 + pair3 + pair2, // ACB
        pair2 + pair1 + pair3, // BAC
        pair2 + pair3 + pair1, // BCA
        pair3 + pair1 + pair2, // CAB
        pair3 + pair2 + pair1, // CBA
      ];
      
      if (permutations.includes(numStr)) return true;
    }
    
    return false;
  };

  const playTypeLabels = {
    'fijo': 'FIJO',
    'corrido': 'CORRIDO',
    'parle': 'PARLÉ',
    'centena': 'CENTENA',
    'tripleta': 'TRIPLETA'
  };

  const getCapacityColor = (percentage) => {
    if (percentage >= 80) return '#E74C3C';
    if (percentage >= 60) return '#F39C12';
    if (percentage >= 40) return '#F1C40F';
    return '#27AE60';
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
        setCurrentListerId(user.id);
      } catch (error) {
        console.error('Error loading user profile:', error);
        Alert.alert('Error', 'Error al cargar el perfil del usuario');
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [navigation]);

  const fetchListerCapacities = useCallback(async () => {
    if (!currentBankId || !currentListerId) return;

    setLoading(true);

    try {
      const orderColumn = sortBy === 'capacity' ? 'used_today_listero' : 'numero';
      const { data, error } = await supabase
        .from('v_capacidades')
        .select('*')
        .eq('id_banco', currentBankId)
        .eq('id_listero', currentListerId)
        .order(orderColumn, { ascending: sortBy === 'number' });

      if (error) throw error;

      setCapacityData(data || []);
    } catch (error) {
      console.error('Error fetching lister capacities:', error);
      Alert.alert('Error', 'No se pudieron cargar las capacidades');
    } finally {
      setLoading(false);
    }
  }, [currentBankId, currentListerId, sortBy]);

  useEffect(() => {
    if (currentBankId && currentListerId) {
      fetchListerCapacities();
    }
  }, [currentBankId, currentListerId, fetchListerCapacities]);

  // Obtener opciones únicas de lotería y tipo de jugada
  const lotteryOptions = useMemo(() => {
    const unique = [...new Set(capacityData.map(item => item.nombre_loteria))];
    return unique.filter(Boolean).sort();
  }, [capacityData]);

  const scheduleOptions = useMemo(() => {
    const unique = [...new Set(capacityData.map(item => item.nombre_horario))];
    return unique.filter(Boolean).sort();
  }, [capacityData]);

  const playTypeOptions = useMemo(() => {
    const unique = [...new Set(capacityData.map(item => item.jugada))];
    return unique.filter(Boolean).sort();
  }, [capacityData]);

  // Filtrar datos según los filtros seleccionados
  const filteredData = useMemo(() => {
    let filtered = [...capacityData];
    
    if (lotteryFilter) {
      filtered = filtered.filter(item => item.nombre_loteria === lotteryFilter);
    }
    
    if (scheduleFilter) {
      filtered = filtered.filter(item => item.nombre_horario === scheduleFilter);
    }
    
    if (playTypeFilter) {
      filtered = filtered.filter(item => item.jugada === playTypeFilter);
    }
    
    if (searchNumber) {
      filtered = filtered.filter(item => matchesSearch(item.numero, searchNumber));
    }
    
    return filtered;
  }, [capacityData, lotteryFilter, scheduleFilter, playTypeFilter, searchNumber]);

  // Calcular el total usado del listero de los datos filtrados
  const totalUsed = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + (item.used_today_listero || 0), 0);
  }, [filteredData]);

  const renderCapacityItem = useCallback(({ item }) => {
    const playType = playTypeLabels[item.jugada] || item.jugada?.toUpperCase() || '';
    const percentage = item.effective_limit_listero 
      ? Math.min(100, (item.used_today_listero / item.effective_limit_listero) * 100)
      : 0;
    const barColor = getCapacityColor(percentage);
    
    return (
      <View style={styles.capacityCard}>
        {/* Porcentaje y barra de progreso en la misma línea */}
        <View style={styles.progressContainer}>
          <Text style={[styles.percentageTextTop, { color: barColor }]}>
            {percentage.toFixed(1)}%
          </Text>
          {/* Barra de progreso */}
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${percentage}%`, backgroundColor: barColor }
              ]} 
            />
          </View>
        </View>

        <View style={styles.firstLine}>
          <Text style={styles.numberText}>{item.numero}</Text>
          <Text style={styles.playTypeText}>{playType}</Text>
          <Text style={styles.amountText}>${(item.used_today_listero || 0).toFixed(2)}</Text>
        </View>

        <View style={styles.secondLine}>
          <Text style={styles.lotteryText}>{item.nombre_loteria}</Text>
          <Text style={styles.separator}> - </Text>
          <Text style={styles.scheduleText}>
            {item.nombre_horario} | {formatTime(item.hora_inicio)} - {formatTime(item.hora_fin)}
          </Text>
        </View>

        <View style={styles.thirdLine}>
          <Text style={styles.limitText}>
            Usado: ${(item.used_today_listero || 0).toFixed(2)} / ${(item.effective_limit_listero || 0).toFixed(2)}
          </Text>
        </View>
      </View>
    );
  }, [playTypeLabels]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Mi Capacidad</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.filtersBar}>
          <View style={styles.filtersContainer}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Ordenar:</Text>
              <TouchableOpacity
                style={[styles.sortButton, sortBy === 'capacity' && styles.sortButtonActive]}
                onPress={() => setSortBy('capacity')}
              >
                <Text style={[styles.sortButtonText, sortBy === 'capacity' && styles.sortButtonTextActive]}>
                  Capacidad
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortButton, sortBy === 'number' && styles.sortButtonActive]}
                onPress={() => setSortBy('number')}
              >
                <Text style={[styles.sortButtonText, sortBy === 'number' && styles.sortButtonTextActive]}>
                  Número
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#27AE60" />
          <Text style={styles.loadingText}>Cargando capacidades...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Mi Capacidad</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Barra de filtros */}
      <View style={styles.filtersBar}>
        <View style={styles.filtersContainer}>
          {/* Ordenar */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Ordenar:</Text>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'capacity' && styles.sortButtonActive]}
              onPress={() => setSortBy('capacity')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'capacity' && styles.sortButtonTextActive]}>
                Capacidad
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'number' && styles.sortButtonActive]}
              onPress={() => setSortBy('number')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'number' && styles.sortButtonTextActive]}>
                Número
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filtro de Lotería */}
          {lotteryOptions.length > 0 && (
            <View style={styles.filterGroupWrapper}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Lotería:</Text>
                <TouchableOpacity
                  style={[styles.sortButton, styles.sortButtonActive]}
                  onPress={() => setLotteryExpanded(!lotteryExpanded)}
                >
                  <Text style={[styles.sortButtonText, styles.sortButtonTextActive]}>
                    {lotteryFilter || 'Todas'}
                  </Text>
                </TouchableOpacity>
              </View>
              {lotteryExpanded && (
                <View style={styles.expandedOptions}>
                  {lotteryOptions.map(lottery => (
                    <TouchableOpacity
                      key={lottery}
                      style={styles.sortButton}
                      onPress={() => {
                        setLotteryFilter(lottery);
                        setLotteryExpanded(false);
                      }}
                    >
                      <Text style={styles.sortButtonText}>
                        {lottery}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {lotteryFilter && (
                    <TouchableOpacity
                      style={styles.sortButton}
                      onPress={() => {
                        setLotteryFilter(null);
                        setLotteryExpanded(false);
                      }}
                    >
                      <Text style={styles.sortButtonText}>
                        Todas
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Filtro de Horario */}
          {scheduleOptions.length > 0 && (
            <View style={styles.filterGroupWrapper}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Horario:</Text>
                <TouchableOpacity
                  style={[styles.sortButton, styles.sortButtonActive]}
                  onPress={() => setScheduleExpanded(!scheduleExpanded)}
                >
                  <Text style={[styles.sortButtonText, styles.sortButtonTextActive]}>
                    {scheduleFilter || 'Todos'}
                  </Text>
                </TouchableOpacity>
              </View>
              {scheduleExpanded && (
                <View style={styles.expandedOptions}>
                  {scheduleOptions.map(schedule => (
                    <TouchableOpacity
                      key={schedule}
                      style={styles.sortButton}
                      onPress={() => {
                        setScheduleFilter(schedule);
                        setScheduleExpanded(false);
                      }}
                    >
                      <Text style={styles.sortButtonText}>
                        {schedule}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {scheduleFilter && (
                    <TouchableOpacity
                      style={styles.sortButton}
                      onPress={() => {
                        setScheduleFilter(null);
                        setScheduleExpanded(false);
                      }}
                    >
                      <Text style={styles.sortButtonText}>
                        Todos
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Filtro de Jugada */}
          {playTypeOptions.length > 0 && (
            <View style={styles.filterGroupWrapper}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Jugada:</Text>
                <TouchableOpacity
                  style={[styles.sortButton, styles.sortButtonActive]}
                  onPress={() => setPlayTypeExpanded(!playTypeExpanded)}
                >
                  <Text style={[styles.sortButtonText, styles.sortButtonTextActive]}>
                    {playTypeFilter ? (playTypeLabels[playTypeFilter] || playTypeFilter.toUpperCase()) : 'Todas'}
                  </Text>
                </TouchableOpacity>
              </View>
              {playTypeExpanded && (
                <View style={styles.expandedOptions}>
                  {playTypeOptions.map(playType => (
                    <TouchableOpacity
                      key={playType}
                      style={styles.sortButton}
                      onPress={() => {
                        setPlayTypeFilter(playType);
                        setPlayTypeExpanded(false);
                      }}
                    >
                      <Text style={styles.sortButtonText}>
                        {playTypeLabels[playType] || playType.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {playTypeFilter && (
                    <TouchableOpacity
                      style={styles.sortButton}
                      onPress={() => {
                        setPlayTypeFilter(null);
                        setPlayTypeExpanded(false);
                      }}
                    >
                      <Text style={styles.sortButtonText}>
                        Todas
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Filtro de Búsqueda por Número */}
          <View style={styles.filterGroupWrapper}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Buscar:</Text>
              <TouchableOpacity
                style={[styles.sortButton, searchNumber ? styles.sortButtonActive : null]}
                onPress={() => setSearchExpanded(!searchExpanded)}
              >
                <Text style={[styles.sortButtonText, searchNumber ? styles.sortButtonTextActive : null]}>
                  {searchNumber || 'Número'}
                </Text>
              </TouchableOpacity>
            </View>
            {searchExpanded ? (
              <View style={styles.expandedOptions}>
                <View style={styles.searchInputContainer}>
                  <TextInput
                    style={styles.searchInput}
                    value={searchNumber}
                    onChangeText={(text) => {
                      const numericText = text.replace(/[^0-9]/g, '').substring(0, 6);
                      setSearchNumber(numericText);
                    }}
                    placeholder="Número"
                    keyboardType="numeric"
                    maxLength={6}
                  />
                </View>
                {searchNumber ? (
                  <TouchableOpacity
                    style={styles.sortButton}
                    onPress={() => {
                      setSearchNumber('');
                      setSearchExpanded(false);
                    }}
                  >
                    <Text style={styles.sortButtonText}>Limpiar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Total Usado */}
          <View style={styles.totalBrutoContainer}>
            <Text style={styles.totalBrutoLabel}>Total Usado: </Text>
            <Text style={styles.totalBrutoValue}>${totalUsed.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {filteredData.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>No hay datos de capacidad</Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          renderItem={renderCapacityItem}
          keyExtractor={(item, index) => 
            `${item.id_loteria}-${item.id_horario}-${item.jugada}-${item.numero}-${index}`
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 70,
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 44,
  },
  filtersBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 110,
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 6,
  },
  filterGroupWrapper: {
    flexDirection: 'column',
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandedOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    marginLeft: 0,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#495057',
  },
  sortButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  sortButtonActive: {
    backgroundColor: '#27AE60',
    borderColor: '#27AE60',
  },
  sortButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#495057',
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
  },
  searchInputContainer: {
    flexDirection: 'row',
  },
  searchInput: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#27AE60',
    fontSize: 10,
    fontWeight: '600',
    color: '#495057',
    minWidth: 60,
    textAlign: 'center',
  },
  totalBrutoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    paddingLeft: 8,
  },
  totalBrutoLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#495057',
  },
  totalBrutoValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#27AE60',
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
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  percentageTextTop: {
    fontSize: 11,
    fontWeight: 'bold',
    minWidth: 40,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E9ECEF',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  firstLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 10,
  },
  numberText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C3E50',
  },
  playTypeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#27AE60',
  },
  secondLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  lotteryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3498DB',
  },
  separator: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  scheduleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A0826D',
  },
  thirdLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitText: {
    fontSize: 11,
    color: '#7F8C8D',
  },
});

export default ListerCapacityScreen;
