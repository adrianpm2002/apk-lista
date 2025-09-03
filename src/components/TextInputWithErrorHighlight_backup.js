import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';

const TextInputWithErrorHighlight = ({
  label,
  value,
  onChangeText,
  placeholder,
  hasError = false,
  errorLines = [], // Array de números de línea con errores (empezando desde 1)
  duplicateLines = [], // Array de números de línea con duplicados (empezando desde 1)
  duplicateNumbers = [], // Array de números que están duplicados para resaltar específicamente
  style,
  inputStyle,
  showPasteButton = false,
  pasteButtonOverlay = false,
  showClearButtonOverlay = false,
  onClear,
  ...otherProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const inputRef = useRef(null);
  const overlayScrollRef = useRef(null);

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

  // Sincronizar scroll entre input y overlay
  const handleScroll = (event) => {
    if (!event || !event.nativeEvent) return;
    
    const { contentOffset } = event.nativeEvent;
    if (!contentOffset) return;
    
    const x = contentOffset.x || 0;
    const y = contentOffset.y || 0;
    
    setScrollPosition({ x, y });
    
    // Sincronizar el scroll del overlay si existe
    if (overlayScrollRef.current) {
      overlayScrollRef.current.scrollTo({
        x,
        y,
        animated: false,
      });
    }
  };

  // Dividir el texto en líneas para mostrar con colores
  const renderTextWithHighlight = () => {
    if (!value) return null;
    
    const lines = value.split('\n');
    return (
      <ScrollView
        ref={overlayScrollRef}
        style={[styles.textOverlay, { pointerEvents: 'none' }]}
        contentContainerStyle={styles.overlayContent}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        {lines.map((line, index) => {
          const lineNumber = index + 1;
          const hasErrorInLine = errorLines.includes(lineNumber);
          
          // Si la línea tiene error, resaltar toda la línea en rojo
          if (hasErrorInLine) {
            return (
              <Text 
                key={index}
                style={[styles.overlayLine, styles.errorOverlayLine]}
              >
                {line || ' '}
              </Text>
            );
          }
          
          // Si no hay duplicados específicos, mostrar línea normal
          if (!duplicateNumbers.length) {
            return (
              <Text 
                key={index}
                style={styles.overlayLine}
              >
                {line || ' '}
              </Text>
            );
          }
          
          // Resaltar números específicos duplicados
          let processedLine = line || ' ';
          
          // Si no hay duplicados específicos, mostrar línea normal
          if (!duplicateNumbers.length) {
            return (
              <Text 
                key={index}
                style={styles.overlayLine}
              >
                {processedLine}
              </Text>
            );
          }
          
          // Crear regex para encontrar números completos (separados por espacios, comas, etc.)
          let segments = [];
          let lastIndex = 0;
          let foundAnyDuplicate = false;
          
          // Buscar números en la línea usando una regex más específica
          const numberRegex = /\b\d+\b/g;
          let match;
          
          while ((match = numberRegex.exec(processedLine)) !== null) {
            const number = match[0];
            const isDuplicate = duplicateNumbers.includes(number);
            
            // Agregar texto antes del número
            if (match.index > lastIndex) {
              segments.push({
                text: processedLine.substring(lastIndex, match.index),
                highlight: false
              });
            }
            
            // Agregar el número (resaltado si es duplicado)
            segments.push({
              text: number,
              highlight: isDuplicate
            });
            
            if (isDuplicate) foundAnyDuplicate = true;
            lastIndex = match.index + match[0].length;
          }
          
          // Agregar el resto del texto si queda algo
          if (lastIndex < processedLine.length) {
            segments.push({
              text: processedLine.substring(lastIndex),
              highlight: false
            });
          }
          
          // Si no hay segmentos o no se encontraron duplicados, mostrar línea normal
          if (!segments.length || !foundAnyDuplicate) {
            return (
              <Text 
                key={index}
                style={styles.overlayLine}
              >
                {processedLine}
              </Text>
            );
          }
          
          return (
            <Text 
              key={index}
              style={styles.overlayLine}
            >
              {segments.map((segment, segIndex) => (
                <Text
                  key={segIndex}
                  style={segment.highlight ? styles.duplicateTextHighlight : undefined}
                >
                  {segment.text}
                </Text>
              ))}
            </Text>
          );
        })}
      </ScrollView>
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
      {pasteButtonOverlay && <Text style={styles.label}>{label}</Text>}

      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            hasError && styles.inputError,
            isFocused && styles.inputFocused,
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
          onScroll={handleScroll}
          scrollEventThrottle={16}
          {...otherProps}
        />
        
        {renderTextWithHighlight()}
        
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
  textOverlay: {
    position: 'absolute',
    top: 14,
    left: 12,
    right: 12,
    bottom: 14,
    backgroundColor: 'transparent',
  },
  overlayContent: {
    flexGrow: 1,
    paddingRight: 20, // Espacio para scroll
  },
  overlayLine: {
    fontSize: 16,
    lineHeight: 22,
    color: 'transparent',
    minHeight: 22,
  },
  errorOverlayLine: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)', // Fondo rojo transparente para líneas con error
  },
  duplicateOverlayLine: {
    backgroundColor: 'rgba(212, 163, 0, 0.2)', // Fondo amarillo transparente para líneas con duplicados
  },
  duplicateTextHighlight: {
    backgroundColor: 'rgba(212, 163, 0, 0.4)', // Fondo amarillo más intenso para números duplicados específicos
    color: '#8B5A00', // Texto más oscuro para mejor contraste
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
