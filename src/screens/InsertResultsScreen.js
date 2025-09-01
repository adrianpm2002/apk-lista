import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet, Pressable, TextInput, Platform, RefreshControl } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';
import { useFocusEffect } from '@react-navigation/native';
import { useCache } from '../contexts/CacheContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';

const InsertResultsScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  return (
    <ScreenWrapper>
      <InsertResultsContent
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
      />
    </ScreenWrapper>
  );
};

const InsertResultsContent = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  const { 
    cache, 
    userRole: cacheUserRole, 
    currentBankId: cacheBankId, 
    updateCacheData, 
    fetchTodayResults, 
    fetchLotteries, 
    fetchSchedules,
    preloadAllData
  } = useCache();
  const { refreshing: cacheRefreshing, onRefresh: cacheOnRefresh } = usePullToRefresh('todayResults');
  
  // Inicializar con datos del cache
  const [lotteryOptions, setLotteryOptions] = useState(
    cache.lotteries ? cache.lotteries.map(l => ({ label: l.nombre, value: l.id })) : []
  );
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [selectedLotteryLabel, setSelectedLotteryLabel] = useState('');
  const [horarioOptions, setHorarioOptions] = useState([]);
  const [selectedHorario, setSelectedHorario] = useState(null);
  const [selectedHorarioLabel, setSelectedHorarioLabel] = useState('');
  const [result, setResult] = useState('');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(cacheUserRole); // Usar cache como inicial
  const [currentBankId, setCurrentBankId] = useState(cacheBankId); // Usar cache como inicial
  const [todayResults, setTodayResults] = useState(cache.todayResults || []); // Inicializar con cache
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [loadingResults, setLoadingResults] = useState(false); // Optimizado para cache
  const [deniedEditId, setDeniedEditId] = useState(null);
  const [initialLoading, setInitialLoading] = useState(!(cache.lotteries && cache.schedules)); // Loading solo si no hay datos

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

  // ========== CACHE SYNCHRONIZATION ==========
  // Sincronizar userRole y bankId con cache
  useEffect(() => {
    if (cacheUserRole) {
      setUserRole(cacheUserRole);
    }
  }, [cacheUserRole]);

  useEffect(() => {
    if (cacheBankId) {
      setCurrentBankId(cacheBankId);
    }
  }, [cacheBankId]);

  // Sincronizar con cache para todayResults
  useEffect(() => {
    if (cache.todayResults) {
      setTodayResults(cache.todayResults);
    }
  }, [cache.todayResults]);

  // Sincronizar con cache para loterias
  useEffect(() => {
    if (cache.lotteries) {
      const options = cache.lotteries.map(lottery => ({
        label: lottery.nombre,
        value: lottery.id
      }));
      setLotteryOptions(options);
    }
  }, [cache.lotteries]);

  // Estados para errores de validación
  const [errors, setErrors] = useState({
    lottery: false,
    horario: false,
    result: false
  });

  // ========== DATA FETCHING ==========
  const fetchAllDataFromCache = async () => {
    if (!cacheBankId) {
      console.log('No bank ID available for fetching data');
      setInitialLoading(false);
      return;
    }
    
    try {
      setInitialLoading(true);
      // Precargar todos los datos necesarios
      await preloadAllData();
      setInitialLoading(false);
    } catch (error) {
      console.error('Error fetching data from cache:', error);
      setInitialLoading(false);
    }
  };

  // ========== FOCUS REFRESH ==========
  const focusRefresh = useCallback(() => {
    if (cacheBankId) {
      // Actualizar datos en background sin bloquear UI
      setTimeout(() => {
        fetchTodayResults();
        fetchLotteries();
        fetchSchedules();
      }, 100);
    }
  }, [cacheBankId, fetchTodayResults, fetchLotteries, fetchSchedules]);

  // Función optimizada para cargar loterías desde cache
  const fetchLoteriasFromCache = async () => {
    if (!cacheBankId) return;
    
    // Usar cache primero si está disponible
    if (cache.lotteries && cache.lotteries.length > 0) {
      const options = cache.lotteries.map((l) => ({ label: l.nombre, value: l.id }));
      setLotteryOptions(options);
      return;
    }
    
    // Solo hacer fetch si no hay datos en cache
    await fetchLotteries();
  };

  const fetchHorarios = async (lotteryId) => {
    if (!lotteryId) {
      setHorarioOptions([]);
      setSelectedHorario(null);
      setSelectedHorarioLabel('');
      return;
    }

    // Usar datos del cache filtrados por banco y lotería específica
    const availableSchedules = cache.schedules?.filter(schedule => 
      schedule.id_loteria === lotteryId && 
      schedule.loteria?.id_banco === cacheBankId
    ) || [];

    if (availableSchedules.length === 0) {
      setHorarioOptions([]);
      setSelectedHorario(null);
      setSelectedHorarioLabel('');
      return;
    }

    const options = availableSchedules.map((h) => ({ 
      label: `${h.nombre} (${h.hora_inicio.slice(0,5)} - ${h.hora_fin.slice(0,5)})`, 
      value: h.id 
    }));
    setHorarioOptions(options);
    setSelectedHorario(null);
    setSelectedHorarioLabel('');
  };

  useEffect(() => {
    if (cacheBankId) {
      fetchLoteriasFromCache();
      loadTodayResultsFromCache();
    }
  }, [cacheBankId]);

  // ========== INITIAL DATA LOADING ==========
  useEffect(() => {
    if (cacheBankId && initialLoading) {
      fetchAllDataFromCache();
    }
  }, [cacheBankId, initialLoading]);

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

  // Cargar resultados del día actual usando cache primero
  const loadTodayResultsFromCache = async () => {
    if (!cacheBankId) return;
    
    // Usar cache primero si está disponible
    if (cache.todayResults !== null && cache.todayResults !== undefined) {
      setTodayResults(cache.todayResults);
      setLoadingResults(false);
      return;
    }
    
    // Solo hacer fetch si no hay datos en cache
    setLoadingResults(true);
    try {
      await fetchTodayResults();
      setLoadingResults(false);
    } catch (error) {
      console.error('Error loading today results from cache:', error);
      setLoadingResults(false);
    }
  };

  // Función legacy - cargar resultados del día actual (rango local) directamente desde la consulta
  const loadTodayResults = async () => {
    if (!cacheBankId) return;
    setLoadingResults(true);
    const { start, end } = buildLocalDayRange();
    try {
      const { data, error } = await supabase
        .from('resultado')
        .select('id, numeros, created_at, rol, horario:id_horario ( id, nombre, loteria:id_loteria ( id, nombre, id_banco ) )')
        .gte('created_at', start)
        .lte('created_at', end)
        .eq('horario.loteria.id_banco', cacheBankId)
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

  // Refresco automático al volver a la pantalla - solo actualizar cache en background
  useFocusEffect(
    useCallback(() => {
      focusRefresh();
    }, [focusRefresh])
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
    
    // Actualizar cache
    await updateCacheData('todayResults');
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
      
      // Actualizar cache
      await updateCacheData('todayResults');
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
        
        // Actualizar cache
        await updateCacheData('todayResults');
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
      // Validar que el horario pertenece al banco actual (seguridad)
      const isValidSchedule = cache.schedules?.some(
        s => s.id === selectedHorario && s.loteria?.id_banco === cacheBankId
      );
      
      if (!isValidSchedule) {
        setErrors(prev => ({ ...prev, horario: true }));
        hasErrors = true;
        errorMessages.push('- Horario no válido para este banco');
        console.error('Security validation failed: schedule does not belong to current bank');
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

    // Recargar lista de hoy usando cache
    await updateCacheData('todayResults');
  };

  // Función de refresh optimizada para ambos roles
  const handleRefresh = async () => {
    try {
      setLoadingResults(true);
      // Actualizar datos usando las funciones del cache context
      await Promise.all([
        fetchTodayResults(),
        fetchLotteries(),
        fetchSchedules()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoadingResults(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#1a1a1a' : '#F8FDF5' }]}>
      {/* Header personalizado - arriba del todo */}
      <View style={[styles.customHeader, { backgroundColor: isDarkMode ? '#2c3e50' : '#F8F9FA' }]}>
        <SideBarToggle 
          inline 
          onToggle={() => setSidebarVisible(!sidebarVisible)} 
          style={styles.sidebarButton} 
        />
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#2C3E50' }]}>
          Resultados
        </Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={cacheRefreshing || loadingResults}
            onRefresh={cacheOnRefresh}
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
          <Text style={[styles.todayTitle, { color: isDarkMode ? '#ecf0f1' : '#2C3E50' }]}>
            Resultados de Hoy
          </Text>
          
          {(loadingResults || initialLoading) && (
            <Text style={[styles.loadingText, { color: isDarkMode ? '#bdc3c7' : '#64748B' }]}>
              Cargando...
            </Text>
          )}
          {!loadingResults && !initialLoading && todayResults.length === 0 && (
            <Text style={[styles.emptyText, { color: isDarkMode ? '#bdc3c7' : '#94A3B8' }]}>
              No hay resultados registrados hoy.
            </Text>
          )}
          {!loadingResults && !initialLoading && todayResults.map(item => {
            const isEditing = editingId === item.id;
            return (
              <View key={item.id} style={[
                styles.resultRow, 
                { backgroundColor: isDarkMode ? '#2c3e50' : '#FFFFFF' },
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
    height: 100,
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
    marginTop: 50,
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
