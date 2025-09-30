// Configuración de logs para la aplicación
const __DEV__ = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args) => {
    if (__DEV__) {
      console.log(...args);
    }
  },
  
  warn: (...args) => {
    if (__DEV__) {
      console.warn(...args);
    }
  },
  
  error: (...args) => {
    // Los errores siempre se muestran
    console.error(...args);
  },
  
  debug: (...args) => {
    if (__DEV__) {
      console.log('[DEBUG]', ...args);
    }
  }
};

export default logger;