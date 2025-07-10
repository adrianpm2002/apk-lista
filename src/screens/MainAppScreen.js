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
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: targetSlide,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentMode(newMode);
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
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
        return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20;
      },
      onPanResponderMove: (evt, gestureState) => {
        const { dx } = gestureState;
        const newValue = currentMode === 'Visual' ? 
          Math.max(-screenWidth, Math.min(0, dx)) : 
          Math.max(-screenWidth, Math.min(0, -screenWidth + dx));
        slideAnim.setValue(newValue);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, vx } = gestureState;
        const threshold = screenWidth * 0.3;
        
        let newMode = currentMode;
        let targetValue = currentMode === 'Visual' ? 0 : -screenWidth;
        
        if (currentMode === 'Visual' && (dx < -threshold || vx < -0.5)) {
          newMode = 'Texto';
          targetValue = -screenWidth;
        } else if (currentMode === 'Texto' && (dx > threshold || vx > 0.5)) {
          newMode = 'Visual';
          targetValue = 0;
        }
        
        Animated.spring(slideAnim, {
          toValue: targetValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
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
        <View style={[styles.modeScreen, { left: 0 }]}>
          <VisualModeScreen 
            navigation={navigation} 
            currentMode={currentMode}
            onModeChange={handleModeChange}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
          />
        </View>
        
        {/* Text Mode Screen */}
        <View style={[styles.modeScreen, { left: screenWidth }]}>
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
    position: 'absolute',
    top: 0,
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
  },
  modeSelectorContainerDark: {
    // Mantener transparente para el modo oscuro también
  },
});

export default MainAppScreen;
