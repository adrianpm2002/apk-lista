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
import ModeSelector from '../components/ModeSelector';
import HammerButton from '../components/HammerButton';
import ListButton from '../components/ListButton';
import InfoButton from '../components/InfoButton';
import TopBar from '../components/TopBar';

const TextModeScreen = ({ navigation }) => {
  // Estados para los campos
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [plays, setPlays] = useState('');
  const [note, setNote] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState(0);
  
  // Animación para transición
  const fadeAnim = useRef(new Animated.Value(1)).current;

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
    setSelectedLottery(null);
    setSelectedSchedule(null);
    setPlays('');
    setNote('');
    setCalculatedAmount(0);
  };

  const handleVerify = () => {
    // Validar campos requeridos
    if (!selectedLottery || !selectedSchedule || !plays) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }
    
    const playList = plays.split(',').filter(play => play.trim() !== '');
    alert(`Verificación:\nLotería: ${selectedLottery}\nHorario: ${selectedSchedule}\nJugadas: ${playList.length}\nMonto: $${calculatedAmount.toFixed(2)}`);
  };

  const handleInsert = () => {
    // Validar campos requeridos
    if (!selectedLottery || !selectedSchedule || !plays) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    console.log('Insertar jugada:', {
      lottery: selectedLottery,
      schedule: selectedSchedule,
      plays,
      note,
      amount: calculatedAmount,
    });

    alert('Jugada insertada correctamente');
    handleClear();
  };

  const handleModeChange = (mode) => {
    if (mode === 'Visual') {
      // Animación de salida
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        navigation.replace('VisualMode');
      });
    }
  };

  // Animación de entrada cuando se monta el componente
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleTopBarOption = (option) => {
    console.log('Top bar option selected:', option);
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <TopBar onOptionSelect={handleTopBarOption} />
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

        {/* Row 2: Jugadas */}
        <InputField
          label="Jugadas"
          value={plays}
          onChangeText={setPlays}
          placeholder="Ej: 123, 456, 789"
          multiline={true}
          showPasteButton={true}
          pasteButtonOverlay={true}
        />

        {/* Row 3: Nota y Monto */}
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <InputField
              label="Nota"
              value={note}
              onChangeText={setNote}
              placeholder="Nombre del jugador"
            />
          </View>
          <View style={styles.halfWidth}>
            <InputField
              label="Monto"
              value={`$${calculatedAmount.toFixed(2)}`}
              editable={false}
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

      {/* Botón de modo al final */}
      <View style={styles.modeContainer}>
        <ModeSelector 
          currentMode="Texto" 
          onModeChange={handleModeChange}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8ff',
  },
  content: {
    flex: 1,
    padding: 10,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 8,
  },
  halfWidth: {
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
  modeContainer: {
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
});

export default TextModeScreen;
