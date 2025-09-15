import React, { useEffect, useRef } from 'react';
import { createShadowStyle } from '../utils/shadowUtils';
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';

const ModeSelector = ({ currentMode, onModeChange, visibleModes = { visual: true, text: true, text2: true, vault: true } }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animación sutil cuando cambia el modo
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 100,
        useNativeDriver: false,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: false,
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
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      {visibleModes.visual && (
        <Pressable
          style={({ pressed }) => [
            styles.modeButton,
            !visibleModes.text ? styles.singleButton : styles.leftButton,
            currentMode === 'Visual' && styles.activeButton,
            pressed && styles.buttonPressed
          ]}
          onPress={() => handleModeSelect('Visual')}
        >
          <Text style={[
            styles.modeText,
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
            currentMode === 'Texto' && styles.activeButton,
            pressed && styles.buttonPressed
          ]}
          onPress={() => handleModeSelect('Texto')}
        >
          <Text style={[
            styles.modeText,
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
            currentMode === 'Texto2' && styles.activeButton,
            pressed && styles.buttonPressed
          ]}
          onPress={() => handleModeSelect('Texto2')}
        >
          <Text style={[
            styles.modeText,
            currentMode === 'Texto2' && styles.activeText
          ]}>
            📝 Texto 2.0
          </Text>
        </Pressable>
      )}
      
      {/* Modo Vault */}
      {visibleModes.vault && (
        <Pressable
          style={({ pressed }) => [
            styles.modeButton,
            styles.rightButton,
            currentMode === 'Vault' && styles.activeButton,
            pressed && styles.buttonPressed
          ]}
          onPress={() => handleModeSelect('Vault')}
        >
          <Text style={[
            styles.modeText,
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
    ...createShadowStyle({
      color: '#000',
      offsetY: 2,
      opacity: 0.08,
      radius: 3,
      elevation: 2,
    }),
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
    ...createShadowStyle({
      color: '#2980b9',
      offsetY: 2,
      opacity: 0.22,
      radius: 3,
      elevation: 4,
    }),
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#556',
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
