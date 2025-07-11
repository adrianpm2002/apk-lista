import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

const SideBar = ({ isVisible, onClose, onOptionSelect, isDarkMode, onToggleDarkMode, navigation }) => {
  const slideAnim = useRef(new Animated.Value(-screenWidth * 0.5)).current;
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [expandedLottery, setExpandedLottery] = useState(null);
  const [expandedSchedule, setExpandedSchedule] = useState(null);

  // Datos simplificados para las opciones
  const configOptions = [
    {
      id: 'limitedNumbers',
      icon: '📊',
      title: 'Números Limitados',
      description: 'Ver y gestionar números limitados'
    },
    {
      id: 'listerLimits',
      icon: '⚠️',
      title: 'Límites del Listero',
      description: 'Configurar límites de apuestas'
    },
    {
      id: 'prices',
      icon: '💰',
      title: 'Configuración de Precios',
      description: 'Ajustar precios y porcentajes'
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
        toValue: -screenWidth * 0.5,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  // Función para manejar click en opción y abrir modal
  const handleOptionPress = (option) => {
    setModalContent(option);
    setModalVisible(true);
  };

  // Función para cerrar modal
  const closeModal = () => {
    setModalVisible(false);
    setModalContent(null);
    setExpandedLottery(null);
    setExpandedSchedule(null);
  };

  // Función para cerrar la barra lateral
  const handleClose = () => {
    onClose();
  };

  // Función para toggle del modo oscuro
  const toggleDarkMode = () => {
    onToggleDarkMode && onToggleDarkMode();
  };

  // Función para cerrar sesión
  const handleLogout = () => {
    console.log('Logout pressed');
    onClose(); // Cerrar sidebar primero
    navigation && navigation.navigate('Login');
  };

  // Función para toggle de lotería en modal
  const toggleLottery = (lotteryIndex) => {
    if (expandedLottery === lotteryIndex) {
      setExpandedLottery(null);
      setExpandedSchedule(null);
    } else {
      setExpandedLottery(lotteryIndex);
      setExpandedSchedule(null);
    }
  };

  // Función para toggle de horario en modal
  const toggleSchedule = (scheduleIndex) => {
    if (expandedSchedule === scheduleIndex) {
      setExpandedSchedule(null);
    } else {
      setExpandedSchedule(scheduleIndex);
    }
  };

  // Renderizar contenido del modal según la opción
  const renderModalContent = () => {
    if (!modalContent) return null;

    const sampleData = {
      limitedNumbers: {
        title: 'Números Limitados',
        sections: [
          {
            lottery: 'Georgia',
            schedules: [
              { name: 'Mediodía', numbers: ['123', '456', '789'] },
              { name: 'Noche', numbers: ['111', '222', '333'] }
            ]
          },
          {
            lottery: 'Florida',
            schedules: [
              { name: 'Mediodía', numbers: ['234', '567'] },
              { name: 'Noche', numbers: ['444', '555'] }
            ]
          }
        ]
      },
      listerLimits: {
        title: 'Límites del Listero',
        sections: [
          {
            lottery: 'Georgia',
            schedules: [
              { name: 'Mediodía', limits: ['Fijo: $1000', 'Corrido: $800'] },
              { name: 'Noche', limits: ['Fijo: $1200', 'Corrido: $900'] }
            ]
          }
        ]
      },
      prices: {
        title: 'Configuración de Precios',
        sections: [
          {
            lottery: 'Georgia',
            schedules: [
              { name: 'Mediodía', prices: ['Fijo: $500/450', 'Corrido: $80/70'] },
              { name: 'Noche', prices: ['Fijo: $520/470', 'Corrido: $85/75'] }
            ]
          }
        ]
      }
    };

    const data = sampleData[modalContent.id];
    
    return (
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{data.title}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.modalCloseButton,
              pressed && styles.modalCloseButtonPressed
            ]}
            onPress={closeModal}
          >
            <Text style={styles.modalCloseText}>✕</Text>
          </Pressable>
        </View>
        
        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          {data.sections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.modalSection}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalLotteryHeader,
                  pressed && styles.modalHeaderPressed
                ]}
                onPress={() => toggleLottery(sectionIndex)}
              >
                <Text style={styles.modalSectionTitle}>{section.lottery}</Text>
                <Text style={[
                  styles.modalExpandIcon,
                  expandedLottery === sectionIndex && styles.modalExpandIconRotated
                ]}>
                  ▶
                </Text>
              </Pressable>
              
              {expandedLottery === sectionIndex && (
                <View style={styles.modalLotteryContent}>
                  {section.schedules.map((schedule, scheduleIndex) => (
                    <View key={scheduleIndex} style={styles.modalSchedule}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.modalScheduleHeader,
                          pressed && styles.modalHeaderPressed
                        ]}
                        onPress={() => toggleSchedule(scheduleIndex)}
                      >
                        <Text style={styles.modalScheduleTitle}>{schedule.name}</Text>
                        <Text style={[
                          styles.modalExpandIcon,
                          expandedSchedule === scheduleIndex && styles.modalExpandIconRotated
                        ]}>
                          ▶
                        </Text>
                      </Pressable>
                      
                      {expandedSchedule === scheduleIndex && (
                        <View style={styles.modalScheduleContent}>
                          {(schedule.numbers || schedule.limits || schedule.prices || []).map((item, itemIndex) => (
                            <Text key={itemIndex} style={styles.modalItem}>• {item}</Text>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <>
      {/* Barra Lateral */}
      <Modal
        visible={isVisible}
        transparent
        animationType="none"
        onRequestClose={handleClose}
      >
        {/* Overlay */}
        <Pressable
          style={styles.overlay}
          onPress={handleClose}
        >
          {/* Sidebar */}
          <Animated.View
            style={[
              styles.sidebar,
              isDarkMode && styles.sidebarDark,
              {
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <Pressable>
              {/* Header */}
              <View style={[styles.header, isDarkMode && styles.headerDark]}>
                <View style={styles.appInfo}>
                  <Text style={styles.appLogo}>🎲</Text>
                  <Text style={[styles.appName, isDarkMode && styles.appNameDark]}>Lotería Pro</Text>
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
              <View style={styles.headerDivider} />

              {/* Content */}
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {configOptions.map((option) => (
                  <Pressable
                    key={option.id}
                    style={({ pressed }) => [
                      styles.optionRow, 
                      isDarkMode && styles.optionRowDark,
                      pressed && styles.buttonPressed
                    ]}
                    onPress={() => handleOptionPress(option)}
                  >
                    <Text style={styles.optionIcon}>{option.icon}</Text>
                    <View style={styles.optionTextContainer}>
                      <Text style={[styles.optionTitle, isDarkMode && styles.optionTitleDark]}>{option.title}</Text>
                      <Text style={[styles.optionDescription, isDarkMode && styles.optionDescriptionDark]}>{option.description}</Text>
                    </View>
                    <Text style={[styles.arrowIcon, isDarkMode && styles.arrowIconDark]}>▶</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Botones inferiores */}
              <View style={[styles.bottomButtons, isDarkMode && styles.bottomButtonsDark]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.darkModeButton,
                    pressed && styles.buttonPressed
                  ]}
                  onPress={toggleDarkMode}
                >
                  <Text style={styles.darkModeIcon}>{isDarkMode ? '☀️' : '🌙'}</Text>
                </Pressable>
                
                <Pressable
                  style={({ pressed }) => [
                    styles.logoutButton,
                    pressed && styles.buttonPressed
                  ]}
                  onPress={handleLogout}
                >
                  <Text style={styles.logoutIcon}>🚪</Text>
                  <Text style={[styles.logoutText, isDarkMode && styles.logoutTextDark]}>Cerrar Sesión</Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Modal para opciones */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={closeModal}
        >
          <View style={styles.modalContainer}>
            <Pressable>
              {renderModalContent()}
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const SideBarToggle = ({ onToggle }) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.toggleButton,
        pressed && styles.buttonPressed
      ]}
      onPress={onToggle}
    >
      <Text style={styles.toggleIcon}>☰</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: screenWidth * 0.5,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
  },
  sidebarDark: {
    backgroundColor: '#2c3e50',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#f8f9fa',
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
    marginRight: 10,
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  appNameDark: {
    color: '#ecf0f1',
  },
  headerDivider: {
    height: 2,
    backgroundColor: '#3498db',
    marginHorizontal: 20,
    marginBottom: 10,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  // Estilos para opciones principales
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
    borderRadius: 8,
  },
  optionRowDark: {
    backgroundColor: '#34495e',
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
    color: '#ecf0f1',
  },
  optionDescription: {
    fontSize: 12,
    color: '#7f8c8d',
    lineHeight: 16,
  },
  optionDescriptionDark: {
    color: '#bdc3c7',
  },
  arrowIcon: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  arrowIconDark: {
    color: '#bdc3c7',
  },
  // Estilos para los botones inferiores
  bottomButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  bottomButtonsDark: {
    borderTopColor: '#34495e',
    backgroundColor: '#2c3e50',
  },
  darkModeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  darkModeIcon: {
    fontSize: 18,
  },
  logoutButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffe6e6',
    borderRadius: 8,
  },
  logoutIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e74c3c',
  },
  logoutTextDark: {
    color: '#e74c3c',
  },
  // Estilos para el modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalLotteryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    marginBottom: 8,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  modalExpandIcon: {
    fontSize: 12,
    color: '#1976d2',
    transform: [{ rotate: '0deg' }],
  },
  modalExpandIconRotated: {
    transform: [{ rotate: '90deg' }],
  },
  modalLotteryContent: {
    paddingLeft: 16,
    marginBottom: 12,
  },
  modalSchedule: {
    marginBottom: 12,
  },
  modalScheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    marginBottom: 8,
  },
  modalScheduleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  modalScheduleContent: {
    paddingLeft: 16,
  },
  modalItem: {
    fontSize: 13,
    color: '#5d6d7e',
    lineHeight: 18,
    marginBottom: 4,
    paddingVertical: 2,
  },
  toggleButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 1000,
  },
  toggleIcon: {
    fontSize: 18,
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});

export { SideBar, SideBarToggle };
