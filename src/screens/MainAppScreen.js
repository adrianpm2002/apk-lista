import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
} from 'react-native';
import VisualModeScreen from './VisualModeScreen';
import TextModeScreen from './TextModeScreen';

const MainAppScreen = ({ navigation, route }) => {
  const [currentMode, setCurrentMode] = useState('Visual');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [visibleModes, setVisibleModes] = useState({
    visual: true,
    text: true
  });
  // Refs para evitar cierres obsoletos en el PanResponder
  const modeRef = useRef(currentMode);
  const visibleRef = useRef(visibleModes);
  useEffect(() => { modeRef.current = currentMode; }, [currentMode]);
  useEffect(() => { visibleRef.current = visibleModes; }, [visibleModes]);
  const SWIPE_THRESHOLD = 60; // px
  const SWIPE_MAX_OFF_AXIS = 40; // px de tolerancia vertical
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (e, g) => {
        // Iniciar sólo si es claramente horizontal
        return Math.abs(g.dx) > 20 && Math.abs(g.dy) < 15;
      },
      onPanResponderRelease: (e, g) => {
        const { dx, dy } = g;
        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_MAX_OFF_AXIS) {
          const current = modeRef.current;
          const vis = visibleRef.current;
          // Invertido: izquierda -> Texto, derecha -> Visual
          if (dx < 0 && current === 'Visual' && vis.text) {
            setCurrentMode('Texto');
          } else if (dx > 0 && current === 'Texto' && vis.visual) {
            setCurrentMode('Visual');
          }
        }
      },
    })
  ).current;
  
  // Usar configuraciones locales simples

  useEffect(() => {
    // Si el modo actual no es visible, cambiar al primer modo disponible
    if (currentMode === 'Visual' && !visibleModes.visual && visibleModes.text) {
      setCurrentMode('Texto');
    } else if (currentMode === 'Texto' && !visibleModes.text && visibleModes.visual) {
      setCurrentMode('Visual');
    }
  }, [visibleModes, currentMode]);

  // Forzar Visual si llega un editPayload desde otra pantalla
  useEffect(()=>{
    const editPayload = route?.params?.editPayload;
    if(editPayload && currentMode !== 'Visual'){
      setCurrentMode('Visual');
    }
  },[route?.params?.editPayload, currentMode]);

  // Asegurar que VisualModeScreen vea cambios subsecuentes de editPayload aun si ya está en Visual
  const visualRoute = {
    ...route,
    params: {
      ...route?.params,
      editPayload: route?.params?.editPayload
    }
  };
  const textRoute = {
    ...route,
    params: {
      ...route?.params
    }
  };

  const handleModeChange = (newMode) => {
    if (newMode === currentMode) return;
    setCurrentMode(newMode);
  };

  const handleToggleDarkMode = async () => {
    try {
      setIsDarkMode(!isDarkMode);
    } catch (error) {
      console.error('Error toggling dark mode:', error);
    }
  };

  const handleModeVisibilityChange = async (newVisibleModes) => {
    try {
      setVisibleModes(newVisibleModes);
    } catch (error) {
      console.error('Error updating mode visibility:', error);
    }
  };

  return (
  <View style={[styles.container, isDarkMode && styles.containerDark]} {...panResponder.panHandlers}>
  {/* Mode Selector movido a los headers de cada pantalla */}
      
      {/* Renderizar solo la pantalla del modo actual si está visible */}
      {currentMode === 'Visual' && visibleModes.visual ? (
        <VisualModeScreen 
          navigation={navigation} 
          route={visualRoute}
          currentMode={currentMode}
          onModeChange={handleModeChange}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
          onModeVisibilityChange={handleModeVisibilityChange}
          visibleModes={visibleModes}
        />
      ) : visibleModes.text ? (
        <TextModeScreen 
          navigation={navigation}
          route={textRoute}
          currentMode={currentMode}
          onModeChange={handleModeChange}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
          onModeVisibilityChange={handleModeVisibilityChange}
          visibleModes={visibleModes}
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
