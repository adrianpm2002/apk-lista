import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';

const ModeSelector = ({ currentMode, onModeChange, isDarkMode }) => {
  const handleModeSelect = (mode) => {
    if (mode !== currentMode) {
      onModeChange && onModeChange(mode);
    }
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <TouchableOpacity
        style={[
          styles.modeButton,
          styles.leftButton,
          currentMode === 'Visual' && (isDarkMode ? styles.activeButtonDark : styles.activeButton)
        ]}
        onPress={() => handleModeSelect('Visual')}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.modeText,
          isDarkMode && styles.modeTextDark,
          currentMode === 'Visual' && styles.activeText
        ]}>
          👁️ Modo Visual
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.modeButton,
          styles.rightButton,
          currentMode === 'Texto' && (isDarkMode ? styles.activeButtonDark : styles.activeButton)
        ]}
        onPress={() => handleModeSelect('Texto')}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.modeText,
          isDarkMode && styles.modeTextDark,
          currentMode === 'Texto' && styles.activeText
        ]}>
          📝 Modo Texto
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    padding: 4,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  containerDark: {
    backgroundColor: '#34495e',
  },
  modeButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftButton: {
    marginRight: 2,
  },
  rightButton: {
    marginLeft: 2,
  },
  activeButton: {
    backgroundColor: '#3498db',
    shadowColor: '#2980b9',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  activeButtonDark: {
    backgroundColor: '#e74c3c',
    shadowColor: '#c0392b',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  modeTextDark: {
    color: '#bdc3c7',
  },
  activeText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default ModeSelector;
