import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useConnection } from '../hooks/useConnection';

/**
 * Indicador visual del estado de conexión
 * Muestra banner verde cuando está online (se oculta después de 3s)
 * Muestra banner rojo cuando está offline (permanece visible)
 */
export const ConnectionIndicator = () => {
  const { isOnline, isChecking } = useConnection();
  const [showOnline, setShowOnline] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (!isChecking) {
      if (isOnline) {
        // Mostrar indicador verde
        setShowOnline(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();

        // Ocultar después de 3 segundos
        const timer = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setShowOnline(false);
          });
        }, 3000);

        return () => clearTimeout(timer);
      } else {
        // Offline: mostrar permanentemente
        setShowOnline(false);
      }
    }
  }, [isOnline, isChecking]);

  // No mostrar nada mientras está checando
  if (isChecking) {
    return null;
  }

  // Mostrar banner rojo si está offline
  if (!isOnline) {
    return (
      <View style={styles.container}>
        <View style={[styles.banner, styles.offlineBanner]}>
          <Text style={styles.icon}>📵</Text>
          <Text style={styles.text}>Sin conexión</Text>
        </View>
      </View>
    );
  }

  // Mostrar banner verde si está online (con fade out)
  if (showOnline) {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={[styles.banner, styles.onlineBanner]}>
          <Text style={styles.icon}>✅</Text>
          <Text style={styles.text}>Conectado</Text>
        </View>
      </Animated.View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  onlineBanner: {
    backgroundColor: '#10B981', // Verde
  },
  offlineBanner: {
    backgroundColor: '#DC2626', // Rojo
  },
  icon: {
    fontSize: 18,
    marginRight: 8,
  },
  text: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ConnectionIndicator;
