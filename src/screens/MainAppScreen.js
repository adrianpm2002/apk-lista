import React, { useState } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import VisualModeScreen from './VisualModeScreen';
import TextModeScreen from './TextModeScreen';
import ModeSelector from '../components/ModeSelector';

const MainAppScreen = ({ navigation }) => {
  const [currentMode, setCurrentMode] = useState('Visual');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const handleModeChange = (newMode) => {
    if (newMode === currentMode) return;
    setCurrentMode(newMode);
  };

  const handleToggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Renderizar solo la pantalla del modo actual */}
      {currentMode === 'Visual' ? (
        <VisualModeScreen 
          navigation={navigation} 
          currentMode={currentMode}
          onModeChange={handleModeChange}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
        />
      ) : (
        <TextModeScreen 
          navigation={navigation}
          currentMode={currentMode}
          onModeChange={handleModeChange}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
        />
      )}
      
      {/* Mode Selector - Siempre visible en la parte inferior */}
      <View style={[styles.modeSelectorContainer, isDarkMode && styles.modeSelectorContainerDark]}>
        <ModeSelector 
          currentMode={currentMode} 
          onModeChange={handleModeChange}
          isDarkMode={isDarkMode}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  containerDark: {
    backgroundColor: '#2c3e50',
  },
  modeSelectorContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  modeSelectorContainerDark: {
    // Mantener transparente para el modo oscuro también
  },
});

export default MainAppScreen;
