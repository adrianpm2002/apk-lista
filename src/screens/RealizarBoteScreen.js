import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { supabase } from '../supabaseClient';
import SideBarWrapper, { SideBarToggle } from '../components/SideBarWrapper';
import ScreenWrapper from '../components/ScreenWrapper';
import ErrorBoundary from '../components/ErrorBoundary';
import DropdownPicker from '../components/DropdownPicker';
import ActionButton from '../components/ActionButton';
import FeedbackBanner from '../components/FeedbackBanner';
import * as OfflineStorage from '../services/offlineStorageService';
import { useOfflineSafe } from '../contexts/OfflineContext';

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
  const [loading, setLoading] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [capacityData, setCapacityData] = useState([]);
  const [sortBy, setSortBy] = useState('capacity');
  
  // Estados para lotería y horario
  const [lotteries, setLotteries] = useState([]);
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [scheduleOptions, setScheduleOptions] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  
  // Estado de conexión
  const offlineContext = useOfflineSafe();
  const isOnline = offlineContext?.isOnline ?? true;
  
  // Estados para los filtros
  const [lotteryFilter, setLotteryFilter] = useState(null);
  const [scheduleFilter, setScheduleFilter] = useState(null);
  const [playTypeFilter, setPlayTypeFilter] = useState(null);
  const [searchNumber, setSearchNumber] = useState('');
  const [boteAmount, setBoteAmount] = useState('');
  
  // Estados de expansión
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

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  // Función para verificar si un número coincide con la búsqueda considerando permutaciones
  const matchesSearch = (numero, searchTerm) => {
    if (!searchTerm) return true;
    
    const numStr = numero.toString();
    const searchStr = searchTerm.toString();
    
    if (numStr === searchStr) return true;
    
    const length = searchStr.length;
    
    if (length === 4 && numStr.length === 4) {
      const ab = searchStr.substring(0, 2);
      const cd = searchStr.substring(2, 4);
      const permuted = cd + ab;
      if (numStr === permuted) return true;
    }
    
    if (length === 6 && numStr.length === 6) {
      const pair1 = searchStr.substring(0, 2);
      const pair2 = searchStr.substring(2, 4);
      const pair3 = searchStr.substring(4, 6);
      
      const permutations = [
        pair1 + pair2 + pair3,
        pair1 + pair3 + pair2,
        pair2 + pair1 + pair3,
        pair2 + pair3 + pair1,
        pair3 + pair1 + pair2,
        pair3 + pair2 + pair1,
      ];
      
      if (permutations.includes(numStr)) return true;
    }
    
    return false;
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

  // Cargar loterías cuando tengamos bankId
  useEffect(() => {
    if (!currentBankId) return;
    
    const loadLotteries = async () => {
      try {
        let lots = [];
        
        // Cargar desde cache primero
        const cachedLots = await OfflineStorage.getLotteries(currentBankId);
        if (cachedLots && cachedLots.length > 0) {
          lots = cachedLots;
          setLotteries(lots.map(l => ({ label: l.nombre, value: l.id })));
        }
        
        // Si está online, actualizar desde Supabase
        if (isOnline) {
          try {
            const { data } = await supabase
              .from('loteria')
              .select('id,nombre')
              .eq('id_banco', currentBankId)
              .order('nombre');
            
            if (data && data.length > 0) {
              lots = data;
              await OfflineStorage.saveLotteries(lots.map(l => ({ ...l, id_banco: currentBankId })));
              setLotteries(lots.map(l => ({ label: l.nombre, value: l.id })));
            }
          } catch (onlineError) {
            console.log('[RealizarBote] Error cargando loterías online, usando cache');
          }
        }
      } catch (error) {
        console.error('[RealizarBote] Error cargando loterías:', error);
      }
    };
    
    loadLotteries();
  }, [currentBankId, isOnline]);

  // Cargar horarios cuando se selecciona una lotería
  useEffect(() => {
    console.log('[RealizarBote] useEffect horarios - currentBankId:', currentBankId, 'selectedLottery:', selectedLottery);
    
    if (!currentBankId || !selectedLottery) {
      console.log('[RealizarBote] No hay bankId o lotería seleccionada, limpiando horarios');
      setScheduleOptions([]);
      setSelectedSchedule(null);
      return;
    }
    
    const loadSchedules = async () => {
      try {
        console.log('[RealizarBote] Iniciando carga de horarios para lotería:', selectedLottery);
        let rows = [];
        
        // Cargar desde cache primero
        const cachedSchedules = await OfflineStorage.getSchedules(null);
        console.log('[RealizarBote] Horarios en cache (todos):', cachedSchedules?.length || 0);
        
        if (cachedSchedules && cachedSchedules.length > 0) {
          rows = cachedSchedules.filter(s => s.id_loteria === selectedLottery);
          console.log('[RealizarBote] Horarios filtrados de cache para lotería:', rows.length);
          console.log('[RealizarBote] Primer horario de cache:', JSON.stringify(rows[0], null, 2));
        }
        
        // Si está online, actualizar desde Supabase
        console.log('[RealizarBote] isOnline:', isOnline);
        if (isOnline) {
          try {
            console.log('[RealizarBote] Consultando Supabase - lotteryId:', selectedLottery);
            const { data, error } = await supabase
              .from('horario')
              .select('id, nombre, id_loteria, hora_inicio, hora_fin')
              .eq('id_loteria', selectedLottery)
              .order('hora_inicio');
            
            console.log('[RealizarBote] Respuesta Supabase - data:', data?.length || 0, 'error:', error);
            
            if (error) {
              console.error('[RealizarBote] Error en query Supabase:', error);
            }
            
            if (data && data.length > 0) {
              console.log('[RealizarBote] Horarios obtenidos de Supabase:', data.length);
              console.log('[RealizarBote] Primer horario de Supabase:', JSON.stringify(data[0], null, 2));
              await OfflineStorage.saveSchedules(data);
              rows = data;
            } else {
              console.log('[RealizarBote] No se obtuvieron horarios de Supabase');
            }
          } catch (onlineError) {
            console.log('[RealizarBote] Error cargando horarios online, usando cache:', onlineError);
          }
        }
        
        console.log('[RealizarBote] Total rows a procesar:', rows.length);
        
        if (!rows || rows.length === 0) {
          console.log('[RealizarBote] No hay horarios disponibles');
          setScheduleOptions([]);
          setSelectedSchedule(null);
          return;
        }
        
        // Mostrar todos los horarios sin filtrar
        const schedulesList = rows.map(r => {
          const horaInicio = r.hora_inicio ? r.hora_inicio.substring(0, 5) : '';
          const horaFin = r.hora_fin ? r.hora_fin.substring(0, 5) : '';
          const labelConHoras = horaInicio && horaFin ? `${r.nombre} (${horaInicio} - ${horaFin})` : r.nombre;
          return { label: labelConHoras, value: r.id };
        });
        
        console.log('[RealizarBote] schedulesList creada:', schedulesList.length);
        console.log('[RealizarBote] Primer elemento de schedulesList:', JSON.stringify(schedulesList[0], null, 2));
        
        setScheduleOptions(schedulesList);
        setSelectedSchedule(null);
      } catch (error) {
        console.error('[RealizarBote] Error cargando horarios:', error);
      }
    };
    
    loadSchedules();
  }, [currentBankId, selectedLottery, isOnline]);

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const handleEnviarBote = async () => {
    if (!selectedSchedule) {
      setFeedbackMessage({ type: 'error', message: 'Debes seleccionar una lotería y un horario' });
      return;
    }
    
    setIsSending(true);
    setFeedbackMessage(null);
    try {
      const { data, error } = await supabase
        .from('realizar_bote')
        .insert({ horario_id: selectedSchedule })
        .select();
      
      if (error) {
        console.error('[RealizarBote] Error enviando bote:', error);
        const errorMessage = error.message || 'No se pudo realizar el bote. Intenta nuevamente.';
        setFeedbackMessage({ type: 'error', message: errorMessage });
        return;
      }
      
      setFeedbackMessage({ type: 'success', message: 'Bote realizado correctamente' });
      setSelectedLottery(null);
      setSelectedSchedule(null);
      setScheduleOptions([]);
      
      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (error) {
      console.error('[RealizarBote] Error enviando bote:', error);
      const errorMessage = error.message || 'Ocurrió un error inesperado';
      setFeedbackMessage({ type: 'error', message: errorMessage });
    } finally {
      setIsSending(false);
    }
  };

  // Opciones únicas de loterías, horarios y tipos de jugada
  const lotteryOptions = useMemo(() => {
    const unique = [...new Set(capacityData.map(item => item.nombre_loteria))];
    return unique.filter(Boolean).sort();
  }, [capacityData]);

  const scheduleFilterOptions = useMemo(() => {
    const unique = [...new Set(capacityData.map(item => item.nombre_horario))];
    return unique.filter(Boolean).sort();
  }, [capacityData]);

  const playTypeOptions = useMemo(() => {
    const unique = [...new Set(capacityData.map(item => item.jugada))];
    return unique.filter(Boolean).sort();
  }, [capacityData]);

  // Datos filtrados
  const filteredData = useMemo(() => {
    let filtered = [...capacityData];
    
    if (sortBy === 'capacity') {
      filtered.sort((a, b) => (b.used_today_banco || 0) - (a.used_today_banco || 0));
    } else {
      filtered.sort((a, b) => {
        const numA = parseInt(a.numero);
        const numB = parseInt(b.numero);
        return numA - numB;
      });
    }
    
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
    
    const boteValue = parseFloat(boteAmount) || 0;
    if (boteValue > 0) {
      filtered = filtered.filter(item => (item.used_today_banco || 0) > boteValue);
    }
    
    return filtered;
  }, [capacityData, lotteryFilter, scheduleFilter, playTypeFilter, searchNumber, boteAmount, sortBy]);

  // Total bruto de los datos filtrados
  const boteValue = parseFloat(boteAmount) || 0;
  const totalBruto = useMemo(() => {
    if (boteValue > 0) {
      return filteredData.reduce((sum, item) => {
        const excedente = (item.used_today_banco || 0) - boteValue;
        return sum + excedente;
      }, 0);
    }
    return filteredData.reduce((sum, item) => sum + (item.used_today_banco || 0), 0);
  }, [filteredData, boteValue]);

  const renderCapacityItem = useCallback(({ item }) => {
    const playType = playTypeLabels[item.jugada] || item.jugada?.toUpperCase() || '';
    
    const currentBoteValue = parseFloat(boteAmount) || 0;
    const displayAmount = currentBoteValue > 0 
      ? (item.used_today_banco || 0) - currentBoteValue 
      : (item.used_today_banco || 0);
    
    return (
      <View style={styles.capacityCard}>
        <View style={styles.firstLine}>
          <Text style={styles.numberText}>{item.numero}</Text>
          <Text style={styles.playTypeText}>{playType}</Text>
          <Text style={[styles.amountText, currentBoteValue > 0 && styles.exceedAmount]}>
            {currentBoteValue > 0 ? '+' : ''}${displayAmount.toFixed(2)}
          </Text>
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
  }, [playTypeLabels, boteAmount]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SideBarToggle inline onToggle={toggleSidebar} style={styles.sidebarButton} />
          <Text style={styles.headerTitle}>Realizar Bote</Text>
        </View>

        {/* Feedback Banner */}
        {feedbackMessage && (
          <FeedbackBanner
            type={feedbackMessage.type}
            message={feedbackMessage.message}
            onClose={() => setFeedbackMessage(null)}
            style={{ top: 70 }}
          />
        )}

        {/* Selectores de lotería y horario */}
        <View style={styles.selectorsContainer}>
          <View style={styles.selectorsRow}>
            <View style={styles.selectorHalf}>
              <DropdownPicker
                label="Lotería"
                value={selectedLottery && lotteries.find(l => l.value === selectedLottery)?.label}
                onSelect={(item) => setSelectedLottery(item.value || item)}
                options={lotteries}
                placeholder="Seleccionar lotería"
              />
            </View>
            <View style={styles.selectorHalf}>
              <DropdownPicker
                label="Horario"
                value={selectedSchedule && scheduleOptions.find(s => s.value === selectedSchedule)?.label}
                onSelect={(item) => setSelectedSchedule(item.value || item)}
                options={scheduleOptions}
                placeholder="Sin horario seleccionado"
              />
            </View>
          </View>
          <View style={styles.sendButtonContainer}>
            <ActionButton
              title={isSending ? 'Enviando...' : 'Enviar Bote'}
              onPress={handleEnviarBote}
              variant="success"
              size="medium"
              disabled={!selectedSchedule || isSending}
            />
          </View>
        </View>

        <View style={styles.filtersBar}>
          <View style={styles.filtersContainer}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Ordenar:</Text>
              <TouchableOpacity style={[styles.sortButton, styles.sortButtonActive]}>
                <Text style={[styles.sortButtonText, styles.sortButtonTextActive]}>
                  Capacidad
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sortButton}>
                <Text style={styles.sortButtonText}>
                  Número
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#27AE60" />
          <Text style={styles.loadingText}>Cargando...</Text>
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
        <SideBarToggle inline onToggle={toggleSidebar} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>Realizar Bote</Text>
      </View>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <FeedbackBanner
          type={feedbackMessage.type}
          message={feedbackMessage.message}
          onClose={() => setFeedbackMessage(null)}
          style={{ top: 70 }}
        />
      )}

      {/* Selectores de lotería y horario */}
      <View style={styles.selectorsContainer}>
        <View style={styles.selectorsRow}>
          <View style={styles.selectorHalf}>
            <DropdownPicker
              label="Lotería"
              value={selectedLottery && lotteries.find(l => l.value === selectedLottery)?.label}
              onSelect={(item) => setSelectedLottery(item.value || item)}
              options={lotteries}
              placeholder="Seleccionar lotería"
            />
          </View>
          <View style={styles.selectorHalf}>
            <DropdownPicker
              label="Horario"
              value={selectedSchedule && scheduleOptions.find(s => s.value === selectedSchedule)?.label}
              onSelect={(item) => setSelectedSchedule(item.value || item)}
              options={scheduleOptions}
              placeholder="Sin horario seleccionado"
            />
          </View>
        </View>
        <View style={styles.sendButtonContainer}>
          <ActionButton
            title={isSending ? 'Enviando...' : 'Enviar Bote'}
            onPress={handleEnviarBote}
            variant="success"
            size="medium"
            disabled={!selectedSchedule || isSending}
          />
        </View>
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
                      <Text style={styles.sortButtonText}>{lottery}</Text>
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
                      <Text style={styles.sortButtonText}>Todas</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Filtro de Horario */}
          {scheduleFilterOptions.length > 0 && (
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
                  {scheduleFilterOptions.map(schedule => (
                    <TouchableOpacity
                      key={schedule}
                      style={styles.sortButton}
                      onPress={() => {
                        setScheduleFilter(schedule);
                        setScheduleExpanded(false);
                      }}
                    >
                      <Text style={styles.sortButtonText}>{schedule}</Text>
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
                      <Text style={styles.sortButtonText}>Todos</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Filtro de Tipo de Jugada */}
          {playTypeOptions.length > 0 && (
            <View style={styles.filterGroupWrapper}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Tipo:</Text>
                <TouchableOpacity
                  style={[styles.sortButton, styles.sortButtonActive]}
                  onPress={() => setPlayTypeExpanded(!playTypeExpanded)}
                >
                  <Text style={[styles.sortButtonText, styles.sortButtonTextActive]}>
                    {playTypeFilter ? playTypeLabels[playTypeFilter] : 'Todos'}
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
                        {playTypeLabels[playType] || playType}
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
                      <Text style={styles.sortButtonText}>Todos</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Búsqueda por Número */}
          <View style={styles.filterGroupWrapper}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Buscar:</Text>
              <TouchableOpacity
                style={[styles.sortButton, searchExpanded && styles.sortButtonActive]}
                onPress={() => setSearchExpanded(!searchExpanded)}
              >
                <Text style={[styles.sortButtonText, searchExpanded && styles.sortButtonTextActive]}>
                  {searchNumber || 'Número'}
                </Text>
              </TouchableOpacity>
            </View>
            {searchExpanded && (
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Número"
                  value={searchNumber}
                  onChangeText={setSearchNumber}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            )}
          </View>

          {/* Monto del Bote */}
          <View style={styles.filterGroupWrapper}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Bote:</Text>
              <TouchableOpacity
                style={[styles.sortButton, boteExpanded && styles.sortButtonActive]}
                onPress={() => setBoteExpanded(!boteExpanded)}
              >
                <Text style={[styles.sortButtonText, boteExpanded && styles.sortButtonTextActive]}>
                  {boteAmount ? `$${boteAmount}` : 'Monto'}
                </Text>
              </TouchableOpacity>
            </View>
            {boteExpanded && (
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="0.00"
                  value={boteAmount}
                  onChangeText={setBoteAmount}
                  keyboardType="decimal-pad"
                />
              </View>
            )}
          </View>

          {/* Total Bruto */}
          <View style={styles.totalBrutoContainer}>
            <Text style={styles.totalBrutoLabel}>Total: </Text>
            <Text style={styles.totalBrutoValue}>${totalBruto.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Lista de Datos */}
      {filteredData.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>
            {capacityData.length === 0
              ? 'Aun no se ha realizado ningun bote.'
              : 'No hay resultados con los filtros aplicados'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          renderItem={renderCapacityItem}
          keyExtractor={(item, index) => `${item.numero}-${item.jugada}-${item.id_horario}-${index}`}
          contentContainerStyle={styles.listContent}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
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
  sidebarButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    flex: 1,
    textAlign: 'center',
  },
  selectorsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 110,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  selectorsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  selectorHalf: {
    flex: 1,
  },
  sendButtonContainer: {
    alignItems: 'center',
  },
  filtersBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  exceedAmount: {
    color: '#E74C3C',
  },
  secondLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
});

export default RealizarBoteScreen;
