import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  ScrollView,
  Dimensions,
  StyleSheet,
  Alert,
  Platform,
  TextInput,
  BackHandler,
  StatusBar,
} from 'react-native';
import { supabase } from '../supabaseClient';
import ChangePasswordModal from './ChangePasswordModal';
import { createShadowStyle } from '../utils/shadowUtils';
import { getAccessibilityProps } from '../utils/accessibilityUtils';

const { width: screenWidth } = Dimensions.get('window');

const SideBar = ({ isVisible, onClose, onOptionSelect, navigation, onModeVisibilityChange, role, visibleModes: incomingVisibleModes }) => {

  const sidebarWidth = screenWidth * 0.75;
  // Inicializar slideAnim con validación
  const slideAnim = useRef(new Animated.Value(isNaN(sidebarWidth) ? -300 : -sidebarWidth)).current;
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  // Vista interna del modal de configuración: 'root' o 'modes' (Modos Visibles)
  const [settingsView, setSettingsView] = useState('root');
  // Toast de confirmación
  const [toastMsg, setToastMsg] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [visibleModes, setVisibleModes] = useState({
    visual: true,
    text: true,
    text2: true,
    vault: true,
  });
  
  // Sincronizar con estado externo si llega
  useEffect(() => {
    if (incomingVisibleModes && typeof incomingVisibleModes === 'object') {
      setVisibleModes(prev => ({ ...prev, ...incomingVisibleModes }));
    }
  }, [incomingVisibleModes]);

  // Cargar estado del modo santiago cuando es admin
  useEffect(() => {
    if (role === 'admin') {
      loadModoSantiago();
    }
  }, [role]);
  // Modal de cambio de contraseña independiente
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  
  // Estado para modo santiago (solo para admin/banco)
  const [modoSantiago, setModoSantiago] = useState(false);
  const [loadingModoSantiago, setLoadingModoSantiago] = useState(false);
  const [porcentajeSantiago, setPorcentajeSantiago] = useState(100);
  const [loadingPorcentaje, setLoadingPorcentaje] = useState(false);

  // Opciones del sidebar por rol
const roleOptionsMap = {
  admin: [
    { id: 'statistics', icon: '📈', title: 'Estadísticas' },
    { id: 'insertResults', icon: '🎯', title: 'Resultados' },
    { id: 'createUser', icon: '🧑‍💼', title: 'Usuarios' },
    { id: 'lotteries', icon: '🎰', title: 'Loterías' },
    { id: 'lotteryLimits', icon: '🚫', title: 'Límites de Loterías' },
    { id: 'jugadas', icon: '🎲', title: 'Jugadas' },
    { id: 'prices', icon: '💰', title: 'Precios' },
    { id: 'limitedNumbers', icon: '📊', title: 'Límites' },
    { id: 'bankCapacity', icon: '🔋', title: 'Capacidad del Banco' },
    { id: 'settings', icon: '⚙️', title: 'Configuración' },
  ],
  collector: [
    // Solo las pantallas permitidas para collector, sin Reportes
    { id: 'statistics', icon: '📈', title: 'Estadísticas' },
    { id: 'insertResults', icon: '🎯', title: 'Resultados' },
    { id: 'createUser', icon: '🧑‍💼', title: 'Usuarios' },
    { id: 'settings', icon: '⚙️', title: 'Configuración' },
  ],
  listero: [
  { id: 'play', icon: '🎮', title: 'Inicio' },
  { id: 'pendingPlays', icon: '📤', title: 'Jugadas Pendientes' },
  { id: 'statistics', icon: '📈', title: 'Estadísticas' },
  { id: 'insertResults', icon: '🎯', title: 'Resultados' },
  { id: 'settings', icon: '⚙️', title: 'Configuración' },
  ]
};

// Opciones básicas que siempre están disponibles (solo para casos extremos)
const basicOptions = [
  { id: 'settings', title: 'Configuración', icon: '⚙️' },
  { id: 'logout', title: 'Cerrar Sesión', icon: '🚪', action: 'logout' },
];

// Selección de opciones dinámicamente según rol - mostrar loading si no hay rol
const configOptions = role ? roleOptionsMap[role] : null;


  // Animación del sidebar
  useEffect(() => {
    if (!slideAnim) {
      return;
    }

    try {
      if (isVisible) {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: Platform.OS === 'android' ? 250 : 300,
          useNativeDriver: Platform.OS !== 'web', // Solo usar native driver en móvil
        }).start();
      } else {
        Animated.timing(slideAnim, {
          toValue: -sidebarWidth,
          duration: Platform.OS === 'android' ? 200 : 300,
          useNativeDriver: Platform.OS !== 'web', // Solo usar native driver en móvil
        }).start();
      }
    } catch (error) {
      // Fallback sin animación
      slideAnim.setValue(isVisible ? 0 : -sidebarWidth);
    }
  }, [isVisible, sidebarWidth]);

  // Cleanup de animaciones
  useEffect(() => {
    return () => {
      if (slideAnim) {
        slideAnim.stopAnimation();
      }
    };
  }, []);

  // Manejo del botón back de Android para el modal
  useEffect(() => {
    if (Platform.OS === 'android' && modalVisible) {
      const backAction = () => {
        if (settingsView === 'modes') {
          backToSettingsRoot();
          return true; // Prevenir default back action
        } else {
          closeModal();
          return true; // Prevenir default back action
        }
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }
  }, [modalVisible, settingsView]);

  const handleClose = () => {
    onClose && onClose();
  };

  const handleOptionPress = (option) => {
    switch (option.id) {
    case 'createUser':
      handleClose();
      navigation.navigate('CreateUser');
      break;
    case 'insertResults':
      handleClose();
      navigation.navigate('Bankview');
      break;
    case 'lotteries':
      handleClose();
      navigation.navigate('ManageLotteries');
      break;
    case 'jugadas':
      handleClose();
      navigation.navigate('Jugadas');
      break;
    case 'lotteryLimits':
      handleClose();
      navigation.navigate('LotteryLimits');
      break;
    case 'prices':
      handleClose();
      navigation.navigate('ManagePrices');
      break;
    case 'listerLimits':
      handleClose();
      navigation.navigate('NumberLimits');
      break;
    case 'limitedNumbers':
      handleClose();
      navigation.navigate('NumberLimits');
      break;
    case 'statistics':
      handleClose();
      navigation.navigate('Statistics');
      break;
    case 'bankCapacity':
      handleClose();
      navigation.navigate('BankCapacity');
      break;
    case 'collectorStatistics':
      handleClose();
      navigation.navigate('CollectorStatistics');
      break;
    case 'pendingPlays':
      handleClose();
      navigation.navigate('PendingPlays');
      break;
    case 'play':
      handleClose();
      navigation.navigate('MainApp');
      break;
    case 'settings':
      setModalContent(option);
      setModalVisible(true);
      // NO cerrar el sidebar para configuración - el modal se maneja independientemente
      break;
    default:
      handleClose();
      Alert.alert('Opción aún no implementada');
  }
};


  const closeModal = () => {
    setModalVisible(false);
    setModalContent(null);
    setSettingsView('root');
    // Cerrar el sidebar también cuando se cierre el modal de configuración
    handleClose();
  };

  const handleLogout = () => {
    const proceed = async () => {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // ignorar error de signOut para no bloquear la navegación
      }
      handleClose();
      if (navigation && navigation.reset) {
        // Usar reset en lugar de navigate para prevenir navegación hacia atrás
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (navigation && navigation.navigate) {
        navigation.navigate('Login');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        proceed();
      }
    } else {
      Alert.alert(
        'Cerrar Sesión',
        '¿Estás seguro de que quieres cerrar sesión?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar Sesión', style: 'destructive', onPress: proceed }
        ]
      );
    }
  };

  // Estados para configuraciones
  const [keepSessionActive, setKeepSessionActive] = useState(false);

  // Función para manejar "Mantener sesión iniciada"
  const handleKeepSessionPress = () => {
    Alert.alert(
      'Mantener sesión iniciada',
      `Actualmente: ${keepSessionActive ? 'Activado' : 'Desactivado'}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: keepSessionActive ? 'Desactivar' : 'Activar', 
          onPress: () => {
            setKeepSessionActive(!keepSessionActive);
          }
        }
      ]
    );
  };

  // Función para manejar "Patrón de seguridad"
  const handleSecurityPatternPress = () => {
    Alert.alert(
      'Patrón de seguridad',
      '¿Qué deseas hacer?',
      [
        { 
          text: 'Configurar nuevo patrón', 
          onPress: () => {
            Alert.alert(
              'Configurar patrón',
              'Funcionalidad en desarrollo. Permitirá configurar un patrón de 9 puntos para desbloquear la aplicación.',
              [{ text: 'OK' }]
            );
          }
        },
        { 
          text: 'Desactivar patrón', 
          onPress: () => {
            Alert.alert(
              'Desactivar patrón',
              '¿Estás seguro de que deseas desactivar el patrón de seguridad?',
              [
                { text: 'Cancelar', style: 'cancel' },
                { 
                  text: 'Desactivar', 
                  style: 'destructive',
                  onPress: () => {
                    // Patrón desactivado
                  }
                }
              ]
            );
          }
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  // Abre la vista de Modos Visibles dentro del mismo modal de Configuración
  const handleModeVisibilityPress = () => {
    setSettingsView('modes');
  };

  // Cargar estado del modo santiago desde la base de datos
  const loadModoSantiago = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('modo_santiago, porciento')
        .eq('id', user.id)
        .single();

      if (!error && profile) {
        setModoSantiago(profile.modo_santiago || false);
        setPorcentajeSantiago(profile.porciento || 100);
      }
    } catch (error) {
      // Error silencioso en modo producción
    }
  };

  // Alternar estado del modo santiago
  const toggleModoSantiago = async () => {
    if (loadingModoSantiago) return;
    
    setLoadingModoSantiago(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newValue = !modoSantiago;
      
      const { error } = await supabase
        .from('profiles')
        .update({ modo_santiago: newValue })
        .eq('id', user.id);

      if (!error) {
        setModoSantiago(newValue);
        showToast(`Modo Santiago ${newValue ? 'activado' : 'desactivado'}`);
      } else {
        Alert.alert('Error', 'No se pudo actualizar el modo santiago');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el modo santiago');
    } finally {
      setLoadingModoSantiago(false);
    }
  };

  // Actualizar porcentaje de modo santiago
  const updatePorcentajeSantiago = async (newPorcentaje) => {
    if (loadingPorcentaje) return;
    
    setLoadingPorcentaje(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ porciento: newPorcentaje })
        .eq('id', user.id);

      if (!error) {
        setPorcentajeSantiago(newPorcentaje);
        showToast(`Porcentaje actualizado a ${newPorcentaje}%`);
      } else {
        Alert.alert('Error', 'No se pudo actualizar el porcentaje');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el porcentaje');
    } finally {
      setLoadingPorcentaje(false);
    }
  };

  // Función para mostrar toast de confirmación
  const showToast = (message) => {
    setToastMsg(message);
    toastOpacity.stopAnimation();
    toastOpacity.setValue(0);
    try {
      Animated.sequence([
        Animated.timing(toastOpacity, { 
          toValue: 1, 
          duration: Platform.OS === 'android' ? 120 : 160, 
          useNativeDriver: Platform.OS !== 'web' 
        }),
        Animated.delay(Platform.OS === 'android' ? 1000 : 1200),
        Animated.timing(toastOpacity, { 
          toValue: 0, 
          duration: Platform.OS === 'android' ? 150 : 180, 
          useNativeDriver: Platform.OS !== 'web' 
        }),
      ]).start();
    } catch (error) {
      toastOpacity.setValue(1);
      setTimeout(() => toastOpacity.setValue(0), Platform.OS === 'android' ? 1000 : 1200);
    }
  };

  const handleModeToggle = (mode) => {
    const newVisibleModes = {
      ...visibleModes,
      [mode]: !visibleModes[mode]
    };
    
    // Asegurar que al menos un modo esté visible
    const hasAnyModeVisible = Object.values(newVisibleModes).some(visible => visible);
    if (!hasAnyModeVisible) {
      Alert.alert('Error', 'Debe tener al menos un modo visible');
      return;
    }
    
  // Actualizar solo localmente; se persiste al pulsar "Aplicar" para evitar cierre del modal por cambios de pantalla
  setVisibleModes(newVisibleModes);
  };

  // Volver a la vista raíz del modal de configuración
  const backToSettingsRoot = () => {
    setSettingsView('root');
  };

  const renderModalContent = () => {
    if (!modalContent) {
      return null;
    }

    if (modalContent.id === 'settings') {
      return (
        <View style={[
          styles.modalContentInner,
          Platform.OS === 'android' && { 
            backgroundColor: '#FFFFFF',
            minHeight: 150,
            padding: 5
          }
        ]}>
          <Text style={[
            styles.modalTitle,
            Platform.OS === 'android' && { 
              color: '#000000',
              fontSize: 16,
              fontWeight: 'bold',
              marginBottom: 10,
              textAlign: 'center'
            }
          ]}>
            {settingsView === 'modes' ? 'Modos Visibles' : modalContent.title}
          </Text>

          {settingsView === 'root' ? (
            <>
              <View style={[
                styles.settingsContainer,
                Platform.OS === 'android' && {
                  backgroundColor: '#F8F8F8',
                  padding: 5,
                  borderRadius: 6,
                  marginBottom: 10
                }
              ]}>
                {/* OCULTO PARA BUILD - Mantener sesión iniciada */}
                {/*
                <Pressable style={[
                  styles.settingOption,
                  Platform.OS === 'android' && {
                    backgroundColor: '#FFFFFF',
                    marginVertical: 2,
                    borderRadius: 4,
                    elevation: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 10
                  }
                ]} onPress={handleKeepSessionPress}>
                  <Text style={[styles.settingIcon, { fontSize: 14 }]}>🔐</Text>
                  <View style={styles.settingTextContainer}>
                    <Text style={[styles.settingText, Platform.OS === 'android' && { color: '#000000', fontSize: 13 }]}>
                      Mantener sesión iniciada
                    </Text>
                    <Text style={[styles.settingStatus, Platform.OS === 'android' && { color: '#666666', fontSize: 11 }]}>
                      {keepSessionActive ? 'Activado' : 'Desactivado'}
                    </Text>
                  </View>
                  <Text style={[styles.settingArrow, { fontSize: 12 }]}>▶</Text>
                </Pressable>
                */}



                {/* OCULTO PARA BUILD - Patrón de seguridad */}
                {/*
                <Pressable style={[
                  styles.settingOption,
                  Platform.OS === 'android' && {
                    backgroundColor: '#FFFFFF',
                    marginVertical: 2,
                    borderRadius: 4,
                    elevation: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 10
                  }
                ]} onPress={handleSecurityPatternPress}>
                  <Text style={[styles.settingIcon, { fontSize: 14 }]}>🔒</Text>
                  <View style={styles.settingTextContainer}>
                    <Text style={[styles.settingText, Platform.OS === 'android' && { color: '#000000', fontSize: 13 }]}>
                      Patrón de seguridad
                    </Text>
                    <Text style={[styles.settingStatus, Platform.OS === 'android' && { color: '#666666', fontSize: 11 }]}>
                      No configurado
                    </Text>
                  </View>
                  <Text style={[styles.settingArrow, { fontSize: 12 }]}>▶</Text>
                </Pressable>
                */}

                {/* Modos Visibles (solo listero) */}
                {role === 'listero' && (
                  <Pressable 
                    style={styles.settingOption}
                    onPress={handleModeVisibilityPress}
                  >
                    <Text style={styles.settingIcon}>👁️</Text>
                    <Text style={styles.settingText}>Modos Visibles</Text>
                    <Text style={styles.settingArrow}>▶</Text>
                  </Pressable>
                )}

                {/* Modo Santiago (solo admin/banco) */}
                {role === 'admin' && (
                  <Pressable 
                    style={[
                      styles.settingOption,
                      loadingModoSantiago && { opacity: 0.6 }
                    ]}
                    onPress={toggleModoSantiago}
                    disabled={loadingModoSantiago}
                  >
                    <Text style={styles.settingIcon}>⚡</Text>
                    <View style={styles.settingTextContainer}>
                      <Text style={styles.settingText}>Modo Santiago</Text>
                      <Text style={styles.settingStatus}>
                        {loadingModoSantiago ? 'Actualizando...' : (modoSantiago ? 'Activado' : 'Desactivado')}
                      </Text>
                    </View>
                    <View style={[
                      styles.toggleSwitch,
                      modoSantiago && styles.toggleSwitchActive
                    ]}>
                      <View style={[
                        styles.toggleIndicator,
                        modoSantiago && styles.toggleIndicatorActive
                      ]} />
                    </View>
                  </Pressable>
                )}

                {/* Porcentaje Santiago (solo cuando modo santiago está activado) */}
                {role === 'admin' && modoSantiago && (
                  <View style={styles.settingOption}>
                    <Text style={styles.settingIcon}>📊</Text>
                    <View style={styles.settingTextContainer}>
                      <Text style={styles.settingText}>Porcentaje Santiago</Text>
                      <Text style={styles.settingStatus}>
                        {loadingPorcentaje ? 'Actualizando...' : `${porcentajeSantiago}%`}
                      </Text>
                    </View>
                    <View style={styles.percentageInputContainer}>
                      <TextInput
                        style={[
                          styles.percentageInput,
                          loadingPorcentaje && { opacity: 0.6 }
                        ]}
                        value={porcentajeSantiago.toString()}
                        onChangeText={(text) => {
                          const numValue = parseInt(text) || 0;
                          if (numValue >= 0 && numValue <= 100) {
                            setPorcentajeSantiago(numValue);
                          }
                        }}
                        onEndEditing={() => {
                          updatePorcentajeSantiago(porcentajeSantiago);
                        }}
                        keyboardType="numeric"
                        maxLength={3}
                        editable={!loadingPorcentaje}
                        selectTextOnFocus={true}
                      />
                      <Text style={styles.percentageSymbol}>%</Text>
                    </View>
                  </View>
                )}



                {/* Cambiar contraseña (admin, collector y listero) */}
                {(role === 'collector' || role === 'listero' || role === 'admin') && (
                  <Pressable 
                    style={styles.settingOption}
                    onPress={() => {
                      setChangePasswordModalVisible(true);
                    }}
                  >
                    <Text style={styles.settingIcon}>🔑</Text>
                    <Text style={styles.settingText}>Cambiar contraseña</Text>
                    <Text style={styles.settingArrow}>▶</Text>
                  </Pressable>
                )}
              </View>

              <Pressable style={[
                styles.modalCloseButton,
                Platform.OS === 'android' && {
                  backgroundColor: '#007AFF',
                  padding: 6,
                  borderRadius: 4,
                  marginTop: 8,
                  marginBottom: 5
                }
              ]} onPress={closeModal}>
                <Text style={[
                  styles.modalCloseButtonText,
                  Platform.OS === 'android' && {
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 'bold'
                  }
                ]}>Cerrar</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.modalSubtitle}>
                Selecciona qué modos quieres mostrar en la interfaz
              </Text>

              <View style={styles.modeOptionsContainer}>
                {/* Modo Visual */}
                <Pressable
                  style={[
                    styles.modeOption,
                    visibleModes.visual && styles.modeOptionSelected
                  ]}
                  onPress={() => handleModeToggle('visual')}
                >
                  <Text style={styles.modeIcon}>👁️</Text>
                  <View style={styles.modeTextContainer}>
                    <Text style={[
                      styles.modeTitle,
                      visibleModes.visual && styles.modeTitleSelected
                    ]}>
                      Modo Visual
                    </Text>
                    <Text style={styles.modeDescription}>
                      Interfaz gráfica completa
                    </Text>
                  </View>
                  <View style={[
                    styles.modeCheckbox,
                    visibleModes.visual && styles.modeCheckboxSelected
                  ]}>
                    {visibleModes.visual && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </Pressable>

                {/* Modo Texto */}
                <Pressable
                  style={[
                    styles.modeOption,
                    visibleModes.text && styles.modeOptionSelected
                  ]}
                  onPress={() => handleModeToggle('text')}
                >
                  <Text style={styles.modeIcon}>📝</Text>
                  <View style={styles.modeTextContainer}>
                    <Text style={[
                      styles.modeTitle,
                      visibleModes.text && styles.modeTitleSelected
                    ]}>
                      Modo Texto
                    </Text>
                    <Text style={styles.modeDescription}>
                      Interfaz simplificada de texto
                    </Text>
                  </View>
                  <View style={[
                    styles.modeCheckbox,
                    visibleModes.text && styles.modeCheckboxSelected
                  ]}>
                    {visibleModes.text && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </Pressable>

                {/* Modo Texto 2.0 */}
                <Pressable
                  style={[
                    styles.modeOption,
                    visibleModes.text2 && styles.modeOptionSelected
                  ]}
                  onPress={() => handleModeToggle('text2')}
                >
                  <Text style={styles.modeIcon}>📝</Text>
                  <View style={styles.modeTextContainer}>
                    <Text style={[
                      styles.modeTitle,
                      visibleModes.text2 && styles.modeTitleSelected
                    ]}>
                      Modo Texto 2.0
                    </Text>
                    <Text style={styles.modeDescription}>
                      Sintaxis avanzada con comandos
                    </Text>
                  </View>
                  <View style={[
                    styles.modeCheckbox,
                    visibleModes.text2 && styles.modeCheckboxSelected
                  ]}>
                    {visibleModes.text2 && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </Pressable>

                {/* Modo Vault */}
                <Pressable
                  style={[
                    styles.modeOption,
                    visibleModes.vault && styles.modeOptionSelected
                  ]}
                  onPress={() => handleModeToggle('vault')}
                >
                  <Text style={styles.modeIcon}>🏦</Text>
                  <View style={styles.modeTextContainer}>
                    <Text style={[
                      styles.modeTitle,
                      visibleModes.vault && styles.modeTitleSelected
                    ]}>
                      Modo Vault
                    </Text>
                    <Text style={styles.modeDescription}>
                      Tres columnas con entradas rápidas
                    </Text>
                  </View>
                  <View style={[
                    styles.modeCheckbox,
                    visibleModes.vault && styles.modeCheckboxSelected
                  ]}>
                    {visibleModes.vault && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </Pressable>
              </View>

              <View style={styles.modeModalButtons}>
                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => {
                    // Persistir cambios y mostrar toast
                    onModeVisibilityChange && onModeVisibilityChange(visibleModes);
                    setToastMsg('Preferencias guardadas');
                    toastOpacity.stopAnimation();
                    toastOpacity.setValue(0);
                    try {
                      Animated.sequence([
                        Animated.timing(toastOpacity, { 
                          toValue: 1, 
                          duration: Platform.OS === 'android' ? 120 : 160, 
                          useNativeDriver: Platform.OS !== 'web' 
                        }),
                        Animated.delay(Platform.OS === 'android' ? 1000 : 1200),
                        Animated.timing(toastOpacity, { 
                          toValue: 0, 
                          duration: Platform.OS === 'android' ? 150 : 180, 
                          useNativeDriver: Platform.OS !== 'web' 
                        }),
                      ]).start();
                    } catch (error) {
                      toastOpacity.setValue(1);
                      setTimeout(() => toastOpacity.setValue(0), Platform.OS === 'android' ? 1000 : 1200);
                    }
                    backToSettingsRoot();
                  }}
                >
                  <Text style={styles.modalCloseButtonText}>
                    Aplicar
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      );
    }

    return (
      <View style={styles.modalContentInner}>
        <Text style={styles.modalTitle}>{modalContent.title}</Text>
        <Text style={styles.modalDescription}>
          Funcionalidad para {modalContent.title.toLowerCase()}
        </Text>
        <Pressable style={styles.modalCloseButton} onPress={closeModal}>
          <Text style={styles.modalCloseButtonText}>Cerrar</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <>
      {/* Sidebar Principal */}
      <Modal
        visible={isVisible}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        accessible={true}
        accessibilityViewIsModal={false}
        presentationStyle="overFullScreen"
      >
        <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
          {/* Área para cerrar */}
          <Pressable 
            style={styles.overlayTouchable} 
            onPress={handleClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú lateral"
            importantForAccessibility="yes"
          />
          
          {/* Sidebar */}
          <Animated.View
            style={[
              styles.sidebar,
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
            {...getAccessibilityProps('navigation', 'Menú de navegación principal', {
              importantForAccessibility: 'yes'
            })}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.appInfo}>
                <Text style={styles.appLogo}>🎲</Text>
                <Text style={styles.appName}>
                  Cloud
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={handleClose}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Content */}
            <ScrollView 
              style={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Mostrar loading si no hay opciones, contenido si las hay */}
              {configOptions ? (
                configOptions.map((option) => (
                  <Pressable
                    key={option.id}
                    style={({ pressed }) => [
                      styles.optionRow,
                        pressed && styles.optionRowPressed
                      ]}
                      onPress={() => handleOptionPress(option)}
                    >
                      <Text style={styles.optionIcon}>{option.icon}</Text>
                      <View style={styles.optionTextContainer}>
                        <Text style={styles.optionTitle}>
                          {option.title}
                        </Text>
                      </View>
                      <Text style={styles.arrowIcon}>▶</Text>
                    </Pressable>
                  ))
                ) : (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Cargando...</Text>
                  </View>
                )
              }
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Pressable
                style={({ pressed }) => [
                  styles.footerButton,
                  styles.logoutButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={handleLogout}
              >
                <Text style={styles.footerButtonIcon}>🚪</Text>
                <Text style={styles.footerButtonText}>
                  Cerrar Sesión
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal para opciones - INDEPENDIENTE del SideBar */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType={Platform.OS === 'android' ? 'none' : 'fade'}
        onRequestClose={() => {
          closeModal();
        }}
        accessible={true}
        accessibilityViewIsModal={true}
        presentationStyle="overFullScreen"
        statusBarTranslucent={Platform.OS === 'android'}
        hardwareAccelerated={Platform.OS === 'android'}
        onShow={() => {
          if (Platform.OS === 'android') {
            StatusBar.setBackgroundColor('rgba(0, 0, 0, 0.7)', true);
          }
        }}
        onDismiss={() => {
          if (Platform.OS === 'android') {
            StatusBar.setBackgroundColor('transparent', true);
          }
        }}
      >
        <View 
          style={{
            flex: 1,
            backgroundColor: Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.8)',
            justifyContent: Platform.OS === 'android' ? 'flex-start' : 'center',
            alignItems: 'center',
            paddingTop: Platform.OS === 'android' ? 40 : 0,
            padding: 20,
          }}
        >
          <View 
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: Platform.OS === 'android' ? 8 : 12,
              padding: 15,
              width: '90%',
              maxWidth: 380,
              maxHeight: Platform.OS === 'android' ? '90%' : '80%',
              minHeight: Platform.OS === 'android' ? 480 : 300,
              ...(Platform.OS === 'android' && {
                elevation: 10,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
              }),
            }}
          >
            <View style={{ flex: 1 }}>
              {/* Botón cerrar */}
              <Pressable 
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  zIndex: 1000,
                  backgroundColor: '#666666',
                  borderRadius: 12,
                  width: 24,
                  height: 24,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={() => {
                  closeModal();
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>✕</Text>
              </Pressable>

              {/* Contenido del modal - SIN SCROLLVIEW */}
              <View style={{ flex: 1, marginTop: 25 }}>
                {renderModalContent()}
              </View>
            </View>
          </View>
          {/* Toast fuera del contenedor principal */}
          {Platform.OS !== 'android' && (
            <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]}>
              <Text style={styles.toastText}>{toastMsg}</Text>
            </Animated.View>
          )}
        </View>
      </Modal>

  {/* Modal de visibilidad eliminado: ahora se gestiona dentro del modal de Configuración */}

      {/* Modal independiente para cambiar contraseña */}
      <ChangePasswordModal
        visible={changePasswordModalVisible}
        onClose={() => setChangePasswordModalVisible(false)}
      />
    </>
  );
};

const SideBarToggle = ({ onToggle, inline = false, style }) => {
  const handlePress = () => { onToggle && onToggle(); };
  const baseStyle = inline ? styles.toggleButtonInline : styles.toggleButton;
  return (
    <Pressable
      style={({ pressed }) => [baseStyle, style, pressed && styles.toggleButtonPressed]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={handlePress}
    >
      <Text style={styles.toggleIcon}>☰</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // Overlay y estructura principal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  
  // Sidebar principal
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: screenWidth * 0.75,
    backgroundColor: '#ffffff',
    ...createShadowStyle({
      color: '#000',
      offsetY: 0,
      opacity: 0.25,
      radius: 5,
      elevation: 8,
    }),
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#3498db',
  },
  appInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appLogo: {
    fontSize: 24,
    marginRight: 8,
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Divider
  divider: {
    height: 1,
    backgroundColor: '#bdc3c7',
  },
  
  // Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  
  // Option rows
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    marginVertical: 4,
    borderRadius: 8,
  },
  optionRowPressed: {
    backgroundColor: '#e9ecef',
  },
  optionIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  arrowIcon: {
    fontSize: 12,
    color: '#95a5a6',
    marginLeft: 8,
  },
  
  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#bdc3c7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginVertical: 2,
  },
  logoutButton: {
    backgroundColor: '#fff5f5',
  },
  footerButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  footerButtonText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  
  // Modal para opciones
  modalOverlay: {
    flex: 1,
    backgroundColor: Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      android: {
        elevation: 5,
      }
    }),
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    minWidth: 280,
    maxWidth: 400,
    width: '90%',
    maxHeight: '80%',
    ...Platform.select({
      android: {
        elevation: 8,
        shadowColor: 'transparent', // Evitar conflictos con elevation
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
      }
    }),
  },
  modalContainerAndroid: {
    // Estilos específicos para Android
    borderRadius: 8, // Radio menor para mejor rendimiento
    margin: 16, // Márgenes más pequeños
    maxHeight: '85%', // Más espacio vertical
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalCloseButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
  },
  modalCloseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Settings modal
  settingsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  settingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'android' ? 14 : 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    marginVertical: 4,
    borderRadius: Platform.OS === 'android' ? 6 : 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    ...Platform.select({
      android: {
        elevation: 1,
        minHeight: 48, // Altura mínima recomendada para touch en Android
      }
    }),
  },
  settingIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  settingText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingStatus: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
    fontWeight: '400',
  },
  settingArrow: {
    fontSize: 12,
    color: '#95a5a6',
  },
  
  // Toggle Button
  toggleButton: {
    position: 'absolute',
    top: 60,
    left: 8,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...createShadowStyle({
      color: '#000',
      offsetY: 2,
      opacity: 0.25,
      radius: 4,
      elevation: 12,
    }),
    zIndex: 2000,
  },
  toggleButtonInline: {
    position: 'relative',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...createShadowStyle({
      color: '#000',
      offsetY: 2,
      opacity: 0.25,
      radius: 4,
      elevation: 6,
    }),
  },
  toggleButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  toggleIcon: {
    fontSize: 18,
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  
  // Mode visibility modal styles
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modeOptionsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E8F1E4',
  },
  modeOptionSelected: {
    borderColor: '#27AE60',
    backgroundColor: '#E8F5E8',
  },
  modeIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  modeTextContainer: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D5016',
    marginBottom: 2,
  },
  modeTitleSelected: {
    color: '#27AE60',
  },
  modeDescription: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  modeCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D5DBDB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  modeCheckboxSelected: {
    borderColor: '#27AE60',
    backgroundColor: '#27AE60',
  },
  checkmark: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modeModalButtons: {
    width: '100%',
    alignItems: 'center',
  },
  toastContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 40 : 30,
    alignSelf: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'android' ? 10 : 8,
    borderRadius: Platform.OS === 'android' ? 6 : 20,
    ...Platform.select({
      android: {
        elevation: 6,
        minWidth: 120,
      },
      ios: {
        ...createShadowStyle({
          color: '#000',
          offsetY: 2,
          opacity: 0.2,
          radius: 3,
          elevation: 3,
        }),
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      }
    }),
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  
  // Loading estado
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  
  // Toggle switch styles for modo santiago
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#34c759',
  },
  toggleIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleIndicatorActive: {
    alignSelf: 'flex-end',
  },

  // Percentage input styles
  percentageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 8,
    minWidth: 60,
  },
  percentageInput: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    minWidth: 30,
    paddingVertical: 4,
  },
  percentageSymbol: {
    fontSize: 12,
    color: '#666',
    marginLeft: 2,
  },



  // Pressed states
  buttonPressed: {
    opacity: 0.7,
  },
});

const MemoizedSideBar = React.memo(SideBar, (prevProps, nextProps) => {
  // Solo re-renderizar si cambian props específicas importantes
  return (
    prevProps.navigation === nextProps.navigation &&
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.role === nextProps.role
  );
});

export { MemoizedSideBar as SideBar, SideBarToggle };
