import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet, Pressable, TextInput, Platform, RefreshControl, BackHandler } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';
import { useFocusEffect } from '@react-navigation/native';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';
import { createCommonDarkStyles, createFormDarkStyles, DarkTheme, LightTheme } from '../utils/darkModeStyles';
import { useDarkMode } from '../contexts/UnifiedDarkModeContext';

const InsertResultsScreen = ({ navigation, onModeVisibilityChange }) => {
  return (
    <ScreenWrapper>
      <InsertResultsContent
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
      />
    </ScreenWrapper>
  );
};

const InsertResultsContent = ({ navigation, onModeVisibilityChange }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  
  // Crear estilos adaptativos para modo oscuro
  const commonStyles = createCommonDarkStyles(isDarkMode);
  const formStyles = createFormDarkStyles(isDarkMode);
  
  // Estados locales
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  // Funciones para obtener datos directamente
  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase.from('profiles').select('role, id_banco').eq('id', user.id).single();
        if (profile && !error) {
          setUserRole(profile.role);
          // Usar la misma lógica que otras pantallas para obtener bankId
          const bankId = profile.role === 'admin' ? user.id : profile.id_banco;
          setCurrentBankId(bankId);
        } else {
          console.error('Error loading user profile:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchLotteries = async (bankId) => {
    if (!bankId) {
      setLotteryOptions([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('loteria')
        .select('id, nombre')
        .eq('id_banco', bankId)
        .order('nombre');
      
      if (error) {
        console.error('Error fetching lotteries:', error);
        setLotteryOptions([]);
        return;
      }
      
      if (!data || data.length === 0) {
        setLotteryOptions([]);
        return;
      }
      
      const options = data.map(lottery => ({
        label: lottery.nombre,
        value: lottery.id
      }));
      
      setLotteryOptions(options);
    } catch (error) {
      console.error('Error fetching lotteries:', error);
      setLotteryOptions([]);
    }
  };

  const fetchTodayResults = async (bankId) => {
    if (!bankId) return;
    setLoadingResults(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const startStr = `${today}T00:00:00.000Z`;
      const endStr = `${today}T23:59:59.999Z`;

      const { data, error } = await supabase
        .from('resultado')
        .select(`
          id, numeros, created_at, id_horario,
          horario!inner(
            id, nombre, hora_inicio, hora_fin, id_loteria,
            loteria!inner(id, nombre, id_banco)
          )
        `)
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .eq('horario.loteria.id_banco', bankId);

      if (error) throw error;

      setTodayResults(data || []);
    } catch (error) {
      console.error('Error fetching today results:', error);
    } finally {
      setLoadingResults(false);
    }
  };

  // Estados para errores de validación
  const [errors, setErrors] = useState({
    lottery: false,
    horario: false,
    result: false
  });

  // ========== ANDROID BACK HANDLER ==========
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert(
          'Cerrar Aplicación',
          '¿Estás seguro de que quieres salir?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', onPress: () => BackHandler.exitApp() }
          ]
        );
        return true; // Prevenir navegación hacia atrás
      });

      return () => backHandler.remove();
    }
  }, []);

  // ========== INITIAL DATA LOADING ==========
  useEffect(() => {
    const timeoutId = setTimeout(fetchUserProfile, 10);
    return () => clearTimeout(timeoutId);
  }, []); // Solo al montar el componente

  // ========== LOAD DATA WHEN BANK ID IS AVAILABLE ==========
  useEffect(() => {
    if (currentBankId) {
      fetchLotteries(currentBankId);
      fetchTodayResults(currentBankId);
    }
    // Siempre detener el loading inicial después de intentar cargar el perfil
    setInitialLoading(false);
  }, [currentBankId]); // Cuando cambie el bankId

  // ========== FORCE RE-RENDER WHEN OPTIONS CHANGE ==========
  useEffect(() => {
    // Forzar actualización del componente cuando cambien las opciones
    if (lotteryOptions.length > 0 && !selectedLottery) {
      // Opcional: auto-seleccionar la primera lotería si solo hay una
      if (lotteryOptions.length === 1) {
        const firstOption = lotteryOptions[0];
        setSelectedLottery(firstOption.value);
        setSelectedLotteryLabel(firstOption.label);
        fetchHorarios(firstOption.value);
      }
    }
  }, [lotteryOptions]);

  // Refrescar datos cuando se regresa a la pantalla
  useFocusEffect(
    React.useCallback(() => {
      if (currentBankId) {
        fetchTodayResults(currentBankId);
        fetchLotteries(currentBankId);
      }
    }, [currentBankId])
  );

  // ========== REFRESH HANDLER ==========
  const handleRefresh = async () => {
    if (!currentBankId) return;
    
    setRefreshing(true);
    try {
      await Promise.all([
        fetchLotteries(currentBankId),
        fetchTodayResults(currentBankId)
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };





  const fetchHorarios = async (lotteryId) => {
    if (!lotteryId || !currentBankId) {
      setHorarioOptions([]);
      setSelectedHorario(null);
      setSelectedHorarioLabel('');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('horario')
        .select('id, nombre, hora_inicio, hora_fin')
        .eq('id_loteria', lotteryId)
        .order('hora_inicio');

      if (error) {
        console.error('Error fetching schedules:', error);
        setHorarioOptions([]);
        setSelectedHorario(null);
        setSelectedHorarioLabel('');
        return;
      }

      const options = (data || []).map((h) => ({ 
        label: `${h.nombre} (${h.hora_inicio.slice(0,5)} - ${h.hora_fin.slice(0,5)})`, 
        value: h.id 
      }));
      setHorarioOptions(options);
      setSelectedHorario(null);
      setSelectedHorarioLabel('');
    } catch (error) {
      console.error('Error in fetchHorarios:', error);
      setHorarioOptions([]);
      setSelectedHorario(null);
      setSelectedHorarioLabel('');
    }
  };



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

  // Función legacy - cargar resultados del día actual (rango local) directamente desde la consulta
  const loadTodayResults = async () => {
    if (!currentBankId) {
      return;
    }
    
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
      
      if (error) {
        console.error('[InsertResults] ❌ Error en consulta Supabase:', error);
        throw error;
      }
      
      // Ya viene filtrado; no se necesita filtrado en cliente salvo fallback
      setTodayResults(data || []);
    } catch (e) {
      console.error('[InsertResults] ❌ Error cargando resultados del día:', e.message);
    } finally {
      setLoadingResults(false);
    }
  };



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
    const updatePayload = userRole === 'admin' ? { numeros: formatted, rol: 'admin' } : { numeros: formatted };
    
    const { error } = await supabase
      .from('resultado')
      .update(updatePayload)
      .eq('id', editingId);
      
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    
    // Actualizar localmente para respuesta más rápida
    setTodayResults(prev => prev.map(r => r.id === editingId ? { ...r, numeros: formatted } : r));
    cancelEditing();
    
    // Recargar resultados después de actualizar
    await fetchTodayResults(currentBankId);
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
    } else {
      // Validar que el horario es uno de los disponibles (seguridad básica)
      const isValidSchedule = horarioOptions.some(h => h.value === selectedHorario);
      
      if (!isValidSchedule) {
        setErrors(prev => ({ ...prev, horario: true }));
        hasErrors = true;
        errorMessages.push('- Horario no válido');
        console.error('Security validation failed: schedule not in available options');
      }
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

    // Comprobar si ya existe resultado hoy para este horario
    const { start, end } = buildLocalDayRange();
    const { data: existing, error: existErr } = await supabase
      .from('resultado')
      .select('id, created_at')
      .eq('id_horario', selectedHorario)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false })
      .limit(1);
    if (existErr) {
      Alert.alert('Error', 'No se pudo verificar existencia previa. Intenta de nuevo.');
      return;
    }

    if (existing && existing.length) {
      // Ya existe uno hoy para este horario
      if ((userRole || 'collector') === 'admin') {
        // Banco: actualiza el existente y promueve rol a admin
        const { error: upErr } = await supabase
          .from('resultado')
          .update({ numeros: cleanResult, rol: 'admin' })
          .eq('id', existing[0].id);
        if (upErr) {
          Alert.alert('Error', upErr.message);
          return;
        }
        Alert.alert('Actualizado', 'Resultado actualizado para este horario.');
      } else {
        // Collector: bloquear
        Alert.alert(
          'Resultado ya registrado', 
          'Ya se ha registrado un resultado para este horario hoy. No se pueden registrar resultados duplicados para el mismo horario en el mismo día.',
          [{ text: 'Entendido', style: 'default' }]
        );
        return;
      }
    } else {
      // No existe: insertar nuevo
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
    }
    
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

    // Recargar lista de resultados de hoy
    await fetchTodayResults(currentBankId);
  };



  return (
    <View style={[styles.container, commonStyles.container]}>
      {/* Header personalizado - arriba del todo */}
      <View style={[styles.customHeader, commonStyles.header]}>
        <SideBarToggle 
          inline 
          onToggle={() => setSidebarVisible(!sidebarVisible)} 
          style={styles.sidebarButton} 
        />
        <Text style={[styles.headerTitle, commonStyles.textPrimary]}>
          Resultados
        </Text>
      </View>

      <ScrollView 
        style={[styles.content, commonStyles.containerSecondary]} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loadingResults}
            onRefresh={handleRefresh}
            colors={isDarkMode ? ['#3498db'] : ['#27AE60']}
            tintColor={isDarkMode ? '#3498db' : '#27AE60'}
          />
        }
      >
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
          isDarkMode={isDarkMode}
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
          isDarkMode={isDarkMode}
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
          isDarkMode={isDarkMode}
        />

        <ActionButton
          title="Insertar Resultado"
          onPress={handleInsert}
          variant="success"
          size="medium"
          style={styles.submitButton}
          isDarkMode={isDarkMode}
        />

        {/* Listado resultados hoy */}
        <View style={styles.todayContainer}>
          <Text style={[styles.todayTitle, commonStyles.textPrimary]}>
            Resultados de Hoy
          </Text>
          
          {(loadingResults || initialLoading) && (
            <Text style={[styles.loadingText, commonStyles.textSecondary]}>
              Cargando...
            </Text>
          )}
          {!loadingResults && !initialLoading && todayResults.length === 0 && (
            <Text style={[styles.emptyText, commonStyles.textTertiary]}>
              No hay resultados registrados hoy.
            </Text>
          )}
          {!loadingResults && !initialLoading && todayResults.map(item => {
            const isEditing = editingId === item.id;
            return (
              <View key={item.id} style={[
                styles.resultRow, 
                commonStyles.card,
                item.id === deniedEditId && styles.resultRowDenied
              ]}>
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultLottery, { color: isDarkMode ? '#ecf0f1' : '#334155' }]}>
                    {item.horario?.loteria?.nombre || 'Lotería'}
                  </Text>
                  <Text style={[styles.resultHorario, { color: isDarkMode ? '#bdc3c7' : '#64748B' }]}>
                    {item.horario?.nombre || 'Horario'}
                  </Text>
                  {isEditing ? (
                    <TextInput
                      style={[
                        styles.editInput,
                        {
                          backgroundColor: isDarkMode ? '#34495e' : '#FFFFFF',
                          borderColor: isDarkMode ? '#566175' : '#CBD5E1',
                          color: isDarkMode ? '#ecf0f1' : '#1E293B'
                        }
                      ]}
                      value={editingValue.length > 3 ? editingValue.slice(0,3) + ' ' + editingValue.slice(3) : editingValue}
                      onChangeText={(text)=> {
                        const digits = text.replace(/\D/g,'').slice(0,7);
                        setEditingValue(digits);
                      }}
                      keyboardType="numeric"
                      placeholder="7 dígitos"
                      placeholderTextColor={isDarkMode ? '#7f8c8d' : '#94A3B8'}
                      maxLength={8}
                    />
                  ) : (
                    <Text style={[styles.resultNumber, { color: isDarkMode ? '#ecf0f1' : '#1E293B' }]}>
                      {item.numeros}
                    </Text>
                  )}
                  {item.id === deniedEditId && (
                    <Text style={[styles.deniedText, { color: isDarkMode ? '#e74c3c' : '#B91C1C' }]}>
                      Este resultado fue subido por el banco, no es posible editar.
                    </Text>
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
        onToggleDarkMode={toggleDarkMode}
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
    height: Platform.OS === 'android' ? 70 : 100,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    marginRight: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: Platform.OS === 'android' ? 75 : 105, // Ajustado para coincidir con altura del header más un pequeño espacio
  },
  submitButton: {
    marginTop: 10,
    width: '100%',
  },
  todayContainer: {
    marginTop: 15,
    paddingVertical: 5,
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
