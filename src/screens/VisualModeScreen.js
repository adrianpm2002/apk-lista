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
import PlaysInputField from '../components/PlaysInputField';
import ActionButton from '../components/ActionButton';
import BatteryButton from '../components/BatteryButton';
import HammerButton from '../components/HammerButton';
import ListButton from '../components/ListButton';
import { SideBar, SideBarToggle } from '../components/SideBar';

const VisualModeScreen = ({ navigation, currentMode, onModeChange, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  // Estados para los campos
  const [selectedLotteries, setSelectedLotteries] = useState([]); // Cambiado a array para múltiple selección
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedPlayType, setSelectedPlayType] = useState(null);
  const [plays, setPlays] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [total, setTotal] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [lotteryError, setLotteryError] = useState(false);
  const [lotteryErrorMessage, setLotteryErrorMessage] = useState('');
  const [scheduleError, setScheduleError] = useState(false);
  const [playTypeError, setPlayTypeError] = useState(false);
  const [playsError, setPlaysError] = useState(false);
  const [amountError, setAmountError] = useState(false);

  // Calcular total automáticamente basado en cantidad de números y monto
  useEffect(() => {
    if (plays.trim() && amount) {
      const amountNum = parseInt(amount.toString().replace(/[^0-9]/g, '')) || 0;
      
      if (isLocked) {
        // Cuando el candado está cerrado: Total = Monto (sin importar cantidad de números)
        setTotal(amountNum);
      } else {
        // Cuando el candado está abierto: Total = Cantidad de números × Monto
        const allNumbers = plays.match(/\d+/g) || [];
        const totalNumbers = allNumbers.length;
        const calculatedTotal = totalNumbers * amountNum;
        setTotal(calculatedTotal);
      }
    } else {
      setTotal(0);
    }
  }, [plays, amount, isLocked]); // Agregado isLocked a las dependencias

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

  const playTypes = [
    { label: 'Fijo', value: 'fijo' },
    { label: 'Corrido', value: 'corrido' },
    { label: 'Posición', value: 'posicion' },
    { label: 'Parlé', value: 'parle' },
    { label: 'Centena', value: 'centena' },
    { label: 'Tripleta', value: 'tripleta' },
  ];

  const handleInsert = () => {
    // Resetear errores
    setLotteryError(false);
    setScheduleError(false);
    setPlayTypeError(false);
    setPlaysError(false);
    setAmountError(false);
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

    if (!selectedPlayType) {
      setPlayTypeError(true);
      hasErrors = true;
    }

    if (!plays.trim()) {
      setPlaysError(true);
      hasErrors = true;
    }

    if (!amount || amount === '0') {
      setAmountError(true);
      hasErrors = true;
    }

    if (hasErrors) {
      // Quitar errores después de 3 segundos
      setTimeout(() => {
        setLotteryError(false);
        setScheduleError(false);
        setPlayTypeError(false);
        setPlaysError(false);
        setAmountError(false);
        setLotteryErrorMessage('');
      }, 3000);
      return;
    }
    
    console.log('Insertar jugada:', {
      lotteries: selectedLotteries,
      schedule: selectedSchedule,
      playType: selectedPlayType,
      plays,
      amount,
      note,
    });
    
    // Aquí irá la lógica para guardar en la base de datos
    alert('Jugada insertada correctamente');
    
    // Solo limpiar plays, amount, note y total - mantener lotería, horario y jugada
    setPlays('');
    setAmount('');
    setNote('');
    setTotal(0);
  };

  const handleClear = () => {
    setSelectedLotteries([]);
    setSelectedSchedule(null);
    setSelectedPlayType(null);
    setPlays('');
    setAmount('');
    setNote('');
    setTotal(0);
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

  const toggleLock = () => {
    setIsLocked(!isLocked);
  };

  const handleLotteryError = (hasError, message = '') => {
    setLotteryError(hasError);
    setLotteryErrorMessage(message);
    if (hasError) {
      // Quitar el error después de 3 segundos
      setTimeout(() => {
        setLotteryError(false);
        setLotteryErrorMessage('');
      }, 3000);
    }
  };

  // Función para manejar opciones del HammerButton
  const handleHammerOption = (option) => {
    if (option.action === 'insert' && option.numbers) {
      // Agregar números al campo de jugadas
      const newPlays = plays ? `${plays}, ${option.numbers}` : option.numbers;
      setPlays(newPlays);
    }
  };

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

        {/* Row 2: Horario y Jugada */}
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <DropdownPicker
              label="Horario"
              value={selectedSchedule}
              onSelect={setSelectedSchedule}
              options={schedules}
              placeholder="Seleccionar horario"
              hasError={scheduleError}
            />
          </View>
          <View style={styles.halfWidth}>
            <DropdownPicker
              label="Jugada"
              value={selectedPlayType}
              onSelect={setSelectedPlayType}
              options={playTypes}
              placeholder="Seleccionar jugada"
              hasError={playTypeError}
            />
          </View>
        </View>

        {/* Row 3: Jugadas */}
        <PlaysInputField
          label="Jugadas"
          value={plays}
          onChangeText={setPlays}
          placeholder="Ej: 12, 34, 56"
          playType={selectedPlayType}
          multiline={true}
          isDarkMode={isDarkMode}
          showPasteButton={true}
          pasteButtonOverlay={true}
          hasError={playsError}
        />

        {/* Row 4: Nota, Monto y Total */}
        <View style={styles.threeColumnRow}>
          <View style={styles.thirdWidth}>
            <InputField
              label="Nota"
              value={note}
              onChangeText={setNote}
              placeholder=""
              style={styles.fieldContainer}
              inputStyle={styles.unifiedInput}
            />
          </View>
          <View style={styles.thirdWidth}>
            <MoneyInputField
              label="Monto"
              value={amount}
              onChangeText={setAmount}
              placeholder="$0"
              style={styles.fieldContainer}
              inputStyle={styles.unifiedInput}
              hasError={amountError}
            />
          </View>
          <View style={styles.thirdWidth}>
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

        {/* Row 5: Botones de herramientas */}
        <View style={styles.toolsContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.lockButton, 
              isLocked && styles.lockButtonActive,
              pressed && styles.lockButtonPressed
            ]}
            onPress={toggleLock}
          >
            <Text style={styles.lockIcon}>{isLocked ? '🔒' : '🔓'}</Text>
          </Pressable>
          
          <BatteryButton 
            onOptionSelect={(option) => console.log('Battery option:', option)}
            selectedLotteries={selectedLotteries}
            lotteryOptions={lotteries}
            onLotteryError={handleLotteryError}
          />
          
          <HammerButton 
            onOptionSelect={handleHammerOption}
            isDarkMode={isDarkMode}
          />
          
          <ListButton 
            onOptionSelect={(option) => console.log('List option:', option)}
            isDarkMode={isDarkMode}
          />
        </View>

        {/* Row 6: Botones de acción */}
        <View style={styles.actionRow}>
          <View style={styles.actionButton}>
            <ActionButton
              title="Borrar"
              onPress={handleClear}
              variant="danger"
              size="medium"
            />
          </View>
          <View style={styles.actionButton}>
            <ActionButton
              title="Insertar"
              onPress={handleInsert}
              variant="success"
              size="medium"
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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
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
  },
  threeColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 4,
  },
  halfWidth: {
    width: '48%',
  },
  thirdWidth: {
    flex: 1,
    marginHorizontal: 2,
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
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 6,
  },
  actionButton: {
    width: '48%',
  },
  lockButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});

export default VisualModeScreen;
