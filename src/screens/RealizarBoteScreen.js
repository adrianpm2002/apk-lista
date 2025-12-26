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
  RefreshControl,
  Platform,
  Modal,
  ScrollView,
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
import { createShadowStyle } from '../utils/shadowUtils';

// Importación condicional para exportación PDF
let exportPdfModule;
try {
  if (Platform.OS === 'web') {
    exportPdfModule = require('../utils/pdfExport.web');
  } else {
    exportPdfModule = require('../utils/pdfExport.native');
  }
} catch (error) {
  exportPdfModule = null;
}

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
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [boteData, setBoteData] = useState([]);
  const [sortBy, setSortBy] = useState('cantidad');
  
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
  const [userFilter, setUserFilter] = useState(null);
  const [collectorFilter, setCollectorFilter] = useState(null);
  
  // Estados de expansión
  const [lotteryExpanded, setLotteryExpanded] = useState(false);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [playTypeExpanded, setPlayTypeExpanded] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [boteExpanded, setBoteExpanded] = useState(false);
  const [userExpanded, setUserExpanded] = useState(false);
  const [collectorExpanded, setCollectorExpanded] = useState(false);
  
  // Estados para colector - listeros asociados
  const [listeros, setListeros] = useState([]);
  const [selectedListero, setSelectedListero] = useState(null);
  const [expandedListeros, setExpandedListeros] = useState(new Set());
  
  // Estados para admin (banco) - colectores y acordeón de 3 niveles
  const [colectores, setColectores] = useState([]);
  const [selectedCollector, setSelectedCollector] = useState(null);
  const [expandedCollectors, setExpandedCollectors] = useState(new Set());
  
  // Estados para modal de precio bote (solo admin)
  const [precioBoteModalVisible, setPrecioBoteModalVisible] = useState(false);
  const [precioBoteId, setPrecioBoteId] = useState(null);
  const [listeroPercent, setListeroPercent] = useState('');
  const [collectorPercent, setCollectorPercent] = useState('');
  const [fijoPrice, setFijoPrice] = useState('');
  const [corridoPrice, setCorridoPrice] = useState('');
  const [parlePrice, setParlePrice] = useState('');
  const [centenaPrice, setCentenaPrice] = useState('');
  const [tripletaPrice, setTripletaPrice] = useState('');
  const [loadingPrecio, setLoadingPrecio] = useState(false);
  const [savingPrecio, setSavingPrecio] = useState(false);

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
        setCurrentUserId(user.id);
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

  // Cargar datos del bote
  const fetchBoteData = useCallback(async () => {
    if (!currentUserId || !userRole) return;
    
    try {
      let query = supabase
        .from('v_bote')
        .select('*');
      
      // Para listero: filtrar por su propio ID
      // Para colector: filtrar por todos los botes de sus listeros asociados
      if (userRole === 'listero') {
        query = query.eq('listero_id', currentUserId);
      } else if (userRole === 'collector') {
        query = query.eq('collector_id', currentUserId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        Alert.alert('Error', 'No se pudieron cargar los datos del bote');
        return;
      }
      
      setBoteData(data || []);
    } catch (error) {
    }
  }, [currentUserId, userRole]);

  // Cargar colectores asociados (solo para admin/banco)
  const fetchColectores = useCallback(async () => {
    if (!currentUserId || userRole !== 'admin') return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id_banco', currentUserId)
        .eq('role', 'collector')
        .order('username');
      
      if (error) {
        console.error('[RealizarBote] Error cargando colectores:', error);
        return;
      }
      
      console.log('[RealizarBote] Colectores cargados:', data?.length || 0);
      setColectores(data || []);
    } catch (error) {
      console.error('[RealizarBote] Error en fetchColectores:', error);
    }
  }, [currentUserId, userRole]);
  
  // Cargar listeros asociados (para colector o para admin según colector seleccionado)
  const fetchListeros = useCallback(async () => {
    if (!currentUserId || !userRole) return;
    
    // Para colector: cargar sus propios listeros
    if (userRole === 'collector') {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('id_collector', currentUserId)
          .eq('role', 'listero')
          .order('username');
        
        if (error) {
          console.error('[RealizarBote] Error cargando listeros:', error);
          return;
        }
        
        console.log('[RealizarBote] Listeros cargados:', data?.length || 0);
        setListeros(data || []);
      } catch (error) {
        console.error('[RealizarBote] Error en fetchListeros:', error);
      }
    }
    // Para admin: cargar listeros del colector seleccionado
    else if (userRole === 'admin' && selectedCollector) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('id_collector', selectedCollector)
          .eq('role', 'listero')
          .order('username');
        
        if (error) {
          console.error('[RealizarBote] Error cargando listeros del colector:', error);
          return;
        }
        
        console.log('[RealizarBote] Listeros del colector cargados:', data?.length || 0);
        setListeros(data || []);
      } catch (error) {
        console.error('[RealizarBote] Error en fetchListeros para admin:', error);
      }
    }
  }, [currentUserId, userRole, selectedCollector]);
  
  // Cargar precio de bote configurado (solo admin)
  const fetchPrecioBote = useCallback(async () => {
    if (!currentUserId || userRole !== 'admin') return;
    
    setLoadingPrecio(true);
    try {
      const { data, error } = await supabase
        .from('precio_bote')
        .select('*')
        .eq('banco_id', currentUserId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('[RealizarBote] Error cargando precio bote:', error);
        return;
      }
      
      if (data) {
        setPrecioBoteId(data.id);
        setListeroPercent(data.listero?.toString() || '');
        setCollectorPercent(data.colector?.toString() || '');
        setFijoPrice(data.fijo?.toString() || '');
        setCorridoPrice(data.corrido?.toString() || '');
        setParlePrice(data.parle?.toString() || '');
        setCentenaPrice(data.centena?.toString() || '');
        setTripletaPrice(data.tripleta?.toString() || '');
      }
    } catch (error) {
      console.error('[RealizarBote] Error en fetchPrecioBote:', error);
    } finally {
      setLoadingPrecio(false);
    }
  }, [currentUserId, userRole]);
  
  // Cargar datos al entrar y cuando cambie currentUserId o userRole
  useEffect(() => {
    if (currentUserId && userRole) {
      fetchBoteData();
      if (userRole === 'collector') {
        fetchListeros();
      } else if (userRole === 'admin') {
        fetchColectores();
      }
    }
  }, [currentUserId, userRole, fetchBoteData, fetchListeros, fetchColectores]);
  
  // Cargar listeros cuando se seleccione un colector (solo admin)
  useEffect(() => {
    if (userRole === 'admin' && selectedCollector) {
      fetchListeros();
    } else if (userRole === 'admin' && !selectedCollector) {
      setListeros([]);
      setSelectedListero(null);
    }
  }, [selectedCollector, userRole, fetchListeros]);
  
  // Cargar precio bote cuando se abre el modal
  useEffect(() => {
    if (precioBoteModalVisible && userRole === 'admin') {
      fetchPrecioBote();
    }
  }, [precioBoteModalVisible, userRole, fetchPrecioBote]);

  // Función para refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBoteData();
    setRefreshing(false);
  }, [fetchBoteData]);

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
          }
        }
      } catch (error) {
      }
    };
    
    loadLotteries();
  }, [currentBankId, isOnline]);

  // Cargar horarios cuando se selecciona una lotería
  useEffect(() => {
    if (!currentBankId || !selectedLottery) {
      setScheduleOptions([]);
      setSelectedSchedule(null);
      return;
    }
    
    const loadSchedules = async () => {
      try {
        let rows = [];
        
        // Cargar desde cache primero
        const cachedSchedules = await OfflineStorage.getSchedules(null);
        
        if (cachedSchedules && cachedSchedules.length > 0) {
          rows = cachedSchedules.filter(s => s.id_loteria === selectedLottery);
        }
        
        // Si está online, actualizar desde Supabase
        if (isOnline) {
          try {
            const { data, error } = await supabase
              .from('horario')
              .select('id, nombre, id_loteria, hora_inicio, hora_fin')
              .eq('id_loteria', selectedLottery)
              .order('hora_inicio');
            
            if (data && data.length > 0) {
              await OfflineStorage.saveSchedules(data);
              rows = data;
            }
          } catch (onlineError) {
          }
        }
        
        if (!rows || rows.length === 0) {
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
        
        setScheduleOptions(schedulesList);
        setSelectedSchedule(null);
      } catch (error) {
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
    
    // Validación adicional para colector
    if (userRole === 'collector' && !selectedListero) {
      setFeedbackMessage({ type: 'error', message: 'Debes seleccionar un listero' });
      return;
    }
    
    // Validación adicional para admin (banco)
    if (userRole === 'admin') {
      if (!selectedCollector) {
        setFeedbackMessage({ type: 'error', message: 'Debes seleccionar un colector' });
        return;
      }
      if (!selectedListero) {
        setFeedbackMessage({ type: 'error', message: 'Debes seleccionar un listero' });
        return;
      }
    }
    
    setIsSending(true);
    setFeedbackMessage(null);
    try {
      // Determinar el listero_id según el rol
      let listeroId;
      if (userRole === 'listero') {
        listeroId = currentUserId;
      } else if (userRole === 'collector' || userRole === 'admin') {
        listeroId = selectedListero;
      }
      
      const { data, error } = await supabase
        .from('realizar_bote')
        .insert({ horario_id: selectedSchedule, listero_id: listeroId })
        .select();
      
      if (error) {
        const errorMessage = error.message || 'No se pudo realizar el bote. Intenta nuevamente.';
        setFeedbackMessage({ type: 'error', message: errorMessage });
        return;
      }
      
      setFeedbackMessage({ type: 'success', message: 'Bote realizado correctamente' });
      setSelectedLottery(null);
      setSelectedSchedule(null);
      setScheduleOptions([]);
      setSelectedListero(null);
      setSelectedCollector(null);
      
      // Actualizar datos del bote automáticamente
      await fetchBoteData();
      
      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (error) {
      const errorMessage = error.message || 'Ocurrió un error inesperado';
      setFeedbackMessage({ type: 'error', message: errorMessage });
    } finally {
      setIsSending(false);
    }
  };

  // Opciones únicas de loterías, horarios, tipos de jugada y usuarios
  const lotteryOptions = useMemo(() => {
    const unique = [...new Set(boteData.map(item => item.loteria_nombre))];
    return unique.filter(Boolean).sort();
  }, [boteData]);

  const scheduleFilterOptions = useMemo(() => {
    const unique = [...new Set(boteData.map(item => item.horario_nombre))];
    return unique.filter(Boolean).sort();
  }, [boteData]);

  const playTypeOptions = useMemo(() => {
    const unique = [...new Set(boteData.map(item => item.jugada))];
    return unique.filter(Boolean).sort();
  }, [boteData]);
  
  const userOptions = useMemo(() => {
    const unique = [...new Set(boteData.map(item => item.listero_username))];
    return unique.filter(Boolean).sort();
  }, [boteData]);
  
  const collectorOptions = useMemo(() => {
    const unique = [...new Set(boteData.map(item => item.collector_username))];
    return unique.filter(Boolean).sort();
  }, [boteData]);

  // Datos filtrados
  const filteredData = useMemo(() => {
    let filtered = [...boteData];
    
    if (sortBy === 'cantidad') {
      filtered.sort((a, b) => (b.monto || 0) - (a.monto || 0));
    } else {
      filtered.sort((a, b) => {
        const numA = parseInt(a.numero);
        const numB = parseInt(b.numero);
        return numA - numB;
      });
    }
    
    if (lotteryFilter) {
      filtered = filtered.filter(item => item.loteria_nombre === lotteryFilter);
    }
    
    if (scheduleFilter) {
      filtered = filtered.filter(item => item.horario_nombre === scheduleFilter);
    }
    
    if (playTypeFilter) {
      filtered = filtered.filter(item => item.jugada === playTypeFilter);
    }
    
    if (collectorFilter) {
      filtered = filtered.filter(item => item.collector_username === collectorFilter);
    }
    
    if (userFilter) {
      filtered = filtered.filter(item => item.listero_username === userFilter);
    }
    
    if (searchNumber) {
      filtered = filtered.filter(item => matchesSearch(item.numero, searchNumber));
    }
    
    return filtered;
  }, [boteData, lotteryFilter, scheduleFilter, playTypeFilter, collectorFilter, userFilter, searchNumber, sortBy]);

  // Agrupar datos por listero (solo para colector)
  const groupedByListero = useMemo(() => {
    if (userRole !== 'collector') return null;
    
    const groups = {};
    filteredData.forEach(item => {
      const username = item.listero_username;
      if (!groups[username]) {
        groups[username] = {
          listero_username: username,
          items: [],
          total: 0
        };
      }
      groups[username].items.push(item);
      groups[username].total += parseFloat(item.monto) || 0;
    });
    
    return Object.values(groups).sort((a, b) => 
      a.listero_username.localeCompare(b.listero_username)
    );
  }, [filteredData, userRole]);
  
  // Agrupar datos por colector y listero (solo para admin/banco)
  const groupedByCollectorAndListero = useMemo(() => {
    if (userRole !== 'admin') return null;
    
    const collectorGroups = {};
    filteredData.forEach(item => {
      const collectorName = item.collector_username;
      const listeroName = item.listero_username;
      
      if (!collectorGroups[collectorName]) {
        collectorGroups[collectorName] = {
          collector_username: collectorName,
          listeros: {},
          total: 0
        };
      }
      
      if (!collectorGroups[collectorName].listeros[listeroName]) {
        collectorGroups[collectorName].listeros[listeroName] = {
          listero_username: listeroName,
          items: [],
          total: 0
        };
      }
      
      collectorGroups[collectorName].listeros[listeroName].items.push(item);
      collectorGroups[collectorName].listeros[listeroName].total += parseFloat(item.monto) || 0;
      collectorGroups[collectorName].total += parseFloat(item.monto) || 0;
    });
    
    // Convertir a array y ordenar
    return Object.values(collectorGroups).map(collector => ({
      ...collector,
      listeros: Object.values(collector.listeros).sort((a, b) => 
        a.listero_username.localeCompare(b.listero_username)
      )
    })).sort((a, b) => 
      a.collector_username.localeCompare(b.collector_username)
    );
  }, [filteredData, userRole]);
  
  // Total de los datos filtrados
  const total = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0);
  }, [filteredData]);

  const renderBoteItem = useCallback(({ item }) => {
    const playType = playTypeLabels[item.jugada] || item.jugada?.toUpperCase() || '';
    
    return (
      <View style={styles.boteCard}>
        <View style={styles.firstLine}>
          <Text style={styles.numberText}>{item.numero}</Text>
          <Text style={styles.playTypeText}>{playType}</Text>
          <Text style={styles.amountText}>
            ${(parseFloat(item.monto) || 0).toFixed(2)}
          </Text>
        </View>

        <View style={styles.secondLine}>
          <Text style={styles.lotteryText}>{item.loteria_nombre}</Text>
          <Text style={styles.separator}> - </Text>
          <Text style={styles.scheduleText}>
            {item.horario_nombre}
          </Text>
        </View>
      </View>
    );
  }, [playTypeLabels]);
  
  // Renderizar grupo de listero (solo para colector)
  const renderListeroGroup = useCallback(({ item: group }) => {
    const isExpanded = expandedListeros.has(group.listero_username);
    
    return (
      <View>
        <TouchableOpacity
          style={styles.listeroHeader}
          onPress={() => {
            const newExpanded = new Set(expandedListeros);
            if (isExpanded) {
              newExpanded.delete(group.listero_username);
            } else {
              newExpanded.add(group.listero_username);
            }
            setExpandedListeros(newExpanded);
          }}
        >
          <Text style={styles.listeroHeaderIcon}>{isExpanded ? '▼' : '▶'}</Text>
          <View style={styles.listeroHeaderContent}>
            <Text style={styles.listeroHeaderText}>{group.listero_username}</Text>
            <Text style={styles.listeroHeaderTotal}>${group.total.toFixed(2)}</Text>
          </View>
        </TouchableOpacity>
        
        {isExpanded && group.items.map((item, index) => {
          const playType = playTypeLabels[item.jugada] || item.jugada?.toUpperCase() || '';
          return (
            <View key={`${item.bote_id}-${index}`} style={styles.boteCard}>
              <View style={styles.firstLine}>
                <Text style={styles.numberText}>{item.numero}</Text>
                <Text style={styles.playTypeText}>{playType}</Text>
                <Text style={styles.amountText}>
                  ${(parseFloat(item.monto) || 0).toFixed(2)}
                </Text>
              </View>

              <View style={styles.secondLine}>
                <Text style={styles.lotteryText}>{item.loteria_nombre}</Text>
                <Text style={styles.separator}> - </Text>
                <Text style={styles.scheduleText}>
                  {item.horario_nombre}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }, [expandedListeros, playTypeLabels]);
  
  // Guardar o actualizar precio de bote
  const handleSavePrecioBote = async () => {
    // Validar que no sean cero o negativos
    const values = [
      { name: 'Listero', value: listeroPercent },
      { name: 'Colector', value: collectorPercent },
      { name: 'Fijo', value: fijoPrice },
      { name: 'Corrido', value: corridoPrice },
      { name: 'Parlé', value: parlePrice },
      { name: 'Centena', value: centenaPrice },
      { name: 'Tripleta', value: tripletaPrice },
    ];
    
    for (const field of values) {
      if (field.value && field.value.trim() !== '') {
        const num = parseFloat(field.value);
        if (isNaN(num) || num <= 0) {
          Alert.alert('Error', `${field.name} debe ser un número mayor que cero o vacío`);
          return;
        }
      }
    }
    
    setSavingPrecio(true);
    try {
      const dataToSave = {
        listero: listeroPercent && listeroPercent.trim() !== '' ? parseFloat(listeroPercent) : null,
        colector: collectorPercent && collectorPercent.trim() !== '' ? parseFloat(collectorPercent) : null,
        fijo: fijoPrice && fijoPrice.trim() !== '' ? parseFloat(fijoPrice) : null,
        corrido: corridoPrice && corridoPrice.trim() !== '' ? parseFloat(corridoPrice) : null,
        parle: parlePrice && parlePrice.trim() !== '' ? parseFloat(parlePrice) : null,
        centena: centenaPrice && centenaPrice.trim() !== '' ? parseFloat(centenaPrice) : null,
        tripleta: tripletaPrice && tripletaPrice.trim() !== '' ? parseFloat(tripletaPrice) : null,
      };
      
      let result;
      if (precioBoteId) {
        // Actualizar registro existente
        const { data, error } = await supabase
          .from('precio_bote')
          .update(dataToSave)
          .eq('id', precioBoteId)
          .select()
          .single();
        
        if (error) {
          console.error('[RealizarBote] Error actualizando precio bote:', error);
          Alert.alert('Error', 'No se pudo actualizar el precio del bote');
          return;
        }
        result = data;
      } else {
        // Insertar nuevo registro
        const { data, error } = await supabase
          .from('precio_bote')
          .insert({ ...dataToSave, banco_id: currentUserId })
          .select()
          .single();
        
        if (error) {
          console.error('[RealizarBote] Error insertando precio bote:', error);
          Alert.alert('Error', 'No se pudo guardar el precio del bote');
          return;
        }
        result = data;
        setPrecioBoteId(data.id);
      }
      
      Alert.alert('Éxito', 'Precio del bote guardado correctamente');
      
      // Recargar los datos para mostrar los valores guardados
      await fetchPrecioBote();
    } catch (error) {
      console.error('[RealizarBote] Error en handleSavePrecioBote:', error);
      Alert.alert('Error', 'Ocurrió un error al guardar');
    } finally {
      setSavingPrecio(false);
    }
  };
  
  // Renderizar grupo de colector con sus listeros (solo para admin/banco)
  const renderCollectorGroup = useCallback(({ item: collectorGroup }) => {
    const isCollectorExpanded = expandedCollectors.has(collectorGroup.collector_username);
    
    return (
      <View>
        <TouchableOpacity
          style={styles.collectorHeader}
          onPress={() => {
            const newExpanded = new Set(expandedCollectors);
            if (isCollectorExpanded) {
              newExpanded.delete(collectorGroup.collector_username);
            } else {
              newExpanded.add(collectorGroup.collector_username);
            }
            setExpandedCollectors(newExpanded);
          }}
        >
          <Text style={styles.collectorHeaderIcon}>{isCollectorExpanded ? '▼' : '▶'}</Text>
          <View style={styles.collectorHeaderContent}>
            <Text style={styles.collectorHeaderText}>{collectorGroup.collector_username}</Text>
            <Text style={styles.collectorHeaderTotal}>${collectorGroup.total.toFixed(2)}</Text>
          </View>
        </TouchableOpacity>
        
        {isCollectorExpanded && collectorGroup.listeros.map((listeroGroup) => {
          const isListeroExpanded = expandedListeros.has(`${collectorGroup.collector_username}-${listeroGroup.listero_username}`);
          
          return (
            <View key={listeroGroup.listero_username} style={styles.listeroNestedContainer}>
              <TouchableOpacity
                style={styles.listeroNestedHeader}
                onPress={() => {
                  const key = `${collectorGroup.collector_username}-${listeroGroup.listero_username}`;
                  const newExpanded = new Set(expandedListeros);
                  if (isListeroExpanded) {
                    newExpanded.delete(key);
                  } else {
                    newExpanded.add(key);
                  }
                  setExpandedListeros(newExpanded);
                }}
              >
                <Text style={styles.listeroNestedIcon}>{isListeroExpanded ? '▼' : '▶'}</Text>
                <View style={styles.listeroNestedContent}>
                  <Text style={styles.listeroNestedText}>{listeroGroup.listero_username}</Text>
                  <Text style={styles.listeroNestedTotal}>${listeroGroup.total.toFixed(2)}</Text>
                </View>
              </TouchableOpacity>
              
              {isListeroExpanded && listeroGroup.items.map((item, index) => {
                const playType = playTypeLabels[item.jugada] || item.jugada?.toUpperCase() || '';
                return (
                  <View key={`${item.bote_id}-${index}`} style={[styles.boteCard, styles.boteCardNested]}>
                    <View style={styles.firstLine}>
                      <Text style={styles.numberText}>{item.numero}</Text>
                      <Text style={styles.playTypeText}>{playType}</Text>
                      <Text style={styles.amountText}>
                        ${(parseFloat(item.monto) || 0).toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.secondLine}>
                      <Text style={styles.lotteryText}>{item.loteria_nombre}</Text>
                      <Text style={styles.separator}> - </Text>
                      <Text style={styles.scheduleText}>
                        {item.horario_nombre}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  }, [expandedCollectors, expandedListeros, playTypeLabels]);

  const handleExportPDF = async () => {
    if (!exportPdfModule) {
      Alert.alert('Error', 'La funcionalidad de exportar PDF no está disponible en esta plataforma');
      return;
    }

    if (filteredData.length === 0) {
      Alert.alert('Sin datos', 'No hay datos para exportar');
      return;
    }

    try {
      // Estilos profesionales como en StatisticsScreen
      const style = `
        <style>
          body{ 
            font-family: Arial, sans-serif; 
            margin: 20px;
            color: #333;
          }
          h2{ 
            margin: 0 0 16px 0; 
            font-size: 18px; 
            color: #1976D2;
            border-bottom: 2px solid #1976D2;
            padding-bottom: 8px;
          }
          table{ 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          th, td{ 
            border: 1px solid #ddd; 
            padding: 8px; 
            font-size: 11px; 
            text-align: left;
            vertical-align: top;
          }
          th {
            white-space: nowrap;
          }
          td {
            word-wrap: break-word;
            word-break: break-word;
            overflow-wrap: break-word;
            min-height: 30px;
          }
          thead{ 
            background: #1976D2;
            color: white;
            font-weight: bold;
          }
          tbody tr:nth-child(even) {
            background: #f9f9f9;
          }
          tbody tr:hover {
            background: #f0f0f0;
          }
          .summary-box {
            background: #f0f0f0;
            padding: 16px;
            margin-bottom: 20px;
            border-radius: 8px;
            border-left: 4px solid #1976D2;
            page-break-inside: avoid;
          }
          .filter-box {
            background: #fff3cd;
            padding: 12px;
            margin-bottom: 16px;
            border-radius: 4px;
            border-left: 4px solid #ffc107;
            page-break-inside: avoid;
          }
          @media print {
            body { 
              margin: 10px; 
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            h2 { 
              page-break-before: avoid;
              color: #1976D2 !important;
            }
            table { 
              page-break-inside: avoid;
              box-shadow: none;
            }
            thead {
              background: #1976D2 !important;
              color: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            tbody tr:nth-child(even) {
              background: #f9f9f9 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .summary-box, .filter-box {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      `;

      // Información de filtros aplicados
      const filtrosActivos = [];
      
      if (lotteryFilter) {
        filtrosActivos.push(`<div><strong>Lotería:</strong> ${lotteryFilter}</div>`);
      } else {
        filtrosActivos.push('<div><strong>Lotería:</strong> Todas</div>');
      }
      
      if (scheduleFilter) {
        filtrosActivos.push(`<div><strong>Horario:</strong> ${scheduleFilter}</div>`);
      } else {
        filtrosActivos.push('<div><strong>Horario:</strong> Todos</div>');
      }

      if (playTypeFilter) {
        const typeName = playTypeLabels[playTypeFilter] || playTypeFilter.toUpperCase();
        filtrosActivos.push(`<div><strong>Tipo:</strong> ${typeName}</div>`);
      } else {
        filtrosActivos.push('<div><strong>Tipo:</strong> Todos</div>');
      }

      if (searchNumber) {
        filtrosActivos.push(`<div><strong>Búsqueda:</strong> "${searchNumber}"</div>`);
      }
      
      if (sortBy) {
        const sortLabel = sortBy === 'cantidad' ? 'Cantidad' : 'Número';
        filtrosActivos.push(`<div><strong>Ordenar por:</strong> ${sortLabel}</div>`);
      }

      const filtrosHTML = `
        <div class="filter-box">
          <h4 style="margin:0 0 8px 0; font-size:12px; color:#856404;">🔍 Filtros Aplicados</h4>
          <div style="font-size:10px; color:#856404;">
            ${filtrosActivos.join('')}
            <div><strong>Total de registros:</strong> ${filteredData.length}</div>
          </div>
        </div>
      `;

      // Resumen general
      const resumenHTML = `
        <div class="summary-box">
          <h3 style="margin:0 0 12px 0; font-size:15px; color:#1976D2;">📊 Resumen General</h3>
          <table style="width:100%; border:none; font-size:11px; margin:0;">
            <tr>
              <td style="border:none; padding:3px; width:50%;"><strong>Total de Números:</strong> ${filteredData.length}</td>
              <td style="border:none; padding:3px; width:50%;"><strong>Total Monto:</strong> $${total.toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="2" style="border:none; padding:3px;">
                <strong>Fecha de Exportación:</strong> ${new Date().toLocaleString('es-ES', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </td>
            </tr>
          </table>
        </div>
      `;

      // Generar filas de la tabla
      const rows = filteredData.map(item => {
        const playType = playTypeLabels[item.jugada] || item.jugada?.toUpperCase() || '';
        const monto = (parseFloat(item.monto) || 0).toFixed(2);
        return `
          <tr>
            <td>${item.numero || ''}</td>
            <td>${playType}</td>
            <td>$${monto}</td>
            <td>${item.loteria_nombre || ''}</td>
            <td>${item.horario_nombre || ''}</td>
          </tr>
        `;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>${style}</head><body>
        <h2>Reporte de Bote</h2>
        ${filtrosHTML}
        ${resumenHTML}
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Jugada</th>
              <th>Monto</th>
              <th>Lotería</th>
              <th>Horario</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body></html>`;

      const success = await exportPdfModule.exportPdf(html);

      if (success) {
        Alert.alert('Éxito', 'PDF exportado correctamente');
      } else {
        Alert.alert('Error', 'No se pudo generar el PDF');
      }
    } catch (error) {
      Alert.alert('Error', `No se pudo exportar: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SideBarToggle inline onToggle={toggleSidebar} style={styles.sidebarButton} />
          <Text style={styles.headerTitle}>Bote</Text>
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
          
          {/* Selector de colector (solo para admin/banco) */}
          {userRole === 'admin' && (
            <View style={styles.selectorsRow}>
              <View style={styles.selectorFull}>
                <DropdownPicker
                  label="Colector"
                  value={selectedCollector && colectores.find(c => c.id === selectedCollector)?.username}
                  onSelect={(item) => setSelectedCollector(item.id || item)}
                  options={colectores.map(c => ({ label: c.username, value: c.id, id: c.id }))}
                  placeholder="Seleccionar colector"
                />
              </View>
            </View>
          )}
          
          {/* Selector de listero (para colector o admin) */}
          {(userRole === 'collector' || userRole === 'admin') && (
            <View style={styles.selectorsRow}>
              <View style={styles.selectorFull}>
                <DropdownPicker
                  label="Listero"
                  value={selectedListero && listeros.find(l => l.id === selectedListero)?.username}
                  onSelect={(item) => setSelectedListero(item.id || item)}
                  options={listeros.map(l => ({ label: l.username, value: l.id, id: l.id }))}
                  placeholder={userRole === 'admin' && !selectedCollector ? "Selecciona un colector primero" : "Seleccionar listero"}
                  disabled={userRole === 'admin' && !selectedCollector}
                />
              </View>
            </View>
          )}
          
          <View style={styles.sendButtonContainer}>
            <ActionButton
              title={isSending ? 'Enviando...' : 'Enviar Bote'}
              onPress={handleEnviarBote}
              variant="success"
              size="medium"
              disabled={!selectedSchedule || isSending || (userRole === 'collector' && !selectedListero) || (userRole === 'admin' && (!selectedCollector || !selectedListero))}
            />
          </View>
        </View>

        <View style={styles.filtersBar}>
          <View style={styles.filtersContainer}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Ordenar:</Text>
              <TouchableOpacity style={[styles.sortButton, styles.sortButtonActive]}>
                <Text style={[styles.sortButtonText, styles.sortButtonTextActive]}>
                  Cantidad
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
        <Text style={styles.headerTitle}>Bote</Text>
        <View style={styles.headerButtons}>
          {userRole === 'admin' && (
            <TouchableOpacity
              style={styles.configButton}
              onPress={() => setPrecioBoteModalVisible(true)}
            >
              <Text style={styles.configButtonText}>
                ⚙️ Precio
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExportPDF}
            disabled={filteredData.length === 0}
          >
            <Text style={[styles.exportButtonText, filteredData.length === 0 && styles.exportButtonDisabled]}>
              📄 PDF
            </Text>
          </TouchableOpacity>
        </View>
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
        
        {/* Selector de colector (solo para admin/banco) */}
        {userRole === 'admin' && (
          <View style={styles.selectorsRow}>
            <View style={styles.selectorFull}>
              <DropdownPicker
                label="Colector"
                value={selectedCollector && colectores.find(c => c.id === selectedCollector)?.username}
                onSelect={(item) => setSelectedCollector(item.id || item)}
                options={colectores.map(c => ({ label: c.username, value: c.id, id: c.id }))}
                placeholder="Seleccionar colector"
              />
            </View>
          </View>
        )}
        
        {/* Selector de listero (para colector o admin) */}
        {(userRole === 'collector' || userRole === 'admin') && (
          <View style={styles.selectorsRow}>
            <View style={styles.selectorFull}>
              <DropdownPicker
                label="Listero"
                value={selectedListero && listeros.find(l => l.id === selectedListero)?.username}
                onSelect={(item) => setSelectedListero(item.id || item)}
                options={listeros.map(l => ({ label: l.username, value: l.id, id: l.id }))}
                placeholder={userRole === 'admin' && !selectedCollector ? "Selecciona un colector primero" : "Seleccionar listero"}
                disabled={userRole === 'admin' && !selectedCollector}
              />
            </View>
          </View>
        )}
        
        <View style={styles.sendButtonContainer}>
          <ActionButton
            title={isSending ? 'Enviando...' : 'Enviar Bote'}
            onPress={handleEnviarBote}
            variant="success"
            size="medium"
            disabled={!selectedSchedule || isSending || (userRole === 'collector' && !selectedListero) || (userRole === 'admin' && (!selectedCollector || !selectedListero))}
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
              style={[styles.sortButton, sortBy === 'cantidad' && styles.sortButtonActive]}
              onPress={() => setSortBy('cantidad')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'cantidad' && styles.sortButtonTextActive]}>
                Cantidad
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'numero' && styles.sortButtonActive]}
              onPress={() => setSortBy('numero')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'numero' && styles.sortButtonTextActive]}>
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

          {/* Filtro de Colector (solo para admin) */}
          {userRole === 'admin' && collectorOptions.length > 0 && (
            <View style={styles.filterGroupWrapper}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Colector:</Text>
                <TouchableOpacity
                  style={[styles.sortButton, styles.sortButtonActive]}
                  onPress={() => setCollectorExpanded(!collectorExpanded)}
                >
                  <Text style={[styles.sortButtonText, styles.sortButtonTextActive]}>
                    {collectorFilter || 'Todos'}
                  </Text>
                </TouchableOpacity>
              </View>
              {collectorExpanded && (
                <View style={styles.expandedOptions}>
                  {collectorOptions.map(collectorName => (
                    <TouchableOpacity
                      key={collectorName}
                      style={styles.sortButton}
                      onPress={() => {
                        setCollectorFilter(collectorName);
                        setCollectorExpanded(false);
                      }}
                    >
                      <Text style={styles.sortButtonText}>{collectorName}</Text>
                    </TouchableOpacity>
                  ))}
                  {collectorFilter && (
                    <TouchableOpacity
                      style={styles.sortButton}
                      onPress={() => {
                        setCollectorFilter(null);
                        setCollectorExpanded(false);
                      }}
                    >
                      <Text style={styles.sortButtonText}>Todos</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Filtro de Usuario/Listero (para colector o admin) */}
          {(userRole === 'collector' || userRole === 'admin') && userOptions.length > 0 && (
            <View style={styles.filterGroupWrapper}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Listero:</Text>
                <TouchableOpacity
                  style={[styles.sortButton, styles.sortButtonActive]}
                  onPress={() => setUserExpanded(!userExpanded)}
                >
                  <Text style={[styles.sortButtonText, styles.sortButtonTextActive]}>
                    {userFilter || 'Todos'}
                  </Text>
                </TouchableOpacity>
              </View>
              {userExpanded && (
                <View style={styles.expandedOptions}>
                  {userOptions.map(username => (
                    <TouchableOpacity
                      key={username}
                      style={styles.sortButton}
                      onPress={() => {
                        setUserFilter(username);
                        setUserExpanded(false);
                      }}
                    >
                      <Text style={styles.sortButtonText}>{username}</Text>
                    </TouchableOpacity>
                  ))}
                  {userFilter && (
                    <TouchableOpacity
                      style={styles.sortButton}
                      onPress={() => {
                        setUserFilter(null);
                        setUserExpanded(false);
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

          {/* Total */}
          <View style={styles.totalBrutoContainer}>
            <Text style={styles.totalBrutoLabel}>Total: </Text>
            <Text style={styles.totalBrutoValue}>${total.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Lista de Datos */}
      {filteredData.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>
            {boteData.length === 0
              ? 'Aun no se ha realizado ningun bote.'
              : 'No hay resultados con los filtros aplicados'}
          </Text>
        </View>
      ) : userRole === 'admin' ? (
        <FlatList
          data={groupedByCollectorAndListero}
          renderItem={renderCollectorGroup}
          keyExtractor={(item) => item.collector_username}
          contentContainerStyle={styles.listContent}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#27AE60']}
              tintColor="#27AE60"
            />
          }
        />
      ) : userRole === 'collector' ? (
        <FlatList
          data={groupedByListero}
          renderItem={renderListeroGroup}
          keyExtractor={(item) => item.listero_username}
          contentContainerStyle={styles.listContent}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#27AE60']}
              tintColor="#27AE60"
            />
          }
        />
      ) : (
        <FlatList
          data={filteredData}
          renderItem={renderBoteItem}
          keyExtractor={(item, index) => `${item.bote_id}-${index}`}
          contentContainerStyle={styles.listContent}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#27AE60']}
              tintColor="#27AE60"
            />
          }
        />
      )}

      <SideBarWrapper
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
        role={userRole}
      />
      
      {/* Modal de Configuración de Precio Bote (solo admin) */}
      {userRole === 'admin' && (
        <Modal
          visible={precioBoteModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPrecioBoteModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Configurar Precio de Bote</Text>
                <TouchableOpacity
                  onPress={() => setPrecioBoteModalVisible(false)}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {loadingPrecio ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color="#27AE60" />
                  <Text style={styles.modalLoadingText}>Cargando...</Text>
                </View>
              ) : (
                <ScrollView style={styles.modalScrollContent}>
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Porcentajes (%)</Text>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Listero %</Text>
                      <View style={styles.modalInputWrapper}>
                        <TextInput
                          style={styles.modalInput}
                          value={listeroPercent}
                          onChangeText={setListeroPercent}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor="#95A5A6"
                        />
                        <Text style={styles.modalInputSuffix}>%</Text>
                      </View>
                    </View>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Colector %</Text>
                      <View style={styles.modalInputWrapper}>
                        <TextInput
                          style={styles.modalInput}
                          value={collectorPercent}
                          onChangeText={setCollectorPercent}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor="#95A5A6"
                        />
                        <Text style={styles.modalInputSuffix}>%</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Precios ($)</Text>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Fijo</Text>
                      <View style={styles.modalInputWrapper}>
                        <Text style={styles.modalInputPrefix}>$</Text>
                        <TextInput
                          style={[styles.modalInput, styles.modalInputWithPrefix]}
                          value={fijoPrice}
                          onChangeText={setFijoPrice}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor="#95A5A6"
                        />
                      </View>
                    </View>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Corrido</Text>
                      <View style={styles.modalInputWrapper}>
                        <Text style={styles.modalInputPrefix}>$</Text>
                        <TextInput
                          style={[styles.modalInput, styles.modalInputWithPrefix]}
                          value={corridoPrice}
                          onChangeText={setCorridoPrice}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor="#95A5A6"
                        />
                      </View>
                    </View>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Parlé</Text>
                      <View style={styles.modalInputWrapper}>
                        <Text style={styles.modalInputPrefix}>$</Text>
                        <TextInput
                          style={[styles.modalInput, styles.modalInputWithPrefix]}
                          value={parlePrice}
                          onChangeText={setParlePrice}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor="#95A5A6"
                        />
                      </View>
                    </View>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Centena</Text>
                      <View style={styles.modalInputWrapper}>
                        <Text style={styles.modalInputPrefix}>$</Text>
                        <TextInput
                          style={[styles.modalInput, styles.modalInputWithPrefix]}
                          value={centenaPrice}
                          onChangeText={setCentenaPrice}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor="#95A5A6"
                        />
                      </View>
                    </View>
                    
                    <View style={styles.modalInputGroup}>
                      <Text style={styles.modalLabel}>Tripleta</Text>
                      <View style={styles.modalInputWrapper}>
                        <Text style={styles.modalInputPrefix}>$</Text>
                        <TextInput
                          style={[styles.modalInput, styles.modalInputWithPrefix]}
                          value={tripletaPrice}
                          onChangeText={setTripletaPrice}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor="#95A5A6"
                        />
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.modalFooter}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalCancelButton]}
                      onPress={() => setPrecioBoteModalVisible(false)}
                      disabled={savingPrecio}
                    >
                      <Text style={styles.modalCancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalSaveButton]}
                      onPress={handleSavePrecioBote}
                      disabled={savingPrecio}
                    >
                      <Text style={styles.modalSaveButtonText}>
                        {savingPrecio ? 'Guardando...' : 'Guardar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  configButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#3498DB',
  },
  configButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  exportButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#27AE60',
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  selectorsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 110,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  selectorsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 3,
  },
  selectorHalf: {
    flex: 1,
  },
  selectorFull: {
    width: '100%',
  },
  sendButtonContainer: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  filtersBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 5,
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
    fontSize: 10,
    fontWeight: 'bold',
    color: '#495057',
  },
  sortButton: {
    paddingHorizontal: 6,
    paddingVertical: 3,
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
    fontSize: 9,
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
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#27AE60',
    fontSize: 9,
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
    fontSize: 10,
    fontWeight: 'bold',
    color: '#495057',
  },
  totalBrutoValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#27AE60',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
  },
  boteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
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
    marginBottom: 4,
    gap: 8,
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
  listeroHeader: {
    backgroundColor: '#F8F9FA',
    padding: 8,
    marginBottom: 6,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#3498DB',
    flexDirection: 'row',
    alignItems: 'center',
    ...createShadowStyle(0, 1, 2, 0.05),
  },
  listeroHeaderIcon: {
    fontSize: 12,
    color: '#3498DB',
    marginRight: 6,
    width: 16,
  },
  listeroHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listeroHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C3E50',
  },
  listeroHeaderTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#27AE60',
  },
  collectorHeader: {
    backgroundColor: '#E8F4F8',
    padding: 8,
    marginBottom: 6,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#2980B9',
    flexDirection: 'row',
    alignItems: 'center',
    ...createShadowStyle(0, 1, 3, 0.08),
  },
  collectorHeaderIcon: {
    fontSize: 14,
    color: '#2980B9',
    marginRight: 6,
    width: 18,
  },
  collectorHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collectorHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C3E50',
  },
  collectorHeaderTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#27AE60',
  },
  listeroNestedContainer: {
    marginLeft: 16,
    marginBottom: 4,
  },
  listeroNestedHeader: {
    backgroundColor: '#F8F9FA',
    padding: 6,
    marginBottom: 4,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#3498DB',
    flexDirection: 'row',
    alignItems: 'center',
    ...createShadowStyle(0, 1, 2, 0.05),
  },
  listeroNestedIcon: {
    fontSize: 10,
    color: '#3498DB',
    marginRight: 4,
    width: 14,
  },
  listeroNestedContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listeroNestedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C3E50',
  },
  listeroNestedTotal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#27AE60',
  },
  boteCardNested: {
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    ...createShadowStyle(0, 4, 8, 0.15),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C3E50',
  },
  modalCloseButton: {
    padding: 4,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#7F8C8D',
    fontWeight: '300',
  },
  modalLoadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#7F8C8D',
  },
  modalScrollContent: {
    maxHeight: 500,
  },
  modalSection: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInputGroup: {
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
  },
  modalInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#2C3E50',
  },
  modalInputWithPrefix: {
    paddingLeft: 4,
  },
  modalInputPrefix: {
    paddingLeft: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#27AE60',
  },
  modalInputSuffix: {
    paddingRight: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#3498DB',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  modalSaveButton: {
    backgroundColor: '#27AE60',
  },
  modalSaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default RealizarBoteScreen;
