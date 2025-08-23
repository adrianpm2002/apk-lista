import React, { useEffect, useRef } from 'react';
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';

const ModeSelector = ({ currentMode, onModeChange, isDarkMode, visibleModes = { visual: true, text: true, text2: true, vault: true } }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animación sutil cuando cambia el modo
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentMode]);

  const handleModeSelect = (mode) => {
    if (mode !== currentMode) {
      onModeChange && onModeChange(mode);
    }
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        isDarkMode && styles.containerDark,
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      {visibleModes.visual && (
        <Pressable
          style={({ pressed }) => [
            styles.modeButton,
            !visibleModes.text ? styles.singleButton : styles.leftButton,
            currentMode === 'Visual' && (isDarkMode ? styles.activeButtonDark : styles.activeButton),
            pressed && styles.buttonPressed
          ]}
          onPress={() => handleModeSelect('Visual')}
        >
          <Text style={[
            styles.modeText,
            isDarkMode && styles.modeTextDark,
            currentMode === 'Visual' && styles.activeText
          ]}>
            👁️ Visual
          </Text>
        </Pressable>
      )}
      
      {visibleModes.text && (
        <Pressable
          style={({ pressed }) => [
            styles.modeButton,
            !visibleModes.visual ? styles.singleButton : styles.rightButton,
            currentMode === 'Texto' && (isDarkMode ? styles.activeButtonDark : styles.activeButton),
            pressed && styles.buttonPressed
          ]}
          onPress={() => handleModeSelect('Texto')}
        >
          <Text style={[
            styles.modeText,
            isDarkMode && styles.modeTextDark,
            currentMode === 'Texto' && styles.activeText
          ]}>
            📝 Texto
          </Text>
        </Pressable>
      )}
      {visibleModes.text2 && (
        <Pressable
          style={({ pressed }) => [
            styles.modeButton,
            styles.rightButton,
            currentMode === 'Texto2' && (isDarkMode ? styles.activeButtonDark : styles.activeButton),
            pressed && styles.buttonPressed
          ]}
          onPress={() => handleModeSelect('Texto2')}
        >
          <Text style={[
            styles.modeText,
            isDarkMode && styles.modeTextDark,
            currentMode === 'Texto2' && styles.activeText
          ]}>
            📝 Texto 2.0
          </Text>
        </Pressable>
      )}
      {visibleModes.vault && (
        <Pressable
          style={({ pressed }) => [
            styles.modeButton,
            styles.rightButton,
            currentMode === 'Vault' && (isDarkMode ? styles.activeButtonDark : styles.activeButton),
            pressed && styles.buttonPressed
          ]}
          onPress={() => handleModeSelect('Vault')}
        >
          <Text style={[
            styles.modeText,
            isDarkMode && styles.modeTextDark,
            currentMode === 'Vault' && styles.activeText
          ]}>
            🏦 Vault
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#f5f5f5',
    borderRadius: 18,
    padding: 2,
    alignSelf: 'center',
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  containerDark: {
    backgroundColor: '#34495e',
  },
  modeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftButton: {
    marginRight: 2,
  },
  rightButton: {
    marginLeft: 2,
  },
  singleButton: {
    // Sin márgenes para un solo botón
  },
  activeButton: {
    backgroundColor: '#3498db',
    shadowColor: '#2980b9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 4,
  },
  activeButtonDark: {
    backgroundColor: '#e74c3c',
    shadowColor: '#c0392b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 4,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#556',
  },
  modeTextDark: {
    color: '#bdc3c7',
  },
  activeText: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});

export default ModeSelector;
