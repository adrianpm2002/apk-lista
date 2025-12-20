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

const LotteryLimitsScreen = ({ navigation, onToggleDarkMode }) => {
  return (
    <ScreenWrapper>
      <LotteryLimitsContent
        navigation={navigation}
        onToggleDarkMode={onToggleDarkMode}
      />
    </ScreenWrapper>
  );
};

const LotteryLimitsContent = ({ navigation, onToggleDarkMode }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState(null);
  const [bankId, setBankId] = useState(null);
  
  // Estados principales
  const [lotteries, setLotteries] = useState([]);
  const [activeJugadas, setActiveJugadas] = useState({});
  const [allLimits, setAllLimits] = useState({}); // Para almacenar límites de todas las loterías
  const [expandedLotteries, setExpandedLotteries] = useState({}); // Para controlar acordeón
  
  // Estados del modal de lotería
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [currentLimits, setCurrentLimits] = useState({});
  const [limitsRecordId, setLimitsRecordId] = useState(null);
  
  // Estados del modal de horario
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [currentScheduleLimits, setCurrentScheduleLimits] = useState({});

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
      // Cargar loterías con sus horarios en una sola query
      const { data, error } = await supabase
        .from('loteria')
        .select(`
          id, 
          nombre,
          horarios:horario(id, nombre, hora_inicio, hora_fin, limite)
        `)
        .eq('id_banco', bankId)
        .order('nombre');
      
      if (!error) {
        setLotteries(data || []);
        // Cargar todos los límites después de cargar las loterías
        await loadAllLimits(data || []);
      }
    } catch (error) {
      console.error('Error loading lotteries:', error);
    }
    setLoading(false);
  };

  const loadAllLimits = async (lotteriesList) => {
    try {
      const { data, error } = await supabase
        .from('limite_loteria')
        .select('id_loteria, limites')
        .in('id_loteria', lotteriesList.map(l => l.id));
      
      if (!error && data) {
        const limitsMap = {};
        data.forEach(item => {
          limitsMap[item.id_loteria] = item.limites || {};
        });
        setAllLimits(limitsMap);
      }
    } catch (error) {
      console.error('Error loading all limits:', error);
      // Si hay error (tabla no existe), usar objeto vacío
      setAllLimits({});
    }
  };

  const loadActiveJugadas = async () => {
    if (!bankId) return;
    
    try {
      const { data, error } = await supabase
        .from('jugadas_activas')
        .select('jugadas')
        .eq('id_banco', bankId)
        .maybeSingle();
      
      if (!error && data?.jugadas) {
        // Nuevo formato: { "uuid-loteria-1": { fijo: true, ... }, "uuid-loteria-2": { ... } }
        // Crear un objeto consolidado de todas las jugadas activas por lotería
        const jugadasByLottery = data.jugadas;
        setActiveJugadas(jugadasByLottery);
      } else {
        // Si no hay datos, usar objeto vacío
        setActiveJugadas({});
      }
    } catch (error) {
      console.error('Error loading active jugadas:', error);
      setActiveJugadas({});
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
        .maybeSingle();
      
      if (error) {
        console.error('[lottery_limits] Error cargando límites:', error);
        
        // Si la tabla no existe (error 406 o 42P01), usar valores por defecto
        if (error.code === '42P01' || error.message?.includes('406') || error.message?.includes('Not Acceptable')) {
          console.warn('[lottery_limits] Tabla limite_loteria no existe o no es accesible. Usando valores por defecto.');
          setLimitsRecordId(null);
          setCurrentLimits({});
          
          // Mostrar alerta informativa al usuario
          Alert.alert(
            'Información',
            'La tabla de límites no existe aún. Se creará automáticamente al guardar los primeros límites.',
            [{ text: 'Entendido' }]
          );
          return;
        }
        
        // Para otros errores, usar valores por defecto silenciosamente
        setLimitsRecordId(null);
        setCurrentLimits({});
        return;
      }
      
      if (data) {
        setLimitsRecordId(data.id);
        setCurrentLimits(data.limites || {});
      } else {
        setLimitsRecordId(null);
        setCurrentLimits({});
      }
    } catch (error) {
      console.error('[lottery_limits] Excepción cargando límites:', error);
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
        
        if (error) {
          console.error('[lottery_limits] Error actualizando:', error);
          throw error;
        }
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
        
        if (error) {
          console.error('[lottery_limits] Error creando:', error);
          
          // Si la tabla no existe, mostrar mensaje más específico
          if (error.code === '42P01' || error.message?.includes('406') || error.message?.includes('Not Acceptable')) {
            Alert.alert(
              'Error de Base de Datos',
              'La tabla limite_loteria no existe en la base de datos. Por favor, contacta al administrador del sistema para crear la tabla con la siguiente estructura:\n\nCREATE TABLE limite_loteria (\n  id SERIAL PRIMARY KEY,\n  id_loteria UUID NOT NULL,\n  limites JSONB,\n  created_at TIMESTAMP DEFAULT NOW()\n);',
              [{ text: 'Entendido' }]
            );
            return;
          }
          
          throw error;
        }
        
        if (data) {
          setLimitsRecordId(data.id);
        }
      }
      
      Alert.alert('Éxito', 'Límites guardados correctamente');
      
      // Actualizar la vista previa en la lista
      setAllLimits(prev => ({
        ...prev,
        [selectedLottery.id]: processedLimits
      }));
      
      setModalVisible(false);
    } catch (error) {
      console.error('[lottery_limits] Error guardando límites:', error);
      Alert.alert(
    

  // Funciones para horarios
  const toggleLotteryExpansion = (lotteryId) => {
    setExpandedLotteries(prev => ({
      ...prev,
      [lotteryId]: !prev[lotteryId]
    }));
  };

  const openScheduleModal = (schedule, lotteryName) => {
    setSelectedSchedule({ ...schedule, lotteryName });
    setCurrentScheduleLimits(schedule.limite || {});
    setScheduleModalVisible(true);
  };

  const handleScheduleLimitChange = (jugada, value) => {
    setCurrentScheduleLimits(prev => ({
      ...prev,
      [jugada]: value
    }));
  };

  const saveScheduleLimits = async () => {
    if (!selectedSchedule) return;
    
    setSaving(true);
    try {
      // Convertir valores a números y filtrar vacíos
      const processedLimits = {};
      Object.entries(currentScheduleLimits).forEach(([jugada, value]) => {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue > 0) {
          processedLimits[jugada] = numValue;
        }
      });

      // Actualizar directamente en la tabla horario
      const { error } = await supabase
        .from('horario')
        .update({ limite: processedLimits })
        .eq('id', selectedSchedule.id);
      
      if (error) {
        console.error('[schedule_limits] Error actualizando:', error);
        throw error;
      }
      
      Alert.alert('Éxito', 'Límites del horario guardados correctamente');
      
      // Recargar loterías para actualizar la vista
      await loadLotteries();
      
      setScheduleModalVisible(false);
    } catch (error) {
      console.error('[schedule_limits] Error guardando límites:', error);
      Alert.alert(
        'Error',
        `No se pudieron guardar los límites: ${error.message || 'Error desconocido'}`
      );
    }
    setSaving(false);
  };    'Error',
        `No se pudieron guardar los límites: ${error.message || 'Error desconocido'}`
      );
    }
    setSaving(false);
  };

  const renderLotteryItem = ({ item }) => {
    const itemLimits = allLimits[item.id] || {};
    const hasLimits = Object.keys(itemLimits).length > 0;
    const activeJugadasList = getActiveJugadasList(item.id);
    const isExpanded = expandedLotteries[item.id] || false;
    const schedules = item.horarios || [];
    
    // Filtrar solo las jugadas que tienen límites configurados
    const configuredLimits = activeJugadasList.filter(jugada => itemLimits[jugada]);
    
    // Crear filas con 3 elementos máximo por fila
    const createLimitRows = () => {
      const rows = [];
      for (let i = 0; i < configuredLimits.length; i += 3) {
        rows.push(configuredLimits.slice(i, i + 3));
      }
      return rows;
    };
    
    return (
      <View style={styles.lotteryContainer}>
        {/* Card de Lotería */}
        <TouchableOpacity 
          style={styles.lotteryItem}
          onPress={() => toggleLotteryExpansion(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.lotteryHeader}>
            <View style={styles.lotteryInfo}>
              <View style={styles.lotteryTitleRow}>
                <Text style={styles.expandIcon}>
                  {isExpanded ? '📂' : '📁'}
                </Text>
                <Text style={styles.lotteryName}>
                  {item.nombre}
                </Text>
                <Text style={styles.scheduleCount}>
                  ({schedules.length} horario{schedules.length !== 1 ? 's' : ''})
                </Text>
              </View>
              
              {hasLimits ? (
                <View style={styles.limitsPreview}>
                  <Text style={styles.limitsPreviewTitle}>
                    Límites de lotería:
                  </Text>
                  {createLimitRows().map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.limitRow}>
                      {row.map(jugada => (
                        <View key={jugada} style={styles.limitChip}>
                          <Text style={styles.limitChipText}>
                            {jugada.charAt(0).toUpperCase() + jugada.slice(1)}: ${itemLimits[jugada].toLocaleString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noLimitsText}>
                  Sin límites de lotería
                </Text>
              )}
            </View>
            
            <TouchableOpacity
              style={styles.editButton}
              onPress={(e) => {
                e.stopPropagation();
                openEditModal(item);
              }}
            >
              <Text style={styles.editButtonText}>✏️</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Horarios expandibles */}
        {isExpanded && schedules.length > 0 && (
          <View style={styles.schedulesContainer}>
            {schedules.map((schedule, index) => {
              const scheduleLimits = schedule.limite || {};
              const hasScheduleLimits = Object.keys(scheduleLimits).length > 0;
              const scheduleLimitsArray = Object.entries(scheduleLimits).filter(([, value]) => value > 0);
              
              return (
                <View key={schedule.id} style={styles.scheduleItem}>
                  <View style={styles.scheduleInfo}>
                    <View style={styles.scheduleHeader}>
                      <Text style={styles.scheduleIcon}>🕐</Text>
                      <View style={styles.scheduleDetails}>
                        <Text style={styles.scheduleName}>
                          {schedule.nombre}
                        </Text>
                        <Text style={styles.scheduleTime}>
                          {schedule.hora_inicio?.substring(0, 5)} - {schedule.hora_fin?.substring(0, 5)}
                        </Text>
                      </View>
                    </View>
                    
                    {hasScheduleLimits ? (
                      <View style={styles.scheduleLimits}>
                        <Text style={styles.scheduleLimitsTitle}>
                          Límites del horario:
                        </Text>
                        <View style={styles.scheduleLimitsList}>
                          {scheduleLimitsArray.map(([jugada, value]) => (
                            <View key={jugada} style={styles.scheduleLimitChip}>
                              <Text style={styles.scheduleLimitChipText}>
                                {jugada.charAt(0).toUpperCase() + jugada.slice(1)}: ${value.toLocaleString()}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.noScheduleLimitsText}>
                        Sin límites específicos
                      </Text>
                    )}
                  </View>
                  
                  <TouchableOpacity
                    style={styles.scheduleEditButton}
                    onPress={() => openScheduleModal(schedule, item.nombre)}
                  >
                    <Text style={styles.scheduleEditButtonText}>✏️</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const getActiveJugadasList = (lotteryId = null) => {
    // Si no se proporciona lotería específica, usar la lotería seleccionada del modal
    const targetLotteryId = lotteryId || selectedLottery?.id;
    if (!targetLotteryId) return [];
    
    // Nuevo formato: activeJugadas = { "uuid-loteria-1": { fijo: true, ... } }
    const lotteryJugadas = activeJugadas[targetLotteryId] || {};
    return JUGADA_ORDER.filter(jugada => lotteryJugadas[jugada] === true);
  };

  const renderLimitInput = (jugada) => (
    <View key={jugada} style={styles.limitInputRow}>
      <Text style={styles.limitLabel}>
        {jugada.charAt(0).toUpperCase() + jugada.slice(1)}:
      </Text>
      <TextInput
        style={styles.limitInput}
        value={currentLimits[jugada]?.toString() || ''}
        onChangeText={(value) => handleLimitChange(jugada, value)}
        placeholder="0.00"
        placeholderTextColor="#95a5a6"
        keyboardType="numeric"
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <SideBarToggle 
          inline 
          onToggle={() => setSidebarVisible(!sidebarVisible)} 
          style={styles.sidebarButton} 
        />
        <Text style={styles.headerTitle}>
          Límites de Loterías
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D5016" />
          <Text style={styles.loadingText}>
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

      {/* Modal de edición de límites de lotería */}
      {modalVisible && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Límites de Lotería - {selectedLottery?.nombre}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalCloseButton}>×</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {getActiveJugadasList().length > 0 ? (
                  getActiveJugadasList().map(renderLimitInput)
                ) : (
                  <Text style={styles.noJugadasText}>
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
      )}

      {/* Modal de edición de límites de horario */}
      {scheduleModalVisible && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setScheduleModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    Límites de Horario
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedSchedule?.lotteryName} - {selectedSchedule?.nombre}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setScheduleModalVisible(false)}>
                  <Text style={styles.modalCloseButton}>×</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {getActiveJugadasList(selectedSchedule?.id_loteria).length > 0 ? (
                  getActiveJugadasList(selectedSchedule?.id_loteria).map((jugada) => (
                    <View key={jugada} style={styles.limitInputRow}>
                      <Text style={styles.limitLabel}>
                        {jugada.charAt(0).toUpperCase() + jugada.slice(1)}:
                      </Text>
                      <TextInput
                        style={styles.limitInput}
                        value={currentScheduleLimits[jugada]?.toString() || ''}
                        onChangeText={(value) => handleScheduleLimitChange(jugada, value)}
                        placeholder="0.00"
                        placeholderTextColor="#95a5a6"
                        keyboardType="numeric"
                      />
                    </View>
                  ))
                ) : (
                  <Text style={styles.noJugadasText}>
                    No hay jugadas activas configuradas
                  </Text>
                )}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setScheduleModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={saveScheduleLimits}
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
      )}

      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        onToggleDarkMode={onToggleDarkMode}
        navigation={navigation}
        role={role}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 50,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8F5E8',
    ...createShadowStyle(0, 2, '#000000', 0.1, 4)
  },
  sidebarButton: {
    padding: 8
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D5016',
    flex: 1,
    textAlign: 'center',
    marginRight: 40
  },
  headerTitleDark: {
    color: '#E8F5E8'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#2D5016'
  },
  loadingTextDark: {
    color: '#E8F5E8'
  },
  list: {
    flex: 1
  },
  listContent: {
    padding: 20
  },
  lotteryContainer: {
    marginBottom: 15
  },
  lotteryItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    ...createShadowStyle(0, 2, '#000000', 0.1, 4)
  },
  lotteryItemDark: {
    backgroundColor: '#2c3e50'
  },
  lotteryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  lotteryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  expandIcon: {
    fontSize: 18,
    marginRight: 8
  },
  scheduleCount: {
    fontSize: 12,
    color: '#95a5a6',
    marginLeft: 8,
    fontStyle: 'italic'
  },
  lotteryInfo: {
    flex: 1,
    marginRight: 10
  },
  lotteryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D5016'
  },
  lotteryNameDark: {
    color: '#E8F5E8'
  },
  limitsPreview: {
    marginTop: 4
  },
  limitsPreviewTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4CAF50',
    marginBottom: 6
  },
  limitsPreviewTitleDark: {
    color: '#81C784'
  },
  limitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4
  },
  limitChip: {
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 3
  },
  limitChipDark: {
    backgroundColor: '#34495e'
  },
  limitChipText: {
    fontSize: 10,
    color: '#2D5016',
    fontWeight: '500'
  },
  limitChipTextDark: {
    color: '#E8F5E8'
  },
  noLimitsText: {
    fontSize: 11,
    color: '#95a5a6',
    fontStyle: 'italic',
    marginTop: 4
  },
  noLimitsTextDark: {
    color: '#bdc3c7'
  },
  editButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center'
  },
  editButtonText: {
    fontSize: 18
  },
  // Estilos para horarios
  schedulesContainer: {
    marginTop: 10,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#E8F5E8'
  },
  scheduleItem: {
    backgroundColor: '#F8FDF5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E8F5E8'
  },
  scheduleInfo: {
    flex: 1,
    marginRight: 8
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  scheduleIcon: {
    fontSize: 16,
    marginRight: 8
  },
  scheduleDetails: {
    flex: 1
  },
  scheduleName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D5016',
    marginBottom: 2
  },
  scheduleTime: {
    fontSize: 11,
    color: '#7F8C8D'
  },
  scheduleLimits: {
    marginTop: 6
  },
  scheduleLimitsTitle: {
    fontSize: 10,
    fontWeight: '500',
    color: '#3498DB',
    marginBottom: 4
  },
  scheduleLimitsList: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  scheduleLimitChip: {
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 3
  },
  scheduleLimitChipText: {
    fontSize: 9,
    color: '#1976D2',
    fontWeight: '500'
  },
  noScheduleLimitsText: {
    fontSize: 10,
    color: '#95a5a6',
    fontStyle: 'italic',
    marginTop: 4
  },
  scheduleEditButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center'
  },
  scheduleEditButtonText: {
    fontSize: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    ...createShadowStyle(0, 4, '#000000', 0.3, 8)
  },
  modalContentDark: {
    backgroundColor: '#2c3e50'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F5E8'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D5016',
    flex: 1
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 4
  },
  modalTitleDark: {
    color: '#E8F5E8'
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#95a5a6',
    fontWeight: 'bold',
    padding: 5
  },
  modalBody: {
    padding: 20,
    maxHeight: 400
  },
  limitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15
  },
  limitLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D5016',
    width: 100,
    marginRight: 15
  },
  limitLabelDark: {
    color: '#E8F5E8'
  },
  limitInput: {
    flex: 1,
    backgroundColor: '#F8FDF5',
    borderWidth: 1,
    borderColor: '#B8D4A8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#2D5016'
  },
  limitInputDark: {
    backgroundColor: '#34495e',
    borderColor: '#4a6741',
    color: '#E8F5E8'
  },
  noJugadasText: {
    fontSize: 16,
    color: '#95a5a6',
    textAlign: 'center',
    paddingVertical: 40
  },
  noJugadasTextDark: {
    color: '#bdc3c7'
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E8F5E8'
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5
  },
  cancelButton: {
    backgroundColor: '#e74c3c'
  },
  saveButton: {
    backgroundColor: '#4CAF50'
  },
  saveButtonDisabled: {
    backgroundColor: '#95a5a6'
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  }
});

export default LotteryLimitsScreen;
