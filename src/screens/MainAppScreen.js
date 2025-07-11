import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import VisualModeScreen from './VisualModeScreen';
import TextModeScreen from './TextModeScreen';
import ModeSelector from '../components/ModeSelector';

const { width: screenWidth } = Dimensions.get('window');

const MainAppScreen = ({ navigation }) => {
  const [currentMode, setCurrentMode] = useState('Visual');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Animaciones
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleModeChange = (newMode) => {
    if (newMode === currentMode || isTransitioning) return;
    
    setIsTransitioning(true);
    
    // Configurar animación basada en la dirección
    const targetSlide = newMode === 'Visual' ? 0 : -screenWidth;
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0.9,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: targetSlide,
        useNativeDriver: true,
        tension: 120,
        friction: 7,
        restDisplacementThreshold: 0.1,
        restSpeedThreshold: 0.1,
      }),
    ]).start(() => {
      setCurrentMode(newMode);
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }).start(() => {
        setIsTransitioning(false);
      });
    });
  };

  const handleToggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Configurar PanResponder para gestos de deslizamiento
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        // Hacer más sensible el reconocimiento del gesto
        return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        const { dx } = gestureState;
        const currentValue = currentMode === 'Visual' ? 0 : -screenWidth;
        
        // Aplicar un factor de amortiguación para que el movimiento sea más suave
        const dampingFactor = 0.8;
        const dampedDx = dx * dampingFactor;
        
        const newValue = Math.max(-screenWidth, Math.min(0, currentValue + dampedDx));
        slideAnim.setValue(newValue);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, vx } = gestureState;
        // Reducir el threshold para que sea más fácil cambiar de modo
        const threshold = screenWidth * 0.15; // Reducido de 0.3 a 0.15
        const velocityThreshold = 0.3; // Reducido de 0.5 a 0.3
        
        let newMode = currentMode;
        let targetValue = currentMode === 'Visual' ? 0 : -screenWidth;
        
        // Deslizar hacia la izquierda desde Visual Mode (cambiar a Texto)
        if (currentMode === 'Visual' && (dx < -threshold || vx < -velocityThreshold)) {
          newMode = 'Texto';
          targetValue = -screenWidth;
        } 
        // Deslizar hacia la derecha desde Text Mode (cambiar a Visual)
        else if (currentMode === 'Texto' && (dx > threshold || vx > velocityThreshold)) {
          newMode = 'Visual';
          targetValue = 0;
        }
        
        // Usar una animación más rápida y suave
        Animated.spring(slideAnim, {
          toValue: targetValue,
          useNativeDriver: true,
          tension: 120, // Aumentado de 100
          friction: 7,  // Reducido de 8
          restDisplacementThreshold: 0.1,
          restSpeedThreshold: 0.1,
        }).start(() => {
          if (newMode !== currentMode) {
            setCurrentMode(newMode);
          }
        });
      },
    })
  ).current;

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <Animated.View 
        style={[
          styles.modesContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }]
          }
        ]}
        {...panResponder.panHandlers}
      >
        {/* Visual Mode Screen */}
        <View style={styles.modeScreen}>
          <VisualModeScreen 
            navigation={navigation} 
            currentMode={currentMode}
            onModeChange={handleModeChange}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
          />
        </View>
        
        {/* Text Mode Screen */}
        <View style={styles.modeScreen}>
          <TextModeScreen 
            navigation={navigation}
            currentMode={currentMode}
            onModeChange={handleModeChange}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
          />
        </View>
      </Animated.View>
      
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
  modesContainer: {
    flex: 1,
    flexDirection: 'row',
    width: screenWidth * 2,
  },
  modeScreen: {
    width: screenWidth,
    height: '100%',
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
