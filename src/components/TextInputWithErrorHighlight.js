import React, { useState, useRef } from 'react';
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
  // Props específicos de React Native que se deben filtrar en Web
  keyboardType,
  returnKeyType,
  blurOnSubmit,
  ...otherProps
}) => {
  // Filtrar props de React Native que no son válidos en Web
  const validProps = Platform.OS === 'web' 
    ? otherProps 
    : { ...otherProps, keyboardType, returnKeyType, blurOnSubmit };
  const [isFocused, setIsFocused] = useState(false);
  const editorRef = useRef(null);
  const overlayRef = useRef(null);

  // Sincronizar scroll entre textarea y overlay
  const handleScroll = (e) => {
    if (overlayRef.current && editorRef.current) {
      overlayRef.current.scrollTop = e.target.scrollTop;
      overlayRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  // Generar CSS dinámico para las líneas con errores
  const generateDynamicCSS = () => {
    if (!errorLines.length) return '';
    
    let css = '<style>';
    errorLines.forEach(lineNumber => {
      css += `
        .editor-line:nth-child(${lineNumber}) {
          background-color: rgba(255, 182, 182, 0.25) !important;
          padding-left: 9px !important;
          margin: 0 !important;
          border-radius: 3px !important;
          height: 22.4px !important;
          display: flex !important;
          align-items: center !important;
        }
      `;
    });
    css += '</style>';
    return css;
  };

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

  // Renderizar el editor según la plataforma
  const renderEditor = () => {
    if (Platform.OS === 'web') {
      // Para web, usar textarea con overlay CSS para resaltado de errores
      return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {/* CSS dinámico para errores */}
          {errorLines.length > 0 && (
            <div dangerouslySetInnerHTML={{ __html: generateDynamicCSS() }} />
          )}
          
          <textarea
            ref={editorRef}
            value={value || ''}
            onChange={(e) => {
              if (onChangeText) {
                onChangeText(e.target.value);
              }
            }}
            onScroll={handleScroll}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            style={{
              width: '100%',
              minHeight: '120px',
              border: '1.5px solid #D5DBDB',
              borderRadius: '8px',
              padding: '14px 12px',
              paddingRight: overlayButtons.length > 0 ? '50px' : '12px',
              fontSize: '16px',
              fontFamily: 'monospace',
              color: '#2C3E50',
              backgroundColor: '#FFFFFF',
              resize: 'vertical',
              outline: 'none',
              lineHeight: '1.4',
              boxSizing: 'border-box',
              ...inputStyle,
            }}
            {...validProps}
          />
          
          {/* Overlay para mostrar líneas con errores */}
          {errorLines.length > 0 && value && (
            <div 
              ref={overlayRef}
              style={{
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                pointerEvents: 'none',
                zIndex: 1,
                fontFamily: 'monospace',
                fontSize: '16px',
                lineHeight: '1.4',
                color: 'transparent',
                whiteSpace: 'pre-wrap',
                overflow: 'hidden',
                padding: '14px 12px',
                paddingRight: overlayButtons.length > 0 ? '50px' : '12px',
                border: '1.5px solid transparent',
                borderRadius: '8px',
                boxSizing: 'border-box',
              }}
            >
              {value.split('\n').map((line, index) => {
                const lineNumber = index + 1;
                const hasLineError = errorLines.includes(lineNumber);
                return (
                  <div 
                    key={index}
                    className="editor-line"
                    style={{
                      backgroundColor: hasLineError ? 'rgba(255, 182, 182, 0.25)' : 'transparent',
                      paddingLeft: '6px',
                      margin: '0',
                      borderRadius: '3px',
                      lineHeight: '1.4',
                      height: '22.4px', // 16px (fontSize) * 1.4 (lineHeight) = altura exacta
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {line || '\u00A0'}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Para React Native nativo, implementar señalización de errores mejorada
    return (
      <View style={{ position: 'relative' }}>
        <TextInput
          style={[
            styles.input,
            overlayButtons.length > 0 && styles.inputWithOverlayButtons,
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
          {...validProps}
        />
        
        {/* Mostrar indicador de errores específicos debajo del input - REMOVIDO */}
      </View>
    );
  };

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
        {renderEditor()}

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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  inputWithOverlayButtons: {
    paddingRight: 50, // Espacio para los botones overlay (evita superposición del texto)
  },
  inputWithErrors: {
    // Para React Native, usar borde izquierdo como indicador de errores
    borderLeftWidth: 4,
    borderLeftColor: '#FF7F7F',
    paddingLeft: 8,
  },
  inputWithLineErrors: {
    // Estilos especiales para errores de líneas específicas
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
    backgroundColor: '#FEF2F2',
    paddingLeft: 8,
  },
  rnErrorIndicator: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  rnErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rnErrorIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  rnErrorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '700',
  },
  rnErrorLines: {
    fontSize: 12,
    color: '#B91C1C',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    marginLeft: 20, // Alinear con el texto después del ícono
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
