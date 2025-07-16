import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet, Platform, Pressable } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';
import DateTimePicker from '../components/DateTimePickerWrapper';
import { format } from '../utils/dateUtils';

const InsertResultsScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  const [lotteryOptions, setLotteryOptions] = useState([]);
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [result, setResult] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);

  const fetchLoterias = async () => {
    const { data, error } = await supabase.from('loteria').select('id, nombre');
    if (error) {
      Alert.alert('Error cargando loterías');
      return;
    }
    const options = data.map((l) => ({ label: l.nombre, value: l.id }));
    setLotteryOptions(options);
  };

  useEffect(() => {
    fetchLoterias();
  }, []);

  useEffect(() => {
  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('profiles') // o el nombre de tu tabla de usuarios
        .select('role')
        .eq('id', user.id)
        .single();

      if (data) {
        setUserRole(data.role);
      } else {
        console.error('Error cargando rol:', error);
      }
    }
  };

  fetchUserRole();
}, []);


  const handleInsert = async () => {
  if (!selectedLottery || !result) {
    Alert.alert('Error', 'Selecciona lotería y escribe el resultado');
    return;
  }

  console.log('Insertando resultado:', {
    loteria_id: selectedLottery,
    resultado: result,
    fecha: date.toISOString().split('T')[0],
  });

  const { error } = await supabase.from('resultados').insert([
    {
      loteria_id: selectedLottery,
      resultado: result,
      fecha: date.toISOString().split('T')[0],
    }
  ]);

  if (error) {
    console.error('Error Supabase:', error);
    Alert.alert('Error al guardar', error.message);
    return;
  }

  Alert.alert('Éxito', 'Resultado guardado');
  setResult('');
};


  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={styles.toggleContainer}>
        <SideBarToggle onToggle={() => setSidebarVisible(!sidebarVisible)} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Insertar Resultado</Text>

        <DropdownPicker
  label="Lotería"
  value={selectedLottery}
  onSelect={(option) => setSelectedLottery(option.value)}
  options={lotteryOptions}
  placeholder="Seleccionar lotería"
/>


        <Text style={styles.label}>Fecha</Text>
        <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateDisplay}>
          <Text style={styles.dateText}>{format(date, 'yyyy-MM-dd')}</Text>
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selectedDate) setDate(selectedDate);
            }}
          />
        )}

        <InputField
          label="Resultado"
          value={result}
          onChangeText={setResult}
          placeholder="Ej: 12,34,56"
        />

        <View style={styles.actionRow}>
          <ActionButton
            title="Insertar Resultado"
            onPress={handleInsert}
            variant="success"
            size="medium"
          />
        </View>
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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2C3E50',
  },
  label: {
    marginBottom: 4,
    fontWeight: 'bold',
    color: '#34495E',
  },
  dateDisplay: {
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#D5DBDB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  dateText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  actionRow: {
    marginTop: 10,
    width: '100%',
  },
});
