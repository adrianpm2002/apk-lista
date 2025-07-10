import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';

const ModeSelector = ({ currentMode, onModeChange, modes = [] }) => {
  const handlePress = () => {
    const nextMode = currentMode === 'Visual' ? 'Texto' : 'Visual';
    onModeChange && onModeChange(nextMode);
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Text style={styles.modeText}>Modo: {currentMode}</Text>
      <Text style={styles.arrow}>⚡</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F4D03F',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B7860B',
    marginRight: 6,
  },
  arrow: {
    fontSize: 12,
    color: '#B7860B',
  },
});

export default ModeSelector;
