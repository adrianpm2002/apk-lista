import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * AnimatedModalWrapper
 * Proporciona animación fade + scale para la aparición/desaparición de contenidos tipo modal.
 * Props:
 *  - visible: boolean
 *  - children: ReactNode
 *  - scaleFrom: número inicial de escala (default 0.85)
 *  - duration: duración ms (default 160)
 *  - easing: función de easing (default Easing.out(Easing.quad))
 *  - style: estilos adicionales
 */
const AnimatedModalWrapper = ({ visible, children, scaleFrom = 0.85, duration = 160, easing = Easing.out(Easing.quad), style }) => {
  const scale = useRef(new Animated.Value(scaleFrom)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(scaleFrom);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration, easing, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration, easing, useNativeDriver: true })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, { toValue: scaleFrom, duration: Math.min(duration, 140), easing, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: Math.min(duration, 140), easing, useNativeDriver: true })
      ]).start();
    }
  }, [visible, scaleFrom, duration, easing, scale, opacity]);

  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[{ transform: [{ scale }], opacity }, style]}>
      {children}
    </Animated.View>
  );
};

export default AnimatedModalWrapper;
