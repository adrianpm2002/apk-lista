import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  Modal, 
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
        .from('Precio')
        .select('jugada, "activo?"')
        .eq('id_banco', currentBankId)
        .eq('"activo?"', true);

      if (error) throw error;
      
      // Mapear a formato compatible
      const activeTypes = data.map(item => ({
        label: getPlayTypeLabel(item.jugada),
        value: item.jugada
      }));
      
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
    if (!currentBankId) return; // No cargar loterias si no tenemos el banco ID
    
    try {
      const { data, error } = await supabase
        .from('loteria')
        .select('id, nombre')
        .eq('id_banco', currentBankId) // Solo loterias del mismo banco
        .order('nombre');

      if (error) throw error;
      
      const options = data.map(l => ({ label: l.nombre, value: l.id }));
      setLotteries(options);
    } catch (error) {
      console.error('Error cargando loterías:', error);
      Alert.alert('Error', 'No se pudieron cargar las loterías');
    }
  };

  // Cargar horarios
  const fetchSchedules = async (lotteryId) => {
    try {
      if (!lotteryId) {
        setSchedules([]);
        return;
      }

      const { data, error } = await supabase
        .from('horario')
        .select('id, nombre, hora_inicio, hora_fin')
        .eq('id_loteria', lotteryId)
        .order('hora_inicio');

      if (error) throw error;

      const options = data.map(h => ({
        label: `${h.nombre} (${h.hora_inicio.slice(0,5)} - ${h.hora_fin.slice(0,5)})`,
        value: h.id
      }));
      setSchedules(options);
    } catch (error) {
      console.error('Error cargando horarios:', error);
      Alert.alert('Error', 'No se pudieron cargar los horarios');
    }
  };

  // Verificar rol de usuario
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
          // Si es admin (banco), su propio ID es el banco ID, si es colector usa id_banco
          setCurrentBankId(data.role === 'admin' ? user.id : data.id_banco);
        }
      }
    } catch (error) {
      console.error('Error cargando rol:', error);
    }
  };

  // Manejar selección de lotería
  const handleLotteryChange = (option) => {
    setSelectedLottery(option);
    setSelectedSchedule(null);
    setSelectedPlayType(null);
    fetchSchedules(option.value);
  };

  // Manejar selección de horario
  const handleScheduleChange = (option) => {
    setSelectedSchedule(option);
    setSelectedPlayType(null);
  };

  // Manejar selección de tipo de jugada
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
        
        <Text style={[styles.percentageText, isDarkMode && styles.percentageTextDark]}>
          {percentage.toFixed(1)}% utilizado
        </Text>
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
        <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>Limitar Números</Text>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#27AE60']}
            tintColor={'#27AE60'}
          />
        }
      >
        {/* Selectores principales */}
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
        visible={specificLimitModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSpecificLimitModalVisible(false);
          setSpecificNumber('');
          setSpecificLimitAmount('');
          setNumberError('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, isDarkMode && styles.modalContainerDark]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
              Configurar Límite Específico
            </Text>
            
            <Text style={[styles.modalDescription, isDarkMode && styles.modalDescriptionDark]}>
              {selectedPlayType && `${getDigitValidation(selectedPlayType.value).message.replace('debe tener exactamente', 'requiere')}`}
            </Text>

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

            <MoneyInputField
              label="Límite Específico ($)"
              value={specificLimitAmount}
              onChangeText={setSpecificLimitAmount}
              placeholder="0.00"
              isDarkMode={isDarkMode}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setSpecificLimitModalVisible(false);
                  setSpecificNumber('');
                  setSpecificLimitAmount('');
                  setNumberError('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveSpecificLimit}
              >
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Resumen */}
      <Modal
        visible={summaryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSummaryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView 
            style={styles.summaryModalScroll}
            contentContainerStyle={styles.summaryModalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.summaryModalContainer, isDarkMode && styles.modalContainerDark]}>
              <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
                📊 Resumen de Límites
              </Text>
              
              <Text style={[styles.modalDescription, isDarkMode && styles.modalDescriptionDark]}>
                {selectedLottery?.label} - {selectedSchedule?.label} - {selectedPlayType?.label}
              </Text>

              {summaryData && (
                <>
                  {/* Estadísticas Generales */}
                  <View style={styles.summarySection}>
                    <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                      📈 Estadísticas Generales
                    </Text>
                    
                    <View style={styles.statsGrid}>
                      <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
                        <Text style={[styles.statNumber, isDarkMode && styles.statNumberDark]}>
                          {summaryData.stats.totalLimits}
                        </Text>
                        <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                          Límites Configurados
                        </Text>
                      </View>

                      <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
                        <Text style={[styles.statNumber, styles.statWarning]}>
                          {summaryData.stats.limitsNearFull}
                        </Text>
                        <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                          Cerca del Límite (≥80%)
                        </Text>
                      </View>

                      <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
                        <Text style={[styles.statNumber, styles.statDanger]}>
                          {summaryData.stats.limitsAtFull}
                        </Text>
                        <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                          En el Límite (100%)
                        </Text>
                      </View>

                      <View style={[styles.statCard, isDarkMode && styles.statCardDark]}>
                        <Text style={[styles.statNumber, isDarkMode && styles.statNumberDark]}>
                          {summaryData.stats.averageUsage.toFixed(1)}%
                        </Text>
                        <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                          Uso Promedio
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Límite Global */}
                  {summaryData.globalLimit > 0 && (
                    <View style={styles.summarySection}>
                      <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                        🌐 Límite Global
                      </Text>
                      <View style={[styles.globalLimitCard, isDarkMode && styles.globalLimitCardDark]}>
                        <Text style={[styles.globalLimitText, isDarkMode && styles.globalLimitTextDark]}>
                          ${parseFloat(summaryData.globalLimit).toFixed(2)}
                        </Text>
                        <Text style={[styles.globalLimitLabel, isDarkMode && styles.globalLimitLabelDark]}>
                          Para números sin límite específico
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Top 5 Números con Más Dinero */}
                  {summaryData.topNumbers.length > 0 && (
                    <View style={styles.summarySection}>
                      <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                        💰 Top 5 - Números con Más Dinero
                      </Text>
                      {summaryData.topNumbers.map((item, index) => (
                        <View key={item.number} style={[styles.topNumberItem, isDarkMode && styles.topNumberItemDark]}>
                          <View style={styles.topNumberRank}>
                            <Text style={styles.topNumberRankText}>#{index + 1}</Text>
                          </View>
                          <View style={styles.topNumberInfo}>
                            <Text style={[styles.topNumberNumber, isDarkMode && styles.topNumberNumberDark]}>
                              #{item.number}
                            </Text>
                            <Text style={[styles.topNumberAmount, isDarkMode && styles.topNumberAmountDark]}>
                              ${parseFloat(item.current_amount).toFixed(2)} / ${parseFloat(item.limit_amount).toFixed(2)}
                            </Text>
                          </View>
                          <View style={styles.topNumberPercentage}>
                            <Text style={[styles.percentageText, isDarkMode && styles.percentageTextDark]}>
                              {((item.current_amount / item.limit_amount) * 100).toFixed(1)}%
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Top 5 Números con Mayor Porcentaje */}
                  {summaryData.highestPercentageNumbers.length > 0 && (
                    <View style={styles.summarySection}>
                      <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                        🔥 Top 5 - Mayor Porcentaje de Uso
                      </Text>
                      {summaryData.highestPercentageNumbers.map((item, index) => (
                        <View key={`${item.number}-pct`} style={[styles.topNumberItem, isDarkMode && styles.topNumberItemDark]}>
                          <View style={styles.topNumberRank}>
                            <Text style={styles.topNumberRankText}>#{index + 1}</Text>
                          </View>
                          <View style={styles.topNumberInfo}>
                            <Text style={[styles.topNumberNumber, isDarkMode && styles.topNumberNumberDark]}>
                              #{item.number}
                            </Text>
                            <Text style={[styles.topNumberAmount, isDarkMode && styles.topNumberAmountDark]}>
                              ${parseFloat(item.current_amount).toFixed(2)} / ${parseFloat(item.limit_amount).toFixed(2)}
                            </Text>
                          </View>
                          <View style={[
                            styles.topNumberPercentage,
                            item.percentage >= 100 && styles.percentageFull,
                            item.percentage >= 80 && item.percentage < 100 && styles.percentageNear
                          ]}>
                            <Text style={[
                              styles.percentageText, 
                              isDarkMode && styles.percentageTextDark,
                              item.percentage >= 80 && styles.percentageTextBold
                            ]}>
                              {item.percentage.toFixed(1)}%
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Totales */}
                  <View style={styles.summarySection}>
                    <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                      📋 Totales
                    </Text>
                    <View style={[styles.totalsCard, isDarkMode && styles.totalsCardDark]}>
                      <View style={styles.totalRow}>
                        <Text style={[styles.totalLabel, isDarkMode && styles.totalLabelDark]}>
                          Total Apostado:
                        </Text>
                        <Text style={[styles.totalValue, isDarkMode && styles.totalValueDark]}>
                          ${summaryData.stats.totalCurrentAmount.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={[styles.totalLabel, isDarkMode && styles.totalLabelDark]}>
                          Límite Total:
                        </Text>
                        <Text style={[styles.totalValue, isDarkMode && styles.totalValueDark]}>
                          ${summaryData.stats.totalLimitAmount.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={[styles.totalLabel, isDarkMode && styles.totalLabelDark]}>
                          Disponible:
                        </Text>
                        <Text style={[styles.totalValue, styles.totalValueSuccess]}>
                          ${(summaryData.stats.totalLimitAmount - summaryData.stats.totalCurrentAmount).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={() => {
                    setSummaryModalVisible(false);
                    setSummaryData(null);
                  }}
                >
                  <Text style={styles.saveButtonText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Sidebar */}
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  globalLimitButton: {
    backgroundColor: '#3498db',
  },
  specificLimitButton: {
    backgroundColor: '#e74c3c',
  },
  summaryButton: {
    backgroundColor: '#f39c12',
  },
  resetButton: {
    backgroundColor: '#95a5a6',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
  },
  sectionTitleDark: {
    color: '#ecf0f1',
  },
  limitsContainer: {
    marginTop: 8,
  },
  limitItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  limitItemDark: {
    backgroundColor: '#34495e',
    borderColor: '#2c3e50',
  },
  limitItemNear: {
    borderColor: '#f39c12',
    borderWidth: 2,
  },
  limitItemFull: {
    borderColor: '#e74c3c',
    borderWidth: 2,
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
    marginBottom: 12,
  },
  limitText: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 4,
  },
  limitTextDark: {
    color: '#bdc3c7',
  },
  currentText: {
    fontSize: 14,
    color: '#27ae60',
    fontWeight: '500',
  },
  currentTextDark: {
    color: '#27ae60',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#ecf0f1',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#27ae60',
    borderRadius: 4,
  },
  progressFillNear: {
    backgroundColor: '#f39c12',
  },
  progressFillFull: {
    backgroundColor: '#e74c3c',
  },
  percentageText: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  percentageTextDark: {
    color: '#95a5a6',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#7f8c8d',
    marginVertical: 20,
  },
  loadingTextDark: {
    color: '#95a5a6',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#7f8c8d',
    fontStyle: 'italic',
    marginVertical: 20,
  },
  emptyTextDark: {
    color: '#95a5a6',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    width: '90%',
  },
  modalContainerDark: {
    backgroundColor: '#2c3e50',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalTitleDark: {
    color: '#ecf0f1',
  },
  modalDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalDescriptionDark: {
    color: '#95a5a6',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  saveButton: {
    backgroundColor: '#27ae60',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // Estilos para modal de resumen
  summaryModalScroll: {
    flex: 1,
  },
  summaryModalContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  summaryModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    maxWidth: 500,
    width: '100%',
    maxHeight: '90%',
  },
  summarySection: {
    marginBottom: 24,
    width: '100%',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    minWidth: '45%',
    flex: 1,
  },
  statCardDark: {
    backgroundColor: '#34495e',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  statNumberDark: {
    color: '#ecf0f1',
  },
  statWarning: {
    color: '#f39c12',
  },
  statDanger: {
    color: '#e74c3c',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  statLabelDark: {
    color: '#bdc3c7',
  },
  globalLimitCard: {
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#27ae60',
  },
  globalLimitCardDark: {
    backgroundColor: '#2c3e50',
    borderColor: '#27ae60',
  },
  globalLimitText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 4,
  },
  globalLimitTextDark: {
    color: '#27ae60',
  },
  globalLimitLabel: {
    fontSize: 14,
    color: '#27ae60',
    textAlign: 'center',
  },
  globalLimitLabelDark: {
    color: '#27ae60',
  },
  topNumberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  topNumberItemDark: {
    backgroundColor: '#34495e',
  },
  topNumberRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  topNumberRankText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  topNumberInfo: {
    flex: 1,
  },
  topNumberNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  topNumberNumberDark: {
    color: '#ecf0f1',
  },
  topNumberAmount: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  topNumberAmountDark: {
    color: '#bdc3c7',
  },
  topNumberPercentage: {
    backgroundColor: '#27ae60',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  percentageNear: {
    backgroundColor: '#f39c12',
  },
  percentageFull: {
    backgroundColor: '#e74c3c',
  },
  percentageTextBold: {
    fontWeight: 'bold',
  },
  totalsCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  totalsCardDark: {
    backgroundColor: '#34495e',
    borderColor: '#2c3e50',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  totalLabelDark: {
    color: '#ecf0f1',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  totalValueDark: {
    color: '#ecf0f1',
  },
  totalValueSuccess: {
    color: '#27ae60',
  },
  inputContainer: {
    marginBottom: 16,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 8,
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
  addButton: {
    backgroundColor: '#27ae60',
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
  emptySubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    marginTop: 8,
  },
  emptySubtextDark: {
    color: '#7f8c8d',
  },
});

export default LimitNumberScreen;