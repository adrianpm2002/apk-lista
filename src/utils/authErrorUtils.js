/**
 * Utilidades para manejo de errores de autenticación
 */

/**
 * Mapea errores de Supabase a mensajes legibles
 * @param {Error} error - Error de Supabase
 * @returns {string} Mensaje de error legible
 */
export const mapAuthError = (error) => {
  if (!error) return 'Error desconocido';

  const errorMessage = error.message?.toLowerCase() || '';

  // Errores comunes de autenticación
  if (errorMessage.includes('invalid login credentials')) {
    return 'Credenciales incorrectas';
  }

  if (errorMessage.includes('email not confirmed')) {
    return 'Email no confirmado';
  }

  if (errorMessage.includes('invalid refresh token')) {
    return 'Sesión expirada, por favor inicie sesión nuevamente';
  }

  if (errorMessage.includes('refresh_token_not_found')) {
    return 'Token de sesión no encontrado';
  }

  if (errorMessage.includes('user not found')) {
    return 'Usuario no encontrado';
  }

  if (errorMessage.includes('signup_disabled')) {
    return 'Registro de usuarios deshabilitado';
  }

  if (errorMessage.includes('weak_password')) {
    return 'La contraseña es muy débil';
  }

  if (errorMessage.includes('too_many_requests')) {
    return 'Demasiados intentos, por favor espere un momento';
  }

  if (errorMessage.includes('network')) {
    return 'Error de conexión, verifique su internet';
  }

  // Si no coincide con ningún patrón conocido, devolver el mensaje original
  return error.message || 'Error de autenticación';
};

/**
 * Verifica si un error indica que el token ha expirado
 * @param {Error} error - Error a verificar
 * @returns {boolean} True si el token ha expirado
 */
export const isTokenExpiredError = (error) => {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  
  return errorMessage.includes('invalid refresh token') ||
         errorMessage.includes('refresh_token_not_found') ||
         errorMessage.includes('jwt expired') ||
         errorMessage.includes('token expired');
};

/**
 * Verifica si un error indica problemas de red
 * @param {Error} error - Error a verificar
 * @returns {boolean} True si es un error de red
 */
export const isNetworkError = (error) => {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  
  return errorMessage.includes('network') ||
         errorMessage.includes('fetch') ||
         errorMessage.includes('timeout') ||
         errorMessage.includes('connection');
};

/**
 * Logs detallados de errores de autenticación
 * @param {string} context - Contexto donde ocurrió el error
 * @param {Error} error - Error a loggear
 */
export const logAuthError = (context, error) => {
  console.error(`[Auth Error - ${context}]`, {
    message: error.message,
    stack: error.stack,
    name: error.name,
    timestamp: new Date().toISOString(),
    fullError: error, // Agregar el error completo para debugging
  });
  
  // Log adicional para debugging en desarrollo
  if (process.env.NODE_ENV !== 'production') {

  }
};
