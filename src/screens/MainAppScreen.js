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
  const [visibleModes, setVisibleModes] = useState({
    visual: true,
    text: true
  });

  const handleModeChange = (newMode) => {
    if (newMode === currentMode) return;
    setCurrentMode(newMode);
  };

  const handleToggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleModeVisibilityChange = (newVisibleModes) => {
    setVisibleModes(newVisibleModes);
    
    // Si el modo actual ya no es visible, cambiar al primer modo visible
    if ((currentMode === 'Visual' && !newVisibleModes.visual) ||
        (currentMode === 'Texto' && !newVisibleModes.text)) {
      if (newVisibleModes.visual) {
        setCurrentMode('Visual');
      } else if (newVisibleModes.text) {
        setCurrentMode('Texto');
      }
    }
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Mode Selector - Visible si hay al menos un modo disponible */}
      {(visibleModes.visual || visibleModes.text) && (
        <View style={[styles.modeSelectorContainer, isDarkMode && styles.modeSelectorContainerDark]}>
          <ModeSelector 
            currentMode={currentMode} 
            onModeChange={handleModeChange}
            isDarkMode={isDarkMode}
            visibleModes={visibleModes}
          />
        </View>
      )}
      
      {/* Renderizar solo la pantalla del modo actual si está visible */}
      {currentMode === 'Visual' && visibleModes.visual ? (
        <VisualModeScreen 
          navigation={navigation} 
          currentMode={currentMode}
          onModeChange={handleModeChange}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
          onModeVisibilityChange={handleModeVisibilityChange}
        />
      ) : visibleModes.text ? (
        <TextModeScreen 
          navigation={navigation}
          currentMode={currentMode}
          onModeChange={handleModeChange}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
          onModeVisibilityChange={handleModeVisibilityChange}
        />
      ) : null}
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
    top: 0,
    left: 70, // Dejamos espacio para el botón de la barra lateral (45px + 15px left + margen)
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingTop: 50,
    zIndex: 10,
  },
  modeSelectorContainerDark: {
    // Mantener transparente para el modo oscuro también
  },
});

export default MainAppScreen;
