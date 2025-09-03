import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform } from 'react-native';

const TextInputWithErrorHighlight = ({
  label,
  value,
  onChangeText,
  placeholder,
  hasError = false,
  errorLines = [], // Array de números de línea con errores (empezando desde 1)
  style,
  inputStyle,
  showPasteButton = false,
  pasteButtonOverlay = false,
  showClearButtonOverlay = false,
  onClear,
  ...otherProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const handlePaste = async () => {
    try {
      let text = '';
      if (Platform.OS === 'web') {
        if (navigator.clipboard && navigator.clipboard.readText) {
          text = await navigator.clipboard.readText();
        } else {
          alert('Usa Ctrl+V para pegar');
          return;
        }
      } else {
        const { Clipboard } = require('react-native');
        text = await Clipboard.getString();
      }
      if (text && onChangeText) {
        onChangeText(value ? value + '\n' + text : text);
      }
    } catch (e) {
      console.error('Error al pegar', e);
      alert('No se pudo pegar. Usa Ctrl+V');
    }
  };

  const handleClear = () => {
    if (onClear) onClear();
    else if (onChangeText) onChangeText('');
  };

  // Crear array de botones overlay
  const overlayButtons = [];
  if (showPasteButton) {
    overlayButtons.push({
      icon: '📋',
      onPress: handlePaste,
    });
  }
  if (showClearButtonOverlay) {
    overlayButtons.push({
      icon: '🧹',
      onPress: handleClear,
    });
  }

  return (
    <View style={[styles.container, style]}>
      {!pasteButtonOverlay && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {showPasteButton && (
            <Pressable
              style={[styles.pasteBtn]}
              onPress={handlePaste}
            >
              <Text style={styles.pasteBtnText}>📋</Text>
            </Pressable>
          )}
        </View>
      )}
      {pasteButtonOverlay && <Text style={styles.label}>{label}</Text>}

      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            hasError && styles.inputError,
            isFocused && styles.inputFocused,
            errorLines.length > 0 && styles.inputWithErrors,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#95A5A6"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={true}
          textAlignVertical="top"
          selectionColor="rgba(52, 152, 219, 0.3)"
          {...otherProps}
        />
        
        {pasteButtonOverlay && overlayButtons.length > 0 && (
          <View style={styles.sideButtons}>
            {overlayButtons.map((button, index) => (
              <Pressable
                key={index}
                style={[styles.sideBtn]}
                onPress={button.onPress}
              >
                <Text style={styles.sideBtnTxt}>{button.icon}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      
      {/* Mostrar información de errores debajo del input */}
      {errorLines.length > 0 && (
        <View style={styles.errorInfo}>
          <Text style={styles.errorText}>
            ❌ Errores en línea{errorLines.length > 1 ? 's' : ''}: {errorLines.join(', ')}
          </Text>
        </View>
      )}
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
  },
  inputWrapper: {
    position: 'relative',
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
    minHeight: 120,
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderColor: '#3498DB',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#E74C3C',
    borderWidth: 2,
    backgroundColor: '#FDEDEC',
  },
  inputWithErrors: {
    color: '#DC2626', // Cambiar color de texto cuando hay errores
    fontWeight: '600',
  },
  errorInfo: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  pasteBtn: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#B8D4A8',
  },
  pasteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D5016',
  },
  sideButtons: {
    position: 'absolute',
    right: 8,
    top: 8,
    alignItems: 'flex-end',
  },
  sideBtn: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#B8D4A8',
  },
  sideBtnTxt: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2D5016',
  },
});

export default TextInputWithErrorHighlight;
