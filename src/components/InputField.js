import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
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
  showPasteButton = false,
  pasteButtonOverlay = false,
  editable = true,
  ...otherProps
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
      {!pasteButtonOverlay && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {showPasteButton && (
            <Pressable
              style={({ pressed }) => [
                styles.pasteButton,
                pressed && styles.pasteButtonPressed
              ]}
              onPress={handlePaste}
            >
              <Text style={styles.pasteButtonText}>📋 Pegar</Text>
            </Pressable>
          )}
        </View>
      )}
      
      {pasteButtonOverlay && (
        <Text style={styles.label}>{label}</Text>
      )}
      
      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            multiline && styles.multilineInput,
            !editable && styles.readOnlyInput,
            inputStyle
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#8FA987"
          multiline={multiline}
          keyboardType={keyboardType}
          numberOfLines={multiline ? 4 : 1}
          editable={editable}
          {...otherProps}
        />
        
        {pasteButtonOverlay && showPasteButton && (
          <Pressable
            style={({ pressed }) => [
              styles.pasteButtonOverlay,
              pressed && styles.pasteButtonOverlayPressed
            ]}
            onPress={handlePaste}
          >
            <Text style={styles.pasteButtonOverlayText}>📋</Text>
          </Pressable>
        )}
      </View>
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
  inputWrapper: {
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
  pasteButtonOverlayText: {
    fontSize: 16,
    color: '#2D5016',
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
  readOnlyInput: {
    backgroundColor: '#e8f5e8',
    color: '#27ae60',
    fontWeight: 'bold',
    borderColor: '#27ae60',
  },
  pasteButtonPressed: {
    opacity: 0.7,
    backgroundColor: '#D4E8D4',
  },
  pasteButtonOverlayPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
});

export default InputField;
