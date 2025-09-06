// src/screens/ManageLotteriesScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, Alert, FlatList, TouchableOpacity, Platform, Modal, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { supabase } from '../supabaseClient';
import InputField from '../components/InputField';
import { SideBar, SideBarToggle } from '../components/SideBar';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';

// Función helper para confirmaciones compatibles con web
const showConfirmation = (title, message, onConfirm, onCancel = null) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  } else {
    Alert.alert(
      title,
      message,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: onCancel
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: onConfirm
        }
      ]
    );
  }
};

const ManageLotteriesScreen = ({ navigation, onModeVisibilityChange }) => {
  return (
    <ScreenWrapper>
      <ManageLotteriesContent
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
      />
    </ScreenWrapper>
  );
};

const ManageLotteriesContent = ({ navigation, onModeVisibilityChange }) => {
  
  // Estados locales
  const [lotteries, setLotteries] = useState([]);
  const [newLottery, setNewLottery] = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados para gestión de horarios
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedLottery, setSelectedLottery] = useState(null);
  // Horarios para la vista principal (todas las loterías)
  const [schedules, setSchedules] = useState([]);
  // Horarios para el modal (solo la lotería seleccionada)
  const [modalSchedules, setModalSchedules] = useState([]);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    startTime: '12:00',
    endTime: '13:00'
  });
  const [editingSchedule, setEditingSchedule] = useState(null);
  
  // ========== TIME PICKER STATES ==========
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());

  // ========== HELPER FUNCTIONS ==========
  const formatTime12Hour = (date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Función para formatear hora desde string de BD (HH:MM) a formato AM/PM
  const formatTimeFromString = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return formatTime12Hour(date);
  };

  // Función para obtener horarios de una lotería específica
  const getLotterySchedules = (lotteryId) => {
    return schedules.filter(schedule => schedule.id_loteria === lotteryId);
  };

  const formatTimeForDB = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = '00'; // Siempre 00 segundos
    return `${hours}:${minutes}:${seconds}`;
  };

  const parseTimeToDate = (timeString) => {
    // Manejar tanto formato HH:MM como HH:MM:SS
    const timeParts = timeString.split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    return date;
  };

  // ========== FETCH FUNCTIONS ==========
  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, id_banco')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      if (profile) {
        setUserRole(profile.role);
        const bankId = profile.role === 'admin' ? user.id : profile.id_banco;
        setCurrentBankId(bankId);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  };

  const fetchLotteriesData = async () => {
    if (!currentBankId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('loteria')
        .select('*')
        .eq('id_banco', currentBankId)
        .order('nombre', { ascending: true });

      if (error) {
        console.error('Error fetching lotteries:', error);
        return;
      }

      setLotteries(data || []);
    } catch (error) {
      console.error('Error in fetchLotteries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedulesData = async () => {
    if (!currentBankId) return;
    
    try {
      // Primero obtenemos las loterías del banco
      const { data: lotteries, error: lotteriesError } = await supabase
        .from('loteria')
        .select('id')
        .eq('id_banco', currentBankId);

      if (lotteriesError) {
        console.error('Error fetching lotteries for schedules:', lotteriesError);
        return;
      }

      if (!lotteries || lotteries.length === 0) {
        setSchedules([]);
        return;
      }

      // Luego obtenemos los horarios de esas loterías
      const lotteryIds = lotteries.map(l => l.id);
      const { data, error } = await supabase
        .from('horario')
        .select('*')
        .in('id_loteria', lotteryIds)
        .order('hora_inicio', { ascending: true });

      if (error) {
        console.error('Error fetching schedules:', error);
        return;
      }

      setSchedules(data || []);
    } catch (error) {
      console.error('Error in fetchSchedules:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLotteriesData(), fetchSchedulesData()]);
    setRefreshing(false);
  };

  // Cargar datos al montar el componente (optimizado)
  useEffect(() => {
    const timeoutId = setTimeout(fetchUserProfile, 10);
    return () => clearTimeout(timeoutId);
  }, []);

  // Cargar loterias y horarios cuando tengamos bankId
  useEffect(() => {
    if (currentBankId) {
      fetchLotteriesData();
      fetchSchedulesData();
    }
    // Siempre detener el loading inicial después de intentar cargar el perfil
    setInitialLoading(false);
  }, [currentBankId]);

  // Refrescar datos cuando se regresa a la pantalla
  useFocusEffect(
    React.useCallback(() => {
      if (currentBankId) {
        fetchLotteriesData();
        fetchSchedulesData();
      }
    }, [currentBankId])
  );




  const handleRefresh = async () => {
    await onRefresh();
  };

  const handleAddLottery = async () => {
    if (!newLottery.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre de la lotería');
      return;
    }

    if (!currentBankId) {
      Alert.alert('Error', 'No se puede determinar el banco actual');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('loteria')
        .insert([
          {
            nombre: newLottery.trim(),
            id_banco: currentBankId
          }
        ])
        .select();

      if (error) {
        console.error('Error adding lottery:', error);
        Alert.alert('Error', 'No se pudo agregar la lotería');
        return;
      }

      setNewLottery('');
      
      // Recargar datos
      await fetchLotteriesData();
      
      Alert.alert('Éxito', 'Lotería agregada correctamente');
    } catch (error) {
      console.error('Error general adding lottery:', error);
      Alert.alert('Error', 'Error general al agregar la lotería');
    }
  };

  const handleDeleteLottery = async (id) => {
    if (!id) {
      Alert.alert('Error', 'ID de lotería no válido');
      return;
    }

    showConfirmation(
      'Confirmar eliminación',
      '¿Estás seguro de que deseas eliminar esta lotería? También se eliminarán todos sus horarios.',
      async () => {
        try {
          // Primero eliminar horarios
          const { error: schedulesError } = await supabase
            .from('horario')
            .delete()
            .eq('id_loteria', id);

          if (schedulesError) {
            console.error('Error deleting schedules:', schedulesError);
          }

          // Luego eliminar la lotería
          const { error } = await supabase
            .from('loteria')
            .delete()
            .eq('id', id);

          if (error) {
            console.error('Error deleting lottery:', error);
            Alert.alert('Error', 'No se pudo eliminar la lotería');
            return;
          }

          // Recargar datos
          await fetchLotteriesData();
          await fetchSchedulesData();
          
          Alert.alert('Éxito', 'Lotería eliminada correctamente');
        } catch (error) {
          console.error('Error general deleting lottery:', error);
          Alert.alert('Error', 'Error general al eliminar la lotería');
        }
      }
    );
  };

  const openScheduleModal = (lottery) => {
    setSelectedLottery(lottery);
    setScheduleModalVisible(true);
    fetchSchedulesForLottery(lottery.id);
  };

  const closeScheduleModal = () => {
    setScheduleModalVisible(false);
    setSelectedLottery(null);
    setModalSchedules([]); // Limpiar solo el estado del modal
    setNewSchedule({ name: '', startTime: '12:00', endTime: '13:00' });
    setEditingSchedule(null);
    
    // Refrescar la vista previa de horarios después de cerrar el modal
    fetchSchedulesData();
  };

  const fetchSchedulesForLottery = async (lotteryId) => {
    try {
      const { data, error } = await supabase
        .from('horario')
        .select('*')
        .eq('id_loteria', lotteryId)
        .order('hora_inicio', { ascending: true });

      if (error) {
        console.error('Error fetching schedules for lottery:', error);
        return;
      }

      setModalSchedules(data || []); // Usar el estado del modal
    } catch (error) {
      console.error('Error general fetching schedules for lottery:', error);
    }
  };

  const handleAddSchedule = async () => {
    if (!newSchedule.name.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre del horario');
      return;
    }

    if (!selectedLottery) {
      Alert.alert('Error', 'No hay lotería seleccionada');
      return;
    }

    try {
      const scheduleData = {
        id_loteria: selectedLottery.id,
        nombre: newSchedule.name.trim(),
        hora_inicio: formatTimeForDB(startTime),
        hora_fin: formatTimeForDB(endTime)
      };

      if (editingSchedule) {
        // Actualizar horario existente
        const { data, error } = await supabase
          .from('horario')
          .update(scheduleData)
          .eq('id', editingSchedule.id)
          .select();

        if (error) {
          console.error('Error updating schedule:', error);
          Alert.alert('Error', 'No se pudo actualizar el horario');
          return;
        }

        Alert.alert('Éxito', 'Horario actualizado correctamente');
      } else {
        // Crear nuevo horario
        const { data, error } = await supabase
          .from('horario')
          .insert([scheduleData])
          .select();

        if (error) {
          console.error('Error adding schedule:', error);
          Alert.alert('Error', 'No se pudo agregar el horario');
          return;
        }

        Alert.alert('Éxito', 'Horario agregado correctamente');
      }

      // Resetear formulario
      setNewSchedule({ name: '', startTime: '12:00', endTime: '13:00' });
      setStartTime(new Date());
      setEndTime(new Date());
      setEditingSchedule(null);
      
      // Actualizar horarios del modal
      await fetchSchedulesForLottery(selectedLottery.id);
      
      // Actualizar vista previa de horarios para el listado principal
      await fetchSchedulesData();
    } catch (error) {
      console.error('Error general with schedule:', error);
      Alert.alert('Error', 'Error general al procesar el horario');
    }
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setNewSchedule({
      name: schedule.nombre,
      startTime: formatTime(schedule.hora_inicio),
      endTime: formatTime(schedule.hora_fin)
    });
    
    // Configurar los time pickers con los valores del horario
    setStartTime(parseTimeToDate(schedule.hora_inicio));
    setEndTime(parseTimeToDate(schedule.hora_fin));
  };

  const handleDeleteSchedule = async (scheduleId) => {
    showConfirmation(
      'Confirmar eliminación',
      '¿Estás seguro de que deseas eliminar este horario?',
      async () => {
        try {
          const { error } = await supabase
            .from('horario')
            .delete()
            .eq('id', scheduleId);

          if (error) {
            console.error('Error deleting schedule:', error);
            Alert.alert('Error', 'No se pudo eliminar el horario');
            return;
          }

          // Actualizar horarios del modal
          await fetchSchedulesForLottery(selectedLottery.id);
          
          // Actualizar vista previa de horarios para el listado principal
          await fetchSchedulesData();
          
          Alert.alert('Éxito', 'Horario eliminado correctamente');
        } catch (error) {
          console.error('Error general deleting schedule:', error);
          Alert.alert('Error', 'Error general al eliminar el horario');
        }
      }
    );
  };

  const cancelEdit = () => {
    setEditingSchedule(null);
    setNewSchedule({ name: '', startTime: '12:00', endTime: '13:00' });
    
    // Resetear time pickers
    setStartTime(new Date());
    setEndTime(new Date());
  };

  const formatTime = (timeString) => {
    if (!timeString) return '00:00';
    
    // Si es un string en formato HH:MM:SS, extraer solo HH:MM
    if (typeof timeString === 'string' && timeString.includes(':')) {
      const timeParts = timeString.split(':');
      if (timeParts.length >= 2) {
        return `${timeParts[0]}:${timeParts[1]}`;
      }
      return timeString; // Si ya es HH:MM
    }
    
    // Si es un objeto Date, extraer horas y minutos
    if (timeString instanceof Date) {
      return timeString.toTimeString().substring(0, 5);
    }
    
    // Si es un string que representa una fecha
    if (typeof timeString === 'string') {
      const date = new Date(timeString);
      if (!isNaN(date.getTime())) {
        return date.toTimeString().substring(0, 5);
      }
    }
    
    return '00:00';
  };

  // Optimized focus refresh sin cache
  const focusRefresh = useCallback(() => {
    if (currentBankId) {
      fetchLotteriesData();
      fetchSchedulesData();
    }
  }, [currentBankId]);

  useFocusEffect(
    useCallback(() => {
      focusRefresh();
    }, [focusRefresh])
  );

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
          const bankId = data.role === 'admin' ? user.id : data.id_banco;
          setCurrentBankId(bankId);
        } else {
          console.error('Error cargando rol:', error);
        }
      }
    };

    fetchUserRole();
  }, []);

  return (
    <View style={styles.container}>
      {/* Header personalizado - arriba del todo */}
      <View style={styles.customHeader}>
        <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>Loterías</Text>
      </View>
        
      <View style={styles.contentContainer}>
        <InputField
          placeholder="Nombre de nueva lotería"
          value={newLottery}
          onChangeText={setNewLottery}
          style={styles.input}
        />

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: '#2ecc71' }]}
          onPress={handleAddLottery}
        >
          <Text style={styles.addButtonText}>➕ Agregar Lotería</Text>
        </TouchableOpacity>

        {initialLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              Cargando loterías...
            </Text>
          </View>
        ) : (
          <FlatList
            data={lotteries}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#2ecc71']}
                tintColor={'#2ecc71'}
              />
            }
            renderItem={({ item }) => {
              const lotterySchedules = getLotterySchedules(item.id);
              return (
                <View style={styles.lotteryCard}>
                  <Text style={styles.lotteryName}>
                    {item.nombre}
                  </Text>
                  
                  {/* Vista previa de horarios */}
                  <View style={styles.schedulePreviewContainer}>
                    <Text style={styles.schedulePreviewTitle}>
                      Horarios ({lotterySchedules.length}):
                    </Text>
                    {lotterySchedules.length > 0 ? (
                      <View style={styles.schedulePreviewList}>
                        {lotterySchedules.slice(0, 3).map((schedule, index) => (
                          <Text key={schedule.id} style={styles.schedulePreviewItem}>
                            {schedule.nombre}: {formatTimeFromString(schedule.hora_inicio)} - {formatTimeFromString(schedule.hora_fin)}
                          </Text>
                        ))}
                        {lotterySchedules.length > 3 && (
                          <Text style={styles.schedulePreviewMore}>
                            y {lotterySchedules.length - 3} más...
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text style={[styles.noSchedulesText, { color: '#7f8c8d' }]}>
                        Sin horarios configurados
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.scheduleButton]}
                      onPress={() => openScheduleModal(item)}
                    >
                      <Text style={styles.actionButtonText}>🕒 Gestionar Horarios</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteLottery(item.id)}
                    >
                      <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: '#7f8c8d' }]}>
                  No hay loterías registradas
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Modal para gestionar horarios */}
      <Modal
        visible={scheduleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeScheduleModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: '#000' }]}>
                Horarios de {selectedLottery?.nombre}
              </Text>
              <TouchableOpacity onPress={closeScheduleModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Formulario para agregar/editar horario */}
              <View style={styles.formSection}>
                <Text style={[styles.sectionTitle, { color: '#000' }]}>
                  {editingSchedule ? 'Editar Horario' : 'Nuevo Horario'}
                </Text>
                
                <InputField
                  placeholder="Nombre del horario (ej: Mediodía, Noche)"
                  value={newSchedule.name}
                  onChangeText={(text) => setNewSchedule(prev => ({ ...prev, name: text }))}
                  style={styles.input}
                />

                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={[styles.timeLabel, { color: '#000' }]}>
                      Hora de Inicio:
                    </Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="time"
                        value={startTime.toTimeString().slice(0, 5)}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':');
                          const newTime = new Date(startTime);
                          newTime.setHours(parseInt(hours), parseInt(minutes));
                          setStartTime(newTime);
                        }}
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          border: `1px solid #ddd`,
                          backgroundColor: '#fff',
                          color: '#000',
                          fontSize: 16,
                          width: '100%',
                        }}
                      />
                    ) : (
                      <TouchableOpacity 
                        style={[
                          styles.timeSelector, 
                          { 
                            backgroundColor: '#fff',
                            borderColor: '#ddd'
                          }
                        ]}
                        onPress={() => setShowStartPicker(true)}
                      >
                        <Text style={[styles.timeSelectorText, { color: '#000' }]}>
                          {formatTime12Hour(startTime)}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.timeField}>
                    <Text style={[styles.timeLabel, { color: '#000' }]}>
                      Hora de Fin:
                    </Text>
                    {Platform.OS === 'web' ? (
                      <input
                        type="time"
                        value={endTime.toTimeString().slice(0, 5)}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':');
                          const newTime = new Date(endTime);
                          newTime.setHours(parseInt(hours), parseInt(minutes));
                          setEndTime(newTime);
                        }}
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          border: `1px solid #ddd`,
                          backgroundColor: '#fff',
                          color: '#000',
                          fontSize: 16,
                          width: '100%',
                        }}
                      />
                    ) : (
                      <TouchableOpacity 
                        style={[
                          styles.timeSelector, 
                          { 
                            backgroundColor: '#fff',
                            borderColor: '#ddd'
                          }
                        ]}
                        onPress={() => setShowEndPicker(true)}
                      >
                        <Text style={[styles.timeSelectorText, { color: '#000' }]}>
                          {formatTime12Hour(endTime)}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Time Pickers - Solo para móvil */}
                {Platform.OS !== 'web' && showStartPicker && (
                  <DateTimePicker
                    value={startTime}
                    mode="time"
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowStartPicker(false);
                      if (selectedDate) {
                        setStartTime(selectedDate);
                      }
                    }}
                  />
                )}

                {Platform.OS !== 'web' && showEndPicker && (
                  <DateTimePicker
                    value={endTime}
                    mode="time"
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowEndPicker(false);
                      if (selectedDate) {
                        setEndTime(selectedDate);
                      }
                    }}
                  />
                )}

                <View style={styles.formButtons}>
                  {editingSchedule && (
                    <TouchableOpacity onPress={cancelEdit} style={[styles.formButton, styles.cancelButton]}>
                      <Text style={styles.formButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={handleAddSchedule} style={[styles.formButton, styles.saveButton]}>
                    <Text style={styles.formButtonText}>
                      {editingSchedule ? 'Actualizar' : 'Agregar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Lista de horarios existentes */}
              <View style={styles.schedulesSection}>
                <Text style={[styles.sectionTitle, { color: '#000' }]}>
                  Horarios Existentes
                </Text>
                
                {modalSchedules.length === 0 ? (
                  <Text style={[styles.emptyText, { color: '#7f8c8d' }]}>
                    No hay horarios configurados
                  </Text>
                ) : (
                  modalSchedules.map((schedule) => (
                    <View key={schedule.id} style={[styles.scheduleCard, { backgroundColor: '#f8f9fa' }]}>
                      <View style={styles.scheduleInfo}>
                        <Text style={[styles.scheduleName, { color: '#000' }]}>
                          {schedule.nombre}
                        </Text>
                        <Text style={[styles.scheduleTime, { color: '#7f8c8d' }]}>
                          {formatTimeFromString(schedule.hora_inicio)} - {formatTimeFromString(schedule.hora_fin)}
                        </Text>
                      </View>
                      <View style={styles.scheduleActions}>
                        <TouchableOpacity
                          onPress={() => handleEditSchedule(schedule)}
                          style={[styles.scheduleActionButton, styles.editButton]}
                        >
                          <Text style={styles.scheduleActionText}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteSchedule(schedule.id)}
                          style={[styles.scheduleActionButton, styles.deleteScheduleButton]}
                        >
                          <Text style={styles.scheduleActionText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
        role="admin"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
    paddingTop: 0,
  },
  customHeader: {
    height: 100,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }
    }),
  },
  sidebarButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    ...Platform.select({
      web: {
        userSelect: 'none',
      }
    }),
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  input: {
    marginBottom: 15,
  },
  addButton: {
    backgroundColor: '#2ecc71',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  lotteryCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    ...createShadowStyle(2),
  },
  lotteryName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  scheduleButton: {
    backgroundColor: '#3498db',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  modalContent: {
    maxHeight: 400,
  },
  formSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeField: {
    flex: 1,
    marginHorizontal: 5,
  },
  timeLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  timeInput: {
    marginBottom: 15,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  formButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  saveButton: {
    backgroundColor: '#27ae60',
  },
  formButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Time Selector Styles
  timeSelector: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  timeSelectorText: {
    fontSize: 16,
    fontWeight: '600',
  },
  schedulesSection: {
    padding: 20,
  },
  scheduleCard: {
    padding: 15,
    marginBottom: 10,
    borderRadius: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scheduleTime: {
    fontSize: 14,
    marginTop: 5,
  },
  scheduleActions: {
    flexDirection: 'row',
  },
  scheduleActionButton: {
    padding: 8,
    borderRadius: 4,
    marginLeft: 5,
  },
  editButton: {
    backgroundColor: '#f39c12',
  },
  deleteScheduleButton: {
    backgroundColor: '#e74c3c',
  },
  scheduleActionText: {
    fontSize: 12,
  },
  // Estilos para vista previa de horarios
  schedulePreviewContainer: {
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  schedulePreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  schedulePreviewList: {
    paddingLeft: 4,
  },
  schedulePreviewItem: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  schedulePreviewMore: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  noSchedulesText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingLeft: 4,
  },
});

export default ManageLotteriesScreen;
