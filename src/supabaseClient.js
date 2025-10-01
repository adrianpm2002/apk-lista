import { createClient } from '@supabase/supabase-js';
import { NETWORK_CONFIG, SECURITY_CONFIG, getEnvironmentConfig } from './config/security';

// Obtener configuración desde variables de entorno
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validar que las variables de entorno estén configuradas
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Faltan variables de entorno de Supabase. Verifica tu configuración .env');
}

// Configuración de seguridad para el cliente
const envConfig = getEnvironmentConfig();

const supabaseOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Configuración de seguridad para tokens
    storage: undefined, // Usar storage por defecto pero de forma segura
  },
  global: {
    headers: {
      ...SECURITY_CONFIG.defaultHeaders,
    },
  },
  // Configuración de red
  realtime: {
    timeout: NETWORK_CONFIG.timeout,
  },
};

// Solo habilitar logging en desarrollo
if (envConfig.enableLogging) {
  console.log('🔧 Supabase client configurado para desarrollo');
} else {
  console.log('🔒 Supabase client configurado para producción');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, supabaseOptions);