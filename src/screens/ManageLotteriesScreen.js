// src/screens/ManageLotteriesScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, Alert, FlatList, TouchableOpacity, Platform, Modal, StyleSheet, ScrollView, RefreshControl } from 'react-native';

import { supabase } from '../supabaseClient';
import InputField from '../components/InputField';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { useCache } from '../contexts/CacheContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';

const ManageLotteriesScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  return (
    <ScreenWrapper>
      <ManageLotteriesContent
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
      />
    </ScreenWrapper>
  );
};

const ManageLotteriesContent = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  const { cache, userRole: cacheUserRole, currentBankId: cacheBankId, updateCacheData } = useCache();
  const { refreshing: cacheRefreshing, onRefresh: cacheOnRefresh } = usePullToRefresh('lotteries');
  const [lotteries, setLotteries] = useState([]);
  const [newLottery, setNewLottery] = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Estados para gestión de horarios
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    startTime: '12:00',
    endTime: '13:00'
  });
  const [editingSchedule, setEditingSchedule] = useState(null);

  // Usar datos del cache si están disponibles
  useEffect(() => {
    // Solo ejecutar en el mount inicial
    if (initialLoading) {
      if (cache.lotteries && cache.lotteries.length > 0) {
        console.log('Using cached lotteries:', cache.lotteries.length);
        setLotteries(cache.lotteries);
        setInitialLoading(false);
      } else if (cacheBankId) {
        console.log('No cached data, fetching from database...');
        fetchLotteries();
      }
    }
  }, [cache.lotteries, cacheBankId, initialLoading]);

  const fetchLotteries = async (forceRefresh = false) => {
    if (!cacheBankId) {
      console.log('No bank ID available for fetching lotteries');
      setInitialLoading(false);
      return;
    }
    
    // Si no es refresh forzado y hay datos en cache, usarlos
    if (!forceRefresh && cache.lotteries && cache.lotteries.length > 0) {
      console.log('Using existing cached data');
      setLotteries(cache.lotteries);
      setInitialLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      console.log('Fetching lotteries from database for bankId:', cacheBankId);
      const { data, error } = await supabase
        .from('loteria')
        .select('*')
        .eq('id_banco', cacheBankId)
        .order('id', { ascending: true });

      if (error) {
        console.error('Error al cargar lotería:', error.message);
        Alert.alert('Error', 'No se pudieron cargar las loterías');
      } else {
        console.log('Lotteries fetched successfully:', data.length);
        setLotteries(data);
        // Actualizar cache
        await updateCacheData('lotteries', data);
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error);
      Alert.alert('Error', 'Error inesperado al cargar las loterías');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchLotteries(true); // Forzar refresh desde BD
  };

  const handleAddLottery = async () => {
    if (!newLottery.trim()) {
      Alert.alert('Error', 'El nombre de la lotería no puede estar vacío');
      return;
    }

    console.log('Creating lottery with:', { 
      nombre: newLottery.trim(), 
      id_banco: currentBankId 
    });

    const { error } = await supabase
      .from('loteria')
      .insert({ 
        nombre: newLottery.trim(),
        id_banco: currentBankId
      });

    console.log('Insert lottery result:', { error });
    if (error) {
      Alert.alert('Error al agregar', error.message);
    } else {
      setNewLottery('');
      fetchLotteries();
      
      // Actualizar cache si es admin
      if (cacheUserRole === 'admin') {
        updateCacheData('lotteries');
      }
    }
  };

  const handleDeleteLottery = async (id) => {
  const isWeb = Platform.OS === 'web';

  if (isWeb) {
    console.log('Eliminando directamente en web:', id);
    const { error } = await supabase
      .from('loteria')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error al eliminar:', error.message);
      Alert.alert('Error al eliminar', error.message);
    } else {
      console.log('Lotería eliminada con éxito');
      fetchLotteries();
      
      // Actualizar cache si es admin
      if (cacheUserRole === 'admin') {
        updateCacheData('lotteries');
      }
    }
  } else {
    Alert.alert(
      'Eliminar Lotería',
      '¿Estás seguro de que deseas eliminar esta lotería?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            console.log('Confirmado en nativo. Eliminando ID:', id);
            const { error } = await supabase
              .from('loteria')
              .delete()
              .eq('id', id);

            if (error) {
              console.error('Error al eliminar:', error.message);
              Alert.alert('Error al eliminar', error.message);
            } else {
              fetchLotteries();
            }
          }
        }
      ]
    );
  }
};

  // Funciones para gestión de horarios
  const openScheduleModal = (lottery) => {
    setSelectedLottery(lottery);
    setScheduleModalVisible(true);
    fetchSchedules(lottery.id);
  };

  const closeScheduleModal = () => {
    setScheduleModalVisible(false);
    setSelectedLottery(null);
    setSchedules([]);
    setNewSchedule({ name: '', startTime: '12:00', endTime: '13:00' });
    setEditingSchedule(null);
  };

  const fetchSchedules = async (lotteryId) => {
    console.log('Intentando cargar horarios para lotería ID:', lotteryId);
    const { data, error } = await supabase
      .from('horario')
      .select('*')
      .eq('id_loteria', lotteryId)
      .order('hora_inicio', { ascending: true });

    if (error) {
      console.error('Error al cargar horarios:', error.message);
      console.error('Detalles del error:', error);
    } else {
      console.log('Horarios cargados:', data);
      setSchedules(data || []);
    }
  };

  const handleAddSchedule = async () => {
    if (!newSchedule.name.trim()) {
      Alert.alert('Error', 'El nombre del horario es requerido');
      return;
    }

    // Validar formato de tiempo
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(newSchedule.startTime)) {
      Alert.alert('Error', 'Formato de hora de inicio inválido. Use HH:MM');
      return;
    }
    if (!timeRegex.test(newSchedule.endTime)) {
      Alert.alert('Error', 'Formato de hora de fin inválido. Use HH:MM');
      return;
    }

    const scheduleData = {
      id_loteria: selectedLottery.id,
      nombre: newSchedule.name.trim(),
      hora_inicio: newSchedule.startTime + ':00', // Agregar segundos
      hora_fin: newSchedule.endTime + ':00'
    };

    console.log('Datos a enviar:', scheduleData);

    let error;
    if (editingSchedule) {
      // Actualizar horario existente
      const result = await supabase
        .from('horario')
        .update(scheduleData)
        .eq('id', editingSchedule.id);
      error = result.error;
    } else {
      // Crear nuevo horario
      const result = await supabase
        .from('horario')
        .insert(scheduleData);
      error = result.error;
    }

    if (error) {
      console.error('Error de Supabase:', error);
      Alert.alert('Error', error.message);
    } else {
      setNewSchedule({ name: '', startTime: '12:00', endTime: '13:00' });
      setEditingSchedule(null);
      fetchSchedules(selectedLottery.id);
    }
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setNewSchedule({
      name: schedule.nombre,
      startTime: schedule.hora_inicio.slice(0, 5), // HH:MM
      endTime: schedule.hora_fin.slice(0, 5) // HH:MM
    });
  };

  const handleDeleteSchedule = async (scheduleId) => {
    const isWeb = Platform.OS === 'web';

    if (isWeb) {
      const { error } = await supabase
        .from('horario')
        .delete()
        .eq('id', scheduleId);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        fetchSchedules(selectedLottery.id);
      }
    } else {
      Alert.alert(
        'Eliminar Horario',
        '¿Estás seguro de que deseas eliminar este horario?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              const { error } = await supabase
                .from('horario')
                .delete()
                .eq('id', scheduleId);

              if (error) {
                Alert.alert('Error', error.message);
              } else {
                fetchSchedules(selectedLottery.id);
              }
            }
          }
        ]
      );
    }
  };

  // Función auxiliar para cancelar edición
  const cancelEdit = () => {
    setEditingSchedule(null);
    setNewSchedule({
      name: '',
      startTime: '12:00',
      endTime: '13:00'
    });
  };

  // Función auxiliar para formatear tiempo
  const formatTime = (timeString) => {
    try {
      // Si es un string de tiempo en formato HH:MM
      if (typeof timeString === 'string' && timeString.includes(':')) {
        return timeString.slice(0, 5); // Mostrar solo HH:MM
      }
      // Si es un objeto Date
      if (timeString instanceof Date) {
        return timeString.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
      }
      // Si es un timestamp
      const date = new Date(timeString);
      return date.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '00:00';
    }
  };




  useEffect(() => {
    if (currentBankId) fetchLotteries();
  }, [currentBankId]);

  const focusRefresh = useCallback(() => {
    if (currentBankId) fetchLotteries();
  }, [currentBankId]);

  useFocusEffect(
    useCallback(() => {
      focusRefresh();
    }, [focusRefresh])
  );

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('ManageLotteries - User from auth:', user);
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, id_banco')
          .eq('id', user.id)
          .single();

        console.log('ManageLotteries - Profile data:', data);
        console.log('ManageLotteries - Profile error:', error);

        if (data) {
          setUserRole(data.role);
          // Si es admin (banco), su propio ID es el banco ID, si es colector usa id_banco
          const bankId = data.role === 'admin' ? user.id : data.id_banco;
          console.log('ManageLotteries - Calculated bankId:', bankId, 'for role:', data.role);
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
        <Text style={styles.headerTitle}>Gestionar Loterías</Text>
      </View>
        
        <View style={styles.contentContainer}>

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
        refreshControl={
          <RefreshControl
            refreshing={cacheUserRole === 'admin' ? (loading || cacheRefreshing) : false}
            onRefresh={cacheUserRole === 'admin' ? handleRefresh : undefined}
            colors={['#27AE60']}
            tintColor="#27AE60"
          />
        }
        renderItem={({ item }) => (
          <View style={[styles.lotteryCard, { backgroundColor: isDarkMode ? '#2c3e50' : '#fff' }]}>
            <Text style={[styles.lotteryName, { color: isDarkMode ? '#fff' : '#000' }]}>
              {item.nombre}
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={() => openScheduleModal(item)}
                style={[styles.actionButton, styles.scheduleButton]}
              >
                <Text style={styles.actionButtonText}>🕒 Gestionar Horarios</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  console.log('Se hizo clic en eliminar', item.id);
                  handleDeleteLottery(item.id);
                }}
                style={[styles.actionButton, styles.deleteButton]}
              >
                <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Modal para gestionar horarios */}
      <Modal
        visible={scheduleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeScheduleModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? '#2c3e50' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                Horarios de {selectedLottery?.nombre}
              </Text>
              <TouchableOpacity onPress={closeScheduleModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Formulario para agregar/editar horario */}
              <View style={styles.formSection}>
                <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                  {editingSchedule ? 'Editar Horario' : 'Nuevo Horario'}
                </Text>
                
                <InputField
                  placeholder="Nombre del horario (ej: Mediodía, Noche)"
                  value={newSchedule.name}
                  onChangeText={(text) => setNewSchedule(prev => ({ ...prev, name: text }))}
                  isDarkMode={isDarkMode}
                  style={styles.input}
                />

                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={[styles.timeLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                      Hora Inicio (HH:MM):
                    </Text>
                    <InputField
                      placeholder="12:00"
                      value={newSchedule.startTime}
                      onChangeText={(text) => setNewSchedule(prev => ({ ...prev, startTime: text }))}
                      isDarkMode={isDarkMode}
                      style={styles.timeInput}
                    />
                  </View>

                  <View style={styles.timeField}>
                    <Text style={[styles.timeLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                      Hora Fin (HH:MM):
                    </Text>
                    <InputField
                      placeholder="13:00"
                      value={newSchedule.endTime}
                      onChangeText={(text) => setNewSchedule(prev => ({ ...prev, endTime: text }))}
                      isDarkMode={isDarkMode}
                      style={styles.timeInput}
                    />
                  </View>
                </View>

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
                <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                  Horarios Existentes
                </Text>
                
                {schedules.length === 0 ? (
                  <Text style={[styles.emptyText, { color: isDarkMode ? '#bdc3c7' : '#7f8c8d' }]}>
                    No hay horarios configurados
                  </Text>
                ) : (
                  schedules.map((schedule) => (
                    <View key={schedule.id} style={[styles.scheduleCard, { backgroundColor: isDarkMode ? '#34495e' : '#f8f9fa' }]}>
                      <View style={styles.scheduleInfo}>
                        <Text style={[styles.scheduleName, { color: isDarkMode ? '#fff' : '#000' }]}>
                          {schedule.nombre}
                        </Text>
                        <Text style={[styles.scheduleTime, { color: isDarkMode ? '#bdc3c7' : '#7f8c8d' }]}>
                          {formatTime(schedule.hora_inicio)} - {formatTime(schedule.hora_fin)}
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
      </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
    paddingTop: 0, // Sin padding para que el header esté arriba del todo
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
    ...createShadowStyle({
      color: '#000',
      offsetY: 2,
      opacity: 0.1,
      radius: 2,
      elevation: 4,
    }),
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  sidebarButton: {
    marginRight: 16,
    marginLeft: 4,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
    textAlign: 'center',
    marginRight: 44, // Para centrar el texto compensando el botón
  },
  contentContainer: {
    flex: 1,
    padding: 16,
    marginTop: 100, // Espacio para el header fijo (56 + 44 status bar)
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#2ecc71',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  lotteryCard: {
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#ccc',
  },
  lotteryName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  scheduleButton: {
    backgroundColor: '#3498db',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
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
    borderRadius: 12,
    ...createShadowStyle({
      color: '#000',
      offsetY: 2,
      opacity: 0.25,
      radius: 4,
      elevation: 5,
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#e74c3c',
    borderRadius: 4,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  input: {
    marginBottom: 12,
  },
  timeInput: {
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timeField: {
    flex: 1,
    marginHorizontal: 4,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  timePicker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  formButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  saveButton: {
    backgroundColor: '#27ae60',
  },
  formButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  schedulesSection: {
    marginTop: 16,
  },
  emptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
  scheduleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleTime: {
    fontSize: 12,
    marginTop: 2,
  },
  scheduleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  scheduleActionButton: {
    padding: 6,
    borderRadius: 4,
    minWidth: 30,
    alignItems: 'center',
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
});

export default ManageLotteriesScreen;
