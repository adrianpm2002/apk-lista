import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet, SafeAreaView } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';

const InsertResultsScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  const [lotteryOptions, setLotteryOptions] = useState([]);
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [selectedLotteryLabel, setSelectedLotteryLabel] = useState('');
  const [horarioOptions, setHorarioOptions] = useState([]);
  const [selectedHorario, setSelectedHorario] = useState(null);
  const [selectedHorarioLabel, setSelectedHorarioLabel] = useState('');
  const [result, setResult] = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);

  // Estados para errores de validación
  const [errors, setErrors] = useState({
    lottery: false,
    horario: false,
    result: false
  });

  const fetchLoterias = async () => {
    if (!currentBankId) return; // No cargar loterias si no tenemos el banco ID
    
    const { data, error } = await supabase
      .from('loteria')
      .select('id, nombre')
      .eq('id_banco', currentBankId); // Solo loterias del mismo banco
      
    if (error) {
      Alert.alert('Error cargando loterías');
      return;
    }
    const options = data.map((l) => ({ label: l.nombre, value: l.id }));
    setLotteryOptions(options);
  };

  const fetchHorarios = async (lotteryId) => {
    if (!lotteryId) {
      setHorarioOptions([]);
      setSelectedHorario(null);
      setSelectedHorarioLabel('');
      return;
    }

    const { data, error } = await supabase
      .from('horario')
      .select('id, nombre, hora_inicio, hora_fin')
      .eq('id_loteria', lotteryId)
      .order('hora_inicio', { ascending: true });

    if (error) {
      console.error('Error cargando horarios:', error);
      Alert.alert('Error cargando horarios');
      return;
    }

    const options = data.map((h) => ({ 
      label: `${h.nombre} (${h.hora_inicio.slice(0,5)} - ${h.hora_fin.slice(0,5)})`, 
      value: h.id 
    }));
    setHorarioOptions(options);
    setSelectedHorario(null);
    setSelectedHorarioLabel('');
  };

  useEffect(() => {
    if (currentBankId) {
      fetchLoterias();
    }
  }, [currentBankId]);

  useEffect(() => {
    const fetchUserRole = async () => {
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
        } else {
          console.error('Error cargando rol:', error);
        }
      }
    };

    fetchUserRole();
  }, []);
  const handleInsert = async () => {
    // Resetear errores
    setErrors({
      lottery: false,
      horario: false,
      result: false
    });

    let hasErrors = false;
    let errorMessages = [];

    // Validar lotería
    if (!selectedLottery) {
      setErrors(prev => ({ ...prev, lottery: true }));
      hasErrors = true;
      errorMessages.push('- Seleccionar lotería');
    }

    // Validar horario
    if (!selectedHorario) {
      setErrors(prev => ({ ...prev, horario: true }));
      hasErrors = true;
      errorMessages.push('- Seleccionar horario');
    }

    // Validar resultado
    const numbersOnly = result.trim().replace(/\D/g, '');
    if (!result.trim()) {
      setErrors(prev => ({ ...prev, result: true }));
      hasErrors = true;
      errorMessages.push('- Escribir resultado');
    } else if (numbersOnly.length !== 7) {
      setErrors(prev => ({ ...prev, result: true }));
      hasErrors = true;
      errorMessages.push('- El resultado debe tener exactamente 7 números');
    }

    // Si hay errores, mostrar mensaje y salir
    if (hasErrors) {
      Alert.alert(
        'Campos con errores', 
        'Corrige los siguientes errores:\n\n' + errorMessages.join('\n'),
        [{ text: 'OK' }]
      );
      return;
    }

    // Formatear el resultado como "XXX XXXX"
    const cleanResult = numbersOnly.substring(0, 3) + ' ' + numbersOnly.substring(3, 7);

    console.log('Insertando resultado:', {
      id_horario: selectedHorario,
      numeros: cleanResult,
    });

    const { error } = await supabase.from('resultado').insert([
      {
        id_horario: selectedHorario,
        numeros: cleanResult,
        // created_at se crea automáticamente en la base de datos
      }
    ]);

    if (error) {
      console.error('Error Supabase:', error);
      Alert.alert('Error al guardar', error.message);
      return;
    }

    Alert.alert('Éxito', 'Resultado guardado correctamente');
    
    // Limpiar formulario y errores
    setResult('');
    setSelectedHorario(null);
    setSelectedHorarioLabel('');
    setSelectedLottery(null);
    setSelectedLotteryLabel('');
    setErrors({
      lottery: false,
      horario: false,
      result: false
    });
  };


  return (
    <View style={styles.container}>
      {/* Header personalizado - arriba del todo */}
      <View style={styles.customHeader}>
        <SideBarToggle onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>Insertar Resultado</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <DropdownPicker
          label="Lotería"
          value={selectedLotteryLabel}
          onSelect={(option) => {
            setSelectedLottery(option.value);
            setSelectedLotteryLabel(option.label);
            fetchHorarios(option.value);
            // Limpiar error cuando se selecciona
            setErrors(prev => ({ ...prev, lottery: false }));
          }}
          options={lotteryOptions}
          placeholder="Seleccionar lotería"
          hasError={errors.lottery}
        />

        <DropdownPicker
          label="Horario"
          value={selectedHorarioLabel}
          onSelect={(option) => {
            setSelectedHorario(option.value);
            setSelectedHorarioLabel(option.label);
            // Limpiar error cuando se selecciona
            setErrors(prev => ({ ...prev, horario: false }));
          }}
          options={horarioOptions}
          placeholder="Seleccionar horario"
          disabled={!selectedLottery}
          hasError={errors.horario}
        />

        <InputField
          label="Resultado (7 números)"
          value={result}
          onChangeText={(text) => {
            setResult(text);
            // Limpiar error cuando se escribe
            if (text.trim()) {
              setErrors(prev => ({ ...prev, result: false }));
            }
          }}
          placeholder="Ej: 2538666 o 253 8666"
          keyboardType="numeric"
          hasError={errors.result}
        />

        <ActionButton
          title="Insertar Resultado"
          onPress={handleInsert}
          variant="success"
          size="medium"
          style={styles.submitButton}
        />
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
    </View>
  );
};

export default InsertResultsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
  },
  customHeader: {
    height: 100, // 56 + 44 para status bar
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'flex-end', // Alinear al final para que el botón esté abajo
    paddingHorizontal: 16,
    paddingBottom: 12, // Espacio desde el borde inferior
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
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
    marginRight: 44, // Para centrar el texto compensando el botón
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 100, // Espacio para el header fijo
  },
  submitButton: {
    marginTop: 10,
    width: '100%',
  },
});
