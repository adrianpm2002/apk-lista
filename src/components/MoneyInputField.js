import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';

const MoneyInputField = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder = "$0",
  isDarkMode = false,
  editable = true,
  style,
  inputStyle,
  hasError = false
}) => {
  const [displayValue, setDisplayValue] = useState(value || '');

  // Sincronizar el displayValue cuando el prop value cambie
  useEffect(() => {
    if (value !== undefined && value !== null) {
      // Si es para un campo no editable (como Total), formatear inmediatamente
      if (!editable) {
        const formatted = formatMoney(value);
        setDisplayValue(formatted);
      } else {
        // Para campos editables, usar el valor tal como viene
        setDisplayValue(value || '');
      }
    }
  }, [value, editable]);  // Función para formatear el dinero
  const formatMoney = (amount) => {
    if (!amount || amount === '0' || amount === 0) return '';
    
    // Permitir decimales: convertir a número flotante y formatear
    const num = parseFloat(amount.toString().replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return '';
    
    // Formatear con separadores de miles y símbolo de dinero (con decimales si es necesario)
    const formatted = num.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2 
    });
    return `$${formatted}`;
  };  const handleChange = (text) => {
    // Permitir números y un punto decimal
    const cleaned = text.replace(/[^0-9.]/g, '');
    
    // Permitir solo un punto decimal
    const parts = cleaned.split('.');
    let finalValue = parts[0];
    if (parts.length > 1) {
      finalValue += '.' + parts[1].substring(0, 2); // Máximo 2 decimales
    }
    
    // Si está vacío, limpiar todo
    if (!finalValue) {
      setDisplayValue('');
      onChangeText && onChangeText('');
      return;
    }

    // Actualizar display sin formatear mientras se escribe
    setDisplayValue(finalValue);
    
    // Enviar el valor con decimales al padre
    onChangeText && onChangeText(finalValue);
  };  const handleFocus = () => {
    // Al hacer focus, mostrar solo el valor numérico para facilitar edición
    if (displayValue) {
      const cleaned = displayValue.replace(/[^0-9.]/g, '');
      setDisplayValue(cleaned);
    }
  };

  const handleBlur = () => {
    // Al perder focus, formatear el valor
    if (displayValue) {
      const formatted = formatMoney(displayValue);
      setDisplayValue(formatted);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, isDarkMode && styles.labelDark]}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          isDarkMode && styles.inputDark,
          !editable && styles.inputDisabled,
          hasError && styles.inputError,
          inputStyle, // inputStyle debe ir al final para tener mayor prioridad
        ]}
        value={displayValue}
        onChangeText={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}        placeholder={placeholder}
        placeholderTextColor={isDarkMode ? '#7F8C8D' : '#95A5A6'}
        keyboardType="numeric"
        editable={editable !== false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 6,
  },
  labelDark: {
    color: '#ECF0F1',
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
  inputDisabled: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E9ECEF',
    color: '#6C757D',
  },
  inputError: {
    borderColor: '#E74C3C',
    borderWidth: 2,
    backgroundColor: '#FDEDEC',
  },
});

export default MoneyInputField;
