import { supabase } from '../supabaseClient';
import { secureStorage } from '../utils/storage';
import { mapAuthError, logAuthError } from '../utils/authErrorUtils';

/**
 * Servicio de autenticación que maneja el login, logout y restauración de sesión
 */
class AuthService {
  /**
   * Restaura la sesión si está habilitada la persistencia y hay credenciales almacenadas
   * @returns {Promise<Object|null>} Datos de sesión restaurada o null
   */
  async restoreSessionIfNeeded() {
    try {

      // Verificar si la sesión persistente está habilitada
      const isPersistentEnabled = await secureStorage.isPersistentSessionEnabled();

      if (!isPersistentEnabled) {

        return null;
      }

      // Verificar si hay un refresh token almacenado
      const refreshToken = await secureStorage.getStoredRefreshToken();
      if (!refreshToken) {

        return null;
      }

  
      // Intentar renovar la sesión usando el refresh token
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error) {
        console.error('Error al renovar sesión:', error.message);
        logAuthError('session_refresh', error);
        
        // Si el refresh token es inválido, limpiar credenciales
        if (error.message.includes('refresh_token_not_found') || 
            error.message.includes('invalid refresh token') ||
            error.message.includes('Refresh Token Not Found') ||
            error.message.includes('Auth session missing')) {
          // Limpiar credenciales silenciosamente sin mostrar error al usuario
          await secureStorage.clearStoredCredentials();
        }
        
        return null;
      }

      if (!data.session) {

        return null;
      }

  
      // Obtener perfil del usuario restaurado
      const userProfile = await this.getUserProfile(data.session.user.id);
      
      if (!userProfile) {

        return null;
      }

      // Verificar si el usuario sigue activo
      if (userProfile.activo === false) {

        await this.logout(false); // No limpiar preferencia de persistencia
        return null;
      }

      // Actualizar información de sesión almacenada
      if (data.session.refresh_token) {
        await secureStorage.saveRefreshToken(data.session.refresh_token);
      }

      await secureStorage.saveUserSession({
        userId: data.session.user.id,
        role: userProfile.role,
        bankId: userProfile.bankId,
        activo: userProfile.activo,
        restoredAt: new Date().toISOString()
      });


      return {
        success: true,
        session: data.session,
        profile: userProfile
      };

    } catch (error) {
      console.error('Error inesperado al restaurar sesión:', error);
      logAuthError('session_restore', error);
      return null;
    }
  }

  /**
   * Inicia sesión del usuario
   * @param {string} username - Nombre de usuario
   * @param {string} password - Contraseña
   * @param {boolean} keepSession - Si mantener sesión persistente
   * @returns {Promise<Object>} Resultado del login
   */
  async login(username, password, keepSession = false) {
    try {
      if (!username || !password) {
        throw new Error('Credenciales requeridas');
      }

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
      }

      // Guardar datos de sesión
      await secureStorage.saveUserSession({
        userId,
        role: userProfile.role,
        bankId: userProfile.bankId,
        activo: userProfile.activo,
        loginAt: new Date().toISOString()
      });

      // Guardar credenciales para login offline (automático, NO bloqueante)
      try {
        await this.saveCredentialsForOffline(username, password, {
          userId,
          role: userProfile.role,
          bankId: userProfile.bankId,
        });
      } catch (offlineError) {
        // No fallar el login si falla el guardado offline
        console.warn('[AuthService] ⚠️ No se pudieron guardar credenciales offline, pero el login fue exitoso');
        console.warn('[AuthService] Error:', offlineError.message);
      }

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
   * Obtiene la sesión actual de Supabase
   * @returns {Promise<Object|null>} Sesión actual o null
   */
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error obteniendo sesión actual:', error);
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Error inesperado obteniendo sesión:', error);
      return null;
    }
  }

  /**
   * Cierra la sesión del usuario
   * @param {boolean} clearPersistentPreference - Si limpiar también la preferencia de persistencia
   */
  async logout(clearPersistentPreference = false) {
    try {

      
      // Cerrar sesión en Supabase
      await supabase.auth.signOut();
      
      // Limpiar credenciales almacenadas
      if (clearPersistentPreference) {
        await secureStorage.clearAllSessionData();
      } else {
        await secureStorage.clearStoredCredentials();
      }
      

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

        }
      } else {
        // Si se deshabilita, limpiar solo los datos almacenados pero mantener sesión actual

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

  // ========================================
  // FUNCIONALIDAD OFFLINE
  // ========================================

  /**
   * Guardar credenciales para login offline (al hacer login online exitoso)
   * @param {string} username - Nombre de usuario
   * @param {string} password - Contraseña (se encriptará)
   * @param {Object} profile - Perfil del usuario
   */
  async saveCredentialsForOffline(username, password, profile) {
    try {
      console.log('[AuthService] Iniciando guardado de credenciales offline...');
      console.log('[AuthService] Usuario:', username);
      console.log('[AuthService] Profile recibido:', JSON.stringify(profile));

      const { encryptPassword } = require('./encryptionService');
      const OfflineStorage = require('./offlineStorageService');

      // Encriptar contraseña
      console.log('[AuthService] Encriptando contraseña...');
      const encryptedData = await encryptPassword(password);
      console.log('[AuthService] Contraseña encriptada:', encryptedData ? 'OK' : 'FALLÓ');

      // Calcular fecha de expiración (24 horas)
      const now = Date.now();
      const expiresAt = now + (24 * 60 * 60 * 1000);

      console.log('[AuthService] Preparando datos para SQLite...');
      const credentialsData = {
        user_id: profile.userId || profile.id,
        encrypted_data: JSON.stringify({
          username,
          password: encryptedData,
        }),
        role: profile.role,
        id_banco: profile.bankId,
        last_login: now.toString(),
        session_expires: expiresAt.toString(),
      };
      console.log('[AuthService] Datos a guardar:', JSON.stringify(credentialsData, null, 2));

      // Guardar en SQLite
      console.log('[AuthService] Guardando en SQLite...');
      const saved = await OfflineStorage.saveCredentials(credentialsData);
      console.log('[AuthService] Resultado de guardado:', saved ? 'ÉXITO' : 'FALLÓ');

      if (saved) {
        console.log('[AuthService] ✅ Credenciales guardadas exitosamente para login offline');
        await OfflineStorage.setLastLoginTimestamp(now);
        console.log('[AuthService] ✅ Timestamp actualizado');
      } else {
        console.error('[AuthService] ❌ saveCredentials retornó false');
      }

      return saved;
    } catch (error) {
      console.error('[AuthService] ❌ Error al guardar credenciales offline:', error);
      console.error('[AuthService] Error stack:', error.stack);
      // NO retornar false silenciosamente, lanzar el error para que se vea
      throw error;
    }
  }

  /**
   * Login offline usando credenciales guardadas
   * @param {string} username - Nombre de usuario
   * @param {string} password - Contraseña
   * @returns {Promise<Object>} Resultado del login
   */
  async loginOffline(username, password) {
    try {
      console.log('[AuthService] Iniciando login offline para:', username);
      const { decryptPassword } = require('./encryptionService');
      const OfflineStorage = require('./offlineStorageService');

      // Buscar credenciales por username
      console.log('[AuthService] Buscando credenciales...');
      const matchedCredentials = await OfflineStorage.getCredentialsByUsername(username);
      
      if (!matchedCredentials) {
        console.log('[AuthService] ❌ No se encontraron credenciales para', username);
        throw new Error('No hay credenciales guardadas para este usuario');
      }

      console.log('[AuthService] ✅ Credenciales encontradas');

      // Verificar expiración de sesión (24h)
      console.log('[AuthService] Verificando expiración de sesión...');
      const now = Date.now();
      const expiresAt = parseInt(matchedCredentials.session_expires);
      console.log('[AuthService] Sesión expira en:', new Date(expiresAt).toLocaleString());
      
      if (now > expiresAt) {
        console.log('[AuthService] ❌ Sesión expirada');
        throw new Error('Sesión offline expirada (>24h). Conéctese a internet para renovar.');
      }

      console.log('[AuthService] ✅ Sesión válida');

      // Desencriptar y verificar contraseña
      console.log('[AuthService] Desencriptando contraseña...');
      const data = JSON.parse(matchedCredentials.encrypted_data);
      const decryptedPassword = await decryptPassword(data.password);
      console.log('[AuthService] Contraseña desencriptada, verificando...');

      if (decryptedPassword !== password) {
        console.log('[AuthService] ❌ Contraseña incorrecta');
        throw new Error('Contraseña incorrecta');
      }

      console.log('[AuthService] ✅ Contraseña correcta');

      // Login exitoso
      console.log('[AuthService] ✅ Offline login successful');

      return {
        success: true,
        offline: true,
        profile: {
          userId: matchedCredentials.user_id,
          role: matchedCredentials.role,
          bankId: matchedCredentials.id_banco,
          username: data.username,
          activo: true, // Asumimos activo si está guardado
        }
      };

    } catch (error) {
      console.error('[AuthService] Offline login failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validar si la sesión offline sigue válida
   * @returns {Promise<boolean>} true si es válida
   */
  async validateOfflineSession() {
    try {
      const OfflineStorage = require('./offlineStorageService');
      const credentials = await OfflineStorage.getCredentials();

      if (!credentials || !credentials.session_expires) {
        return {
          valid: false,
          error: 'No hay sesión guardada',
        };
      }

      const sessionExpires = parseInt(credentials.session_expires);
      const now = Date.now();
      const isValid = now < sessionExpires;

      return {
        valid: isValid,
        expiresAt: sessionExpires,
        error: isValid ? null : 'Sesión expirada (>24h)',
      };
    } catch (error) {
      console.error('[AuthService] Error validating offline session:', error);
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Logout offline (limpiar credenciales si se desea)
   * @param {boolean} clearCredentials - Si eliminar credenciales guardadas
   */
  async logoutOffline(clearCredentials = false) {
    try {
      if (clearCredentials) {
        const OfflineStorage = require('./offlineStorageService');
        // Eliminar todas las credenciales
        const db = await OfflineStorage.default.getDatabase?.();
        if (db) {
          await db.executeSql('DELETE FROM offline_credentials');
        }
        console.log('[AuthService] Offline credentials cleared');
      }
      return true;
    } catch (error) {
      console.error('[AuthService] Error during offline logout:', error);
      return false;
    }
  }
}

// Exportar instancia singleton
export const authService = new AuthService();

