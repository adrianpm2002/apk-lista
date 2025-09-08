import { supabase } from '../supabaseClient';
import { secureStorage } from '../utils/storage';
import { mapAuthError, isTokenExpiredError, logAuthError } from '../utils/authErrorUtils';

/**
 * Servicio de autenticación con sesión persistente
 */
class AuthService {
  
  /**
   * Restaura la sesión si está habilitada la persistencia
   * @returns {Promise<Object|null>} Datos de sesión restaurada o null
   */
  async restoreSessionIfNeeded() {
    try {
      console.log('Verificando si se debe restaurar la sesión...');
      
      const isPersistentEnabled = await secureStorage.isPersistentSessionEnabled();
      
      if (!isPersistentEnabled) {
        console.log('Sesión persistente deshabilitada');
        return null;
      }

      const refreshToken = await secureStorage.getStoredRefreshToken();
      
      if (!refreshToken) {
        console.log('No hay refresh token almacenado');
        return null;
      }

      console.log('Intentando restaurar sesión con refresh token...');

      // Primero verificar si ya hay una sesión activa en Supabase
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession && currentSession.user) {
        console.log('Hay una sesión activa en Supabase, pero verificando si la persistencia está habilitada...');
        
        // Si la persistencia está deshabilitada, cerrar la sesión activa
        if (!isPersistentEnabled) {
          console.log('Sesión persistente deshabilitada, cerrando sesión activa...');
          await supabase.auth.signOut();
          return null;
        }
        
        // Verificar si la sesión actual es válida haciendo una consulta
        try {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          
          if (user && !userError) {
            console.log('Sesión activa válida confirmada');
            const userProfile = await this.getUserProfile(user.id);
            if (userProfile && userProfile.activo !== false) {
              return {
                session: currentSession,
                profile: userProfile
              };
            }
          }
        } catch (validationError) {
          console.log('Sesión activa no válida:', validationError.message);
        }
      }

      // Si no hay sesión activa válida, intentar establecer la sesión con el refresh token
      console.log('Intentando establecer sesión con refresh token almacenado...');
      
      // Para la web, usamos setSession con ambos tokens
      const { data, error } = await supabase.auth.setSession({
        access_token: 'placeholder', // Será reemplazado
        refresh_token: refreshToken
      });

      if (error) {
        console.error('Error específico en setSession:', {
          message: error.message,
          status: error.status,
          details: error
        });
        logAuthError('restoreSession', error);
        
        // Si el token es inválido, limpiar credenciales
        if (isTokenExpiredError(error)) {
          console.log('Token expirado, limpiando credenciales');
          await this.clearStoredCredentials();
        }
        return null;
      }

      if (data?.session?.user) {
        console.log('Sesión restaurada exitosamente');
        
        // Obtener datos del perfil del usuario
        const userProfile = await this.getUserProfile(data.session.user.id);
        
        if (userProfile) {
          // Verificar que el usuario siga activo
          if (userProfile.activo === false) {
            console.log('Usuario inactivo, cerrando sesión');
            await this.logout(false);
            return null;
          }

          // Guardar nueva información de sesión
          await secureStorage.saveUserSession({
            userId: data.session.user.id,
            role: userProfile.role,
            bankId: userProfile.bankId,
            activo: userProfile.activo,
            restoredAt: new Date().toISOString()
          });

          // Actualizar el refresh token si cambió
          if (data.session.refresh_token && data.session.refresh_token !== refreshToken) {
            await secureStorage.saveRefreshToken(data.session.refresh_token);
            console.log('Refresh token actualizado');
          }

          return {
            session: data.session,
            profile: userProfile
          };
        }
      }

      console.log('No se pudo restaurar la sesión');
      return null;
    } catch (error) {
      logAuthError('restoreSessionIfNeeded', error);
      
      // En caso de error, limpiar credenciales solo si es un error de token
      if (isTokenExpiredError(error)) {
        await this.clearStoredCredentials();
      }
      
      return null;
    }
  }

  /**
   * Maneja el login con opción de persistencia
   * @param {string} username - Nombre de usuario
   * @param {string} password - Contraseña
   * @param {boolean} keepSession - Si mantener la sesión persistente
   * @returns {Promise<Object>} Resultado del login
   */
  async login(username, password, keepSession = false) {
    try {
      const email = `${username.toLowerCase()}@example.com`;

      const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        logAuthError('login', loginError);
        throw new Error(mapAuthError(loginError));
      }

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error('Error interno del sistema.');
      }

      // Obtener perfil del usuario
      const userProfile = await this.getUserProfile(userId);
      
      if (!userProfile) {
        throw new Error('Error al obtener el perfil del usuario');
      }

      // Verificar si el usuario está activo
      if (userProfile.activo === false) {
        await supabase.auth.signOut();
        throw new Error('Cuenta desactivada, contacte con su administrador.');
      }

      // Actualizar preferencia de sesión persistente
      await secureStorage.setPersistentSessionEnabled(keepSession);

      // Si está habilitada la persistencia, guardar el refresh token
      if (keepSession && authData.session?.refresh_token) {
        await secureStorage.saveRefreshToken(authData.session.refresh_token);
        console.log('Refresh token guardado para sesión persistente');
      }

      // Guardar datos de sesión
      await secureStorage.saveUserSession({
        userId,
        role: userProfile.role,
        bankId: userProfile.bankId,
        activo: userProfile.activo,
        loginAt: new Date().toISOString()
      });

      console.log(`Login exitoso para usuario ${username} (${userProfile.role})`);

      return {
        success: true,
        session: authData.session,
        profile: userProfile
      };

    } catch (error) {
      logAuthError('login', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene el perfil del usuario desde la base de datos
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object|null>} Perfil del usuario
   */
  async getUserProfile(userId) {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, activo, id_banco, username')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('Error al obtener perfil:', profileError);
        return null;
      }

      // Determinar el banco_id correcto según el rol
      let bankId;
      if (profile.role === 'admin') {
        bankId = userId; // El admin ES el banco
      } else if (profile.role === 'collector' || profile.role === 'listero') {
        bankId = profile.id_banco;
      }

      return {
        ...profile,
        bankId
      };
    } catch (error) {
      console.error('Error inesperado al obtener perfil:', error);
      return null;
    }
  }

  /**
   * Cierra la sesión del usuario
   * @param {boolean} clearPersistentPreference - Si limpiar también la preferencia de persistencia
   */
  async logout(clearPersistentPreference = false) {
    try {
      console.log('Cerrando sesión...');
      
      // Cerrar sesión en Supabase
      await supabase.auth.signOut();
      
      // Limpiar credenciales almacenadas
      if (clearPersistentPreference) {
        await secureStorage.clearAllSessionData();
      } else {
        await secureStorage.clearStoredCredentials();
      }
      
      console.log('Sesión cerrada exitosamente');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Forzar limpieza incluso si hay error
      await secureStorage.clearStoredCredentials();
    }
  }

  /**
   * Maneja el cambio de estado de sesión persistente desde configuración
   * @param {boolean} enabled - Nuevo estado de persistencia
   */
  async onPersistentSessionToggle(enabled) {
    try {
      await secureStorage.setPersistentSessionEnabled(enabled);
      
      if (enabled) {
        // Si se habilita y hay sesión activa, guardar el refresh token
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.refresh_token) {
          await secureStorage.saveRefreshToken(session.refresh_token);
          console.log('Sesión persistente habilitada - refresh token guardado');
        }
      } else {
        // Si se deshabilita, limpiar solo los datos almacenados pero mantener sesión actual
        console.log('Sesión persistente deshabilitada - limpiando datos almacenados');
        await secureStorage.clearStoredCredentials();
      }
    } catch (error) {
      console.error('Error al cambiar estado de sesión persistente:', error);
      throw error;
    }
  }

  /**
   * Limpia las credenciales almacenadas
   */
  async clearStoredCredentials() {
    await secureStorage.clearStoredCredentials();
  }

  /**
   * Verifica si hay una sesión activa
   * @returns {Promise<boolean>} True si hay sesión activa
   */
  async hasActiveSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return !!session;
    } catch (error) {
      console.error('Error al verificar sesión activa:', error);
      return false;
    }
  }

  /**
   * Obtiene la sesión actual
   * @returns {Promise<Object|null>} Sesión actual o null
   */
  async getCurrentSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      console.error('Error al obtener sesión actual:', error);
      return null;
    }
  }
}

// Exportar instancia singleton
export const authService = new AuthService();
