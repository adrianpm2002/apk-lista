import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert, 
  StyleSheet, 
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';
import { createCommonDarkStyles, createFormDarkStyles, DarkTheme, LightTheme } from '../utils/darkModeStyles';
import { useDarkMode } from '../contexts/DarkModeContext';

const ManagePricesScreen = ({ navigation, onModeVisibilityChange }) => {
  return (
    <ScreenWrapper>
      <ManagePricesContent
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
      />
    </ScreenWrapper>
  );
};

const ManagePricesContent = ({ navigation, onModeVisibilityChange }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);
  
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  
  // Crear estilos adaptativos para modo oscuro
  const commonStyles = createCommonDarkStyles(isDarkMode);
  const formStyles = createFormDarkStyles(isDarkMode);
  
  // Solo mostrar loading si realmente no hay datos
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // fieldErrors removido (validaciones inline en modal)
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [editingBatch, setEditingBatch] = useState(false); // si estamos modificando precios existentes
  
  // Estados para tipos de jugada disponibles
  const [availablePlayTypes] = useState([
    { id: 'fijo', label: 'Fijo', enabled: true },
    { id: 'corrido', label: 'Corrido', enabled: true },
    { id: 'posicion', label: 'Posición', enabled: true },
  { id: 'parle', label: 'Parle', enabled: true },
    { id: 'centena', label: 'Centena', enabled: true },
    { id: 'tripleta', label: 'Tripleta', enabled: true },
  ]);
  
  // Estado de precios (se gestionará vía modal). Cada entrada representa un tipo de jugada y sus valores.
  const [winningPrices, setWinningPrices] = useState({
    fijo: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    corrido: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    posicion: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    parle: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    centena: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    tripleta: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
  });

  // Lista CRUD de precios guardados - inicializar vacía
  const [priceEntries, setPriceEntries] = useState([]); // mantiene última config para edición rápida
  const [priceConfigName, setPriceConfigName] = useState('');
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [priceConfigs, setPriceConfigs] = useState([]); // Lista de configuraciones
  const [expandedConfigs, setExpandedConfigs] = useState(new Set()); // ids expandids
  const [modalError, setModalError] = useState('');
  const [modalFieldErrors, setModalFieldErrors] = useState({}); // { playType: { regular:true, limited:true, collectorPct:true, listeroPct:true } }
  const [editingConfigId, setEditingConfigId] = useState(null); // id de la configuración que se está editando (update), null = insert
  
  // Estados para loterías
  const [availableLotteries, setAvailableLotteries] = useState([]);
  const [selectedLotteries, setSelectedLotteries] = useState([]);
  const [loadingLotteries, setLoadingLotteries] = useState(false);
  
  // Estado para jugadas activas del banco
  const [enabledPlayTypes, setEnabledPlayTypes] = useState({
    fijo: true,
    corrido: true,
    posicion: true,
    parle: true,
    centena: true,
    tripleta: true,
  });

  // Fetch user profile and load data (optimizado para no bloquear UI)
  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, id_banco')
          .eq('id', user.id)
          .single();

        if (data && !error) {
          setUserRole(data.role);
          // Si es admin (banco), su propio ID es el banco ID, si es colector usa id_banco
          const bankId = data.role === 'admin' ? user.id : data.id_banco;
          setCurrentBankId(bankId);
          
          // Solo los admins pueden acceder a esta pantalla
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
    } catch (error) {
      console.error('Error inicializando pantalla:', error);
      Alert.alert('Error', 'No se pudo cargar la información del usuario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    // Cargar perfil de forma no bloqueante
    setLoading(true);
    const timeoutId = setTimeout(fetchUserProfile, 10);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (currentBankId) {
      loadPriceConfigurations();
      loadActivePlayTypes();
      loadAvailableLotteries();
    }
  }, [currentBankId]);

  // Refrescar datos cuando se regresa a la pantalla
  useFocusEffect(
    React.useCallback(() => {
      if (currentBankId) {
        loadPriceConfigurations();
        loadActivePlayTypes();
        loadAvailableLotteries();
      }
    }, [currentBankId])
  );

  const loadActivePlayTypes = async () => {
    if (!currentBankId) return;
    
    try {
      const { data, error } = await supabase
        .from('jugadas_activas')
        .select('jugadas')
        .eq('id_banco', currentBankId)
        .single();

      if (error) {
        console.error('Error loading active play types:', error);
        return;
      }

      if (data && data.jugadas) {
        setEnabledPlayTypes(data.jugadas);
      }
    } catch (error) {
      console.error('Error loading active play types:', error);
    }
  };

  const loadAvailableLotteries = async () => {
    if (!currentBankId) return;
    
    try {
      setLoadingLotteries(true);
      const { data, error } = await supabase
        .from('loteria')
        .select('id, nombre')
        .eq('id_banco', currentBankId)
        .order('nombre', { ascending: true });

      if (error) {
        console.error('Error loading lotteries:', error);
        return;
      }

      setAvailableLotteries(data || []);
    } catch (error) {
      console.error('Error loading lotteries:', error);
    } finally {
      setLoadingLotteries(false);
    }
  };

  const loadPriceConfigurations = async () => {
    if (!currentBankId) return;
    
    try {
      setLoadingPrices(true);
      const { data, error } = await supabase
        .from('precio')
        .select(`
          *,
          loteria:id_loteria (
            id,
            nombre
          )
        `)
        .eq('id_banco', currentBankId)
        .order('id', { ascending: false });

      if (error) {
        console.error('Error loading price configurations:', error);
        return;
      }

      // Parsear el JSON de precios para cada configuración
      const parsedConfigs = data.map(config => ({
        ...config,
        precios: typeof config.precios === 'string' ? JSON.parse(config.precios) : config.precios,
        loteriaNombre: config.loteria?.nombre || 'Lotería desconocida'
      }));

      setPriceConfigs(parsedConfigs);
      setInitialLoading(false);
    } catch (error) {
      console.error('Error loading price configurations:', error);
    } finally {
      setLoadingPrices(false);
    }
  };

  const loadPriceConfigs = async (bankId, forceRefresh = false) => {
    try {
      setLoadingPrices(true);
      const { data, error } = await supabase
        .from('precio')
        .select('id, precios, id, nombre')
        .eq('id_banco', bankId || currentBankId)
        .order('id', { ascending: false });
      if (error) {
        console.error('Error cargando configuraciones de precios:', error);
        return;
      }
      
      setPriceConfigs(data || []);
      // Prefill modal con la última config (más reciente)
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
    } catch (e) {
      console.error('Excepción loadPriceConfigs:', e);
    } finally {
      setLoadingPrices(false);
    }
  };

  const handleRefresh = async () => {
    await loadPriceConfigurations();
  };

  const updateWinningPrice = (playType, priceType, value) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    setWinningPrices(prev => ({
      ...prev,
      [playType]: { ...prev[playType], [priceType]: numericValue }
    }));
  };

  // Función para manejar selección múltiple de loterías
  const handleLotterySelection = (selectedValues) => {
    setSelectedLotteries(selectedValues);
  };

  // saveConfiguration eliminado: cambios se aplican en tiempo real

  // CRUD local de precios (pendiente definir tabla para persistir). Cada guardado reemplaza/añade por jugada.
  const handleSavePricesBatch = async () => {
    // Validar que se hayan seleccionado loterías (solo para nuevas configuraciones)
    if (!editingConfigId && selectedLotteries.length === 0) {
      setModalError('Selecciona al menos una lotería.');
      return;
    }

    // Validar nombre
    if (!priceConfigName.trim()) {
      setModalError('Ingresa un nombre para la configuración.');
      return;
    }

    // Validar que al menos un campo tenga valor
    const entries = [];
    setModalFieldErrors({});
    const fieldErrors = {};
    let hasAnyError = false;
    let percentError = false;
    availablePlayTypes.forEach(pt => {
      // Validar solo jugadas activas
      if (!enabledPlayTypes[pt.id]) return;
      const w = winningPrices[pt.id];
      const req = ['regular','limited','collectorPct','listeroPct'];
      req.forEach(f => {
        if (w[f] === '' || w[f] === null || w[f] === undefined) {
          fieldErrors[pt.id] = fieldErrors[pt.id] || {}; fieldErrors[pt.id][f] = true; hasAnyError = true;
        }
      });
      // porcentajes
      ['collectorPct','listeroPct'].forEach(pctKey => {
        if (w[pctKey] !== '' && (isNaN(w[pctKey]) || parseInt(w[pctKey]) < 0 || parseInt(w[pctKey]) > 100)) {
          fieldErrors[pt.id] = fieldErrors[pt.id] || {}; fieldErrors[pt.id][pctKey] = true; hasAnyError = true; percentError = true;
        }
      });
      if (!fieldErrors[pt.id]) {
        entries.push({
          id: `${pt.id}-${Date.now()}`,
          jugada: pt.id,
          regular: w.regular || null,
          limited: w.limited || null,
          collectorPct: w.collectorPct || null,
          listeroPct: w.listeroPct || null,
        });
      }
    });
    if (hasAnyError) {
      setModalFieldErrors(fieldErrors);
      setModalError(percentError ? 'Corrige porcentajes (0-100) y completa todos los campos requeridos.' : 'Completa todos los campos para cada jugada activa.');
      return;
    }
    if (entries.length === 0) {
      Alert.alert('Sin datos', 'Ingresa algún valor antes de guardar');
      return;
    }
    setPriceEntries(prev => {
      // Si editingBatch, reemplazar valores existentes por jugada
      const filtered = prev.filter(p => !entries.some(e => e.jugada === p.jugada));
      return [...filtered, ...entries];
    });

    // Construir objeto JSON para persistir
    const preciosJSON = {};
    entries.forEach(e => {
      preciosJSON[e.jugada] = {
        regular: e.regular ? Number(e.regular) : null,
        limited: e.limited ? Number(e.limited) : null,
        collectorPct: e.collectorPct ? Number(e.collectorPct) : null,
        listeroPct: e.listeroPct ? Number(e.listeroPct) : null,
      };
    });
    // Incluir jugadas previamente guardadas que no se editaron esta vez
    priceEntries.forEach(old => {
      if (!preciosJSON[old.jugada]) {
        preciosJSON[old.jugada] = {
          regular: old.regular ? Number(old.regular) : null,
          limited: old.limited ? Number(old.limited) : null,
          collectorPct: old.collectorPct ? Number(old.collectorPct) : null,
          listeroPct: old.listeroPct ? Number(old.listeroPct) : null,
        };
      }
    });
    // Persistir en tabla precio (insert o update según editingConfigId)
    if (currentBankId) {
      try {
        setSaving(true);
        
        if (editingConfigId) {
          // Actualizar configuración existente (solo una lotería)
          const updatePayload = { 
            precios: preciosJSON, 
            nombre: priceConfigName.trim()
          };
          const { data: updateData, error: updateError } = await supabase
            .from('precio')
            .update(updatePayload)
            .eq('id', editingConfigId)
            .eq('id_banco', currentBankId)
            .select();
          if (updateError) {
            console.error('Error actualizando precios (updateError):', updateError);
            Alert.alert('Error', 'No se pudo actualizar la configuración de precios');
          } else {
            await loadPriceConfigurations(); // Recargar configuraciones
            Alert.alert('Éxito', 'Configuración actualizada correctamente');
          }
        } else {
          // Insertar nueva configuración para cada lotería seleccionada
          const insertPromises = selectedLotteries.map(lotteryId => {
            const payload = { 
              id_banco: currentBankId, 
              id_loteria: lotteryId,
              precios: preciosJSON, 
              nombre: priceConfigName.trim()
            };
            return supabase.from('precio').insert(payload).select();
          });

          const results = await Promise.all(insertPromises);
          const errors = results.filter(result => result.error);
          
          if (errors.length > 0) {
            console.error('Error guardando precios:', errors);
            Alert.alert('Error', `No se pudieron guardar ${errors.length} configuraciones de precios`);
          } else {
            await loadPriceConfigurations(); // Recargar configuraciones
            Alert.alert('Éxito', `Se guardaron ${selectedLotteries.length} configuraciones de precios correctamente`);
          }
        }
      } catch (err) {
        console.error('Excepción durante persistencia precio:', err);
        Alert.alert('Error', 'Excepción al guardar la configuración');
      } finally {
        setSaving(false);
      }
    }
    setPriceModalVisible(false);
    setEditingBatch(false);
    setEditingConfigId(null);
    // Limpiar datos del modal
    clearModalData();
  };

  const clearModalData = () => {
    setPriceConfigName('');
    setSelectedLotteries([]);
    setModalError('');
    setModalFieldErrors({});
    // Limpiar winningPrices
    const clearedPrices = {};
    availablePlayTypes.forEach(pt => {
      clearedPrices[pt.id] = { regular: '', limited: '', collectorPct: '', listeroPct: '' };
    });
    setWinningPrices(clearedPrices);
  };

  const handleEditPrices = () => {
    // Prellenar winningPrices desde priceEntries
    const newPrices = { ...winningPrices };
    priceEntries.forEach(pe => {
      if (newPrices[pe.jugada]) {
        newPrices[pe.jugada] = {
          regular: pe.regular ? pe.regular.toString() : '',
          limited: pe.limited ? pe.limited.toString() : '',
          collectorPct: pe.collectorPct ? pe.collectorPct.toString() : '',
          listeroPct: pe.listeroPct ? pe.listeroPct.toString() : ''
        };
      }
    });
    setWinningPrices(newPrices);
    setEditingBatch(true);
    setPriceModalVisible(true);
  };

  const handleDeletePrice = (jugada) => {
    setPriceEntries(prev => prev.filter(p => p.jugada !== jugada));
  };

  const performConfigDeletion = async (configId) => {
    try {
      if (!currentBankId) {
        return;
      }
      const { data: authUserData } = await supabase.auth.getUser();
      const { data: preCheck, error: preCheckError } = await supabase
        .from('precio')
        .select('id, id_banco')
        .eq('id', configId)
        .maybeSingle();
      const { error: delError1, count: count1 } = await supabase
        .from('precio')
        .delete({ count: 'exact' })
        .eq('id', configId)
        .eq('id_banco', currentBankId);
      if (!delError1 && count1 === 0) {
        const { error: delError2, count: count2 } = await supabase
          .from('precio')
          .delete({ count: 'exact' })
          .eq('id', configId);
      }
      const { data: postCheck, error: postCheckError } = await supabase
        .from('precio')
        .select('id')
        .eq('id', configId)
        .maybeSingle();
      await loadPriceConfigurations(); // Recargar configuraciones
      setExpandedConfigs(prev => { const n = new Set(prev); n.delete(configId); return n; });
    } catch (e) {
      console.error('[DeleteConfig] Excepción performConfigDeletion:', e);
    }
  };

  const confirmDelete = async (message) => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.confirm) {
          return window.confirm(message);
        }
      } catch (e) {
        return true; // fallback: permitir
      }
      return true;
    } else {
      return await new Promise(resolve => {
        Alert.alert('Confirmación', message, [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) }
        ]);
      });
    }
  };

  const handleDeleteConfig = (configId) => {
    confirmDelete('¿Eliminar esta configuración definitivamente?')
      .then(ok => {
        if (ok) {
          performConfigDeletion(configId);
        }
      });
  };

  if (loading) {
    return (
      <View style={[styles.container, commonStyles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#27AE60" />
        <Text style={[styles.loadingText, commonStyles.textPrimary]}>Cargando configuración...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, commonStyles.container]}>
      {/* Header personalizado */}
      <View style={[styles.customHeader, commonStyles.header]}>
        <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={[styles.headerTitle, commonStyles.textPrimary]}>Precios</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={userRole === 'admin' ? (loading || loadingPrices) : false}
            onRefresh={userRole === 'admin' ? handleRefresh : undefined}
            colors={['#27AE60']}
            tintColor="#27AE60"
          />
        }
      >
        
        {/* Botón para abrir modal de precios */}
        <ActionButton
          title="Nueva Configuración de Precios"
          onPress={() => {
            setEditingBatch(false);
            setEditingConfigId(null);
            clearModalData();
            setPriceModalVisible(true);
          }}
          variant="primary"
          size="medium"
          style={{ 
            marginBottom: 16, 
            marginTop: Platform.OS === 'android' ? 8 : 0 
          }}
        />

        {/* Listado de configuraciones guardadas (acordeón) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuraciones Guardadas</Text>
          
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
            const jugadasKeys = Object.keys(precios).filter(k => {
              const o = precios[k];
              return o && ['regular','limited','collectorPct','listeroPct'].some(field => o[field] !== null && o[field] !== undefined && o[field] !== '');
            });
            // Calcular jugadas configuradas
            const configuredPlays = jugadasKeys;
            
            // Verificar problemas de configuración
            const activePlayTypes = enabledPlayTypes ? Object.keys(enabledPlayTypes).filter(k => enabledPlayTypes[k]) : [];
            const hasInactiveConfigured = configuredPlays.some(play => !activePlayTypes.includes(play));
            const hasMissingActive = activePlayTypes.some(play => !configuredPlays.includes(play));
            const hasConfigError = hasInactiveConfigured || hasMissingActive;
            
            return (
              <View key={cfg.id} style={[styles.configItem, commonStyles.card, hasConfigError && styles.configItemError]}>
                <TouchableOpacity onPress={toggle} style={styles.configHeaderRow}>
                  <View style={styles.configNameContainer}>
                    <Text style={[styles.configName, commonStyles.textPrimary, hasConfigError && styles.configNameError]}>
                      {cfg.nombre || 'Sin nombre'}
                    </Text>
                    <Text style={[styles.configLotteryName, commonStyles.textSecondary]}>
                      {cfg.loteriaNombre}
                    </Text>
                  </View>
                  <Text style={[styles.configArrow, commonStyles.textSecondary]}>{expanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {expanded && (
                  <View style={styles.configDetails}>
                    {hasConfigError && (
                      <View style={styles.configWarning}>
                        <Text style={styles.configWarningText}>
                          ⚠️ Problemas de configuración:
                          {hasInactiveConfigured && " • Tiene jugadas configuradas que están inactivas"}
                          {hasMissingActive && " • Faltan configuraciones para jugadas activas"}
                        </Text>
                      </View>
                    )}
                    {jugadasKeys.length === 0 && (
                      <Text style={[styles.configEmpty, commonStyles.textSecondary]}>Sin jugadas configuradas.</Text>
                    )}
                    {(() => {
                      const allRows = [];
                      const configuredPlays = jugadasKeys;
                      // Mostrar configuradas
                      configuredPlays.forEach(jk => {
                        const obj = precios[jk] || {};
                        const hasAny = ['regular','limited','collectorPct','listeroPct'].some(f => obj[f] !== null && obj[f] !== undefined && obj[f] !== '');
                        allRows.push(
                          <View key={jk} style={styles.detailRow}>
                            <Text style={[styles.detailText, commonStyles.textSecondary]}>
                              {jk} - Reg: {obj.regular ?? '—'}  Lim: {obj.limited ?? '—'}  Col%: {obj.collectorPct ?? '—'}  Lis%: {obj.listeroPct ?? '—'}
                            </Text>
                          </View>
                        );
                      });
                      return allRows;
                    })()}
                    <View style={styles.configActionsRow}>
                      <TouchableOpacity onPress={() => {
                        // Cargar esta config en modal para editar como nueva versión
                        const json = cfg.precios || {};
                        const newWinning = { ...winningPrices };
                        Object.keys(newWinning).forEach(k => {
                          const o = json[k] || {};
                          newWinning[k] = {
                            regular: o.regular?.toString() || '',
                            limited: o.limited?.toString() || '',
                            collectorPct: o.collectorPct?.toString() || '',
                            listeroPct: o.listeroPct?.toString() || ''
                          };
                        });
                        setWinningPrices(newWinning);
                        // reconstruir priceEntries para referencias locales
                        const newEntries = [];
                        Object.keys(json).forEach(k => {
                          const o = json[k] || {};
                          const anyVal = ['regular','limited','collectorPct','listeroPct'].some(f => o[f] !== null && o[f] !== undefined && o[f] !== '');
                          if (anyVal) {
                            newEntries.push({
                              id: k + '-' + Date.now(),
                              jugada: k,
                              regular: o.regular ?? null,
                              limited: o.limited ?? null,
                              collectorPct: o.collectorPct ?? null,
                              listeroPct: o.listeroPct ?? null,
                            });
                          }
                        });
                        setPriceEntries(newEntries);
                        setPriceConfigName(cfg.nombre || '');
                        setEditingBatch(true);
                        setEditingConfigId(cfg.id); // marcar para UPDATE
                        setPriceModalVisible(true);
                      }} style={styles.smallButtonPrimary}>
                        <Text style={styles.smallButtonText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteConfig(cfg.id)} style={styles.smallButtonDanger}>
                        <Text style={styles.smallButtonText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
        {/* Eliminado botón Guardar: cambios de activación son en tiempo real */}

      </ScrollView>

      {/* Modal de precios */}
      {priceModalVisible && (
        <View style={[styles.pricesModalOverlay, commonStyles.modalOverlay]}>
          <View style={[styles.pricesModal, commonStyles.modalContent]}>
            <Text style={[styles.pricesModalTitle, commonStyles.textPrimary]}>{editingBatch ? 'Editar Precios' : 'Agregar Precios'}</Text>
            <ScrollView style={{ maxHeight: 470 }}>
              <View style={styles.modalPriceGroup}>
                <Text style={[styles.modalPriceGroupTitle, commonStyles.textPrimary]}>Nombre de la Configuración</Text>
                <InputField
                  value={priceConfigName}
                  onChangeText={setPriceConfigName}
                  placeholder="Ej: pagos_globales"
                  autoCapitalize="none"
                  isDarkMode={isDarkMode}
                />
              </View>

              {/* Selector de Loterías */}
              {!editingBatch && (
                <View style={styles.modalPriceGroup}>
                  <Text style={[styles.modalPriceGroupTitle, commonStyles.textPrimary]}>Loterías</Text>
                  <MultiSelectDropdown
                    label="Seleccionar Loterías"
                    selectedValues={selectedLotteries}
                    onSelect={handleLotterySelection}
                    options={availableLotteries.map(lottery => ({
                      label: lottery.nombre,
                      value: lottery.id
                    }))}
                    placeholder="Selecciona las loterías..."
                    isDarkMode={isDarkMode}
                  />
                </View>
              )}
              {availablePlayTypes.filter(pt => enabledPlayTypes[pt.id]).map(pt => (
                <View key={pt.id} style={styles.modalPriceGroup}>
                  <Text style={[styles.modalPriceGroupTitle, commonStyles.textPrimary]}>{pt.label}</Text>
                  <View style={styles.modalRow}>
                    <View style={styles.modalField}>
                      <Text style={[styles.modalLabel, commonStyles.textSecondary]}>Regular</Text>
                      <InputField
                        value={winningPrices[pt.id].regular}
                        onChangeText={v => updateWinningPrice(pt.id, 'regular', v)}
                        placeholder="0"
                        keyboardType="numeric"
                        hasError={!!modalFieldErrors[pt.id]?.regular}
                        isDarkMode={isDarkMode}
                      />
                    </View>
                    <View style={styles.modalField}>
                      <Text style={[styles.modalLabel, commonStyles.textSecondary]}>Limitado</Text>
                      <InputField
                        value={winningPrices[pt.id].limited}
                        onChangeText={v => updateWinningPrice(pt.id, 'limited', v)}
                        placeholder="0"
                        keyboardType="numeric"
                        hasError={!!modalFieldErrors[pt.id]?.limited}
                        isDarkMode={isDarkMode}
                      />
                    </View>
                  </View>
                  <View style={styles.modalRow}>
                    <View style={styles.modalField}>
                      <Text style={[styles.modalLabel, commonStyles.textSecondary]}>% Colector</Text>
                      <InputField
                        value={winningPrices[pt.id].collectorPct}
                        onChangeText={v => updateWinningPrice(pt.id, 'collectorPct', v)}
                        placeholder="0"
                        keyboardType="numeric"
                        hasError={!!modalFieldErrors[pt.id]?.collectorPct}
                        isDarkMode={isDarkMode}
                      />
                    </View>
                    <View style={styles.modalField}>
                      <Text style={[styles.modalLabel, commonStyles.textSecondary]}>% Listero</Text>
                      <InputField
                        value={winningPrices[pt.id].listeroPct}
                        onChangeText={v => updateWinningPrice(pt.id, 'listeroPct', v)}
                        placeholder="0"
                        keyboardType="numeric"
                        hasError={!!modalFieldErrors[pt.id]?.listeroPct}
                        isDarkMode={isDarkMode}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalButtonsRow}>
              <ActionButton
                title="Cerrar"
                onPress={() => { setPriceModalVisible(false); setEditingBatch(false); }}
                variant="danger"
                size="small"
                isDarkMode={isDarkMode}
              />
              <ActionButton
                title={editingBatch ? 'Guardar Cambios' : 'Guardar'}
                onPress={handleSavePricesBatch}
                variant="success"
                size="small"
                isDarkMode={isDarkMode}
              />
            </View>
            {!!modalError && <Text style={[styles.modalErrorText, commonStyles.textError]}>{modalError}</Text>}
          </View>
        </View>
      )}

      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
        role={userRole}
      />
    </View>
  );
};

export default ManagePricesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#2C3E50',
  },
  customHeader: {
    height: Platform.OS === 'android' ? 85 : 75,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 30,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    ...createShadowStyle({
      color: '#000',
      offsetY: 2,
      opacity: 0.1,
      radius: 2,
      elevation: 4,
    }),
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  sidebarButton: {
    marginRight: 16,
    marginLeft: 4,
    marginTop: 2,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: Platform.OS === 'android' ? 85 : 75,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    ...createShadowStyle({
      color: '#000',
      offsetY: 2,
      opacity: 0.1,
      radius: 4,
      elevation: 3,
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  // Estilos de botones globales eliminados
  priceGroup: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  priceGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceField: {
    flex: 1,
    marginHorizontal: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: '#34495E',
    marginBottom: 4,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#27AE60',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    marginBottom: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  errorContainer: {
    borderColor: '#E74C3C',
    backgroundColor: '#FCF3F3',
  },
  errorInput: {
    color: '#E74C3C',
  },
  errorText: {
    fontSize: 12,
    color: '#E74C3C',
    marginTop: 4,
    fontWeight: '500',
  },
  saveButton: {
    marginTop: 20,
    marginBottom: 40,
  },
  priceListItem: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  priceListRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  priceListText: {
    fontSize: 14,
    color: '#2C3E50'
  },
  priceListTextWarning: {
    color: '#c92a2a',
    fontWeight: '600'
  },
  priceMismatchNote: {
    fontSize: 11,
    color: '#c92a2a',
    marginTop: 2,
  },
  mismatchLegend: {
    fontSize: 11,
    color: '#c92a2a',
    marginTop: 8,
    fontStyle: 'italic'
  },
  configItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 6
  },
  configHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  configNameContainer: {
    flex: 1,
    marginRight: 10
  },
  configName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50'
  },
  configLotteryName: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
    fontStyle: 'italic'
  },
  configNameError: {
    color: '#e74c3c'
  },
  configItemError: {
    borderLeftWidth: 3,
    borderLeftColor: '#e74c3c',
    backgroundColor: '#fdf2f2'
  },
  configWarning: {
    backgroundColor: '#ffeaa7',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#fdcb6e'
  },
  configWarningText: {
    fontSize: 12,
    color: '#6c5ce7',
    fontWeight: '500'
  },
  configArrow: {
    fontSize: 14,
    color: '#34495E'
  },
  configDetails: {
    marginTop: 8,
    paddingLeft: 4
  },
  detailRow: {
    marginBottom: 4
  },
  detailText: {
    fontSize: 13,
    color: '#2C3E50'
  },
  configEmpty: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic'
  },
  configActionsRow: {
    flexDirection: 'row',
    marginTop: 8
  },
  smallButtonPrimary: {
    backgroundColor: '#3498db',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginRight: 8,
  },
  smallButtonDanger: {
    backgroundColor: '#e74c3c',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  pricesModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 2000,
  },
  pricesModal: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    ...createShadowStyle({
      color: '#000',
      opacity: 0.2,
      radius: 6,
      elevation: 6,
    }),
  },
  pricesModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center'
  },
  modalPriceGroup: {
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 12,
  },
  modalPriceGroupTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2C3E50'
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  modalField: { flex: 1, marginHorizontal: 4 },
  modalLabel: { fontSize: 13, color: '#34495E', marginBottom: 4 },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10
  },
  modalHint: {
    fontSize: 11,
    marginTop: 12,
    textAlign: 'center',
    color: '#7f8c8d'
  },
  modalErrorText: {
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
    color: '#c92a2a',
    fontWeight: '600'
  },
  cacheIndicator: {
    backgroundColor: '#E8F4FD',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3498DB'
  },
  cacheIndicatorText: {
    fontSize: 12,
    color: '#2980B9',
    textAlign: 'center'
  },
});
