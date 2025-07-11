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
import InfoButton from '../components/InfoButton';
import { SideBar, SideBarToggle } from '../components/SideBar';

const TextModeScreen = ({ navigation, currentMode, onModeChange, isDarkMode, onToggleDarkMode }) => {
  // Estados para los campos
  const [selectedLotteries, setSelectedLotteries] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [plays, setPlays] = useState('');
  const [note, setNote] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);

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
      const amount = playList.length * 1; // $1 por jugada (puedes ajustar esta lógica)
      setCalculatedAmount(amount);
    } else {
      setCalculatedAmount(0);
    }
  }, [plays]);

  const handleClear = () => {
    setSelectedLotteries([]);
    setSelectedSchedule(null);
    setPlays('');
    setNote('');
    setCalculatedAmount(0);
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

  const handleInsert = () => {
    // Validar campos requeridos
    if (!selectedLotteries.length || !selectedSchedule || !plays) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    console.log('Insertar jugada:', {
      lotteries: selectedLotteries,
      schedule: selectedSchedule,
      plays,
      note,
      amount: calculatedAmount,
    });

    alert('Jugada insertada correctamente');
    handleClear();
  };

  const handleTopBarOption = (option) => {
    console.log('Sidebar option selected:', option);
  };

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const closeSidebar = () => {
    setSidebarVisible(false);
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <SideBarToggle onToggle={toggleSidebar} />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Row 1: Lotería */}
        <MultiSelectDropdown
          label="Lotería"
          selectedValues={selectedLotteries}
          onSelect={setSelectedLotteries}
          options={lotteries}
          placeholder="Seleccionar loterias"
          isDarkMode={isDarkMode}
        />

        {/* Row 2: Horario */}
        <DropdownPicker
          label="Horario"
          value={selectedSchedule}
          onSelect={setSelectedSchedule}
          options={schedules}
          placeholder="Seleccionar horario"
        />

        {/* Row 3: Jugadas */}
        <InputField
          label="Jugadas"
          value={plays}
          onChangeText={setPlays}
          placeholder="Ej: 123, 456, 789"
          multiline={true}
          showPasteButton={true}
          pasteButtonOverlay={true}
        />

        {/* Row 4: Nota y Monto */}
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <InputField
              label="Nota"
              value={note}
              onChangeText={setNote}
              placeholder=""
            />
          </View>
          <View style={styles.halfWidth}>
            <MoneyInputField
              label="Monto"
              value={calculatedAmount.toString()}
              editable={false}
              placeholder="$0"
            />
          </View>
        </View>

        {/* Row 4: Botones de herramientas */}
        <View style={styles.toolsContainer}>
          <HammerButton onOptionSelect={(option) => console.log('Hammer option:', option)} />
          
          <ListButton onOptionSelect={(option) => console.log('List option:', option)} />
          
          <InfoButton />
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
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
    gap: 6,
  },
  halfWidth: {
    width: '48%',
  },
  thirdWidth: {
    flex: 1,
  },
  toolsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 20,
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
});

export default TextModeScreen;
