import { StyleSheet } from 'react-native';

/**
 * Utility para crear estilos de modo oscuro consistentes
 */

// Colores del tema oscuro
export const DarkTheme = {
  // Colores de fondo
  background: {
    primary: '#1a1a1a',
    secondary: '#2c3e50',
    tertiary: '#34495e',
    modal: '#1e1e1e',
    card: '#2c3e50',
    input: '#34495e',
    header: '#2c3e50',
  },
  
  // Colores de texto
  text: {
    primary: '#ecf0f1',
    secondary: '#bdc3c7',
    tertiary: '#95a5a6',
    disabled: '#7f8c8d',
    link: '#3498db',
    success: '#27ae60',
    warning: '#f39c12',
    error: '#e74c3c',
  },
  
  // Colores de borde
  border: {
    primary: '#4a6741',
    secondary: '#5d6d7e',
    tertiary: '#566175',
    input: '#4a6741',
    card: '#34495e',
  },
  
  // Colores de estado
  status: {
    active: '#27ae60',
    inactive: '#e74c3c',
    pending: '#f39c12',
  },
  
  // Colores específicos de la aplicación
  app: {
    accent: '#e74c3c',
    accentHover: '#c0392b',
    positive: '#2ecc71',
    negative: '#ff6b6b',
    neutral: '#95a5a6',
  }
};

// Colores del tema claro (para referencia)
export const LightTheme = {
  background: {
    primary: '#f8f9fa',
    secondary: '#ffffff',
    tertiary: '#f0f8ff',
    modal: '#ffffff',
    card: '#ffffff',
    input: '#ffffff',
    header: '#f8f9fa',
  },
  
  text: {
    primary: '#2c3e50',
    secondary: '#7f8c8d',
    tertiary: '#95a5a6',
    disabled: '#bdc3c7',
    link: '#3498db',
    success: '#27ae60',
    warning: '#f39c12',
    error: '#e74c3c',
  },
  
  border: {
    primary: '#b8d4a8',
    secondary: '#dee2e6',
    tertiary: '#e9ecef',
    input: '#b8d4a8',
    card: '#e0e0e0',
  },
  
  status: {
    active: '#27ae60',
    inactive: '#e74c3c',
    pending: '#f39c12',
  },
  
  app: {
    accent: '#3498db',
    accentHover: '#2980b9',
    positive: '#27ae60',
    negative: '#e74c3c',
    neutral: '#7f8c8d',
  }
};

/**
 * Crear estilos adaptativos para modo oscuro/claro
 * @param {boolean} isDarkMode - Si está en modo oscuro
 * @param {object} lightStyles - Estilos para modo claro
 * @param {object} darkStyles - Estilos para modo oscuro
 * @returns {object} Estilos combinados
 */
export const createThemedStyles = (isDarkMode, lightStyles = {}, darkStyles = {}) => {
  return isDarkMode ? { ...lightStyles, ...darkStyles } : lightStyles;
};

/**
 * Obtener el tema actual basado en el modo
 * @param {boolean} isDarkMode - Si está en modo oscuro
 * @returns {object} Tema actual
 */
export const getCurrentTheme = (isDarkMode) => {
  return isDarkMode ? DarkTheme : LightTheme;
};

/**
 * Estilos base comunes para modo oscuro
 */
export const createCommonDarkStyles = (isDarkMode) => {
  const theme = getCurrentTheme(isDarkMode);
  
  return StyleSheet.create({
    // Contenedores principales
    container: {
      backgroundColor: theme.background.primary,
    },
    containerSecondary: {
      backgroundColor: theme.background.secondary,
    },
    containerTertiary: {
      backgroundColor: theme.background.tertiary,
    },
    
    // Modales
    modalOverlay: {
      backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      backgroundColor: theme.background.modal,
    },
    
    // Tarjetas
    card: {
      backgroundColor: theme.background.card,
      borderColor: theme.border.card,
    },
    
    // Headers
    header: {
      backgroundColor: theme.background.header,
      borderBottomColor: theme.border.secondary,
    },
    
    // Texto
    textPrimary: {
      color: theme.text.primary,
    },
    textSecondary: {
      color: theme.text.secondary,
    },
    textTertiary: {
      color: theme.text.tertiary,
    },
    textDisabled: {
      color: theme.text.disabled,
    },
    textLink: {
      color: theme.text.link,
    },
    textSuccess: {
      color: theme.text.success,
    },
    textWarning: {
      color: theme.text.warning,
    },
    textError: {
      color: theme.text.error,
    },
    
    // Inputs
    input: {
      backgroundColor: theme.background.input,
      borderColor: theme.border.input,
      color: theme.text.primary,
    },
    
    // Botones
    buttonPrimary: {
      backgroundColor: theme.app.accent,
    },
    buttonSecondary: {
      backgroundColor: theme.background.tertiary,
      borderColor: theme.border.secondary,
    },
    
    // Estados
    statusActive: {
      color: theme.status.active,
    },
    statusInactive: {
      color: theme.status.inactive,
    },
    statusPending: {
      color: theme.status.pending,
    },
  });
};

/**
 * Estilos específicos para pantallas de estadísticas
 */
export const createStatisticsDarkStyles = (isDarkMode) => {
  const theme = getCurrentTheme(isDarkMode);
  
  return StyleSheet.create({
    kpiCard: {
      backgroundColor: theme.background.card,
      borderColor: theme.border.card,
    },
    kpiTitle: {
      color: theme.text.secondary,
    },
    kpiValue: {
      color: theme.text.primary,
    },
    filterChip: {
      backgroundColor: theme.background.tertiary,
      borderColor: theme.border.secondary,
    },
    filterChipActive: {
      backgroundColor: theme.app.accent,
      borderColor: theme.app.accent,
    },
    filterChipText: {
      color: theme.text.primary,
    },
    filterChipTextActive: {
      color: '#ffffff',
    },
    tableHeader: {
      backgroundColor: theme.background.tertiary,
    },
    tableRow: {
      backgroundColor: theme.background.card,
      borderBottomColor: theme.border.secondary,
    },
    tableText: {
      color: theme.text.primary,
    },
  });
};

/**
 * Estilos específicos para formularios
 */
export const createFormDarkStyles = (isDarkMode) => {
  const theme = getCurrentTheme(isDarkMode);
  
  return StyleSheet.create({
    formContainer: {
      backgroundColor: theme.background.card,
    },
    label: {
      color: theme.text.primary,
    },
    inputField: {
      backgroundColor: theme.background.input,
      borderColor: theme.border.input,
      color: theme.text.primary,
    },
    inputFieldError: {
      borderColor: theme.text.error,
    },
    errorText: {
      color: theme.text.error,
    },
    picker: {
      backgroundColor: theme.background.input,
      color: theme.text.primary,
    },
    pickerBorder: {
      borderColor: theme.border.input,
    },
  });
};

export default {
  DarkTheme,
  LightTheme,
  createThemedStyles,
  getCurrentTheme,
  createCommonDarkStyles,
  createStatisticsDarkStyles,
  createFormDarkStyles,
};
