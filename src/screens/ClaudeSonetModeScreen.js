import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { supabase } from '../supabaseClient';
import DropdownPicker from '../components/DropdownPicker';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import InputField from '../components/InputField';
import MoneyInputField from '../components/MoneyInputField';
import ActionButton from '../components/ActionButton';
import BatteryButton from '../components/BatteryButton';
import HammerButton from '../components/HammerButton';
import ListButton from '../components/ListButton';
import PricingInfoButton from '../components/PricingInfoButton';
import FeedbackBanner from '../components/FeedbackBanner';
import NotificationsButton from '../components/NotificationsButton';
import ModeSelector from '../components/ModeSelector';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { t, translatePlayTypeLabel } from '../utils/i18n';
import { applyPlayTypeSelection } from '../utils/playTypeCombinations';
import { usePlaySubmission } from '../hooks/usePlaySubmission';
import { fetchLimitsContext, checkInstructionsLimits } from '../utils/limitUtils';

const ClaudeSonetModeScreen = ({ navigation, route, currentMode, onModeChange, isDarkMode, onToggleDarkMode, onModeVisibilityChange, visibleModes }) => {
  
  // Estados para los campos
  const [selectedLotteries, setSelectedLotteries] = useState([]); // values de loterías (máx 3)
  const [selectedSchedules, setSelectedSchedules] = useState({}); // { lotteryValue: scheduleValue }
  const [scheduleOptionsMap, setScheduleOptionsMap] = useState({}); // { lotteryValue: [{label,value}] }
  const [selectedPlayTypes, setSelectedPlayTypes] = useState([]); // multi jugadas activas
  const [plays, setPlays] = useState('');
  const [amounts, setAmounts] = useState({ fijo:'', corrido:'', centena:'', posicion:'', parle:'', tripleta:'' });
  const [note, setNote] = useState('');
  const [total, setTotal] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [lotteryError, setLotteryError] = useState(false);
  const [lotteryErrorMessage, setLotteryErrorMessage] = useState('');
  const [scheduleError, setScheduleError] = useState(false); // true si falta algún horario
  const [playTypeError, setPlayTypeError] = useState(false);
  const [playsError, setPlaysError] = useState(false);
  const [amountError, setAmountError] = useState(false); // se usará si cualquier monto requerido falta
  const [showFieldErrors, setShowFieldErrors] = useState(false); // sólo mostrar bordes rojos tras intento
  const [limitViolations, setLimitViolations] = useState([]); // [{numero, jugada, permitido, usado}]
  const [duplicateConflicts, setDuplicateConflicts] = useState([]); // [{numero, jugada, jugada_conflicto}]
  const [verifyFeedback, setVerifyFeedback] = useState(null);
  const [insertFeedback, setInsertFeedback] = useState(null);
  
  // Estados de loterías y opciones
  const [lotteries, setLotteries] = useState([]);
  const [activePlayTypes, setActivePlayTypes] = useState({}); // jugadas activas desde BD
  const [limitData, setLimitData] = useState({});
  const [priceData, setPriceData] = useState({});

  // Animación del header
  const headerOpacity = useRef(new Animated.Value(1)).current;

  // Hook para envío de jugadas
  const playSubmission = usePlaySubmission({
    onSuccess: (response) => {
      setInsertFeedback({ type: 'success', message: response.message || 'Claude Sonet 4: Jugada enviada exitosamente' });
      // Limpiar formulario después del éxito
      setPlays('');
      setAmounts({ fijo:'', corrido:'', centena:'', posicion:'', parle:'', tripleta:'' });
      setNote('');
      setTotal(0);
      setLimitViolations([]);
      setDuplicateConflicts([]);
      setShowFieldErrors(false);
    },
    onError: (error) => {
      setInsertFeedback({ type: 'error', message: error });
    }
  });

  // Cargar datos iniciales
  useEffect(() => {
    loadLotteries();
    loadActivePlayTypes();
    loadLimitAndPriceData();
  }, []);

  const loadLotteries = async () => {
    try {
      const { data, error } = await supabase
        .from('lotteries')
        .select('id, nombre, horarios')
        .eq('activa', true)
        .order('nombre');

      if (error) throw error;

      const lotteryOptions = data.map(lottery => ({
        label: lottery.nombre,
        value: lottery.id.toString()
      }));

      const scheduleMap = {};
      data.forEach(lottery => {
        if (lottery.horarios && Array.isArray(lottery.horarios)) {
          scheduleMap[lottery.id.toString()] = lottery.horarios.map(schedule => ({
            label: schedule.nombre || schedule,
            value: schedule.id?.toString() || schedule
          }));
        }
      });

      setLotteries(lotteryOptions);
      setScheduleOptionsMap(scheduleMap);
    } catch (error) {
      console.error('Error loading lotteries:', error);
    }
  };

  const loadActivePlayTypes = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, id_banco')
        .eq('id', user.id)
        .single();

      const bankId = profile?.role === 'admin' ? user.id : profile?.id_banco;
      
      const { data } = await supabase
        .from('jugadas_activas')
        .select('jugadas')
        .eq('id_banco', bankId)
        .maybeSingle();

      setActivePlayTypes(data?.jugadas || {});
    } catch (error) {
      console.error('Error loading active play types:', error);
    }
  };

  const loadLimitAndPriceData = async () => {
    try {
      const limits = await fetchLimitsContext();
      setLimitData(limits);
      
      // Cargar datos de precios aquí si es necesario
      setPriceData({});
    } catch (error) {
      console.error('Error loading limit data:', error);
    }
  };

  // Manejar cambio de loterías
  const handleLotteryChange = (selectedValues) => {
    // Limitar a 3 loterías como en modo visual
    const newValues = selectedValues.length > 3 ? selectedValues.slice(0, 3) : selectedValues;
    setSelectedLotteries(newValues);
    
    // Limpiar horarios de loterías no seleccionadas
    const newSchedules = {};
    newValues.forEach(lotteryId => {
      if (selectedSchedules[lotteryId]) {
        newSchedules[lotteryId] = selectedSchedules[lotteryId];
      }
    });
    setSelectedSchedules(newSchedules);
    
    // Limpiar errores
    setLotteryError(false);
    setLotteryErrorMessage('');
  };

  // Manejar verificación de jugadas
  const handleVerify = async () => {
    setShowFieldErrors(true);
    
    // Validaciones básicas
    if (selectedLotteries.length === 0) {
      setLotteryError(true);
      setLotteryErrorMessage('Debe seleccionar al menos una lotería');
      return;
    }

    if (selectedPlayTypes.length === 0) {
      setPlayTypeError(true);
      return;
    }

    if (!plays.trim()) {
      setPlaysError(true);
      return;
    }

    // Verificar límites usando Claude Sonet 4 IA
    try {
      const instructions = applyPlayTypeSelection(
        plays,
        selectedPlayTypes,
        amounts,
        { selectedLotteries, selectedSchedules }
      );

      const violationsCheck = await checkInstructionsLimits(instructions, limitData);
      setLimitViolations(violationsCheck.violations);
      setDuplicateConflicts(violationsCheck.duplicates);

      if (violationsCheck.violations.length === 0 && violationsCheck.duplicates.length === 0) {
        setVerifyFeedback({ type: 'success', message: 'Claude Sonet 4: Verificación exitosa. Todo en orden.' });
      } else {
        setVerifyFeedback({ type: 'warning', message: 'Claude Sonet 4: Se encontraron advertencias. Revise los detalles.' });
      }
    } catch (error) {
      setVerifyFeedback({ type: 'error', message: 'Claude Sonet 4: Error en la verificación: ' + error.message });
    }
  };

  // Manejar envío de jugadas
  const handleSubmit = async () => {
    if (limitViolations.length > 0 || duplicateConflicts.length > 0) {
      setInsertFeedback({ type: 'error', message: 'Claude Sonet 4: No se puede enviar con violaciones pendientes' });
      return;
    }

    const instructions = applyPlayTypeSelection(
      plays,
      selectedPlayTypes,
      amounts,
      { selectedLotteries, selectedSchedules, note }
    );

    await playSubmission.submitPlay(instructions);
  };

  // Calcular total
  useEffect(() => {
    const calculateTotal = () => {
      const values = Object.values(amounts)
        .map(val => parseFloat(val.replace(/[^0-9.]/g, '')) || 0);
      return values.reduce((sum, val) => sum + val, 0);
    };
    
    setTotal(calculateTotal());
  }, [amounts]);

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Header con información de modo */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <View style={styles.headerContent}>
          <SideBarToggle 
            onPress={() => setSidebarVisible(true)} 
            isDarkMode={isDarkMode}
          />
          <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
            Claude Sonet 4
          </Text>
          <View style={styles.headerIcons}>
            <BatteryButton isDarkMode={isDarkMode} />
            <NotificationsButton isDarkMode={isDarkMode} />
          </View>
        </View>
        
        <ModeSelector
          currentMode={currentMode}
          onModeChange={onModeChange}
          isDarkMode={isDarkMode}
          visibleModes={visibleModes}
        />
      </Animated.View>

      {/* Contenido principal */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Banner informativo de Claude Sonet 4 */}
        <View style={[styles.claudeBanner, isDarkMode && styles.claudeBannerDark]}>
          <Text style={[styles.claudeBannerText, isDarkMode && styles.claudeBannerTextDark]}>
            🤖 Modo Claude Sonet 4 - IA Avanzada para Análisis de Jugadas
          </Text>
        </View>

        {/* Feedback banners */}
        {verifyFeedback && (
          <FeedbackBanner
            type={verifyFeedback.type}
            message={verifyFeedback.message}
            onDismiss={() => setVerifyFeedback(null)}
            isDarkMode={isDarkMode}
          />
        )}
        
        {insertFeedback && (
          <FeedbackBanner
            type={insertFeedback.type}
            message={insertFeedback.message}
            onDismiss={() => setInsertFeedback(null)}
            isDarkMode={isDarkMode}
          />
        )}

        {/* Formulario */}
        <View style={styles.form}>
          
          {/* Loterías */}
          <MultiSelectDropdown
            label={t('common.lottery')}
            selectedValues={selectedLotteries}
            onSelect={handleLotteryChange}
            options={lotteries}
            placeholder="Seleccionar loterías (máx 3)"
            isDarkMode={isDarkMode}
            hasError={lotteryError || (showFieldErrors && selectedLotteries.length === 0)}
            errorMessage={lotteryErrorMessage}
          />

          {/* Horarios */}
          {selectedLotteries.map(lotteryId => (
            <DropdownPicker
              key={lotteryId}
              label={`Horario ${lotteries.find(l => l.value === lotteryId)?.label || ''}`}
              selectedValue={selectedSchedules[lotteryId] || ''}
              onSelect={(value) => setSelectedSchedules(prev => ({ ...prev, [lotteryId]: value }))}
              options={scheduleOptionsMap[lotteryId] || []}
              placeholder="Seleccionar horario"
              isDarkMode={isDarkMode}
              hasError={showFieldErrors && !selectedSchedules[lotteryId]}
            />
          ))}

          {/* Tipos de jugada */}
          <MultiSelectDropdown
            label="Tipos de Jugada"
            selectedValues={selectedPlayTypes}
            onSelect={setSelectedPlayTypes}
            options={Object.keys(activePlayTypes)
              .filter(key => activePlayTypes[key])
              .map(key => ({
                label: translatePlayTypeLabel(key),
                value: key
              }))}
            placeholder="Seleccionar tipos de jugada"
            isDarkMode={isDarkMode}
            hasError={playTypeError || (showFieldErrors && selectedPlayTypes.length === 0)}
          />

          {/* Números/Jugadas */}
          <InputField
            label="Números"
            value={plays}
            onChangeText={setPlays}
            placeholder="Ej: 123, 456, 789"
            isDarkMode={isDarkMode}
            hasError={playsError || (showFieldErrors && !plays.trim())}
            multiline={true}
          />

          {/* Montos por tipo de jugada */}
          {selectedPlayTypes.map(playType => (
            <MoneyInputField
              key={playType}
              label={`Monto ${translatePlayTypeLabel(playType)}`}
              value={amounts[playType] || ''}
              onChangeText={(value) => setAmounts(prev => ({ ...prev, [playType]: value }))}
              placeholder="$0.00"
              isDarkMode={isDarkMode}
              hasError={amountError || (showFieldErrors && !amounts[playType])}
            />
          ))}

          {/* Nota */}
          <InputField
            label="Nota (Opcional)"
            value={note}
            onChangeText={setNote}
            placeholder="Agregar nota..."
            isDarkMode={isDarkMode}
            multiline={true}
          />

          {/* Total */}
          <View style={[styles.totalContainer, isDarkMode && styles.totalContainerDark]}>
            <Text style={[styles.totalLabel, isDarkMode && styles.totalLabelDark]}>Total:</Text>
            <Text style={[styles.totalValue, isDarkMode && styles.totalValueDark]}>
              ${total.toFixed(2)}
            </Text>
          </View>

        </View>

        {/* Violaciones y conflictos */}
        {limitViolations.length > 0 && (
          <View style={styles.violationsContainer}>
            <Text style={styles.violationsTitle}>Límites Excedidos:</Text>
            {limitViolations.map((violation, index) => (
              <Text key={index} style={styles.violationText}>
                • {violation.numero} ({violation.jugada}): {violation.usado}/{violation.permitido}
              </Text>
            ))}
          </View>
        )}

        {duplicateConflicts.length > 0 && (
          <View style={styles.conflictsContainer}>
            <Text style={styles.conflictsTitle}>Conflictos Detectados:</Text>
            {duplicateConflicts.map((conflict, index) => (
              <Text key={index} style={styles.conflictText}>
                • {conflict.numero}: {conflict.jugada} vs {conflict.jugada_conflicto}
              </Text>
            ))}
          </View>
        )}

      </ScrollView>

      {/* Footer con botones de acción */}
      <View style={[styles.footer, isDarkMode && styles.footerDark]}>
        <View style={styles.actionButtons}>
          <ActionButton
            title="Verificar"
            onPress={handleVerify}
            style={styles.verifyButton}
            isDarkMode={isDarkMode}
          />
          <ActionButton
            title="Enviar"
            onPress={handleSubmit}
            style={styles.submitButton}
            isDarkMode={isDarkMode}
            disabled={limitViolations.length > 0 || duplicateConflicts.length > 0}
          />
        </View>
        
        <View style={styles.utilityButtons}>
          <HammerButton isDarkMode={isDarkMode} />
          <ListButton isDarkMode={isDarkMode} navigation={navigation} />
          <PricingInfoButton isDarkMode={isDarkMode} />
        </View>
      </View>

      {/* Sidebar */}
      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        onOptionSelect={(option) => {
          // Manejar selección de opciones del sidebar
          setSidebarVisible(false);
        }}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
        role="listero" // Ajustar según el rol del usuario
        visibleModes={visibleModes}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
    textAlign: 'center',
  },
  headerTitleDark: {
    color: '#ffffff',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  claudeBanner: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  claudeBannerDark: {
    backgroundColor: '#1e3a8a',
    borderLeftColor: '#60a5fa',
  },
  claudeBannerText: {
    color: '#1565c0',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  claudeBannerTextDark: {
    color: '#93c5fd',
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 16,
    gap: 16,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  totalContainerDark: {
    backgroundColor: '#2d3748',
    borderColor: '#4a5568',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#495057',
  },
  totalLabelDark: {
    color: '#e2e8f0',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#28a745',
  },
  totalValueDark: {
    color: '#68d391',
  },
  violationsContainer: {
    margin: 16,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  violationsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  violationText: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 4,
  },
  conflictsContainer: {
    margin: 16,
    padding: 12,
    backgroundColor: '#f8d7da',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  conflictsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 8,
  },
  conflictText: {
    fontSize: 12,
    color: '#721c24',
    marginBottom: 4,
  },
  footer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  footerDark: {
    backgroundColor: '#2d3748',
    borderTopColor: '#4a5568',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  verifyButton: {
    flex: 1,
    backgroundColor: '#17a2b8',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#28a745',
  },
  utilityButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
});

export default ClaudeSonetModeScreen;