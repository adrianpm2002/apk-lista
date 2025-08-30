// src/utils/errorHandler.js

export const handleSupabaseError = (error, operation = 'operación') => {
  console.error(`Error en ${operation}:`, error);
  
  if (error?.message) {
    return error.message;
  }
  
  return `Error inesperado en ${operation}`;
};

export const logDebug = (message, data = null) => {
  if (__DEV__) {
    console.log(message, data);
  }
};

export const logError = (message, error = null) => {
  if (__DEV__) {
    console.error(message, error);
  }
  // En producción, podrías enviar a un servicio de logging
};
