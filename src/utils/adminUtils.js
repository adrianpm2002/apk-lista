// Utilidades para funciones de administrador
import { supabase } from '../supabaseClient';

/**
 * Cambiar contraseña de un usuario por su username (solo admin/collector)
 * @param {string} username - Nombre de usuario  
 * @param {string} newPassword - Nueva contraseña
 * @returns {Promise<Object>} - Resultado de la operación
 */
export async function adminResetPasswordByUsername(username, newPassword) {
  try {
    // Verificar que el usuario existe y obtener su ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();

    if (profileError || !profile) {
      throw new Error('Usuario no encontrado');
    }

    // Cambiar contraseña directamente en Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(profile.id, {
      password: newPassword
    });

    if (updateError) {
      throw new Error('Error al actualizar contraseña: ' + updateError.message);
    }

    return { 
      success: true, 
      message: `Contraseña actualizada exitosamente para ${username}. El usuario puede usar la nueva contraseña inmediatamente.`
    };
  } catch (error) {
    console.error('Admin reset password error:', error);
    throw error;
  }
}
