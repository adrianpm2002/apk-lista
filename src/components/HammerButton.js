import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  FlatList,
  Clipboard,
  Platform,
  Alert,
} from 'react-native';

const HammerButton = ({ onOptionSelect, isDarkMode = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [numbersList, setNumbersList] = useState([]);
  const [currentNumber, setCurrentNumber] = useState('');
  const [decenaUnidadMode, setDecenaUnidadMode] = useState('decena'); // 'decena' o 'unidad'
  const [decenaTerminalMode, setDecenaTerminalMode] = useState('decena'); // 'decena' o 'terminal'
  const [combinarParleEnabled, setCombinarParleEnabled] = useState(false);

  // Función para agregar número al cuadro actual
  const handleDigitPress = (digit) => {
    if (decenaUnidadMode === 'decena') {
      // Modo decena: agregar dígito a la decena (posición izquierda)
      if (currentNumber.length === 0) {
        setCurrentNumber(digit.toString());
      } else if (currentNumber.length === 1) {
        setCurrentNumber(digit.toString() + currentNumber);
      } else {
        // Reemplazar decena
        setCurrentNumber(digit.toString() + currentNumber.charAt(1));
      }
    } else {
      // Modo unidad: agregar dígito a la unidad (posición derecha)
      if (currentNumber.length === 0) {
        setCurrentNumber('0' + digit.toString());
      } else if (currentNumber.length === 1) {
        setCurrentNumber(currentNumber + digit.toString());
      } else {
        // Reemplazar unidad
        setCurrentNumber(currentNumber.charAt(0) + digit.toString());
      }
    }
  };

  // Función para amarrar (agregar número actual a la lista)
  const handleAmarrar = () => {
    if (currentNumber && currentNumber.length === 2) {
      const formattedNumber = currentNumber.padStart(2, '0');
      if (!numbersList.includes(formattedNumber)) {
        setNumbersList([...numbersList, formattedNumber]);
        setCurrentNumber('');
      } else {
        Alert.alert('Número duplicado', 'Este número ya está en la lista');
      }
    } else {
      Alert.alert('Número incompleto', 'Completa el número de 2 dígitos');
    }
  };

  // Función para generar parejas
  const handlePareja = () => {
    if (currentNumber && currentNumber.length === 2) {
      const digit1 = currentNumber.charAt(0);
      const digit2 = currentNumber.charAt(1);
      const pareja1 = digit1 + digit2;
      const pareja2 = digit2 + digit1;
      
      const newNumbers = [];
      if (!numbersList.includes(pareja1)) newNumbers.push(pareja1);
      if (!numbersList.includes(pareja2) && pareja1 !== pareja2) newNumbers.push(pareja2);
      
      if (newNumbers.length > 0) {
        setNumbersList([...numbersList, ...newNumbers]);
        setCurrentNumber('');
      } else {
        Alert.alert('Parejas existentes', 'Las parejas ya están en la lista');
      }
    } else {
      Alert.alert('Número incompleto', 'Completa el número de 2 dígitos');
    }
  };

  // Función para pegar desde clipboard
  const handlePaste = async () => {
    try {
      let text = '';
      
      if (Platform.OS === 'web') {
        if (navigator.clipboard && navigator.clipboard.readText) {
          text = await navigator.clipboard.readText();
        } else {
          Alert.alert('Error', 'No se pudo acceder al portapapeles');
          return;
        }
      } else {
        text = await Clipboard.getString();
      }
      
      if (text) {
        // Extraer números de 2 dígitos del texto
        const numbers = text.match(/\d{2}/g) || [];
        const validNumbers = numbers.filter(num => !numbersList.includes(num));
        
        if (validNumbers.length > 0) {
          setNumbersList([...numbersList, ...validNumbers]);
        } else {
          Alert.alert('Sin números nuevos', 'No se encontraron números válidos para agregar');
        }
      }
    } catch (error) {
      console.error('Error al pegar:', error);
      Alert.alert('Error', 'No se pudo pegar el texto');
    }
  };

  // Función para eliminar todos los números
  const handleDelete = () => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que quieres eliminar todos los números?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => setNumbersList([]) }
      ]
    );
  };

  // Función para insertar números en el campo principal
  const handleInsertar = () => {
    if (numbersList.length > 0) {
      const numbersText = numbersList.join(', ');
      onOptionSelect && onOptionSelect({ action: 'insert', numbers: numbersText });
      setIsVisible(false);
      // Limpiar lista después de insertar
      setNumbersList([]);
      setCurrentNumber('');
    } else {
      Alert.alert('Lista vacía', 'Agrega números antes de insertar');
    }
  };

  // Función para cancelar
  const handleCancel = () => {
    setIsVisible(false);
    setNumbersList([]);
    setCurrentNumber('');
  };

  // Renderizar número en la lista
  const renderNumberItem = ({ item, index }) => (
    <Pressable
      style={[styles.numberItem, isDarkMode && styles.numberItemDark]}
      onPress={() => {
        const newList = numbersList.filter((_, i) => i !== index);
        setNumbersList(newList);
      }}
    >
      <Text style={[styles.numberItemText, isDarkMode && styles.numberItemTextDark]}>{item}</Text>
    </Pressable>
  );

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          isDarkMode && styles.buttonDark
        ]}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.buttonIcon}>🔨</Text>
      </Pressable>

      <Modal
        visible={isVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, isDarkMode && styles.modalDark]}>
            {/* Botones superior derecha */}
            <View style={styles.topButtonsContainer}>
              <Pressable style={[styles.topButton, isDarkMode && styles.topButtonDark]} onPress={handlePaste}>
                <Text style={styles.topButtonText}>📋</Text>
              </Pressable>
              <Pressable style={[styles.topButton, isDarkMode && styles.topButtonDark]} onPress={handleDelete}>
                <Text style={styles.topButtonText}>🗑️</Text>
              </Pressable>
            </View>

            {/* Lista de números */}
            <View style={styles.numbersListContainer}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>Lista de números:</Text>
              <FlatList
                data={numbersList}
                renderItem={renderNumberItem}
                keyExtractor={(item, index) => index.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.numbersList}
                contentContainerStyle={styles.numbersListContent}
              />
            </View>

            {/* Cuadro del número actual */}
            <View style={styles.currentNumberContainer}>
              <Text style={[styles.currentNumber, isDarkMode && styles.currentNumberDark]}>
                {currentNumber.padStart(2, '_')}
              </Text>
            </View>

            {/* Teclado numérico */}
            <View style={styles.numpadContainer}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <Pressable
                  key={digit}
                  style={[styles.numpadButton, isDarkMode && styles.numpadButtonDark]}
                  onPress={() => handleDigitPress(digit)}
                >
                  <Text style={[styles.numpadButtonText, isDarkMode && styles.numpadButtonTextDark]}>
                    {digit}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Selector Decena/Unidad */}
            <View style={styles.switchContainer}>
              <View style={styles.switchGroup}>
                <Text style={[styles.switchLabel, isDarkMode && styles.switchLabelDark]}>Modo:</Text>
                <View style={styles.switchButtons}>
                  <Pressable
                    style={[
                      styles.switchButton,
                      decenaUnidadMode === 'decena' && styles.switchButtonActive,
                      isDarkMode && styles.switchButtonDark,
                      decenaUnidadMode === 'decena' && isDarkMode && styles.switchButtonActiveDark
                    ]}
                    onPress={() => setDecenaUnidadMode('decena')}
                  >
                    <Text style={[
                      styles.switchButtonText,
                      decenaUnidadMode === 'decena' && styles.switchButtonTextActive,
                      isDarkMode && styles.switchButtonTextDark
                    ]}>Decena</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.switchButton,
                      decenaUnidadMode === 'unidad' && styles.switchButtonActive,
                      isDarkMode && styles.switchButtonDark,
                      decenaUnidadMode === 'unidad' && isDarkMode && styles.switchButtonActiveDark
                    ]}
                    onPress={() => setDecenaUnidadMode('unidad')}
                  >
                    <Text style={[
                      styles.switchButtonText,
                      decenaUnidadMode === 'unidad' && styles.switchButtonTextActive,
                      isDarkMode && styles.switchButtonTextDark
                    ]}>Unidad</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Selector Decena/Terminal y Botón Amarrar */}
            <View style={styles.actionsRow}>
              <View style={styles.switchGroup}>
                <Text style={[styles.switchLabel, isDarkMode && styles.switchLabelDark]}>Tipo:</Text>
                <View style={styles.switchButtons}>
                  <Pressable
                    style={[
                      styles.switchButton,
                      decenaTerminalMode === 'decena' && styles.switchButtonActive,
                      isDarkMode && styles.switchButtonDark,
                      decenaTerminalMode === 'decena' && isDarkMode && styles.switchButtonActiveDark
                    ]}
                    onPress={() => setDecenaTerminalMode('decena')}
                  >
                    <Text style={[
                      styles.switchButtonText,
                      decenaTerminalMode === 'decena' && styles.switchButtonTextActive,
                      isDarkMode && styles.switchButtonTextDark
                    ]}>Decena</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.switchButton,
                      decenaTerminalMode === 'terminal' && styles.switchButtonActive,
                      isDarkMode && styles.switchButtonDark,
                      decenaTerminalMode === 'terminal' && isDarkMode && styles.switchButtonActiveDark
                    ]}
                    onPress={() => setDecenaTerminalMode('terminal')}
                  >
                    <Text style={[
                      styles.switchButtonText,
                      decenaTerminalMode === 'terminal' && styles.switchButtonTextActive,
                      isDarkMode && styles.switchButtonTextDark
                    ]}>Terminal</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable
                style={[styles.amarrarButton, isDarkMode && styles.amarrarButtonDark]}
                onPress={handleAmarrar}
              >
                <Text style={[styles.amarrarButtonText, isDarkMode && styles.amarrarButtonTextDark]}>
                  Amarrar
                </Text>
              </Pressable>
            </View>

            {/* Combinar Parle y Pareja */}
            <View style={styles.combineRow}>
              <View style={styles.combineGroup}>
                <Pressable
                  style={[
                    styles.combineSwitch,
                    combinarParleEnabled && styles.combineSwitchActive,
                    isDarkMode && styles.combineSwitchDark,
                    combinarParleEnabled && isDarkMode && styles.combineSwitchActiveDark
                  ]}
                  onPress={() => setCombinarParleEnabled(!combinarParleEnabled)}
                >
                  <Text style={[
                    styles.combineSwitchText,
                    combinarParleEnabled && styles.combineSwitchTextActive,
                    isDarkMode && styles.combineSwitchTextDark
                  ]}>Combinar Parle</Text>
                </Pressable>
              </View>

              <Pressable
                style={[styles.parejaButton, isDarkMode && styles.parejaButtonDark]}
                onPress={handlePareja}
              >
                <Text style={[styles.parejaButtonText, isDarkMode && styles.parejaButtonTextDark]}>
                  Pareja
                </Text>
              </Pressable>
            </View>

            {/* Botones finales */}
            <View style={styles.finalButtonsContainer}>
              <Pressable
                style={[styles.cancelButton, isDarkMode && styles.cancelButtonDark]}
                onPress={handleCancel}
              >
                <Text style={[styles.cancelButtonText, isDarkMode && styles.cancelButtonTextDark]}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                style={[styles.insertButton, isDarkMode && styles.insertButtonDark]}
                onPress={handleInsertar}
              >
                <Text style={[styles.insertButtonText, isDarkMode && styles.insertButtonTextDark]}>
                  Insertar
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#B8D4A8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D5016',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  buttonIcon: {
    fontSize: 18,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  modalDark: {
    backgroundColor: '#2C3E50',
  },
  topButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  topButton: {
    backgroundColor: '#E8F5E8',
    borderRadius: 6,
    padding: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#B8D4A8',
  },
  topButtonDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  topButtonText: {
    fontSize: 16,
  },
  numbersListContainer: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D5016',
    marginBottom: 6,
  },
  sectionTitleDark: {
    color: '#ECF0F1',
  },
  numbersList: {
    height: 40,
  },
  numbersListContent: {
    alignItems: 'center',
  },
  numberItem: {
    backgroundColor: '#E8F5E8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#B8D4A8',
  },
  numberItemDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  numberItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D5016',
  },
  numberItemTextDark: {
    color: '#ECF0F1',
  },
  currentNumberContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  currentNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D5016',
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#B8D4A8',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  currentNumberDark: {
    color: '#ECF0F1',
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  numpadContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 12,
  },
  numpadButton: {
    width: 40,
    height: 40,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#B8D4A8',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 3,
  },
  numpadButtonDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  numpadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D5016',
  },
  numpadButtonTextDark: {
    color: '#ECF0F1',
  },
  switchContainer: {
    marginBottom: 12,
  },
  switchGroup: {
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D5016',
    marginBottom: 6,
  },
  switchLabelDark: {
    color: '#ECF0F1',
  },
  switchButtons: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#B8D4A8',
    borderRadius: 6,
    overflow: 'hidden',
  },
  switchButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8F9FA',
  },
  switchButtonDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  switchButtonActive: {
    backgroundColor: '#E8F5E8',
  },
  switchButtonActiveDark: {
    backgroundColor: '#5D6D7E',
  },
  switchButtonText: {
    fontSize: 12,
    color: '#2D5016',
    fontWeight: '500',
  },
  switchButtonTextDark: {
    color: '#ECF0F1',
  },
  switchButtonTextActive: {
    fontWeight: '700',
    color: '#27AE60',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  amarrarButton: {
    backgroundColor: '#F39C12',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E67E22',
  },
  amarrarButtonDark: {
    backgroundColor: '#E67E22',
    borderColor: '#D35400',
  },
  amarrarButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  amarrarButtonTextDark: {
    color: '#FFFFFF',
  },
  combineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  combineGroup: {
    flex: 1,
  },
  combineSwitch: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#B8D4A8',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  combineSwitchDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  combineSwitchActive: {
    backgroundColor: '#E8F5E8',
    borderColor: '#27AE60',
  },
  combineSwitchActiveDark: {
    backgroundColor: '#5D6D7E',
    borderColor: '#27AE60',
  },
  combineSwitchText: {
    fontSize: 12,
    color: '#2D5016',
    fontWeight: '500',
  },
  combineSwitchTextDark: {
    color: '#ECF0F1',
  },
  combineSwitchTextActive: {
    fontWeight: '700',
    color: '#27AE60',
  },
  parejaButton: {
    backgroundColor: '#9B59B6',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: '#8E44AD',
  },
  parejaButtonDark: {
    backgroundColor: '#8E44AD',
    borderColor: '#7D3C98',
  },
  parejaButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  parejaButtonTextDark: {
    color: '#FFFFFF',
  },
  finalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: '#E74C3C',
    borderRadius: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#C0392B',
  },
  cancelButtonDark: {
    backgroundColor: '#C0392B',
    borderColor: '#A93226',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cancelButtonTextDark: {
    color: '#FFFFFF',
  },
  insertButton: {
    backgroundColor: '#27AE60',
    borderRadius: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flex: 1,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#229954',
  },
  insertButtonDark: {
    backgroundColor: '#229954',
    borderColor: '#1E8449',
  },
  insertButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  insertButtonTextDark: {
    color: '#FFFFFF',
  },
});

export default HammerButton;
