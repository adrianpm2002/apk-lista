import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet,
  SafeAreaView, 
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { supabase } from '../supabaseClient';
import { SideBar, SideBarToggle } from '../components/SideBar';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';

const LotteryLimitsScreen = ({ navigation, isDarkMode, onToggleDarkMode }) => {
  return (
    <ScreenWrapper>
      <LotteryLimitsContent
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
      />
    </ScreenWrapper>
  );
};

const LotteryLimitsContent = ({ navigation, isDarkMode, onToggleDarkMode }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState(null);
  const [bankId, setBankId] = useState(null);
  
  // Estados principales
  const [lotteries, setLotteries] = useState([]);
  const [activeJugadas, setActiveJugadas] = useState({});
  
  // Estados del modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [currentLimits, setCurrentLimits] = useState({});
  const [limitsRecordId, setLimitsRecordId] = useState(null);

  // Orden de jugadas para mostrar
  const JUGADA_ORDER = ['fijo', 'corrido', 'posicion', 'parle', 'centena', 'tripleta'];

  // Cargar rol y bankId
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('role, id_banco')
            .eq('id', user.id)
            .single();
          if (data?.role) {
            setRole(data.role);
            const bId = data.role === 'admin' ? user.id : data.id_banco;
            setBankId(bId);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    fetchUserData();
  }, []);

  // Cargar loterías cuando tenemos bankId
  useEffect(() => {
    if (bankId) {
      loadLotteries();
      loadActiveJugadas();
    }
  }, [bankId]);

  const loadLotteries = async () => {
    if (!bankId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loteria')
        .select('id, nombre')
        .eq('id_banco', bankId)
        .order('nombre');
      
      if (!error) {
        setLotteries(data || []);
      }
    } catch (error) {
      console.error('Error loading lotteries:', error);
    }
    setLoading(false);
  };

  const loadActiveJugadas = async () => {
    if (!bankId) return;
    
    try {
      const { data, error } = await supabase
        .from('jugadas_activas')
        .select('jugadas')
        .eq('id_banco', bankId)
        .single();
      
      if (!error && data?.jugadas) {
        setActiveJugadas(data.jugadas);
      }
    } catch (error) {
      console.error('Error loading active jugadas:', error);
    }
  };

  const openEditModal = async (lottery) => {
    setSelectedLottery(lottery);
    await loadLotteryLimits(lottery.id);
    setModalVisible(true);
  };

  const loadLotteryLimits = async (lotteryId) => {
    try {
      const { data, error } = await supabase
        .from('limite_loteria')
        .select('id, limites')
        .eq('id_loteria', lotteryId)
        .single();
      
      if (!error && data) {
        setLimitsRecordId(data.id);
        setCurrentLimits(data.limites || {});
      } else {
        // No existe registro, preparar para crear uno nuevo
        setLimitsRecordId(null);
        setCurrentLimits({});
      }
    } catch (error) {
      console.error('Error loading lottery limits:', error);
      setLimitsRecordId(null);
      setCurrentLimits({});
    }
  };

  const handleLimitChange = (jugada, value) => {
    setCurrentLimits(prev => ({
      ...prev,
      [jugada]: value
    }));
  };

  const saveLimits = async () => {
    if (!selectedLottery) return;
    
    setSaving(true);
    try {
      // Convertir valores a números y filtrar vacíos
      const processedLimits = {};
      Object.entries(currentLimits).forEach(([jugada, value]) => {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue > 0) {
          processedLimits[jugada] = numValue;
        }
      });

      if (limitsRecordId) {
        // Actualizar registro existente
        const { error } = await supabase
          .from('limite_loteria')
          .update({ limites: processedLimits })
          .eq('id', limitsRecordId);
        
        if (error) throw error;
      } else {
        // Crear nuevo registro
        const { data, error } = await supabase
          .from('limite_loteria')
          .insert({
            id_loteria: selectedLottery.id,
            limites: processedLimits
          })
          .select('id')
          .single();
        
        if (error) throw error;
        setLimitsRecordId(data.id);
      }
      
      Alert.alert('Éxito', 'Límites guardados correctamente');
      setModalVisible(false);
    } catch (error) {
      console.error('Error saving limits:', error);
      Alert.alert('Error', 'No se pudieron guardar los límites');
    }
    setSaving(false);
  };

  const renderLotteryItem = ({ item }) => (
    <View style={[styles.lotteryItem, isDarkMode && styles.lotteryItemDark]}>
      <Text style={[styles.lotteryName, isDarkMode && styles.lotteryNameDark]}>
        {item.nombre}
      </Text>
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => openEditModal(item)}
      >
        <Text style={styles.editButtonText}>Editar Límites</Text>
      </TouchableOpacity>
    </View>
  );

  const getActiveJugadasList = () => {
    return JUGADA_ORDER.filter(jugada => activeJugadas[jugada] === true);
  };

  const renderLimitInput = (jugada) => (
    <View key={jugada} style={styles.limitInputRow}>
      <Text style={[styles.limitLabel, isDarkMode && styles.limitLabelDark]}>
        {jugada.charAt(0).toUpperCase() + jugada.slice(1)}:
      </Text>
      <TextInput
        style={[styles.limitInput, isDarkMode && styles.limitInputDark]}
        value={currentLimits[jugada]?.toString() || ''}
        onChangeText={(value) => handleLimitChange(jugada, value)}
        placeholder="0.00"
        placeholderTextColor="#95a5a6"
        keyboardType="numeric"
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <SideBarToggle 
          inline 
          onToggle={() => setSidebarVisible(!sidebarVisible)} 
          style={styles.sidebarButton} 
        />
        <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
          Límites de Loterías
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D5016" />
          <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
            Cargando loterías...
          </Text>
        </View>
      ) : (
        <FlatList
          data={lotteries}
          renderItem={renderLotteryItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Modal de edición de límites */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
                Límites - {selectedLottery?.nombre}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCloseButton}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {getActiveJugadasList().length > 0 ? (
                getActiveJugadasList().map(renderLimitInput)
              ) : (
                <Text style={[styles.noJugadasText, isDarkMode && styles.noJugadasTextDark]}>
                  No hay jugadas activas configuradas
                </Text>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={saveLimits}
                disabled={saving}
              >
                <Text style={styles.modalButtonText}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        navigation={navigation}
        role={role}
      />
    </SafeAreaView>
  );
};
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [limitsConfig, setLimitsConfig] = useState(DEFAULT_LOTTERY_LIMITS);
  const [limitsRecordId, setLimitsRecordId] = useState(null);
  
  // Estados del modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('general'); // 'general', 'playType', 'numberLimit'
  const [editingItem, setEditingItem] = useState(null);
  const [modalError, setModalError] = useState('');
  
  // Estados del formulario
  const [formData, setFormData] = useState({});

  // Efecto para cargar datos cuando cambia el banco
  useEffect(() => {
    if (cacheBankId) {
      setLoading(true);
      loadLotteries().finally(() => setLoading(false));
    }
  }, [cacheBankId]);

  // Efecto para cargar límites cuando cambia la lotería seleccionada
  useEffect(() => {
    if (selectedLottery && cacheBankId) {
      loadLotteryLimits(selectedLottery.id);
    }
  }, [selectedLottery, cacheBankId]);

  // Carga inicial
  useEffect(() => {
    // No necesitamos setters locales, usamos directamente cacheUserRole y cacheBankId
  }, [cacheUserRole, cacheBankId]);

  const initializeScreen = async () => {
    try {
      setLoading(true);
      // El userRole y currentBankId vienen del cache, no necesitamos fetch adicional
    } catch (error) {
      console.error('Error inicializando pantalla:', error);
      Alert.alert('Error', 'No se pudo cargar la información del usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadLotteries = async () => {
    try {
      const { data, error } = await supabase
        .from('loterias')
        .select('id, nombre, activa')
        .eq('activa', true)
        .order('nombre');
      
      if (error) {
        console.error('Error cargando loterías:', error);
        // Si la tabla no existe, usar datos por defecto
        if (error.code === '42P01') {
          console.warn('Tabla loterias no existe, usando datos por defecto');
          const mockLotteries = [
            { id: 1, nombre: 'Lotería Nacional', activa: true },
            { id: 2, nombre: 'Chance', activa: true },
            { id: 3, nombre: 'Balota', activa: true }
          ];
          setLotteries(mockLotteries);
          if (!selectedLottery) {
            setSelectedLottery(mockLotteries[0]);
          }
        }
        return;
      }
      
      setLotteries(data || []);
      if (data && data.length > 0 && !selectedLottery) {
        setSelectedLottery(data[0]);
      }
    } catch (error) {
      console.error('Error en loadLotteries:', error);
    }
  };

  const loadLotteryLimits = async (lotteryId) => {
    try {
      console.log('[lottery_limits] Cargando límites para lotería:', lotteryId);
      
      const { data: rows, error } = await supabase
        .from('limite_loteria')
        .select('id, limites, created_at')
        .eq('id_loteria', lotteryId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('[lottery_limits] Error cargando límites:', error);
        // Si la tabla no existe, usar valores por defecto
        if (error.code === '42P01') {
          console.warn('Tabla limite_loteria no existe, usando valores por defecto');
          setLimitsRecordId(null);
          setLimitsConfig(DEFAULT_LOTTERY_LIMITS);
          return;
        }
        return;
      }
      
      if (!rows || rows.length === 0) {
        // No existe configuración: crear una por defecto
        console.log('[lottery_limits] No existe configuración; creando por defecto');
        const now = new Date().toISOString();
        const { data: inserted, error: insErr } = await supabase
          .from('limite_loteria')
          .insert({ 
            id_loteria: lotteryId,
            created_at: now, 
            limites: DEFAULT_LOTTERY_LIMITS 
          })
          .select('id, limites')
          .maybeSingle();
        
        if (insErr) {
          console.error('[lottery_limits] Error creando configuración:', insErr);
          // Si la tabla no existe, usar valores por defecto
          if (insErr.code === '42P01') {
            console.warn('Tabla limite_loteria no existe, usando valores por defecto');
            setLimitsRecordId(null);
            setLimitsConfig(DEFAULT_LOTTERY_LIMITS);
            return;
          }
          return;
        }
        
        setLimitsRecordId(inserted.id);
        setLimitsConfig(inserted.limites || DEFAULT_LOTTERY_LIMITS);
        return;
      }
      
      // Si hay múltiples registros, usar el más reciente y limpiar duplicados
      let baseRow = rows[rows.length - 1]; // más reciente
      if (rows.length > 1) {
        console.warn(`[lottery_limits] Detectados ${rows.length} registros duplicados para lotería ${lotteryId}. Limpiando...`);
        
        // Eliminar registros antiguos
        const duplicateIds = rows.slice(0, -1).map(r => r.id);
        if (duplicateIds.length > 0) {
          const { error: delErr } = await supabase
            .from('limite_loteria')
            .delete()
            .in('id', duplicateIds);
          if (delErr) console.error('[lottery_limits] Error eliminando duplicados:', delErr);
          else console.log('[lottery_limits] Duplicados eliminados:', duplicateIds.length);
        }
      }
      
      // Usar la configuración resultante
      setLimitsRecordId(baseRow.id);
      const merged = { ...DEFAULT_LOTTERY_LIMITS, ...(baseRow.limites || {}) };
      setLimitsConfig(merged);
    } catch (error) {
      console.error('Error en loadLotteryLimits:', error);
    }
  };

  const updateLimitsConfig = async (newConfig) => {
    if (!cacheBankId || !selectedLottery || !limitsRecordId) return;
    
    try {
      setSaving(true);
      const { error } = await supabase
        .from('limite_loteria')
        .update({ limites: newConfig })
        .eq('id', limitsRecordId);
      
      if (error) {
        console.error('Error actualizando configuración:', error);
        Alert.alert('Error', 'No se pudo guardar la configuración');
        return;
      }
      
      setLimitsConfig(newConfig);
      Alert.alert('Éxito', 'Configuración guardada correctamente');
    } catch (error) {
      console.error('Error en updateLimitsConfig:', error);
      Alert.alert('Error', 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    setModalError('');
    
    // Prellenar formulario según el tipo
    switch (type) {
      case 'general':
        setFormData({
          maxBetAmount: limitsConfig.general.maxBetAmount?.toString() || '',
          maxDailyAmount: limitsConfig.general.maxDailyAmount?.toString() || '',
          maxWeeklyAmount: limitsConfig.general.maxWeeklyAmount?.toString() || '',
          enabled: limitsConfig.general.enabled || false
        });
        break;
      case 'playType':
        if (item) {
          const playTypeConfig = limitsConfig.playTypes[item] || {};
          setFormData({
            maxBetAmount: playTypeConfig.maxBetAmount?.toString() || '',
            maxDailyAmount: playTypeConfig.maxDailyAmount?.toString() || '',
            enabled: playTypeConfig.enabled || false
          });
        }
        break;
      case 'numberLimit':
        if (item) {
          setFormData({
            number: item.number || '',
            maxBetAmount: item.maxBetAmount?.toString() || '',
            maxDailyAmount: item.maxDailyAmount?.toString() || ''
          });
        } else {
          setFormData({
            number: '',
            maxBetAmount: '',
            maxDailyAmount: ''
          });
        }
        break;
      default:
        setFormData({});
    }
    
    setModalVisible(true);
  };

  const handleModalSave = () => {
    setModalError('');
    
    // Validaciones básicas
    if (modalType === 'numberLimit') {
      if (!formData.number || !formData.maxBetAmount || !formData.maxDailyAmount) {
        setModalError('Todos los campos son requeridos');
        return;
      }
      if (!/^\d{2,4}$/.test(formData.number)) {
        setModalError('El número debe tener entre 2 y 4 dígitos');
        return;
      }
    } else {
      if (!formData.maxBetAmount || !formData.maxDailyAmount) {
        setModalError('Los campos de montos son requeridos');
        return;
      }
    }
    
    const newConfig = { ...limitsConfig };
    
    switch (modalType) {
      case 'general':
        newConfig.general = {
          maxBetAmount: Number(formData.maxBetAmount),
          maxDailyAmount: Number(formData.maxDailyAmount),
          maxWeeklyAmount: Number(formData.maxWeeklyAmount || 0),
          enabled: formData.enabled
        };
        break;
      case 'playType':
        if (editingItem) {
          newConfig.playTypes[editingItem] = {
            maxBetAmount: Number(formData.maxBetAmount),
            maxDailyAmount: Number(formData.maxDailyAmount),
            enabled: formData.enabled
          };
        }
        break;
      case 'numberLimit':
        if (!newConfig.specialNumbers.numberLimits) {
          newConfig.specialNumbers.numberLimits = {};
        }
        newConfig.specialNumbers.numberLimits[formData.number] = {
          maxBetAmount: Number(formData.maxBetAmount),
          maxDailyAmount: Number(formData.maxDailyAmount)
        };
        break;
    }
    
    updateLimitsConfig(newConfig);
    setModalVisible(false);
  };

  const handleDeleteNumberLimit = (number) => {
    const newConfig = { ...limitsConfig };
    if (newConfig.specialNumbers.numberLimits) {
      delete newConfig.specialNumbers.numberLimits[number];
    }
    updateLimitsConfig(newConfig);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#27AE60" />
        <Text style={styles.loadingText}>Cargando configuración...</Text>
      </View>
    );
  }

  if (cacheUserRole !== 'admin') {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <Text style={styles.accessDeniedText}>
          Acceso denegado. Solo administradores pueden gestionar límites de loterías.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header personalizado */}
      <View style={styles.customHeader}>
        <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>Límites</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={cacheRefreshing}
            onRefresh={cacheOnRefresh}
            colors={['#27AE60']}
            tintColor="#27AE60"
          />
        }
      >
        
        {/* Selector de Lotería */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seleccionar Lotería</Text>
          {lotteries.length > 0 ? (
            <DropdownPicker
              items={lotteries.map(lottery => ({
                label: lottery.nombre,
                value: lottery.id,
                lottery: lottery
              }))}
              placeholder="Selecciona una lotería..."
              value={selectedLottery?.id}
              onValueChange={(value, item) => {
                setSelectedLottery(item.lottery);
              }}
            />
          ) : (
            <Text style={styles.noDataText}>No hay loterías activas disponibles</Text>
          )}
        </View>

        {selectedLottery && (
          <>
            {/* Límites Generales */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Límites Generales</Text>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => openModal('general')}
                >
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>Apuesta máxima:</Text>
                <Text style={styles.limitValue}>${limitsConfig.general.maxBetAmount?.toLocaleString()}</Text>
              </View>
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>Límite diario:</Text>
                <Text style={styles.limitValue}>${limitsConfig.general.maxDailyAmount?.toLocaleString()}</Text>
              </View>
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>Límite semanal:</Text>
                <Text style={styles.limitValue}>${limitsConfig.general.maxWeeklyAmount?.toLocaleString()}</Text>
              </View>
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>Estado:</Text>
                <Text style={[styles.limitValue, { color: limitsConfig.general.enabled ? '#27AE60' : '#E74C3C' }]}>
                  {limitsConfig.general.enabled ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
            </View>

            {/* Límites por Tipo de Jugada */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Límites por Tipo de Jugada</Text>
              {Object.entries(limitsConfig.playTypes).map(([playType, config]) => (
                <View key={playType} style={styles.playTypeItem}>
                  <View style={styles.playTypeHeader}>
                    <Text style={styles.playTypeTitle}>
                      {playType.charAt(0).toUpperCase() + playType.slice(1)}
                    </Text>
                    <TouchableOpacity 
                      style={styles.smallEditButton}
                      onPress={() => openModal('playType', playType)}
                    >
                      <Text style={styles.smallEditButtonText}>✏️</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.playTypeDetail}>
                    Máx: ${config.maxBetAmount?.toLocaleString()} | Diario: ${config.maxDailyAmount?.toLocaleString()}
                  </Text>
                  <Text style={[styles.playTypeStatus, { color: config.enabled ? '#27AE60' : '#E74C3C' }]}>
                    {config.enabled ? 'Activo' : 'Inactivo'}
                  </Text>
                </View>
              ))}
            </View>

            {/* Límites de Números Especiales */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Límites de Números Especiales</Text>
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={() => openModal('numberLimit')}
                >
                  <Text style={styles.addButtonText}>+ Agregar</Text>
                </TouchableOpacity>
              </View>
              {Object.entries(limitsConfig.specialNumbers.numberLimits || {}).length > 0 ? (
                Object.entries(limitsConfig.specialNumbers.numberLimits).map(([number, limits]) => (
                  <View key={number} style={styles.numberLimitItem}>
                    <View style={styles.numberLimitHeader}>
                      <Text style={styles.numberText}>#{number}</Text>
                      <View style={styles.numberLimitActions}>
                        <TouchableOpacity 
                          style={styles.smallEditButton}
                          onPress={() => openModal('numberLimit', { number, ...limits })}
                        >
                          <Text style={styles.smallEditButtonText}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.deleteButton}
                          onPress={() => handleDeleteNumberLimit(number)}
                        >
                          <Text style={styles.deleteButtonText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.numberLimitDetail}>
                      Máx: ${limits.maxBetAmount?.toLocaleString()} | Diario: ${limits.maxDailyAmount?.toLocaleString()}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>No hay límites especiales configurados</Text>
              )}
            </View>
          </>
        )}

      </ScrollView>

      {/* Modal para edición */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {modalType === 'general' ? 'Límites Generales' :
               modalType === 'playType' ? `Límites - ${editingItem?.charAt(0).toUpperCase() + editingItem?.slice(1)}` :
               'Límite de Número Especial'}
            </Text>

            {modalType === 'numberLimit' && (
              <InputField
                label="Número"
                value={formData.number || ''}
                onChangeText={(value) => setFormData(prev => ({ ...prev, number: value }))}
                placeholder="Ej: 123"
                keyboardType="numeric"
              />
            )}

            <MoneyInputField
              label="Apuesta Máxima"
              value={formData.maxBetAmount || ''}
              onChangeText={(value) => setFormData(prev => ({ ...prev, maxBetAmount: value }))}
            />

            <MoneyInputField
              label="Límite Diario"
              value={formData.maxDailyAmount || ''}
              onChangeText={(value) => setFormData(prev => ({ ...prev, maxDailyAmount: value }))}
            />

            {modalType === 'general' && (
              <MoneyInputField
                label="Límite Semanal"
                value={formData.maxWeeklyAmount || ''}
                onChangeText={(value) => setFormData(prev => ({ ...prev, maxWeeklyAmount: value }))}
              />
            )}

            {modalType !== 'numberLimit' && (
              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Activo</Text>
                <Switch
                  value={formData.enabled || false}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, enabled: value }))}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={formData.enabled ? '#f5dd4b' : '#f4f3f4'}
                />
              </View>
            )}

            {modalError ? (
              <Text style={styles.errorText}>{modalError}</Text>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleModalSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sidebar */}
      <SideBar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  accessDeniedText: {
    fontSize: 18,
    color: '#E74C3C',
    textAlign: 'center',
    fontWeight: '500',
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
    ...createShadowStyle(2),
  },
  sidebarButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...createShadowStyle(1),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  editButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  smallEditButton: {
    padding: 4,
  },
  smallEditButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  limitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  limitLabel: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  limitValue: {
    fontSize: 16,
    color: '#34495e',
    fontWeight: '600',
  },
  playTypeItem: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  playTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  playTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  playTypeDetail: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  playTypeStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  numberLimitItem: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#e67e22',
  },
  numberLimitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  numberLimitActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e67e22',
  },
  numberLimitDetail: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  noDataText: {
    fontSize: 14,
    color: '#95a5a6',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    ...createShadowStyle(4),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  saveButton: {
    backgroundColor: '#27AE60',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
};

export default LotteryLimitsScreen;
