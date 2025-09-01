import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert, 
  ActivityIndicator, 
  RefreshControl,
  Modal,
  TouchableOpacity,
  Platform,
  Switch
} from 'react-native';
import { supabase } from '../supabaseClient';
import { SideBar, SideBarToggle } from '../components/SideBar';
import ActionButton from '../components/ActionButton';
import InputField from '../components/InputField';
import MoneyInputField from '../components/MoneyInputField';
import DropdownPicker from '../components/DropdownPicker';
import { useCache } from '../contexts/CacheContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';

const LotteryLimitsScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  return (
    <ScreenWrapper>
      <LotteryLimitsContent
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
      />
    </ScreenWrapper>
  );
};

// Esquema por defecto para límites de lotería
const DEFAULT_LOTTERY_LIMITS = {
  general: {
    maxBetAmount: 10000,
    maxDailyAmount: 50000,
    maxWeeklyAmount: 200000,
    enabled: true
  },
  playTypes: {
    fijo: {
      maxBetAmount: 5000,
      maxDailyAmount: 25000,
      enabled: true
    },
    corrido: {
      maxBetAmount: 3000,
      maxDailyAmount: 15000,
      enabled: true
    },
    posicion: {
      maxBetAmount: 2000,
      maxDailyAmount: 10000,
      enabled: true
    },
    parle: {
      maxBetAmount: 1000,
      maxDailyAmount: 5000,
      enabled: true
    },
    centena: {
      maxBetAmount: 500,
      maxDailyAmount: 2500,
      enabled: true
    },
    tripleta: {
      maxBetAmount: 100,
      maxDailyAmount: 1000,
      enabled: true
    }
  },
  specialNumbers: {
    restrictedNumbers: [],
    numberLimits: {
      // Estructura: { "número": { maxBetAmount: value, maxDailyAmount: value } }
    }
  },
  timeRestrictions: {
    cutoffTime: "18:00",
    allowLatePlay: false,
    latePlayFee: 0
  }
};

const LotteryLimitsContent = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  const { cache, userRole: cacheUserRole, currentBankId: cacheBankId } = useCache();
  const { refreshing: cacheRefreshing, onRefresh: cacheOnRefresh } = usePullToRefresh('lotteryLimits');
  
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estados principales
  const [lotteries, setLotteries] = useState([]);
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
    if (currentBankId) {
      loadLotteries();
    }
  }, [currentBankId]);

  // Efecto para cargar límites cuando cambia la lotería seleccionada
  useEffect(() => {
    if (selectedLottery && currentBankId) {
      loadLotteryLimits(selectedLottery.id);
    }
  }, [selectedLottery, currentBankId]);

  // Carga inicial
  useEffect(() => {
    setUserRole(cacheUserRole);
    setCurrentBankId(cacheBankId);
  }, [cacheUserRole, cacheBankId]);

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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('usuarios')
          .select('rol')
          .eq('id', user.id)
          .single();
        if (error) {
          console.error('Error obteniendo rol de usuario:', error);
        } else {
          setUserRole(data.rol);
        }
      }
    } catch (error) {
      console.error('Error en fetchUserRole:', error);
    }
  };

  const loadLotteries = async () => {
    try {
      const { data, error } = await supabase
        .from('loterias')
        .select('id, nombre, activa')
        .eq('id_banco', currentBankId)
        .eq('activa', true)
        .order('nombre');
      
      if (error) {
        console.error('Error cargando loterías:', error);
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
        .from('lottery_limits')
        .select('id, limits_config, created_at')
        .eq('id_banco', currentBankId)
        .eq('id_loteria', lotteryId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('[lottery_limits] Error cargando límites:', error);
        return;
      }
      
      if (!rows || rows.length === 0) {
        // No existe configuración: crear una por defecto
        console.log('[lottery_limits] No existe configuración; creando por defecto');
        const now = new Date().toISOString();
        const { data: inserted, error: insErr } = await supabase
          .from('lottery_limits')
          .insert({ 
            id_banco: currentBankId, 
            id_loteria: lotteryId,
            created_at: now, 
            limits_config: DEFAULT_LOTTERY_LIMITS 
          })
          .select('id, limits_config')
          .maybeSingle();
        
        if (insErr) {
          console.error('[lottery_limits] Error creando configuración:', insErr);
          return;
        }
        
        setLimitsRecordId(inserted.id);
        setLimitsConfig(inserted.limits_config || DEFAULT_LOTTERY_LIMITS);
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
            .from('lottery_limits')
            .delete()
            .in('id', duplicateIds);
          if (delErr) console.error('[lottery_limits] Error eliminando duplicados:', delErr);
          else console.log('[lottery_limits] Duplicados eliminados:', duplicateIds.length);
        }
      }
      
      // Usar la configuración resultante
      setLimitsRecordId(baseRow.id);
      const merged = { ...DEFAULT_LOTTERY_LIMITS, ...(baseRow.limits_config || {}) };
      setLimitsConfig(merged);
    } catch (error) {
      console.error('Error en loadLotteryLimits:', error);
    }
  };

  const updateLimitsConfig = async (newConfig) => {
    if (!currentBankId || !selectedLottery || !limitsRecordId) return;
    
    try {
      setSaving(true);
      const { error } = await supabase
        .from('lottery_limits')
        .update({ limits_config: newConfig })
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

  if (userRole !== 'admin') {
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
