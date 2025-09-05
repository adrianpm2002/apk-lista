import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import LimitedNumbersButton from './LimitedNumbersButton';
import ListerLimitsButton from './ListerLimitsButton';
import PricesButton from './PricesButton';
import { createShadowStyle } from '../utils/shadowUtils';

const TopBar = ({ title, onMenuPress, onOptionSelect, showMenuButton = true, showOptionsButtons = false }) => {
  const handleOptionSelect = (option) => {
    onOptionSelect && onOptionSelect(option);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Botón de menú */}
        {showMenuButton && onMenuPress && (
          <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        )}

        {/* Título */}
        {title && (
          <Text style={styles.title}>{title}</Text>
        )}

        {/* Botones de opciones */}
        {showOptionsButtons && (
          <View style={styles.buttonsContainer}>
            <LimitedNumbersButton onOptionSelect={handleOptionSelect} />
            <ListerLimitsButton onOptionSelect={handleOptionSelect} />
            <PricesButton onOptionSelect={handleOptionSelect} />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    ...createShadowStyle({
      color: '#000',
      offsetY: 2,
      opacity: 0.1,
      radius: 3.84,
      elevation: 3,
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 20,
    color: '#2c3e50',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});

export default TopBar;
