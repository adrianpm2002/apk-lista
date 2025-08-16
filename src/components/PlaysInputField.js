import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Clipboard,
  Platform,
} from 'react-native';

const PlaysInputField = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder,
  playType, // 'fijo', 'corrido', 'parle', 'centena', 'tripleta'
  isDarkMode = false,
  multiline = true,
  showPasteButton = false, // Cambiado a false por defecto
  pasteButtonOverlay = false,
  hasError = false
}) => {
  const [displayValue, setDisplayValue] = useState(value || '');

  useEffect(() => {
    setDisplayValue(value || '');
  }, [value]);

  // Obtener la longitud requerida según el tipo de jugada
  const getRequiredLength = () => {
    // Extraer el valor del playType (puede ser un objeto {label, value} o directamente el valor)
    const playTypeValue = typeof playType === 'object' ? playType?.value : playType;
    
    // Si no hay tipo de jugada seleccionado, no hacer separación automática
    if (!playTypeValue) {
      return null;
    }
    
    switch (playTypeValue) {
      case 'fijo':
      case 'corrido':
      case 'posicion':
      case 'parle':
        return 2;
      case 'centena':
        return 3;
      case 'tripleta':
        return 6;
      default:
        return 2; // Default a fijo
    }
  };

  // Formatear número individual según las reglas
  const formatNumber = (num) => {
    const requiredLength = getRequiredLength();
    
    // Para números del 0-9, agregar ceros a la izquierda
    if (num.length === 1 && requiredLength >= 2) {
      return '0' + num;
    }
    
    return num;
  };

  // Separar automáticamente números largos según el tipo de jugada
  const autoSeparateNumbers = (text) => {
    const requiredLength = getRequiredLength();
    if (!requiredLength) return text;
    const cleanText = text.replace(/[^0-9]/g, '');
    if (!cleanText) return '';
    const fullLength = Math.floor(cleanText.length / requiredLength) * requiredLength; // solo bloques completos
    const numbers = [];
    for (let i = 0; i < fullLength; i += requiredLength) {
      const chunk = cleanText.slice(i, i + requiredLength);
      numbers.push(formatNumber(chunk));
    }
    // Agregar fragmento parcial (sin coma previa) solo como texto editable continuo
    const partial = cleanText.slice(fullLength);
    if (partial.length > 0) {
      return numbers.length ? numbers.join(', ') + ', ' + partial : partial;
    }
    return numbers.join(', ');
  };

  // Función para limpiar y formatear automáticamente texto con caracteres mixtos
  const cleanAndFormatText = (text) => {
    // Extraer solo los números del texto, removiendo cualquier carácter no numérico
    const numbersOnly = text.replace(/[^0-9]/g, '');
    
    if (!numbersOnly) return '';
    
    const requiredLength = getRequiredLength();
    if (!requiredLength) return numbersOnly;
    
    // Dividir en grupos según la longitud requerida
    const numbers = [];
    for (let i = 0; i < numbersOnly.length; i += requiredLength) {
      const chunk = numbersOnly.slice(i, i + requiredLength);
      if (chunk.length === requiredLength) {
        numbers.push(formatNumber(chunk));
      } else if (chunk.length > 0) {
        // Agregar el último chunk incompleto
        numbers.push(chunk);
      }
    }
    
    return numbers.join(', ');
  };

  const handleChange = (text) => {
    const playTypeValue = typeof playType === 'object' ? playType?.value : playType;
    const requiredLength = getRequiredLength();

    // Siempre extraer todos los dígitos y reagrupar (idempotente) cuando hay tipo de jugada
    if (playTypeValue && requiredLength) {
      const digits = text.replace(/[^0-9]/g, '');
      if (!digits) {
        setDisplayValue('');
        onChangeText && onChangeText('');
        return;
      }
      // Reconstruir bloques completos + posible parcial visible
      const fullLen = Math.floor(digits.length / requiredLength) * requiredLength;
      const blocks = [];
      for (let i = 0; i < fullLen; i += requiredLength) {
        blocks.push(formatNumber(digits.slice(i, i + requiredLength)));
      }
      const partial = digits.slice(fullLen);
      const formatted = partial.length > 0
        ? (blocks.length ? blocks.join(', ') + ', ' + partial : partial)
        : blocks.join(', ');
      setDisplayValue(formatted);
      onChangeText && onChangeText(formatted);
      return;
    }

    // Sin tipo de jugada: solo limpiar caracteres inválidos, mantener texto tal cual
    const cleaned = text.replace(/[^0-9,*\-\s]/g, '');
    setDisplayValue(cleaned);
    onChangeText && onChangeText(cleaned);
  };

  const handleBlur = () => {
    // Al perder el foco, formatear todos los números
    const numbers = displayValue.split(/[,*\-\s]+/).filter(num => num.trim() !== '');
    const formattedNumbers = numbers.map(num => {
      const cleanNum = num.replace(/[^0-9]/g, '');
      return formatNumber(cleanNum);
    });
    
    const formatted = formattedNumbers.join(', ');
    setDisplayValue(formatted);
    onChangeText && onChangeText(formatted);
  };

  const handlePaste = async () => {
    try {
      let text = '';
      
      if (Platform.OS === 'web') {
        // Para web usamos la API del navegador
        if (navigator.clipboard && navigator.clipboard.readText) {
          text = await navigator.clipboard.readText();
        } else {
          // Fallback para navegadores más antiguos
          alert('Por favor, usa Ctrl+V para pegar');
          return;
        }
      } else {
        // Para React Native móvil
        text = await Clipboard.getString();
      }
      
      if (text) {
        // Limpiar automáticamente el contenido del clipboard
        const playTypeValue = typeof playType === 'object' ? playType?.value : playType;
        
        let cleanedContent = text;
        
        // Si hay caracteres no válidos, limpiar automáticamente
        if (playTypeValue && /[^0-9,*\-\s]/.test(text)) {
          cleanedContent = cleanAndFormatText(text);
        }
        
        // Si hay contenido previo, agregarlo con una coma
        const newValue = displayValue ? `${displayValue}, ${cleanedContent}` : cleanedContent;
        handleChange(newValue);
      }
    } catch (error) {
      console.error('Error al pegar:', error);
      alert('No se pudo pegar el texto. Intenta usar Ctrl+V');
    }
  };

  const getValidationMessage = () => {
    // Extraer el valor del playType
    const playTypeValue = typeof playType === 'object' ? playType?.value : playType;
    
    if (!playTypeValue) return ''; // No validar si no hay tipo de jugada seleccionado
    
    const requiredLength = getRequiredLength();
    if (!requiredLength) return '';
    
    const numbers = displayValue.split(/[,*\-\s]+/).filter(num => num.trim() !== '');
    
    // Validar longitud incorrecta
    const invalidLengthNumbers = numbers.filter(num => {
      const cleanNum = num.replace(/[^0-9]/g, '');
      return cleanNum.length !== requiredLength;
    });

    // Validar números duplicados
    const cleanNumbers = numbers.map(num => num.replace(/[^0-9]/g, ''));
    const duplicates = cleanNumbers.filter((num, index) => 
      cleanNumbers.indexOf(num) !== index && num.length === requiredLength
    );

    if (invalidLengthNumbers.length > 0) {
      const labelMap = {
        'fijo': 'Fijo',
        'corrido': 'Corrido',
        'posicion': 'Posición',
        'parle': 'Parlé',
        'centena': 'Centena',
        'tripleta': 'Tripleta'
      };
      const label = labelMap[playTypeValue] || playTypeValue;
      return `${label} requiere números de ${requiredLength} dígitos`;
    }

  // Duplicados ahora NO son error: se mostrará advertencia aparte
    
    return '';
  };

  // Función para identificar números con errores
  const getErrorNumbers = () => {
    const playTypeValue = typeof playType === 'object' ? playType?.value : playType;
    if (!playTypeValue) return [];
    
    const requiredLength = getRequiredLength();
    if (!requiredLength) return [];
    
    const numbers = displayValue.split(/[,*\-\s]+/).filter(num => num.trim() !== '');
    const cleanNumbers = numbers.map(num => num.replace(/[^0-9]/g, ''));
    const errorNumbers = [];

    numbers.forEach((num, index) => {
      const cleanNum = num.replace(/[^0-9]/g, '');
      
      // Error por longitud incorrecta
      if (cleanNum.length !== requiredLength) {
        errorNumbers.push(cleanNum);
      }
      
  // Duplicados ya no se incluyen como error crítico
    });

    return [...new Set(errorNumbers)]; // Remover duplicados del array de errores
  };

  // Renderizar texto con números de error resaltados
  const renderFormattedText = () => {
    if (!displayValue) return null;
    
    const errorNumbers = getErrorNumbers();
    if (errorNumbers.length === 0) return null;

    const parts = [];
    let currentText = displayValue;
    let key = 0;

    // Encontrar y resaltar números con errores
    errorNumbers.forEach(errorNum => {
      const regex = new RegExp(`(${errorNum})`, 'g');
      currentText = currentText.replace(regex, '|||ERROR|||$1|||ERROR|||');
    });

    const segments = currentText.split('|||ERROR|||');
    
    segments.forEach((segment, index) => {
      if (errorNumbers.includes(segment)) {
        parts.push(
          <Text key={key++} style={styles.errorText}>
            {segment}
          </Text>
        );
      } else if (segment) {
        parts.push(
          <Text key={key++} style={[styles.normalText, isDarkMode && styles.normalTextDark]}>
            {segment}
          </Text>
        );
      }
    });

    return parts;
  };

  const validationMessage = getValidationMessage();
  const hasErrors = validationMessage !== '';
  const errorNumbers = getErrorNumbers();
  // Detectar duplicados (advertencia)
  const detectDuplicates = () => {
    const playTypeValue = typeof playType === 'object' ? playType?.value : playType;
    if (!playTypeValue) return [];
    const requiredLength = getRequiredLength();
    if (!requiredLength) return [];
    const numbers = displayValue.split(/[,*\-\s]+/).filter(num => num.trim() !== '');
    const cleanNumbers = numbers.map(num => num.replace(/[^0-9]/g, ''));
    const duplicates = [];
    cleanNumbers.forEach(n => {
      if (n.length === requiredLength && cleanNumbers.filter(x=>x===n).length > 1) duplicates.push(n);
    });
    return [...new Set(duplicates)];
  };
  const duplicateNumbers = detectDuplicates();
  const showErrorOverlay = hasErrors && errorNumbers.length > 0;
  const showDuplicateOverlay = !hasErrors && duplicateNumbers.length > 0;

  return (
    <View style={styles.container}>
      {!pasteButtonOverlay && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, isDarkMode && styles.labelDark]}>
            {label}
          </Text>
          {showPasteButton && (
            <Pressable
              style={({ pressed }) => [
                styles.pasteButton,
                pressed && styles.pasteButtonPressed,
                isDarkMode && styles.pasteButtonDark
              ]}
              onPress={handlePaste}
            >
              <Text style={[styles.pasteButtonText, isDarkMode && styles.pasteButtonTextDark]}>📋 Pegar</Text>
            </Pressable>
          )}
        </View>
      )}
      
      {pasteButtonOverlay && label && (
        <Text style={[styles.label, isDarkMode && styles.labelDark]}>
          {label}
        </Text>
      )}
      <View style={styles.inputContainer}>
    <TextInput
          style={[
            styles.input,
            isDarkMode && styles.inputDark,
            multiline && styles.multilineInput,
            validationMessage && styles.inputError,
            hasError && styles.inputFieldError,
      (showErrorOverlay || showDuplicateOverlay) && styles.inputWithOverlay, // ocultar texto base cuando hay overlay
          ]}
          value={displayValue}
          onChangeText={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={isDarkMode ? '#7F8C8D' : '#95A5A6'}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
        />
        
        {/* Overlay de texto formateado con errores resaltados */}
  {showErrorOverlay && (
          <View style={[
            styles.textOverlay,
            multiline && styles.textOverlayMultiline
          ]} pointerEvents="none">
            <Text style={styles.overlayContainer}>
              {renderFormattedText()}
            </Text>
          </View>
        )}
        {/* Overlay parcial para duplicados (advertencia) */}
  {showDuplicateOverlay && (
          <View style={[
            styles.textOverlay,
            multiline && styles.textOverlayMultiline
          ]} pointerEvents="none">
            <Text style={styles.overlayContainer}>
              {displayValue.split(/([,*\-\s]+)/).map((part, idx) => {
                const clean = part.replace(/[^0-9]/g,'');
                if (duplicateNumbers.includes(clean)) {
                  return <Text key={idx} style={styles.duplicateText}>{part}</Text>;
                }
                return <Text key={idx} style={[styles.normalText, isDarkMode && styles.normalTextDark]}>{part}</Text>;
              })}
            </Text>
          </View>
        )}
        
        {pasteButtonOverlay && showPasteButton && (
          <Pressable
            style={({ pressed }) => [
              styles.pasteButtonOverlay,
              pressed && styles.pasteButtonOverlayPressed,
              isDarkMode && styles.pasteButtonOverlayDark
            ]}
            onPress={handlePaste}
          >
            <Text style={[styles.pasteButtonOverlayText, isDarkMode && styles.pasteButtonOverlayTextDark]}>📋</Text>
          </Pressable>
        )}
      </View>
      {validationMessage ? (
        <Text style={styles.validationText}>{validationMessage}</Text>
      ) : duplicateNumbers.length > 0 ? (
        <Text style={styles.warningText}>Hay números duplicados (se permiten pero verifique).</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginLeft: 4,
  },
  labelDark: {
    color: '#ECF0F1',
  },
  pasteButton: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#B8D4A8',
  },
  pasteButtonDark: {
    backgroundColor: '#2C3E50',
    borderColor: '#5D6D7E',
  },
  pasteButtonText: {
    fontSize: 12,
    color: '#2D5016',
    fontWeight: '600',
  },
  pasteButtonTextDark: {
    color: '#ECF0F1',
  },
  pasteButtonPressed: {
    opacity: 0.7,
    backgroundColor: '#D4E8D4',
  },
  inputContainer: {
    position: 'relative',
  },
  pasteButtonOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#B8D4A8',
    shadowColor: '#2D5016',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pasteButtonOverlayDark: {
    backgroundColor: '#2C3E50',
    borderColor: '#5D6D7E',
    shadowColor: '#ECF0F1',
  },
  pasteButtonOverlayText: {
    fontSize: 16,
    color: '#2D5016',
  },
  pasteButtonOverlayTextDark: {
    color: '#ECF0F1',
  },
  pasteButtonOverlayPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#D5DBDB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#2C3E50',
    minHeight: 50,
  },
  inputDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
    color: '#ECF0F1',
  },
  inputError: {
    borderColor: '#E74C3C',
    borderWidth: 2,
  },
  inputFieldError: {
    borderColor: '#E74C3C',
    borderWidth: 2,
    backgroundColor: '#FDEDEC',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputWithOverlay: {
    color: 'transparent', // Ocultar el texto del input cuando hay overlay
  },
  textOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'flex-start',
  },
  textOverlayMultiline: {
    height: 80,
    alignItems: 'flex-start',
  },
  overlayContainer: {
    fontSize: 16,
    lineHeight: 22,
    flexWrap: 'wrap',
  },
  normalText: {
    color: '#2C3E50',
    fontSize: 16,
  },
  normalTextDark: {
    color: '#ECF0F1',
  },
  errorText: {
    color: '#E74C3C',
    backgroundColor: '#FADBD8',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 2,
    borderRadius: 3,
  },
  duplicateText: {
    color: '#B9770E',
    backgroundColor: '#FCF3CF',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 2,
    borderRadius: 3,
  },
  validationText: {
    marginTop: 4,
    fontSize: 12,
    color: '#E74C3C',
  },
  warningText: {
    marginTop: 4,
    fontSize: 12,
    color: '#B9770E',
  },
});

export default PlaysInputField;
