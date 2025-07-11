import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
} from 'react-native';

const ActionButton = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  size = 'medium',
  disabled = false,
  style 
}) => {
  const getButtonStyle = () => {
    const baseStyle = [styles.button, styles[size]];
    
    if (disabled) {
      baseStyle.push(styles.disabled);
    } else {
      baseStyle.push(styles[variant]);
    }
    
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.text, styles[`${size}Text`]];
    
    if (disabled) {
      baseStyle.push(styles.disabledText);
    } else {
      baseStyle.push(styles[`${variant}Text`]);
    }
    
    return baseStyle;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        getButtonStyle(),
        style,
        pressed && !disabled && styles.pressed
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={getTextStyle()}>{title}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  // Sizes
  small: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  medium: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  large: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  // Variants
  primary: {
    backgroundColor: '#4A7C59',
  },
  secondary: {
    backgroundColor: '#8FA987',
  },
  danger: {
    backgroundColor: '#D4714A',
  },
  warning: {
    backgroundColor: '#D4B04A',
  },
  success: {
    backgroundColor: '#5A9B4A',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#4A7C59',
  },
  // Disabled
  disabled: {
    backgroundColor: '#E8F1E4',
  },
  // Text styles
  text: {
    fontWeight: '600',
  },
  smallText: {
    fontSize: 13,
  },
  mediumText: {
    fontSize: 15,
  },
  largeText: {
    fontSize: 17,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#FFFFFF',
  },
  dangerText: {
    color: '#FFFFFF',
  },
  warningText: {
    color: '#FFFFFF',
  },
  successText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: '#4A7C59',
  },
  disabledText: {
    color: '#8FA987',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});

export default ActionButton;
