import { Platform } from 'react-native';

/**
 * Helper para crear estilos de sombra compatibles con web y móvil
 * @param {Object} config - Configuración de la sombra
 * @param {string} config.color - Color de la sombra (default: '#000')
 * @param {number} config.offsetX - Desplazamiento horizontal (default: 0)
 * @param {number} config.offsetY - Desplazamiento vertical (default: 2)
 * @param {number} config.opacity - Opacidad de la sombra (default: 0.1)
 * @param {number} config.radius - Radio de difuminado (default: 3)
 * @param {number} config.elevation - Elevación para Android (default: 3)
 * @returns {Object} Estilos de sombra apropiados para la plataforma
 */
export const createShadowStyle = ({
  color = '#000',
  offsetX = 0,
  offsetY = 2,
  opacity = 0.1,
  radius = 3,
  elevation = 3
} = {}) => {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `${offsetX}px ${offsetY}px ${radius}px rgba(${hexToRgb(color)}, ${opacity})`,
    };
  }
  
  // Para iOS y Android nativo
  return {
    shadowColor: color,
    shadowOffset: {
      width: offsetX,
      height: offsetY,
    },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: elevation, // Solo funciona en Android
  };
};

/**
 * Convierte un color hexadecimal a valores RGB
 * @param {string} hex - Color en formato hexadecimal (#000000)
 * @returns {string} Valores RGB separados por comas (0, 0, 0)
 */
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '0, 0, 0';
};

/**
 * Presets comunes de sombras
 */
export const shadowPresets = {
  light: {
    color: '#000',
    offsetX: 0,
    offsetY: 1,
    opacity: 0.05,
    radius: 2,
    elevation: 1,
  },
  medium: {
    color: '#000',
    offsetX: 0,
    offsetY: 2,
    opacity: 0.1,
    radius: 3,
    elevation: 3,
  },
  heavy: {
    color: '#000',
    offsetX: 0,
    offsetY: 4,
    opacity: 0.15,
    radius: 6,
    elevation: 6,
  },
  modal: {
    color: '#000',
    offsetX: 0,
    offsetY: 4,
    opacity: 0.3,
    radius: 6,
    elevation: 8,
  },
};
