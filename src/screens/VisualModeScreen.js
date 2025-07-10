import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import ModeSelector from '../components/ModeSelector';
import BatteryButton from '../components/BatteryButton';
import HammerButton from '../components/HammerButton';

const VisualModeScreen = ({ navigation }) => {
  // Estados para los campos
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedPlayType, setSelectedPlayType] = useState(null);
  const [plays, setPlays] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  // Datos para los dropdowns
  const lotteries = [
    { label: 'Georgia', value: 'georgia' },
    { label: 'Florida', value: 'florida' },
    { label: 'New York', value: 'newyork' },
  ];

  const schedules = [
    { label: 'Mañana (10:00 AM)', value: 'morning' },
    { label: 'Tarde (3:00 PM)', value: 'afternoon' },
    { label: 'Noche (7:00 PM)', value: 'evening' },
    { label: 'Nocturno (11:00 PM)', value: 'night' },
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

  const handleModeChange = () => {
    // Aquí irá la lógica para cambiar entre modos
    console.log('Cambiar modo');
    alert('Próximamente: Cambio de modos');
  };

  const toggleLock = () => {
    setIsLocked(!isLocked);
  };

  return (
    <View style={styles.container}>
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
        />

        {/* Row 4: Monto y Nota */}
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <InputField
              label="Monto a Jugar"
              value={amount}
              onChangeText={setAmount}
              placeholder="$0.00"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfWidth}>
            <InputField
              label="Nota (Jugador)"
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
        </View>

        {/* Row 6: Botones de acción */}
        <View style={styles.actionRow}>
          <View style={styles.actionButton}>
            <ActionButton
              title="Insertar"
              onPress={handleInsert}
              variant="success"
              size="medium"
            />
          </View>
          <View style={styles.actionButton}>
            <ActionButton
              title="Borrar"
              onPress={handleClear}
              variant="danger"
              size="medium"
            />
          </View>
        </View>
      </ScrollView>

      {/* Botón de modo al final */}
      <View style={styles.modeContainer}>
        <ModeSelector 
          currentMode="Visual" 
          onModeChange={handleModeChange}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
    paddingTop: 50,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  toolsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
    gap: 16,
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
    marginTop: 16,
    marginBottom: 12,
  },
  actionButton: {
    width: '48%',
  },
  modeContainer: {
    backgroundColor: '#E8F5E8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#D4E7CE',
  },
});

export default VisualModeScreen;
