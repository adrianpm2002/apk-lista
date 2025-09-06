import React from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform } from 'react-native';
import { createShadowStyle } from '../utils/shadowUtils';

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
  showClearButtonOverlay = false,
  onClear,
  editable = true,
  hasError = false,
  ...otherProps
}) => {
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

  // Crear array de botones overlay basándose en las props
  const overlayButtons = [];
  if (showPasteButton) {
    overlayButtons.push({
      text: '📋 Pegar',
      onPress: handlePaste,
      style: {},
      textStyle: {}
    });
  }
  if (showClearButtonOverlay) {
    overlayButtons.push({
      text: '✕ Limpiar',
      onPress: handleClear,
      style: {},
      textStyle: {}
    });
  }

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
      {pasteButtonOverlay && <Text style={styles.label}>{label}</Text>}

      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            multiline && styles.multilineInput,
            !editable && styles.readOnlyInput,
            hasError && styles.inputError,
            pasteButtonOverlay && (showPasteButton || showClearButtonOverlay) && styles.inputWithOverlayPadding,
            inputStyle,
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
        {pasteButtonOverlay && (showPasteButton || showClearButtonOverlay) && (
          <View style={[styles.overlayButtonsContainer, { pointerEvents: 'box-none' }]}>
            {overlayButtons && overlayButtons.map((button, index) => (
              <Pressable
                key={index}
                style={[
                  styles.overlayButton,
                  button.style
                ]}
                onPress={button.onPress}
              >
                <Text style={[styles.overlayButtonText, button.textStyle]}>
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
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
  overlayButtonsContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    alignItems: 'flex-end',
  },
  smallOverlayButton: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#B8D4A8',
    ...createShadowStyle({
      color: '#2D5016',
      offsetY: 1,
      opacity: 0.1,
      radius: 2,
      elevation: 2,
    }),
  },
  pasteButtonOverlayText: { fontSize: 16, color: '#2D5016' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#B8D4A8',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2D5016',
    ...createShadowStyle({
      color: '#2D5016',
      offsetY: 2,
      opacity: 0.1,
      radius: 3,
      elevation: 3,
    }),
  },
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },
  readOnlyInput: { backgroundColor: '#e8f5e8', color: '#27ae60', fontWeight: 'bold', borderColor: '#27ae60' },
  inputWithOverlayPadding: { paddingRight: 56 },
  inputError: {
    borderColor: '#E74C3C',
    borderWidth: 2,
    backgroundColor: '#FDEDEC',
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
