import React from 'react';
import { Platform } from 'react-native';

let DateTimePicker;

if (Platform.OS === 'web') {
  // Para web, usar input HTML nativo
  DateTimePicker = ({ value, onChange, mode = 'date', ...props }) => {
    const handleChange = (event) => {
      const selectedDate = new Date(event.target.value);
      onChange && onChange(event, selectedDate);
    };

    const formatValue = () => {
      if (!value) return '';
      
      if (mode === 'time') {
        return value.toTimeString().slice(0, 5); // HH:MM
      } else {
        return value.toISOString().slice(0, 10); // YYYY-MM-DD
      }
    };

    return (
      <input
        type={mode === 'time' ? 'time' : 'date'}
        value={formatValue()}
        onChange={handleChange}
        style={{
          padding: '8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '16px',
          ...props.style
        }}
        {...props}
      />
    );
  };
} else {
  // Para nativo, usar el componente real si está disponible
  try {
    const RNDateTimePicker = require('@react-native-community/datetimepicker');
    DateTimePicker = RNDateTimePicker.default || RNDateTimePicker;
  } catch (error) {
    console.warn('DateTimePicker not available, using fallback:', error);
    // Fallback component para desarrollo
    DateTimePicker = ({ value, onChange, mode }) => {
      return null; // O un componente alternativo
    };
  }
}

export default DateTimePicker;
