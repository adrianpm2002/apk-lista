import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useConnection } from '../hooks/useConnection';

/**
 * Indicador visual del estado de conexión
 * Muestra banner solo cuando está offline
 */
export const ConnectionIndicator = () => {
  const { isOnline, isChecking } = useConnection();

  // No mostrar nada si está online o checando
  if (isOnline || isChecking) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.icon}>📵</Text>
        <Text style={styles.text}>Sin conexión</Text>
      </View>
    </View>
  );
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
    backgroundColor: '#DC2626',
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
