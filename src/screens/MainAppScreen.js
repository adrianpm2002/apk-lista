import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  StyleSheet,
} from 'react-native';
import VisualModeScreen from './VisualModeScreen';
import TextModeScreen from './TextModeScreen';
import TextMode2Screen from './TextMode2Screen';
import VaultModeScreen from './VaultModeScreen';

const MainAppScreen = ({ navigation, route }) => {
  const [currentMode, setCurrentMode] = useState('Visual');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [visibleModes, setVisibleModes] = useState({
    visual: true,
  text: true,
  text2: true,
  vault: true,
  });
  
  // Usar configuraciones locales simples

  // Cargar persistencia de modos visibles solo una vez
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('visibleModes');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            setVisibleModes(prev => ({ ...prev, ...parsed }));
          }
        }
      } catch {}
    })();
  }, []);

  // Si el modo actual no es visible, saltar al primero disponible
  useEffect(() => {
    const visibleOrder = [
      { key: 'visual', mode: 'Visual' },
      { key: 'text', mode: 'Texto' },
      { key: 'text2', mode: 'Texto2' },
      { key: 'vault', mode: 'Vault' },
    ];
    const currentKey =
      currentMode === 'Visual' ? 'visual' :
      currentMode === 'Texto' ? 'text' :
      currentMode === 'Texto2' ? 'text2' :
      currentMode === 'Vault' ? 'vault' : null;

    if (currentKey && visibleModes[currentKey]) return; // el actual es visible

    const firstVisible = visibleOrder.find(v => visibleModes[v.key]);
    if (firstVisible && firstVisible.mode !== currentMode) {
      setCurrentMode(firstVisible.mode);
    }
  }, [visibleModes, currentMode]);

  // Forzar Visual/Texto/Texto2 según el origen de edición
  useEffect(()=>{
    const editPayload = route?.params?.editPayload;
    const originMode = route?.params?.originMode; // 'Visual' | 'Texto' | 'Texto2'
    if(editPayload){
      if(originMode === 'Texto'){
        if(currentMode !== 'Texto') setCurrentMode('Texto');
      } else if(originMode === 'Texto2'){
        if(currentMode !== 'Texto2') setCurrentMode('Texto2');
      } else if(currentMode !== 'Visual') {
        setCurrentMode('Visual');
      }
    }
  },[route?.params?.editPayload, route?.params?.originMode, currentMode]);

  // Asegurar que VisualModeScreen vea cambios subsecuentes de editPayload aun si ya está en Visual
  const visualRoute = {
    ...route,
    params: {
      ...route?.params,
      editPayload: route?.params?.editPayload
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
  await AsyncStorage.setItem('visibleModes', JSON.stringify(newVisibleModes));
    } catch (error) {
      console.error('Error updating mode visibility:', error);
    }
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
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
      ) : currentMode === 'Texto' && visibleModes.text ? (
        <TextModeScreen 
          navigation={navigation}
          route={route}
          currentMode={currentMode}
          onModeChange={handleModeChange}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
          onModeVisibilityChange={handleModeVisibilityChange}
          visibleModes={visibleModes}
        />
      ) : currentMode === 'Texto2' && visibleModes.text2 ? (
        <TextMode2Screen 
          navigation={navigation}
          route={route}
          currentMode={currentMode}
          onModeChange={handleModeChange}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
          onModeVisibilityChange={handleModeVisibilityChange}
          visibleModes={visibleModes}
        />
      ) : currentMode === 'Vault' && visibleModes.vault ? (
        <VaultModeScreen
          navigation={navigation}
          route={route}
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
  paddingHorizontal: 12,
  paddingTop: 44,
    zIndex: 10,
  },
  modeSelectorContainerDark: {
    // Mantener transparente para el modo oscuro también
  },
});

export default MainAppScreen;
