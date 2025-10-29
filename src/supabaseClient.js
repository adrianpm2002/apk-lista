import { createClient } from '@supabase/supabase-js';
import { NETWORK_CONFIG, SECURITY_CONFIG, getEnvironmentConfig } from './config/security';
import { Platform } from 'react-native';

// Obtener configuración desde variables de entorno
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validar que las variables de entorno estén configuradas
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Faltan variables de entorno de Supabase. Verifica tu configuración .env');
}

// Configuración de seguridad para el cliente
const envConfig = getEnvironmentConfig();

const isWeb = (Platform && Platform.OS === 'web') || typeof window !== 'undefined' && typeof document !== 'undefined';

// Para entornos web de desarrollo podemos desactivar el auto refresh de token
// si la API de Supabase no está disponible, para evitar spam de errores de red.
const supabaseOptions = {
  auth: {
    autoRefreshToken: !isWeb, // desactivar en web para evitar reintentos automáticos en dev
    persistSession: true,
    detectSessionInUrl: false,
    // Para web usar localStorage si está disponible
    storage: isWeb && typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined,
  },
  global: {
    // Headers mínimos para evitar conflictos con PostgREST
    // El Accept debe incluir el tipo vendor de PostgREST para respuestas single-object
    headers: {
      'Accept': 'application/json, application/vnd.pgrst.object+json',
    },
  },
  // Configuración de red
  realtime: {
    timeout: NETWORK_CONFIG.timeout,
  },
};

// Solo habilitar logging en desarrollo
if (envConfig.enableLogging) {
  // aquí podría colocarse lógica de logging adicional
} else {
}

if (isWeb && supabaseOptions.auth.autoRefreshToken === false) {
  // Notificar en consola que autoRefreshToken fue desactivado en web para evitar errores de red ruidosos
  // Esto evita múltiples mensajes "Failed to fetch" en el desarrollo cuando el backend no responde.
  // Si quieres habilitar autoRefreshToken en web, cambia la detección o ajusta la opción.
  // eslint-disable-next-line no-console
  console.info('[supabaseClient] autoRefreshToken desactivado en web para evitar reintentos automáticos');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, supabaseOptions);
