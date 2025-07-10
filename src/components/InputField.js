import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';

const InputField = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  multiline = false,
  keyboardType = 'default',
  style,
  inputStyle,
  showPasteButton = false
}) => {
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
        const { Clipboard } = require('react-native');
        text = await Clipboard.getString();
      }
      
      if (text && onChangeText) {
        onChangeText(value ? value + '\n' + text : text);
      }
    } catch (error) {
      console.error('Error al pegar:', error);
      alert('No se pudo pegar el texto. Intenta usar Ctrl+V');
    }
  };
  return (
    <View style={[styles.container, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {showPasteButton && (
          <TouchableOpacity
            style={styles.pasteButton}
            onPress={handlePaste}
            activeOpacity={0.7}
          >
            <Text style={styles.pasteButtonText}>📋 Pegar</Text>
          </TouchableOpacity>
        )}
      </View>
      <TextInput
        style={[
          styles.input,
          multiline && styles.multilineInput,
          inputStyle
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8FA987"
        multiline={multiline}
        keyboardType={keyboardType}
        numberOfLines={multiline ? 4 : 1}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
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
    color: '#2D5016',
    marginLeft: 4,
  },
  pasteButton: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#B8D4A8',
  },
  pasteButtonText: {
    fontSize: 12,
    color: '#2D5016',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#B8D4A8',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2D5016',
    shadowColor: '#2D5016',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

export default InputField;
