// Utilidades para funciones de administrador
import { supabase } from '../supabaseClient';

/**
 * Cambiar contraseña de un usuario por su username (solo admin)
 * @param {string} username - Nombre de usuario
 * @param {string} newPassword - Nueva contraseña
 * @returns {Promise<Object>} - Resultado de la operación
 */
export async function adminResetPasswordByUsername(username, newPassword) {
  try {
    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: { username, newPassword }
    });
    
    if (error) {
      console.error('Supabase functions error:', error);
      throw new Error(error.message || 'Error de comunicación con el servidor');
    }
    
    if (data?.error) {
      throw new Error(data.error);
    }
    
    return data;
  } catch (error) {
    console.error('Admin reset password error:', error);
    throw error;
  }
}
