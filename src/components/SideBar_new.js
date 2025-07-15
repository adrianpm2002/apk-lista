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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width: screenWidth } = Dimensions.get('window');

const SideBar = ({ isVisible, onClose, onOptionSelect, isDarkMode, onToggleDarkMode, navigation }) => {
  const sidebarWidth = screenWidth * 0.75;
  const slideAnim = useRef(new Animated.Value(-sidebarWidth)).current;
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const nav = useNavigation();

  const configOptions = [
    {
      id: 'limitedNumbers',
      icon: '📊',
      title: 'Números Limitados',
      description: 'Ver y gestionar números limitados'
    },
    {
      id: 'listerLimits',
      icon: '📋',
      title: 'Límites del Listero',
      description: 'Configurar límites de apuestas'
    },
    {
      id: 'prices',
      icon: '💰',
      title: 'Configuración de Precios',
      description: 'Ajustar precios y porcentajes'
    },
    {
  id: 'createUser',
  icon: '🧑‍💼',
  title: 'Crear Usuario',
  description: 'Crear nuevos usuarios en el sistema'
}

  ];

  useEffect(() => {
    if (isVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -sidebarWidth,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, sidebarWidth]);

  const handleClose = () => {
    onClose && onClose();
  };

  const handleOptionPress = (option) => {
  if (option.id === 'createUser') {
    handleClose();
    navigation.navigate('CreateUser');
  } else {
    setModalContent(option);
    setModalVisible(true);
  }
};


  const closeModal = () => {
    setModalVisible(false);
    setModalContent(null);
  };

  const toggleDarkMode = () => {
    onToggleDarkMode && onToggleDarkMode();
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Sesión', style: 'destructive', onPress: () => {
          handleClose();
          navigation && navigation.navigate('Login');
        }}
      ]
    );
  };

  const renderModalContent = () => {
    if (!modalContent) return null;

    return (
      <View style={styles.modalContentInner}>
        <Text style={styles.modalTitle}>{modalContent.title}</Text>
        <Text style={styles.modalDescription}>
          Funcionalidad para {modalContent.description.toLowerCase()}
        </Text>
        <Pressable style={styles.modalCloseButton} onPress={closeModal}>
          <Text style={styles.modalCloseButtonText}>Cerrar</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <>
      <Modal
        visible={isVisible}
        transparent
        animationType="none"
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.overlayTouchable} onPress={handleClose} />
          <Animated.View
            style={[
              styles.sidebar,
              isDarkMode && styles.sidebarDark,
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
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

            <View style={styles.divider} />

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
                    <Text style={[styles.optionDescription, isDarkMode && styles.optionDescriptionDark]}>
                      {option.description}
                    </Text>
                  </View>
                  <Text style={[styles.arrowIcon, isDarkMode && styles.arrowIconDark]}>▶</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={[styles.footer, isDarkMode && styles.footerDark]}>
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

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <View style={styles.modalContainer}>
            {renderModalContent()}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const SideBarToggle = ({ onToggle }) => {
  const handlePress = () => {
    onToggle && onToggle();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.toggleButton,
        pressed && styles.toggleButtonPressed
      ]}
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
    flexDirection: 'row',
  },
  overlayTouchable: {
    flex: 1,
  },
  
  // Sidebar principal
  sidebar: {
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
  
  // Toggle Button
  toggleButton: {
    position: 'absolute',
    top: 50,
    left: 15,
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
    zIndex: 99999,
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
  
  // Pressed states
  buttonPressed: {
    opacity: 0.7,
  },
});

export { SideBar, SideBarToggle };
