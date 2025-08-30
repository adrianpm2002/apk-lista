import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';

let Picker;

if (Platform.OS === 'web') {
  // Para web, usar select HTML nativo
  Picker = ({ selectedValue, onValueChange, children, style, ...props }) => {
    const handleChange = (event) => {
      onValueChange && onValueChange(event.target.value);
    };

    return (
      <select
        value={selectedValue}
        onChange={handleChange}
        style={{
          padding: '8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '16px',
          backgroundColor: 'white',
          minHeight: '40px',
          ...style
        }}
        {...props}
      >
        {children}
      </select>
    );
  };

  Picker.Item = ({ label, value, ...props }) => {
    return (
      <option value={value} {...props}>
        {label}
      </option>
    );
  };
} else {
  // Para nativo, usar el componente real si está disponible
  try {
    const PickerModule = require('@react-native-picker/picker');
    const NativePicker = PickerModule.Picker || PickerModule.default;
    Picker = NativePicker;
    Picker.Item = NativePicker.Item;
  } catch (error) {
    console.warn('Picker not available, using fallback:', error);
    // Fallback component para desarrollo
    Picker = ({ selectedValue, onValueChange, children }) => {
      return (
        <View style={styles.fallbackPicker}>
          <Text>Picker no disponible</Text>
        </View>
      );
    };
    Picker.Item = ({ label }) => <Text>{label}</Text>;
  }
}

const styles = StyleSheet.create({
  fallbackPicker: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
  },
});

export { Picker };
