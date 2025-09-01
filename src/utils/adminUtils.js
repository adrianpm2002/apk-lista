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
    // Verificar que el usuario existe
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();

    if (profileError || !profiles) {
      throw new Error('Usuario no encontrado');
    }

    // Por ahora, en lugar de cambiar la contraseña directamente,
    // vamos a almacenar una "contraseña temporal" en la tabla profiles
    // y permitir que el usuario la use en el próximo login
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        temp_password: newPassword,
        temp_password_created: new Date().toISOString()
      })
      .eq('username', username);

    if (updateError) {
      throw new Error('Error al establecer contraseña temporal: ' + updateError.message);
    }

    return { 
      success: true, 
      message: `Contraseña temporal establecida para ${username}. El usuario podrá usar esta contraseña en su próximo login y luego cambiarla desde su perfil.`
    };
  } catch (error) {
    console.error('Admin reset password error:', error);
    throw error;
  }
}
