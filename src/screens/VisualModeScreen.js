import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import BatteryButton from '../components/BatteryButton';
import HammerButton from '../components/HammerButton';
import ListButton from '../components/ListButton';
import { SideBar, SideBarToggle } from '../components/SideBar';

const VisualModeScreen = ({ navigation, currentMode, onModeChange, isDarkMode, onToggleDarkMode }) => {
  // Estados para los campos
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedPlayType, setSelectedPlayType] = useState(null);
  const [plays, setPlays] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isLocked, setIsLocked] = useState(false);
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

  const playTypes = [
    { label: 'Fijo', value: 'fijo' },
    { label: 'Corrido', value: 'corrido' },
    { label: 'Parlé', value: 'parle' },
    { label: 'Centena', value: 'centena' },
    { label: 'Tripleta', value: 'tripleta' },
  ];

  const handleInsert = () => {
    // Validar campos requeridos
    if (!selectedLottery || !selectedSchedule || !selectedPlayType || !plays || !amount) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }
    
    console.log('Insertar jugada:', {
      lottery: selectedLottery,
      schedule: selectedSchedule,
      playType: selectedPlayType,
      plays,
      amount,
      note,
    });
    
    // Aquí irá la lógica para guardar en la base de datos
    alert('Jugada insertada correctamente');
  };

  const handleClear = () => {
    setSelectedLottery(null);
    setSelectedSchedule(null);
    setSelectedPlayType(null);
    setPlays('');
    setAmount('');
    setNote('');
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

  const toggleLock = () => {
    setIsLocked(!isLocked);
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <SideBarToggle onToggle={toggleSidebar} />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Row 1: Lotería y Horario */}
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <DropdownPicker
              label="Lotería"
              value={selectedLottery}
              onSelect={setSelectedLottery}
              options={lotteries}
              placeholder="Seleccionar lotería"
            />
          </View>
          <View style={styles.halfWidth}>
            <DropdownPicker
              label="Horario"
              value={selectedSchedule}
              onSelect={setSelectedSchedule}
              options={schedules}
              placeholder="Seleccionar horario"
            />
          </View>
        </View>

        {/* Row 2: Tipo de Jugada */}
        <DropdownPicker
          label="Tipo de Jugada"
          value={selectedPlayType}
          onSelect={setSelectedPlayType}
          options={playTypes}
          placeholder="Seleccionar tipo de jugada"
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

        {/* Row 4: Monto y Nota */}
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <InputField
              label="Monto"
              value={amount}
              onChangeText={setAmount}
              placeholder="$0.00"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfWidth}>
            <InputField
              label="Nota"
              value={note}
              onChangeText={setNote}
              placeholder="Nombre del jugador"
            />
          </View>
        </View>

        {/* Row 5: Botones de herramientas */}
        <View style={styles.toolsContainer}>
          <TouchableOpacity
            style={[styles.lockButton, isLocked && styles.lockButtonActive]}
            onPress={toggleLock}
            activeOpacity={0.7}
          >
            <Text style={styles.lockIcon}>{isLocked ? '🔒' : '🔓'}</Text>
          </TouchableOpacity>
          
          <BatteryButton onOptionSelect={(option) => console.log('Battery option:', option)} />
          
          <HammerButton onOptionSelect={(option) => console.log('Hammer option:', option)} />
          
          <ListButton onOptionSelect={(option) => console.log('List option:', option)} />
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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
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
  halfWidth: {
    width: '48%',
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
});

export default VisualModeScreen;
