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

/**
 * Actualiza el email (y opcionalmente el metadata.username) de un usuario en Auth (solo admin vía Edge Function)
 * NOTA: Esta función requiere tener desplegada la Edge Function `admin-update-email`
 * que use la service_role key para llamar a supabase.auth.admin.updateUserById.
 * @param {string} userId - UUID del usuario en Auth
 * @param {string} newEmail - Nuevo email a establecer (p.ej. `${username}@example.com`)
 * @param {string} [username] - Nombre de usuario para sincronizar en user_metadata
 */
export async function adminUpdateEmailById(userId, newEmail, username) {
  try {
    const { data, error } = await supabase.functions.invoke('admin-update-email', {
      body: { userId, newEmail, username }
    });

    if (error) {
      console.error('Supabase functions error (admin-update-email):', error);
      throw new Error(error.message || 'Error de comunicación con el servidor');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  } catch (error) {
    console.error('Admin update email error:', error);
    throw error;
  }
}
