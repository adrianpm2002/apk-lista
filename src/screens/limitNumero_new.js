import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  FlatList,
  RefreshControl 
} from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import MoneyInputField from '../components/MoneyInputField';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';
import { useNumberLimits } from '../hooks/useNumberLimits';

const LimitNumberScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  // Estados principales
  const [lotteries, setLotteries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedPlayType, setSelectedPlayType] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Estados para formularios
  const [specificNumber, setSpecificNumber] = useState('');
  const [specificLimitAmount, setSpecificLimitAmount] = useState('');
  const [activePlayTypes, setActivePlayTypes] = useState([]);
  const [numberError, setNumberError] = useState('');

  // Hook personalizado para límites
  const {
    specificLimits,
    isLoading,
    error,
    loadSpecificLimits,
    saveSpecificLimit,
    deleteSpecificLimit,
    resetCurrentAmounts
  } = useNumberLimits();

  // Validación de dígitos por tipo de jugada
  const getDigitValidation = (playType) => {
    const validations = {
      'fijo': { digits: 2, message: 'El fijo debe tener exactamente 2 dígitos' },
      'parle': { digits: 4, message: 'El parlé debe tener exactamente 4 dígitos' },
      'centena': { digits: 3, message: 'La centena debe tener exactamente 3 dígitos' },
      'corrido': { digits: 2, message: 'El corrido debe tener exactamente 2 dígitos' },
      'posicion': { digits: 2, message: 'La posición debe tener exactamente 2 dígitos' },
      'tripleta': { digits: 3, message: 'La tripleta debe tener exactamente 3 dígitos' },
    };
    return validations[playType] || { digits: 2, message: 'Número inválido' };
  };

  // Cargar tipos de jugada activos del banco
  const fetchActivePlayTypes = async () => {
    if (!currentBankId) return;
    try {
      const { data, error } = await supabase
        .from('jugadas_activas')
        .select('jugadas')
        .eq('id_banco', currentBankId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      const jugadas = data?.jugadas || { fijo:true, corrido:true, posicion:true, parle:true, centena:true, tripleta:true };
      const activeTypes = Object.entries(jugadas).filter(([,v])=>v).map(([k]) => ({ label: getPlayTypeLabel(k), value: k }));
      setActivePlayTypes(activeTypes);
    } catch (error) {
      console.error('Error cargando tipos de jugada activos:', error);
      Alert.alert('Error', 'No se pudieron cargar los tipos de jugada activos');
    }
  };

  // Obtener etiqueta del tipo de jugada
  const getPlayTypeLabel = (value) => {
    const labels = {
      'fijo': 'Fijo',
      'corrido': 'Corrido',
      'posicion': 'Posición',
      'parle': 'Parlé',
      'centena': 'Centena',
      'tripleta': 'Tripleta',
    };
    return labels[value] || value;
  };

  // Cargar loterías
  const fetchLotteries = async () => {
    if (!currentBankId) return;
    
    try {
      const { data, error } = await supabase
        .from('loteria')
        .select('id, nombre')
        .eq('id_banco', currentBankId)
        .order('nombre');

      if (error) throw error;
      
      const formattedLotteries = data.map(lottery => ({
        label: lottery.nombre,
        value: lottery.id
      }));
      
      setLotteries(formattedLotteries);
    } catch (error) {
      console.error('Error cargando loterías:', error);
      Alert.alert('Error', 'No se pudieron cargar las loterías');
    }
  };

  // Cargar horarios
  const fetchSchedules = async (lotteryId) => {
    try {
      const { data, error } = await supabase
        .from('horario')
        .select('id, nombre')
        .eq('id_loteria', lotteryId)
        .order('nombre');

      if (error) throw error;
      
      const formattedSchedules = data.map(schedule => ({
        label: schedule.nombre,
        value: schedule.id
      }));
      
      setSchedules(formattedSchedules);
    } catch (error) {
      console.error('Error cargando horarios:', error);
      Alert.alert('Error', 'No se pudieron cargar los horarios');
    }
  };

  // Obtener rol del usuario
  const fetchUserRole = async () => {
    try {
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
        }
      }
    } catch (error) {
      console.error('Error cargando rol del usuario:', error);
    }
  };

  // Manejadores de selección
  const handleLotteryChange = (option) => {
    setSelectedLottery(option);
    setSelectedSchedule(null);
    setSelectedPlayType(null);
    setSchedules([]);
    if (option) {
      fetchSchedules(option.value);
    }
  };

  const handleScheduleChange = (option) => {
    setSelectedSchedule(option);
    setSelectedPlayType(null);
  };

  const handlePlayTypeChange = (option) => {
    setSelectedPlayType(option);
    if (selectedLottery && selectedSchedule && option) {
      loadSpecificLimits(selectedLottery.value, selectedSchedule.value, option.value);
    }
  };

  // Guardar límite específico
  const handleSaveSpecificLimit = async () => {
    if (!selectedLottery || !selectedSchedule || !selectedPlayType) {
      Alert.alert('Error', 'Selecciona lotería, horario y tipo de jugada');
      return;
    }

    // Validar número según tipo de jugada
    const validation = getDigitValidation(selectedPlayType.value);
    if (!specificNumber || specificNumber.length !== validation.digits) {
      setNumberError(validation.message);
      Alert.alert('Error', validation.message);
      return;
    }

    // Validar que solo contenga números
    if (!/^\d+$/.test(specificNumber)) {
      setNumberError('Solo se permiten números');
      Alert.alert('Error', 'Solo se permiten números');
      return;
    }

    if (!specificLimitAmount || parseFloat(specificLimitAmount) <= 0) {
      Alert.alert('Error', 'Ingresa un límite válido mayor a 0');
      return;
    }

    setNumberError(''); // Limpiar error si todo está bien

    const result = await saveSpecificLimit(
      selectedLottery.value,
      selectedSchedule.value,
      selectedPlayType.value,
      specificNumber,
      specificLimitAmount
    );

    if (result.success) {
      Alert.alert('Éxito', 'Límite específico guardado correctamente');
      setSpecificNumber('');
      setSpecificLimitAmount('');
    } else {
      Alert.alert('Error', result.error || 'No se pudo guardar el límite');
    }
  };

  // Validar número en tiempo real
  const handleNumberChange = (text) => {
    // Solo permitir números
    const numericText = text.replace(/[^0-9]/g, '');
    
    if (selectedPlayType) {
      const validation = getDigitValidation(selectedPlayType.value);
      
      // Limitar la longitud según el tipo de jugada
      if (numericText.length <= validation.digits) {
        setSpecificNumber(numericText);
        
        // Mostrar error si no tiene la longitud correcta
        if (numericText.length > 0 && numericText.length !== validation.digits) {
          setNumberError(validation.message);
        } else {
          setNumberError('');
        }
      }
    } else {
      setSpecificNumber(numericText);
    }
  };

  // Eliminar límite específico
  const handleDeleteSpecificLimit = (limit) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Eliminar límite del número ${limit.number}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteSpecificLimit(limit.id);
            if (result.success) {
              Alert.alert('Éxito', 'Límite eliminado correctamente');
            } else {
              Alert.alert('Error', result.error || 'No se pudo eliminar');
            }
          }
        }
      ]
    );
  };

  // Resetear montos actuales
  const handleResetAmounts = () => {
    if (!selectedLottery || !selectedSchedule || !selectedPlayType) {
      Alert.alert('Error', 'Selecciona lotería, horario y tipo de jugada');
      return;
    }

    Alert.alert(
      'Confirmar reseteo',
      '¿Resetear todos los montos actuales a $0? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetear',
          style: 'destructive',
          onPress: async () => {
            const result = await resetCurrentAmounts(
              selectedLottery.value,
              selectedSchedule.value,
              selectedPlayType.value
            );
            if (result.success) {
              Alert.alert('Éxito', 'Montos reseteados correctamente');
            } else {
              Alert.alert('Error', result.error || 'No se pudo resetear');
            }
          }
        }
      ]
    );
  };

  // Refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLotteries();
    await fetchActivePlayTypes();
    if (selectedLottery && selectedSchedule && selectedPlayType) {
      await loadSpecificLimits(selectedLottery.value, selectedSchedule.value, selectedPlayType.value);
    }
    setRefreshing(false);
  };

  // Renderizar item de límite específico
  const renderSpecificLimitItem = ({ item }) => {
    const percentage = item.limit_amount > 0 ? (item.current_amount / item.limit_amount) * 100 : 0;
    const isNearLimit = percentage >= 80;
    const isAtLimit = percentage >= 100;

    return (
      <View style={[
        styles.limitItem,
        isDarkMode && styles.limitItemDark,
        isAtLimit && styles.limitItemFull,
        isNearLimit && !isAtLimit && styles.limitItemNear
      ]}>
        <View style={styles.limitItemHeader}>
          <Text style={[styles.numberText, isDarkMode && styles.numberTextDark]}>
            #{item.number}
          </Text>
          <TouchableOpacity
            onPress={() => handleDeleteSpecificLimit(item)}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.limitItemBody}>
          <Text style={[styles.limitText, isDarkMode && styles.limitTextDark]}>
            Límite: ${parseFloat(item.limit_amount).toFixed(2)}
          </Text>
          <Text style={[styles.currentText, isDarkMode && styles.currentTextDark]}>
            Actual: ${parseFloat(item.current_amount).toFixed(2)}
          </Text>
        </View>

        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { width: `${Math.min(percentage, 100)}%` },
              isAtLimit && styles.progressFillFull,
              isNearLimit && !isAtLimit && styles.progressFillNear
            ]} 
          />
        </View>
        
        <View style={styles.limitItemFooter}>
          <Text style={[styles.percentageText, isDarkMode && styles.percentageTextDark]}>
            {percentage.toFixed(1)}% utilizado
          </Text>
        </View>
      </View>
    );
  };

  // Effects
  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (currentBankId) {
      fetchLotteries();
      fetchActivePlayTypes();
    }
  }, [currentBankId]);

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Header personalizado */}
      <View style={[styles.customHeader, isDarkMode && styles.customHeaderDark]}>
        <SideBarToggle onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
          Límites de Números
        </Text>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Selectores */}
        <View style={styles.selectorsContainer}>
          <DropdownPicker
            label="Lotería"
            value={selectedLottery?.label || ''}
            onSelect={handleLotteryChange}
            options={lotteries}
            placeholder="Seleccionar lotería"
            isDarkMode={isDarkMode}
          />

          <DropdownPicker
            label="Horario"
            value={selectedSchedule?.label || ''}
            onSelect={handleScheduleChange}
            options={schedules}
            placeholder="Seleccionar horario"
            disabled={!selectedLottery}
            isDarkMode={isDarkMode}
          />

          <DropdownPicker
            label="Tipo de Jugada"
            value={selectedPlayType?.label || ''}
            onSelect={handlePlayTypeChange}
            options={activePlayTypes}
            placeholder="Seleccionar tipo"
            disabled={!selectedSchedule}
            isDarkMode={isDarkMode}
          />
        </View>

        {/* Botones de acciones principales */}
        {selectedLottery && selectedSchedule && selectedPlayType && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.resetButton]}
              onPress={handleResetAmounts}
            >
              <Text style={styles.actionButtonText}>🔄 Resetear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Formulario para agregar límite específico */}
        {selectedLottery && selectedSchedule && selectedPlayType && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Agregar Límite Específico
            </Text>
            
            <Text style={[styles.sectionDescription, isDarkMode && styles.sectionDescriptionDark]}>
              {selectedPlayType && `${getDigitValidation(selectedPlayType.value).message.replace('debe tener exactamente', 'requiere')}`}
            </Text>

            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <InputField
                  label={`Número (${selectedPlayType ? getDigitValidation(selectedPlayType.value).digits : '2'} dígitos)`}
                  value={specificNumber}
                  onChangeText={handleNumberChange}
                  placeholder={selectedPlayType ? '0'.repeat(getDigitValidation(selectedPlayType.value).digits) : '00'}
                  keyboardType="numeric"
                  maxLength={selectedPlayType ? getDigitValidation(selectedPlayType.value).digits : 2}
                  isDarkMode={isDarkMode}
                  error={numberError}
                />
                {numberError !== '' && (
                  <Text style={styles.errorText}>{numberError}</Text>
                )}
              </View>

              <View style={styles.inputContainer}>
                <MoneyInputField
                  label="Límite ($)"
                  value={specificLimitAmount}
                  onChangeText={setSpecificLimitAmount}
                  placeholder="0.00"
                  isDarkMode={isDarkMode}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, styles.addButton]}
              onPress={handleSaveSpecificLimit}
            >
              <Text style={styles.actionButtonText}>➕ Agregar Límite</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Filtros para la lista */}
        {selectedLottery && selectedSchedule && selectedPlayType && (
          <View style={styles.filtersContainer}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Límites Configurados
            </Text>
            
            <View style={styles.filterRow}>
              <View style={styles.filterItem}>
                <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>
                  Lotería: {selectedLottery.label}
                </Text>
              </View>
              <View style={styles.filterItem}>
                <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>
                  Horario: {selectedSchedule.label}
                </Text>
              </View>
              <View style={styles.filterItem}>
                <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>
                  Tipo: {selectedPlayType.label}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Lista de límites específicos */}
        {selectedLottery && selectedSchedule && selectedPlayType && (
          <View style={styles.limitsContainer}>
            {isLoading ? (
              <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
                Cargando límites...
              </Text>
            ) : specificLimits.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
                  No hay límites específicos configurados
                </Text>
                <Text style={[styles.emptySubtext, isDarkMode && styles.emptySubtextDark]}>
                  Agrega un número y límite arriba para comenzar
                </Text>
              </View>
            ) : (
              <FlatList
                data={specificLimits}
                renderItem={renderSpecificLimitItem}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
  },
  containerDark: {
    backgroundColor: '#1a252f',
  },
  customHeader: {
    height: 100,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
  },
  customHeaderDark: {
    backgroundColor: '#2c3e50',
    borderBottomColor: '#34495e',
  },
  sidebarButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
    textAlign: 'center',
    marginRight: 44,
  },
  headerTitleDark: {
    color: '#ecf0f1',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  selectorsContainer: {
    marginBottom: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  resetButton: {
    backgroundColor: '#f39c12',
  },
  addButton: {
    backgroundColor: '#27ae60',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 12,
  },
  sectionTitleDark: {
    color: '#ecf0f1',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  sectionDescriptionDark: {
    color: '#bdc3c7',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inputContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  filterItem: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
    flex: 1,
    marginHorizontal: 2,
  },
  filterLabel: {
    fontSize: 12,
    color: '#2c3e50',
    textAlign: 'center',
    fontWeight: '500',
  },
  filterLabelDark: {
    color: '#ecf0f1',
  },
  limitsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: 16,
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  loadingTextDark: {
    color: '#bdc3c7',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    fontWeight: '500',
  },
  emptyTextDark: {
    color: '#bdc3c7',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    marginTop: 8,
  },
  emptySubtextDark: {
    color: '#7f8c8d',
  },
  limitItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#27ae60',
  },
  limitItemDark: {
    backgroundColor: '#34495e',
  },
  limitItemNear: {
    borderLeftColor: '#f39c12',
    backgroundColor: '#fef9e7',
  },
  limitItemFull: {
    borderLeftColor: '#e74c3c',
    backgroundColor: '#fdedec',
  },
  limitItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  numberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  numberTextDark: {
    color: '#ecf0f1',
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  limitItemBody: {
    marginBottom: 8,
  },
  limitText: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 2,
  },
  limitTextDark: {
    color: '#bdc3c7',
  },
  currentText: {
    fontSize: 14,
    color: '#34495e',
  },
  currentTextDark: {
    color: '#bdc3c7',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#ecf0f1',
    borderRadius: 3,
    marginVertical: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#27ae60',
    borderRadius: 3,
  },
  progressFillNear: {
    backgroundColor: '#f39c12',
  },
  progressFillFull: {
    backgroundColor: '#e74c3c',
  },
  limitItemFooter: {
    alignItems: 'flex-end',
  },
  percentageText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  percentageTextDark: {
    color: '#95a5a6',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 8,
  },
});

export default LimitNumberScreen;
