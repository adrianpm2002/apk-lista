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
import { SideBar, SideBarToggle } from '../components/SideBar';
import { usePlaySubmission } from '../hooks/usePlaySubmission';

const TextModeScreen = ({ navigation, currentMode, onModeChange, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
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

    if (hasErrors) {
      // Quitar errores después de 3 segundos
      setTimeout(() => {
        setLotteryError(false);
        setScheduleError(false);
        setPlaysError(false);
        setLotteryErrorMessage('');
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
      <View style={styles.toggleContainer}>
        <SideBarToggle onToggle={toggleSidebar} />
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Row 1: Lotería */}
        <MultiSelectDropdown
          label="Lotería"
          selectedValues={selectedLotteries}
          onSelect={setSelectedLotteries}
          options={lotteries}
          placeholder="Seleccionar loterias"
          isDarkMode={isDarkMode}
          hasError={lotteryError}
          errorMessage={lotteryErrorMessage}
        />

        {/* Row 2: Horario */}
        <DropdownPicker
          label="Horario"
          value={selectedSchedule}
          onSelect={setSelectedSchedule}
          options={schedules}
          placeholder="Seleccionar horario"
          hasError={scheduleError}
        />

        {/* Row 3: Jugadas */}
        <InputField
          label="Números"
          value={plays}
          onChangeText={setPlays}
          placeholder="Ej: 123, 456, 789"
          multiline={true}
          showPasteButton={true}
          pasteButtonOverlay={true}
          hasError={playsError}
        />

        {/* Row 4: Nota y Total */}
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <InputField
              label="Nota"
              value={note}
              onChangeText={setNote}
              placeholder=""
              style={styles.fieldContainer}
              inputStyle={styles.unifiedInput}
            />
          </View>
          <View style={styles.halfWidth}>
            <MoneyInputField
              label="Total"
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
          <PricingInfoButton />
          <NotificationsButton />
        </View>

        {/* Row 5: Botones de acción */}
        <View style={styles.actionRow}>
          <View style={styles.actionButton}>
            <ActionButton
              title="Borrar"
              onPress={handleClear}
              variant="danger"
              size="small"
            />
          </View>
          <View style={styles.actionButton}>
            <ActionButton
              title="Verificar"
              onPress={handleVerify}
              variant="warning"
              size="small"
            />
          </View>
          <View style={styles.actionButton}>
            <ActionButton
              title="Insertar"
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
  toggleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
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
