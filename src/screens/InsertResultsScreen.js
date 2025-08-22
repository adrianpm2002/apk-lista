import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';
import { useFocusEffect } from '@react-navigation/native';
import { useNotifications, publishTemplate } from '../context/NotificationsContext';
import { USER_ROLES } from '../constants/roles';

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
  const [todayResults, setTodayResults] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [loadingResults, setLoadingResults] = useState(false);
  const [deniedEditId, setDeniedEditId] = useState(null);
  const { add } = useNotifications();

  // Sanitiza la entrada del campo de resultado respetando:
  // - Máximo 7 dígitos
  // - Permitir formato "1234567" o "123 4567"
  // - Ignora otros caracteres
  const sanitizeResultInput = (text) => {
    if (!text) return '';
    // Mantener solo dígitos y espacios
    let cleaned = text.replace(/[^0-9 ]/g, '');
    // Extraer dígitos (tope 7)
    const digits = cleaned.replace(/\D/g, '').slice(0, 7);
  if (digits.length <= 3) return digits; // Aún no insertar espacio
  return digits.slice(0, 3) + ' ' + digits.slice(3);
  };

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
  loadTodayResults();
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

  // Utilidad para rango del día local (created_at es timestamp sin zona)
  const buildLocalDayRange = (base = new Date()) => {
    const pad = (n) => String(n).padStart(2, '0');
    const y = base.getFullYear();
    const m = pad(base.getMonth() + 1);
    const d = pad(base.getDate());
    return {
      start: `${y}-${m}-${d} 00:00:00`,
      end: `${y}-${m}-${d} 23:59:59.999`
    };
  };

  // Cargar resultados del día actual (rango local) directamente desde la consulta
  const loadTodayResults = async () => {
    if (!currentBankId) return;
    setLoadingResults(true);
    const { start, end } = buildLocalDayRange();
    try {
      const { data, error } = await supabase
        .from('resultado')
        .select('id, numeros, created_at, rol, horario:id_horario ( id, nombre, loteria:id_loteria ( id, nombre, id_banco ) )')
        .gte('created_at', start)
        .lte('created_at', end)
        .eq('horario.loteria.id_banco', currentBankId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Ya viene filtrado; no se necesita filtrado en cliente salvo fallback
      setTodayResults(data || []);
    } catch (e) {
      console.error('Error cargando resultados del día:', e.message);
    } finally {
      setLoadingResults(false);
    }
  };

  // Refresco automático al volver a la pantalla
  useFocusEffect(
    useCallback(() => {
      if (currentBankId) {
        loadTodayResults();
        fetchLoterias();
      }
    }, [currentBankId])
  );

  const startEditing = (item) => {
    // Permisos: collector no puede editar resultados de admin
    if (userRole === 'collector' && item.rol === 'admin') {
  setDeniedEditId(item.id);
  // Limpiar después de 5 segundos
  setTimeout(() => setDeniedEditId(prev => (prev === item.id ? null : prev)), 5000);
      return;
    }
    setEditingId(item.id);
    const raw = item.numeros.replace(/\D/g, '');
    setEditingValue(raw);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const saveEditing = async () => {
    if (!editingId) return;
    const digits = editingValue.trim().replace(/\D/g, '');
    if (digits.length !== 7) {
      Alert.alert('Error', 'El resultado debe tener exactamente 7 números');
      return;
    }
    const formatted = digits.substring(0,3) + ' ' + digits.substring(3,7);
    const { error } = await supabase
      .from('resultado')
      .update({ numeros: formatted })
      .eq('id', editingId);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
  // Actualizar localmente para respuesta más rápida
  setTodayResults(prev => prev.map(r => r.id === editingId ? { ...r, numeros: formatted } : r));
    cancelEditing();
  // Se puede refrescar silenciosamente en background
  loadTodayResults();
  };

  const deleteResult = async (item) => {
    if (userRole === 'collector' && item.rol === 'admin') {
      Alert.alert('Acceso denegado', 'Ese resultado lo subió un banco y no puede eliminarse.');
      return;
    }
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('¿Eliminar este resultado?');
      if (!confirmed) return;
      const { error } = await supabase.from('resultado').delete().eq('id', item.id);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      setTodayResults(prev => prev.filter(r => r.id !== item.id));
      loadTodayResults();
      return;
    }
    Alert.alert('Confirmar', '¿Eliminar este resultado?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('resultado').delete().eq('id', item.id);
        if (error) {
          Alert.alert('Error', error.message);
          return;
        }
        setTodayResults(prev => prev.filter(r => r.id !== item.id));
        loadTodayResults();
      }}
    ]);
  };
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
        rol: userRole || 'collector',
      }
    ]);

    if (error) {
      console.error('Error Supabase:', error);
      Alert.alert('Error al guardar', error.message);
      return;
    }

  Alert.alert('Éxito', 'Resultado guardado correctamente');

    // Notificaciones: Collector (5: resultados insertados), Listero (10: resultados publicados)
    try {
      publishTemplate(add, 'collector.5', { detalle: `Resultado ${cleanResult} para ${selectedLotteryLabel} (${selectedHorarioLabel})` });
      publishTemplate(add, 'listero.10', { detalle: `Resultados disponibles en ${selectedLotteryLabel} (${selectedHorarioLabel})` });
    } catch {}
    
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

  // Recargar lista de hoy
  loadTodayResults();
  };


  return (
    <View style={styles.container}>
      {/* Header personalizado - arriba del todo */}
      <View style={styles.customHeader}>
        <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
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
            const sanitized = sanitizeResultInput(text);
            setResult(sanitized);
            if (sanitized.replace(/\D/g, '').length === 7) {
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

        {/* Listado resultados hoy */}
        <View style={styles.todayContainer}>
          <Text style={styles.todayTitle}>Resultados de Hoy</Text>
          {loadingResults && (
            <Text style={styles.loadingText}>Cargando...</Text>
          )}
          {!loadingResults && todayResults.length === 0 && (
            <Text style={styles.emptyText}>No hay resultados registrados hoy.</Text>
          )}
          {!loadingResults && todayResults.map(item => {
            const isEditing = editingId === item.id;
            return (
              <View key={item.id} style={[styles.resultRow, item.id === deniedEditId && styles.resultRowDenied]}>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultLottery}>{item.horario?.loteria?.nombre || 'Lotería'}</Text>
                  <Text style={styles.resultHorario}>{item.horario?.nombre || 'Horario'}</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.editInput}
                      value={editingValue.length > 3 ? editingValue.slice(0,3) + ' ' + editingValue.slice(3) : editingValue}
                      onChangeText={(text)=> {
                        const digits = text.replace(/\D/g,'').slice(0,7);
                        setEditingValue(digits);
                      }}
                      keyboardType="numeric"
                      placeholder="7 dígitos"
                      // maxLength 8 (7 dígitos + espacio); el filtrado asegura 7 dígitos
                      maxLength={8}
                    />
                  ) : (
                    <Text style={styles.resultNumber}>{item.numeros}</Text>
                  )}
                  {item.id === deniedEditId && (
                    <Text style={styles.deniedText}>Este resultado fue subido por el banco, no es posible editar.</Text>
                  )}
                </View>
                <View style={styles.resultActions}>
                  {isEditing ? (
                    <>
                      <Pressable style={styles.actionBtnSave} onPress={saveEditing}>
                        <Text style={styles.actionText}>💾</Text>
                      </Pressable>
                      <Pressable style={styles.actionBtnCancel} onPress={cancelEditing}>
                        <Text style={styles.actionText}>✕</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable style={styles.actionBtn} onPress={() => startEditing(item)}>
                        <Text style={styles.actionText}>✎</Text>
                      </Pressable>
                      <Pressable style={styles.actionBtnDelete} onPress={() => deleteResult(item)}>
                        <Text style={styles.actionText}>🗑️</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            );
          })}
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
  todayContainer: {
    marginTop: 30,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  todayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 10
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B'
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8'
  },
  resultRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    alignItems: 'flex-start'
  },
  resultInfo: {
    flex: 1
  },
  resultLottery: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155'
  },
  resultHorario: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4
  },
  resultNumber: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#1E293B'
  },
  resultRole: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B'
  },
  resultActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8
  },
  actionBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginLeft: 6
  },
  actionBtnDelete: {
    backgroundColor: '#EF4444',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginLeft: 6
  },
  // Aumentar área táctil opcional mediante hitSlop al usar
  actionBtnSave: {
    backgroundColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginLeft: 6
  },
  actionBtnCancel: {
    backgroundColor: '#64748B',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginLeft: 6
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  resultRowDenied: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444'
  },
  deniedText: {
    marginTop: 6,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '500'
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 16,
    color: '#1E293B',
    marginTop: 4,
    width: 120
  }
});
