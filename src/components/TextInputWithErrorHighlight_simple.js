import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform } from 'react-native';

const TextInputWithErrorHighlight = ({
  label,
  value,
  onChangeText,
  placeholder,
  hasError = false,
  errorLines = [], // Array de números de línea con errores (empezando desde 1)
  duplicateNumbers = [], // Array de números que están duplicados
  style,
  inputStyle,
  showPasteButton = false,
  pasteButtonOverlay = false,
  showClearButtonOverlay = false,
  onClear,
  ...otherProps
}) => {
  const [isFocused, setIsFocused] = useState(false);

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

  // Renderizar números duplicados como badges flotantes
  const renderDuplicateBadges = () => {
    if (!duplicateNumbers.length || !value) return null;
    
    return (
      <View style={styles.badgeContainer}>
        <Text style={styles.badgeLabel}>Duplicados:</Text>
        {duplicateNumbers.slice(0, 5).map((number, index) => (
          <View key={index} style={styles.duplicateBadge}>
            <Text style={styles.badgeText}>{number}</Text>
          </View>
        ))}
        {duplicateNumbers.length > 5 && (
          <Text style={styles.moreText}>+{duplicateNumbers.length - 5} más</Text>
        )}
      </View>
    );
  };

  // Crear array de botones overlay
  const overlayButtons = [];
  if (showPasteButton && pasteButtonOverlay) {
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

      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            isFocused && styles.inputFocused,
            hasError && styles.inputError,
            errorLines.length > 0 && styles.inputWithErrors,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          placeholderTextColor="#7F8C8D"
          multiline
          textAlignVertical="top"
          {...otherProps}
        />

        {/* Mostrar badges de duplicados */}
        {renderDuplicateBadges()}

        {/* Botones overlay si están habilitados */}
        {overlayButtons.length > 0 && (
          <View style={styles.sideButtons}>
            {overlayButtons.map((button, index) => (
              <Pressable
                key={index}
                style={styles.sideBtn}
                onPress={button.onPress}
              >
                <Text style={styles.sideBtnTxt}>{button.icon}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Mostrar errores de línea debajo del input */}
      {errorLines.length > 0 && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            ❌ Errores en líneas: {errorLines.join(', ')}
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
    borderColor: '#E74C3C',
    backgroundColor: '#FEF2F2',
  },
  badgeContainer: {
    position: 'absolute',
    top: -8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    maxWidth: '70%',
  },
  badgeLabel: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '600',
    marginRight: 4,
  },
  duplicateBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 2,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '600',
  },
  moreText: {
    fontSize: 9,
    color: '#F59E0B',
    fontStyle: 'italic',
    marginLeft: 4,
  },
  errorContainer: {
    marginTop: 4,
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#E74C3C',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
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
    zIndex: 2,
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
