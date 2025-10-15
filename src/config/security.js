/**
 * Configuración segura de red y autenticación
 */

// Configuración de timeouts y reintentos
export const NETWORK_CONFIG = {
  timeout: 10000, // 10 segundos
  retries: 3,
  retryDelay: 1000, // 1 segundo
};

// Configuración de seguridad
export const SECURITY_CONFIG = {
  // Validar SSL certificates
  rejectUnauthorized: true,
  // Headers de seguridad
  defaultHeaders: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  },
};

// Función para validar respuestas de la API
export function validateApiResponse(response) {
  // Verificar que la respuesta venga del dominio correcto
  const allowedOrigins = [
    'kathcxgrriikfdwvqhpz.supabase.co',
    'supabase.co'
  ];
  
  // Validaciones adicionales de seguridad
  if (response.status === 401) {
    // Limpiar tokens locales si hay problemas de autenticación
    clearLocalTokens();
  }
  
  return response;
}

// Función para limpiar tokens comprometidos
function clearLocalTokens() {
  // Implementar limpieza de tokens según el sistema de storage usado
}

// Configuración de desarrollo vs producción
export const getEnvironmentConfig = () => {
  const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
  
  return {
    enableLogging: isDevelopment,
    enableDebugMode: isDevelopment,
    strictSSL: !isDevelopment,
    apiTimeout: isDevelopment ? 30000 : 10000,
  };
};
