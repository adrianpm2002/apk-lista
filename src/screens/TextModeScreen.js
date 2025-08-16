import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import InputField from '../components/InputField';
import MoneyInputField from '../components/MoneyInputField';
import ActionButton from '../components/ActionButton';
import HammerButton from '../components/HammerButton';
import ListButton from '../components/ListButton';
import PricingInfoButton from '../components/PricingInfoButton';
import NotificationsButton from '../components/NotificationsButton';
import ModeSelector from '../components/ModeSelector';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { t } from '../utils/i18n';
import { usePlaySubmission } from '../hooks/usePlaySubmission';
import { supabase } from '../supabaseClient';

const TextModeScreen = ({ navigation, currentMode, onModeChange, isDarkMode, onToggleDarkMode, onModeVisibilityChange, visibleModes }) => {
  // Estados para los campos
  const [selectedLotteries, setSelectedLotteries] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [plays, setPlays] = useState('');
  const [note, setNote] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState(0);
  const [total, setTotal] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [isLocked, setIsLocked] = useState(false); // Candado oculto en este modo
  const [lotteryError, setLotteryError] = useState(false);
  const [lotteryErrorMessage, setLotteryErrorMessage] = useState('');
  const [scheduleError, setScheduleError] = useState(false);
  const [playsError, setPlaysError] = useState(false);
  const [limitViolations, setLimitViolations] = useState([]); // [{numero, jugada, permitido, usado}]

  // Hook para enviar jugadas al almacenamiento
  const { submitPlayWithConfirmation } = usePlaySubmission();

  // Datos para los dropdowns
  const lotteries = [
    { label: 'Georgia', value: 'georgia' },
    { label: 'Florida', value: 'florida' },
    { label: 'New York', value: 'newyork' },
  ];

  const schedules = [
    { label: 'Mediodía', value: 'mediodia' },
    { label: 'Noche', value: 'noche' },
  ];

  // Calcular monto automáticamente basado en las jugadas
  useEffect(() => {
    if (plays.trim()) {
      // Contar las jugadas separadas por comas
      const playList = plays.split(',').filter(play => play.trim() !== '');
      const baseAmount = playList.length * 1; // $1 por jugada
      setCalculatedAmount(baseAmount);
      
      // Calcular total basado en el estado del candado
      if (isLocked) {
        // Cuando el candado está cerrado: Total = Monto (sin importar cantidad de números)
        setTotal(baseAmount);
      } else {
        // Cuando el candado está abierto: Total = Cantidad de números × Monto
        setTotal(baseAmount * playList.length);
      }
    } else {
      setCalculatedAmount(0);
      setTotal(0);
    }
  }, [plays, isLocked]);

  const handleClear = () => {
    setSelectedLotteries([]);
    setSelectedSchedule(null);
    setPlays('');
    setNote('');
    setCalculatedAmount(0);
    setTotal(0);
  };

  const handleVerify = () => {
    // Validar campos requeridos
    if (!selectedLotteries.length || !selectedSchedule || !plays) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }
    
    const playList = plays.split(',').filter(play => play.trim() !== '');
    alert(`Verificación:\nLotería: ${selectedLotteries.join(', ')}\nHorario: ${selectedSchedule}\nJugadas: ${playList.length}\nMonto: $${calculatedAmount.toFixed(2)}`);
  };

  const handleInsert = async () => {
    // Resetear errores
    setLotteryError(false);
    setScheduleError(false);
    setPlaysError(false);
    setLotteryErrorMessage('');
  setLimitViolations([]);

    // Validar campos requeridos
    let hasErrors = false;

    if (!selectedLotteries.length) {
      setLotteryError(true);
      setLotteryErrorMessage('Selecciona una lotería');
      hasErrors = true;
    }

    if (!selectedSchedule) {
      setScheduleError(true);
      hasErrors = true;
    }

    if (!plays.trim()) {
      setPlaysError(true);
      hasErrors = true;
    }

    // Validación de límites (simplificada para modo texto: cada jugada vale 1 unidad)
    if (!hasErrors) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let specificLimits = null;
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('limite_especifico').eq('id', user.id).maybeSingle();
            specificLimits = profile?.limite_especifico || null;
        }
        const horarios = selectedSchedule ? [selectedSchedule] : [];
        if (horarios.length) {
          const { data: limitRows } = await supabase
            .from('limite_numero')
            .select('numero, limite, jugada, id_horario')
            .in('id_horario', horarios);
          const { data: usedRows } = await supabase
            .from('numero_limitado')
            .select('numero, limite, jugada, id_horario')
            .in('id_horario', horarios);
          const limitMap = new Map();
          (limitRows||[]).forEach(r=>{
            limitMap.set(r.id_horario+"|"+r.jugada+"|"+r.numero, r.limite);
          });
          const usedMap = new Map();
            (usedRows||[]).forEach(r=>{
              const k = r.id_horario+"|"+r.jugada+"|"+r.numero;
              usedMap.set(k, (usedMap.get(k)||0)+(r.limite||0));
            });
          const playList = plays.split(',').map(p=>p.trim()).filter(Boolean);
          const numbers = playList.map(p=>p.replace(/[^0-9]/g,''));
          const violations = [];
          numbers.forEach(numRaw=>{
            const numInt = parseInt(numRaw,10);
            // Jugadas base asumidas: fijo,corrido,posicion,parle,centena,tripleta si hay limites específicos
            const jugadas = specificLimits ? Object.keys(specificLimits) : [];
            jugadas.forEach(j=>{
              horarios.forEach(h=>{
                const key = h+"|"+j+"|"+numInt;
                const byNumber = limitMap.get(key);
                const specific = specificLimits && specificLimits[j];
                let effective;
                if (byNumber !== undefined && specific !== undefined) effective = Math.min(byNumber, specific); else if (byNumber !== undefined) effective = byNumber; else if (specific !== undefined) effective = specific; else return;
                const used = usedMap.get(key) || 0;
                const amt = 1; // cada jugada vale 1 en este modo
                if ((used + amt) > effective) {
                  violations.push({ numero:numRaw, jugada:j, permitido:effective, usado:used });
                }
              });
            });
          });
          if (violations.length) {
            setLimitViolations(violations);
            hasErrors = true;
          }
        }
      } catch(e) { /* silencioso */ }
    }

    if (hasErrors) {
      // Quitar errores después de 3 segundos
      setTimeout(() => {
        setLotteryError(false);
        setScheduleError(false);
        setPlaysError(false);
        setLotteryErrorMessage('');
  setLimitViolations([]);
      }, 3000);
      return;
    }

    // Procesar las jugadas del campo de texto
    const playList = plays.split(',').filter(play => play.trim() !== '');
    
    try {
      // Crear un objeto de jugada para cada lotería seleccionada
      const playsToSave = [];
      
      for (const lottery of selectedLotteries) {
        const playData = {
          lottery: lottery,
          schedule: selectedSchedule,
          numbers: playList,
          note: note.trim(),
          amount: calculatedAmount,
          total: calculatedAmount
        };
        
        playsToSave.push(playData);
      }
      
      // Usar Promise.all para guardar todas las jugadas
      await Promise.all(
        playsToSave.map(playData => 
          submitPlayWithConfirmation(playData)
        )
      );
      
      // Solo limpiar plays, note y montos - mantener lotería y horario
      setPlays('');
      setNote('');
      setCalculatedAmount(0);
      setTotal(0);
      
    } catch (error) {
      console.error('Error al guardar las jugadas:', error);
      alert('Error al guardar las jugadas. Inténtalo de nuevo.');
    }
  };

  const handleTopBarOption = (option) => {
    console.log('Sidebar option selected:', option);
  };

  const toggleSidebar = () => {
    console.log('toggleSidebar called, current state:', sidebarVisible);
    setSidebarVisible(!sidebarVisible);
    console.log('toggleSidebar new state will be:', !sidebarVisible);
  };

  const closeSidebar = () => {
    setSidebarVisible(false);
  };

  const toggleLock = () => { /* Candado no visible aquí */ };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={styles.headerFloating} pointerEvents="box-none">
        <View style={styles.inlineHeaderRow} pointerEvents="box-none">
          <SideBarToggle inline onToggle={toggleSidebar} />
          <View style={styles.modeSelectorWrapper}>
            <ModeSelector 
              currentMode={currentMode}
              onModeChange={onModeChange}
              isDarkMode={isDarkMode}
              visibleModes={visibleModes || { visual: true, text: true }}
            />
          </View>
          <View style={styles.rightButtonsGroup} pointerEvents="box-none">
            <PricingInfoButton />
            <NotificationsButton />
          </View>
        </View>
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Row 1: Lotería */}
        <MultiSelectDropdown
          label={t('common.lottery')}
          selectedValues={selectedLotteries}
          onSelect={setSelectedLotteries}
          options={lotteries}
          placeholder={t('placeholders.selectLotteries')}
          isDarkMode={isDarkMode}
          hasError={lotteryError}
          errorMessage={lotteryErrorMessage}
        />

        {/* Row 2: Horario */}
        <DropdownPicker
          label={t('common.schedule')}
          value={selectedSchedule}
          onSelect={setSelectedSchedule}
          options={schedules}
          placeholder={t('placeholders.selectSchedule')}
          hasError={scheduleError}
        />

        {/* Row 3: Jugadas */}
        <InputField
          label={t('common.numbers')}
          value={plays}
          onChangeText={setPlays}
          placeholder="Ej: 123, 456, 789"
          multiline={true}
          showPasteButton={true}
          pasteButtonOverlay={true}
          hasError={playsError}
        />
        {limitViolations.length > 0 && (
          <View style={{ marginTop:8, backgroundColor:'#fff5f5', borderWidth:1, borderColor:'#ffc9c9', padding:8, borderRadius:6 }}>
            {limitViolations.slice(0,5).map((v,idx)=>(
              <Text key={idx} style={{ color:'#c92a2a', fontSize:12 }}>
                Número {v.numero} ({v.jugada}) excede límite: usado {v.usado} + intento {'>'} permitido {v.permitido}
              </Text>
            ))}
            {limitViolations.length>5 && (
              <Text style={{ color:'#c92a2a', fontSize:12, marginTop:2 }}>+{limitViolations.length-5} más...</Text>
            )}
          </View>
        )}

        {/* Row 4: Nota y Total */}
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <InputField
              label={t('common.note')}
              value={note}
              onChangeText={setNote}
              placeholder=""
              style={styles.fieldContainer}
              inputStyle={styles.unifiedInput}
            />
          </View>
          <View style={styles.halfWidth}>
            <MoneyInputField
              label={t('common.total')}
              value={total.toString()}
              editable={false}
              placeholder="$0"
              style={styles.fieldContainer}
              inputStyle={styles.unifiedInput}
            />
          </View>
        </View>

        {/* Row 4: Botones de herramientas */}
        <View style={styles.toolsContainer}>
          <HammerButton onOptionSelect={(option) => console.log('Hammer option:', option)} />
          <ListButton onOptionSelect={(option) => console.log('List option:', option)} />
        </View>

        {/* Row 5: Botones de acción */}
        <View style={styles.actionRow}>
          <View style={styles.actionButton}>
            <ActionButton
              title={t('actions.clear')}
              onPress={handleClear}
              variant="danger"
              size="small"
            />
          </View>
          <View style={styles.actionButton}>
            <ActionButton
              title={t('actions.verify')}
              onPress={handleVerify}
              variant="warning"
              size="small"
            />
          </View>
          <View style={styles.actionButton}>
            <ActionButton
              title={t('actions.insert')}
              onPress={handleInsert}
              variant="success"
              size="small"
            />
          </View>
        </View>
      </ScrollView>
      
      <SideBar
        isVisible={sidebarVisible}
        onClose={closeSidebar}
        onOptionSelect={handleTopBarOption}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
        role="listero"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8ff',
  },
  containerDark: {
    backgroundColor: '#2c3e50',
  },
  headerFloating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    zIndex: 3000,
  paddingTop: 12,
  paddingBottom: 10,
  paddingHorizontal: 20,
  backgroundColor: 'rgba(255,255,255,0.96)',
  borderBottomWidth: 1,
  borderBottomColor: '#E2E6EA',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 4,
  elevation: 4,
  },
  inlineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingTop: 0,
  },
  rightButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  modeSelectorWrapper: {
    marginLeft: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 120,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  threeColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 6,
  },
  halfWidth: {
    flex: 1,
  },
  thirdWidth: {
    flex: 1,
  },
  toolsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 6,
    gap: 10,
  },
  lockButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#B8D4A8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D5016',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  lockButtonActive: {
    backgroundColor: '#FFE4B5',
    borderColor: '#D4AF37',
  },
  lockIcon: {
    fontSize: 18,
  },
  lockButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 6,
  },
  actionButton: {
    flex: 1,
  },
  fieldContainer: {
    marginBottom: 0, // Anular el marginBottom de los componentes internos
  },
  unifiedInput: {
    height: 40, // Altura más pequeña como tenía nota anteriormente
    minHeight: 40, // Sobrescribir cualquier minHeight interno
    maxHeight: 40, // Asegurar que no crezca más
    paddingHorizontal: 12,
    paddingVertical: 8, // Reducido también el padding vertical
    fontSize: 16,
    borderWidth: 1.5,
    borderRadius: 8,
    borderColor: '#D5DBDB',
    backgroundColor: '#FFFFFF',
    color: '#2C3E50',
  },
});

export default TextModeScreen;
