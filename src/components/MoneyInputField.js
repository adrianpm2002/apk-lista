import React, { useState } from 'react';
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
  editable = true
}) => {
  const [displayValue, setDisplayValue] = useState(value || '');  // Función para formatear el dinero
  const formatMoney = (amount) => {
    if (!amount || amount === '0' || amount === 0) return '';
    
    // Convertir a número entero y formatear (sin decimales)
    const num = parseInt(amount.toString().replace(/[^0-9]/g, ''));
    if (isNaN(num)) return '';
    
    // Formatear con separadores de miles y símbolo de dinero (sin decimales)
    return `$${num.toLocaleString('en-US')}`;
  };  const handleChange = (text) => {
    // Permitir solo números (sin punto decimal)
    const cleaned = text.replace(/[^0-9]/g, '');
    
    // Si está vacío, limpiar todo
    if (!cleaned) {
      setDisplayValue('');
      onChangeText && onChangeText('');
      return;
    }

    // Actualizar display sin formatear mientras se escribe
    setDisplayValue(text);
    
    // Enviar el valor limpio al padre
    onChangeText && onChangeText(cleaned);
  };  const handleFocus = () => {
    // Al hacer focus, mostrar solo el valor numérico para facilitar edición
    if (displayValue) {
      const cleaned = displayValue.replace(/[^0-9]/g, '');
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
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, isDarkMode && styles.labelDark]}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          isDarkMode && styles.inputDark,
        ]}
        value={displayValue}
        onChangeText={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}        placeholder={placeholder}
        placeholderTextColor={isDarkMode ? '#7F8C8D' : '#95A5A6'}
        keyboardType="number-pad"
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
});

export default MoneyInputField;
