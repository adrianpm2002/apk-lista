import React from 'react';
import { Platform } from 'react-native';

let DateTimePicker;

if (Platform.OS === 'web') {
  // Para web, usar input HTML nativo
  DateTimePicker = ({ value, onChange, mode = 'date', maximumDate, minimumDate, ...props }) => {
    const handleChange = (event) => {
      const dateString = event.target.value; // YYYY-MM-DD
      
      // CRÍTICO: Crear fecha LOCAL, no UTC
      // new Date('2025-10-16') interpreta como UTC y puede causar desfase de días
      // Solución: parsear componentes y crear fecha local explícitamente
      const [year, month, day] = dateString.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      
      // Llamar onChange solo con la fecha (segundo parámetro)
      // para mantener compatibilidad con el uso en StatisticsScreen
      if (onChange) {
        onChange(selectedDate);
      }
    };

    const formatValue = () => {
      if (!value) return '';
      
      // Asegurar que value sea un Date object
      const dateValue = value instanceof Date ? value : new Date(value);
      
      if (isNaN(dateValue.getTime())) {
        console.warn('[DateTimePickerWrapper] Invalid date value:', value);
        return '';
      }
      
      if (mode === 'time') {
        return dateValue.toTimeString().slice(0, 5); // HH:MM
      } else {
        return dateValue.toISOString().slice(0, 10); // YYYY-MM-DD
      }
    };

    const formatMaxMin = (date) => {
      if (!date) return undefined;
      const dateValue = date instanceof Date ? date : new Date(date);
      if (isNaN(dateValue.getTime())) return undefined;
      return dateValue.toISOString().slice(0, 10);
    };

    return (
      <input
        type={mode === 'time' ? 'time' : 'date'}
        value={formatValue()}
        onChange={handleChange}
        max={formatMaxMin(maximumDate)}
        min={formatMaxMin(minimumDate)}
        style={{
          padding: '8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontSize: '16px',
          ...props.style
        }}
      />
    );
  };
} else {
  // Para nativo, usar el componente real si está disponible
  try {
    const RNDateTimePicker = require('@react-native-community/datetimepicker');
    const NativeDateTimePicker = RNDateTimePicker.default || RNDateTimePicker;
    
    // Wrapper para normalizar el callback
    DateTimePicker = ({ onChange, ...props }) => {
      const handleChange = (event, selectedDate) => {
        // Solo pasar la fecha (segundo parámetro) para mantener compatibilidad
        if (onChange && selectedDate) {
          onChange(selectedDate);
        }
      };
      
      return (
        <NativeDateTimePicker
          {...props}
          onChange={handleChange}
        />
      );
    };
  } catch (error) {
    console.warn('DateTimePicker not available, using fallback:', error);
    // Fallback component para desarrollo
    DateTimePicker = ({ value, onChange, mode }) => {
      return null; // O un componente alternativo
    };
  }
}

export default DateTimePicker;
