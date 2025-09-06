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
  // Modal de cambio de contraseña independiente
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);

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
  { id: 'statistics', icon: '📈', title: 'Estadísticas' },
  { id: 'insertResults', icon: '🎯', title: 'Resultados' },
  { id: 'settings', icon: '⚙️', title: 'Configuración' },
  ]
};

// Opciones básicas que siempre están disponibles
const basicOptions = [
  { id: 'settings', title: 'Configuración', icon: '⚙️' },
  { id: 'logout', title: 'Cerrar Sesión', icon: '🚪', action: 'logout' },
];

// Selección de opciones dinámicamente según rol con fallback a opciones básicas
const configOptions = role ? (roleOptionsMap[role] || basicOptions) : basicOptions;


  // Animación del sidebar
  useEffect(() => {
    if (!slideAnim) {
      console.warn('slideAnim is not initialized');
      return;
    }

    try {
      if (isVisible) {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: Platform.OS === 'android' ? 250 : 300,
          useNativeDriver: Platform.OS !== 'web', // Solo usar native driver en móvil
        }).start((finished) => {
          if (!finished) {
            console.warn('Animation interrupted');
          }
        });
      } else {
        Animated.timing(slideAnim, {
          toValue: -sidebarWidth,
          duration: Platform.OS === 'android' ? 200 : 300,
          useNativeDriver: Platform.OS !== 'web', // Solo usar native driver en móvil
        }).start((finished) => {
          if (!finished) {
            console.warn('Animation interrupted');
          }
        });
      }
    } catch (error) {
      console.error('Animation error:', error);
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
    // Solo cerrar el sidebar si NO es configuración
    if (option.id !== 'settings') {
      handleClose();
    }

    switch (option.id) {
    case 'createUser':
      navigation.navigate('CreateUser');
      break;
    case 'insertResults':
      navigation.navigate('Bankview');
      break;
    case 'lotteries':
      navigation.navigate('ManageLotteries');
      break;
    case 'jugadas':
      navigation.navigate('Jugadas');
      break;
    case 'lotteryLimits':
      navigation.navigate('LotteryLimits');
      break;
    case 'prices':
      navigation.navigate('Prices');
      break;
    case 'listerLimits':
      navigation.navigate('UserLimits');
      break;
    case 'limitedNumbers':
      navigation.navigate('NumberLimits');
      break;
    case 'statistics':
      navigation.navigate('Statistics');
      break;
    case 'collectorStatistics':
      navigation.navigate('CollectorStatistics');
      break;
    case 'play':
      navigation.navigate('MainApp');
      break;
    case 'settings':
      handleClose(); // Cerrar sidebar primero
      setModalContent(option);
      setModalVisible(true);
      break;
    default:
      Alert.alert('Opción aún no implementada');
  }
};


  const closeModal = () => {
    setModalVisible(false);
    setModalContent(null);
    setSettingsView('root');
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
  const [currentFontSize, setCurrentFontSize] = useState('mediano'); // 'pequeno', 'mediano', 'grande'
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
            console.log(`Sesión permanente ${!keepSessionActive ? 'activada' : 'desactivada'}`);
          }
        }
      ]
    );
  };

  // Función para manejar "Tamaño de letra"
  const handleFontSizePress = () => {
    const fontSizeLabels = {
      pequeno: 'Pequeño',
      mediano: 'Mediano',
      grande: 'Grande'
    };

    Alert.alert(
      'Tamaño de letra',
      `Actual: ${fontSizeLabels[currentFontSize]}\n\nSelecciona el tamaño de letra:`,
      [
        { 
          text: 'Pequeño', 
          onPress: () => {
            setCurrentFontSize('pequeno');
            console.log('Tamaño pequeño seleccionado');
            // Aquí se aplicaría el cambio global
          }
        },
        { 
          text: 'Mediano', 
          onPress: () => {
            setCurrentFontSize('mediano');
            console.log('Tamaño mediano seleccionado');
          }
        },
        { 
          text: 'Grande', 
          onPress: () => {
            setCurrentFontSize('grande');
            console.log('Tamaño grande seleccionado');
          }
        },
        { text: 'Cancelar', style: 'cancel' }
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
                  onPress: () => console.log('Patrón desactivado')
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
                {/* Mantener sesión iniciada */}
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

                {/* Tamaño de letra */}
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
                ]} onPress={handleFontSizePress}>
                  <Text style={[styles.settingIcon, { fontSize: 14 }]}>🔤</Text>
                  <View style={styles.settingTextContainer}>
                    <Text style={[styles.settingText, Platform.OS === 'android' && { color: '#000000', fontSize: 13 }]}>
                      Tamaño de letra
                    </Text>
                    <Text style={[styles.settingStatus, Platform.OS === 'android' && { color: '#666666', fontSize: 11 }]}>
                      {currentFontSize === 'pequeno' ? 'Pequeño' : 
                       currentFontSize === 'mediano' ? 'Mediano' : 'Grande'}
                    </Text>
                  </View>
                  <Text style={[styles.settingArrow, { fontSize: 12 }]}>▶</Text>
                </Pressable>

                {/* Patrón de seguridad */}
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
                      console.error('Toast animation error:', error);
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
                  Lotería Pro
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
              {/* Siempre mostrar el contenido, sin estado de carga */}
              {configOptions.map((option) => (
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
    top: 8,
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
  
  // Pressed states
  buttonPressed: {
    opacity: 0.7,
  },
});

const MemoizedSideBar = React.memo(SideBar, (prevProps, nextProps) => {
  // Solo re-renderizar si cambian props específicas importantes
  return (
    prevProps.navigation === nextProps.navigation &&
    prevProps.isVisible === nextProps.isVisible
  );
});

export { MemoizedSideBar as SideBar, SideBarToggle };
