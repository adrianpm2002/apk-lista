// src/screens/ManageLotteriesScreen.js

import React, { useState, useEffect } from 'react';
import { View, Text, Alert, FlatList, Pressable } from 'react-native';
import { supabase } from '../supabaseClient';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import { TouchableOpacity } from 'react-native';

const ManageLotteriesScreen = ({ isDarkMode }) => {
  const [lotteries, setLotteries] = useState([]);
  const [newLottery, setNewLottery] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLotteries = async () => {
    const { data, error } = await supabase
      .from('loteria')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error al cargar lotería:', error.message);
    } else {
      setLotteries(data);
    }
  };

  const handleAddLottery = async () => {
    if (!newLottery.trim()) {
      Alert.alert('Error', 'El nombre de la lotería no puede estar vacío');
      return;
    }

    const { error } = await supabase
      .from('loteria')
      .insert({ nombre: newLottery.trim() });

    if (error) {
      Alert.alert('Error al agregar', error.message);
    } else {
      setNewLottery('');
      fetchLotteries();
    }
  };

  const handleDeleteLottery = async (id) => {
  Alert.alert(
    'Eliminar Lotería',
    '¿Estás seguro de que deseas eliminar esta lotería?',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            console.log('Eliminando lotería con ID:', id);

            const { error } = await supabase
              .from('loteria') // <-- CONFIRMA QUE ESTE ES EL NOMBRE CORRECTO
              .delete()
              .eq('id', id);

            if (error) {
              console.error('Error al eliminar:', error);
              Alert.alert('Error al eliminar', error.message);
            } else {
              console.log('Lotería eliminada con éxito');
              fetchLotteries(); // refresca la lista
            }
          } catch (e) {
            console.error('Error inesperado:', e);
            Alert.alert('Error', 'Ha ocurrido un error inesperado');
          }
        }
      }
    ]
  );
};


  useEffect(() => {
    fetchLotteries();
  }, []);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
        Gestión de Loterías
      </Text>

      <InputField
        placeholder="Nombre de nueva lotería"
        value={newLottery}
        onChangeText={setNewLottery}
        isDarkMode={isDarkMode}
      />

      <TouchableOpacity
  onPress={handleAddLottery}
  style={{
    backgroundColor: '#2ecc71',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20
  }}
>
  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Agregar Lotería</Text>
</TouchableOpacity>


      <FlatList
        data={lotteries}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View
  style={{
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#ccc',
    backgroundColor: isDarkMode ? '#2c3e50' : '#fff',
  }}
>
  <Text style={{ 
    fontSize: 16, 
    fontWeight: '500', 
    color: isDarkMode ? '#fff' : '#000', 
    marginBottom: 8 
  }}>
    {item.nombre}
  </Text>

  


  <TouchableOpacity
  onPress={() => handleDeleteLottery(item.id)}
  style={{
    alignSelf: 'flex-end',
    backgroundColor: '#e74c3c',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  }}
>
  <Text style={{ color: '#fff', fontWeight: '600' }}>Eliminar</Text>
</TouchableOpacity>
</View>

        )}
      />
    </View>
  );
};

export default ManageLotteriesScreen;
