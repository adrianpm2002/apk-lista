import React, { useState, useRef, useEffect } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import { supabase } from '../supabaseClient';
import ChangePasswordModal from './ChangePasswordModal';
import { useOffline } from '../context/OfflineContext';

// Nota: dejamos este valor sólo para estilos por defecto; el ancho real del sidebar es dinámico.
const { width: screenWidth } = Dimensions.get('window');

// Calcula el ancho ideal del sidebar según el ancho de la ventana.
const getSidebarWidth = (w) => {
  if (!w || Number.isNaN(w)) return 320;
  const margin = Math.max(16, Math.floor(w * 0.06)); // margen para poder cerrar
  const maxAllowed = Math.max(160, w - margin);

  let candidate;
  if (w <= 320) candidate = Math.floor(w * 0.9);
  else if (w <= 360) candidate = Math.floor(w * 0.88);
  else if (w <= 480) candidate = Math.floor(w * 0.82);
  else if (w <= 768) candidate = Math.floor(w * 0.75);
  else candidate = Math.min(420, Math.floor(w * 0.45));

  return Math.min(candidate, maxAllowed);
};

const SideBar = ({ isVisible, onClose, onOptionSelect, isDarkMode, onToggleDarkMode, navigation, onModeVisibilityChange, role }) => {
  const { offlineMode, setOffline, pendingCount, getQueue, clearFromQueue } = useOffline();

  // Dimensiones reactivas para responsividad
  const { width: windowWidth } = useWindowDimensions();
  const sidebarWidth = getSidebarWidth(windowWidth);
  // Aseguramos que el valor inicial de la animación considere el ancho inicial
  const slideAnim = useRef(new Animated.Value(-getSidebarWidth(Dimensions.get('window').width))).current;
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [modeVisibilityModal, setModeVisibilityModal] = useState(false);
  const [visibleModes, setVisibleModes] = useState({
    visual: true,
    text: true
  });
  // Modal de cambio de contraseña independiente
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);

  // Opciones del sidebar por rol
const roleOptionsMap = {
  admin: [
    { id: 'statistics', icon: '📈', title: 'Estadísticas' },
    { id: 'insertResults', icon: '🎯', title: 'Insertar Resultados' },
    { id: 'createUser', icon: '🧑‍💼', title: 'Gestionar Usuarios' },
    { id: 'lotteries', icon: '🎰', title: 'Gestionar Loterías' },
    { id: 'prices', icon: '💰', title: 'Configurar Precios' },
    { id: 'limitedNumbers', icon: '📊', title: 'Limitar Números' },
    { id: 'settings', icon: '⚙️', title: 'Configuración' },
  ],
  collector: [
  // Ajustado: solo las pantallas permitidas para collector
  { id: 'statistics', icon: '📈', title: 'Estadísticas' },
  { id: 'insertResults', icon: '🎯', title: 'Insertar Resultados' },
  // Icono corregido: el anterior tenía un carácter inválido que mostraba signo de interrogación
  { id: 'createUser', icon: '🧑‍💼', title: 'Gestionar Usuarios' },
  { id: 'settings', icon: '⚙️', title: 'Configuración' },
  ],
  listero: [
  { id: 'play', icon: '🎮', title: 'Inicio' },
  { id: 'statistics', icon: '📈', title: 'Estadísticas' },
  { id: 'settings', icon: '⚙️', title: 'Configuración' },
  ]
};

// Selección de opciones dinámicamente según rol
const configOptions = roleOptionsMap[role] || [];


  // Animación del sidebar
  useEffect(() => {
    // Cuando cambia visibilidad o dimensiones, re-animamos al destino correcto
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : -sidebarWidth,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [isVisible, sidebarWidth]);

  const handleClose = () => {
    onClose && onClose();
  };

  const handleOptionPress = (option) => {
  handleClose();

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
    case 'prices':
      navigation.navigate('ManagePrices');
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
    case 'play':
      navigation.navigate('MainApp');
      break;
    case 'settings':
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
  };

  const toggleDarkMode = () => {
    onToggleDarkMode && onToggleDarkMode();
  };

  const handleToggleOffline = async () => {
    await setOffline(!offlineMode);
  };

  const handleManualSync = async () => {
    try {
      // Simple manual sync placeholder: just attempt a dry send via navigation event
      // We'll navigate to MainApp to let screens attempt sync, or emit an event later.
      navigation?.navigate?.('MainApp', { triggerSync: Date.now() });
    } catch {}
  };

  const handleLogout = () => {
    const proceed = async () => {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // ignorar error de signOut para no bloquear la navegación
      }
      handleClose();
      if (navigation && navigation.navigate) {
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

  const handleModeVisibilityPress = () => {
    setModeVisibilityModal(true);
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
    
    setVisibleModes(newVisibleModes);
    onModeVisibilityChange && onModeVisibilityChange(newVisibleModes);
  };

  const closeModeVisibilityModal = () => {
    setModeVisibilityModal(false);
  };

  const renderModalContent = () => {
    if (!modalContent) return null;

    if (modalContent.id === 'settings') {
      return (
        <View style={styles.modalContentInner}>
          <Text style={styles.modalTitle}>{modalContent.title}</Text>
          
          <View style={styles.settingsContainer}>
            {/* Mantener sesión iniciada */}
            <Pressable style={styles.settingOption}>
              <Text style={styles.settingIcon}>🔐</Text>
              <Text style={styles.settingText}>Mantener sesión iniciada</Text>
              <Text style={styles.settingArrow}>▶</Text>
            </Pressable>
            
            {/* Tamaño de letra */}
            <Pressable style={styles.settingOption}>
              <Text style={styles.settingIcon}>🔤</Text>
              <Text style={styles.settingText}>Tamaño de letra</Text>
              <Text style={styles.settingArrow}>▶</Text>
            </Pressable>
            
            {/* Patrón de seguridad */}
            <Pressable style={styles.settingOption}>
              <Text style={styles.settingIcon}>🔒</Text>
              <Text style={styles.settingText}>Patrón de seguridad</Text>
              <Text style={styles.settingArrow}>▶</Text>
            </Pressable>
            
            {/* Modos Visibles (solo listero) */}
            {role === 'listero' && (
              <Pressable 
                style={styles.settingOption}
                onPress={() => handleModeVisibilityPress()}
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

            {/* (antes) Modo Offline toggle dentro de settings — ahora se mueve al footer como botón */}

            {/* Sincronizar manualmente */}
            <Pressable 
              style={styles.settingOption}
              onPress={handleManualSync}
            >
              <Text style={styles.settingIcon}>🔄</Text>
              <Text style={styles.settingText}>Sincronizar ahora</Text>
              <Text style={styles.settingArrow}>▶</Text>
            </Pressable>
          </View>
          
          <Pressable style={styles.modalCloseButton} onPress={closeModal}>
            <Text style={styles.modalCloseButtonText}>Cerrar</Text>
          </Pressable>
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
      >
        <View style={styles.overlay}>
          {/* Área para cerrar: sólo el espacio fuera del sidebar */}
          <Pressable
            style={[
              styles.overlayTouchable,
              { left: sidebarWidth, right: 0 },
            ]}
            onPress={handleClose}
          />
          
          {/* Sidebar */}
          <Animated.View
            style={[
              styles.sidebar,
              isDarkMode && styles.sidebarDark,
              {
                width: sidebarWidth,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            {/* Header */}
            <View style={[styles.header, isDarkMode && styles.headerDark]}>
              <View style={styles.appInfo}>
                <Text style={styles.appLogo}>🎲</Text>
                <Text style={[styles.appName, isDarkMode && styles.appNameDark]}>
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
              {configOptions.map((option) => (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.optionRow,
                    isDarkMode && styles.optionRowDark,
                    pressed && styles.optionRowPressed
                  ]}
                  onPress={() => handleOptionPress(option)}
                >
                  <Text style={styles.optionIcon}>{option.icon}</Text>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, isDarkMode && styles.optionTitleDark]}>
                      {option.title}
                    </Text>
                  </View>
                  <Text style={[styles.arrowIcon, isDarkMode && styles.arrowIconDark]}>▶</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, isDarkMode && styles.footerDark]}>
              {/* Botón Modo Offline (clic para alternar) */}
              <Pressable
                style={({ pressed }) => [
                  styles.footerButton,
                  { borderWidth:1, borderColor: offlineMode ? '#27AE60' : '#B8D4A8', backgroundColor: offlineMode ? '#E8F5E8' : '#F8F9FA', justifyContent:'space-between' },
                  pressed && styles.buttonPressed
                ]}
                onPress={handleToggleOffline}
              >
                <Text style={styles.footerButtonIcon}>📴</Text>
                <Text style={[styles.footerButtonText, isDarkMode && styles.footerButtonTextDark]}>Modo Offline: {offlineMode ? 'ON' : 'OFF'}</Text>
                {pendingCount > 0 && (
                  <Text style={[styles.footerButtonText, { color:'#E67E22', fontWeight:'800' }]}>({pendingCount})</Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.footerButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={toggleDarkMode}
              >
                <Text style={styles.footerButtonIcon}>{isDarkMode ? '☀️' : '🌙'}</Text>
                <Text style={[styles.footerButtonText, isDarkMode && styles.footerButtonTextDark]}>
                  {isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
                </Text>
              </Pressable>
              
              <Pressable
                style={({ pressed }) => [
                  styles.footerButton,
                  styles.logoutButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={handleLogout}
              >
                <Text style={styles.footerButtonIcon}>🚪</Text>
                <Text style={[styles.footerButtonText, isDarkMode && styles.footerButtonTextDark]}>
                  Cerrar Sesión
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal para opciones */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <View 
            style={styles.modalContainer}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {renderModalContent()}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Modal de Visibilidad de Modos */}
      <Modal
        visible={modeVisibilityModal}
        transparent
        animationType="slide"
        onRequestClose={closeModeVisibilityModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={closeModeVisibilityModal}
        >
          <View 
            style={[styles.modalContent, isDarkMode && styles.modalContentDark]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
              Modos Visibles
            </Text>
            <Text style={[styles.modalSubtitle, isDarkMode && styles.modalSubtitleDark]}>
              Selecciona qué modos quieres mostrar en la interfaz
            </Text>

            <View style={styles.modeOptionsContainer}>
              {/* Modo Visual */}
              <Pressable
                style={[
                  styles.modeOption,
                  isDarkMode && styles.modeOptionDark,
                  visibleModes.visual && styles.modeOptionSelected,
                  visibleModes.visual && isDarkMode && styles.modeOptionSelectedDark
                ]}
                onPress={() => handleModeToggle('visual')}
              >
                <Text style={styles.modeIcon}>👁️</Text>
                <View style={styles.modeTextContainer}>
                  <Text style={[
                    styles.modeTitle,
                    isDarkMode && styles.modeTitleDark,
                    visibleModes.visual && styles.modeTitleSelected
                  ]}>
                    Modo Visual
                  </Text>
                  <Text style={[
                    styles.modeDescription,
                    isDarkMode && styles.modeDescriptionDark
                  ]}>
                    Interfaz gráfica completa
                  </Text>
                </View>
                <View style={[
                  styles.modeCheckbox,
                  isDarkMode && styles.modeCheckboxDark,
                  visibleModes.visual && styles.modeCheckboxSelected
                ]}>
                  {visibleModes.visual && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </Pressable>

              {/* Modo Texto */}
              <Pressable
                style={[
                  styles.modeOption,
                  isDarkMode && styles.modeOptionDark,
                  visibleModes.text && styles.modeOptionSelected,
                  visibleModes.text && isDarkMode && styles.modeOptionSelectedDark
                ]}
                onPress={() => handleModeToggle('text')}
              >
                <Text style={styles.modeIcon}>📝</Text>
                <View style={styles.modeTextContainer}>
                  <Text style={[
                    styles.modeTitle,
                    isDarkMode && styles.modeTitleDark,
                    visibleModes.text && styles.modeTitleSelected
                  ]}>
                    Modo Texto
                  </Text>
                  <Text style={[
                    styles.modeDescription,
                    isDarkMode && styles.modeDescriptionDark
                  ]}>
                    Interfaz simplificada de texto
                  </Text>
                </View>
                <View style={[
                  styles.modeCheckbox,
                  isDarkMode && styles.modeCheckboxDark,
                  visibleModes.text && styles.modeCheckboxSelected
                ]}>
                  {visibleModes.text && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </Pressable>
            </View>

            <View style={styles.modeModalButtons}>
              <Pressable
                style={[styles.modalCloseButton, isDarkMode && styles.modalCloseButtonDark]}
                onPress={closeModeVisibilityModal}
              >
                <Text style={[styles.modalCloseButtonText, isDarkMode && styles.modalCloseButtonTextDark]}>
                  Aplicar
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Modal independiente para cambiar contraseña */}
      <ChangePasswordModal
        visible={changePasswordModalVisible}
        onClose={() => setChangePasswordModalVisible(false)}
        isDarkMode={isDarkMode}
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
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
  },
  sidebarDark: {
    backgroundColor: '#2c3e50',
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
  headerDark: {
    backgroundColor: '#34495e',
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
  appNameDark: {
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
  optionRowDark: {
    backgroundColor: '#34495e',
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
  optionTitleDark: {
    color: '#ffffff',
  },
  optionDescription: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  optionDescriptionDark: {
    color: '#bdc3c7',
  },
  arrowIcon: {
    fontSize: 12,
    color: '#95a5a6',
    marginLeft: 8,
  },
  arrowIconDark: {
    color: '#7f8c8d',
  },
  
  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#bdc3c7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  footerDark: {
    backgroundColor: '#2c3e50',
    borderTopColor: '#34495e',
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
  footerButtonTextDark: {
    color: '#ffffff',
  },
  
  // Modal para opciones
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  settingIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 12,
    zIndex: 2000,
  },
  toggleButtonInline: {
    position: 'relative',
  width: 36,
  height: 36,
  borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  toggleButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  toggleIcon: {
  fontSize: 16,
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
  modalSubtitleDark: {
    color: '#BDC3C7',
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
  modeOptionDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  modeOptionSelected: {
    borderColor: '#27AE60',
    backgroundColor: '#E8F5E8',
  },
  modeOptionSelectedDark: {
    borderColor: '#27AE60',
    backgroundColor: '#2C3E50',
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
  modeTitleDark: {
    color: '#ECF0F1',
  },
  modeTitleSelected: {
    color: '#27AE60',
  },
  modeDescription: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  modeDescriptionDark: {
    color: '#BDC3C7',
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
  modeCheckboxDark: {
    borderColor: '#5D6D7E',
    backgroundColor: '#34495E',
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
  
  // Pressed states
  buttonPressed: {
    opacity: 0.7,
  },
});

export { SideBar, SideBarToggle };
