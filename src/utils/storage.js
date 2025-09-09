import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Servicio de almacenamiento seguro para credenciales y datos de sesión
 */
class SecureStorage {
  constructor() {
    this.KEYS = {
      REFRESH_TOKEN: 'app_refresh_token',
      USER_SESSION: 'app_user_session',
      PERSISTENT_SESSION_ENABLED: 'app_persistent_session_enabled',
    };
  }

  /**
   * Guarda el refresh token
   */
  async saveRefreshToken(refreshToken) {
    try {
      await AsyncStorage.setItem(this.KEYS.REFRESH_TOKEN, refreshToken);
    } catch (error) {
      console.error('Error guardando refresh token:', error);
      throw error;
    }
  }

  /**
   * Obtiene el refresh token almacenado
   */
  async getStoredRefreshToken() {
    try {
      return await AsyncStorage.getItem(this.KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Error obteniendo refresh token:', error);
      return null;
    }
  }

  /**
   * Guarda la información de sesión del usuario
   */
  async saveUserSession(sessionData) {
    try {
      await AsyncStorage.setItem(this.KEYS.USER_SESSION, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error guardando sesión de usuario:', error);
      throw error;
    }
  }

  /**
   * Obtiene la información de sesión del usuario
   */
  async getUserSession() {
    try {
      const sessionData = await AsyncStorage.getItem(this.KEYS.USER_SESSION);
      return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
      console.error('Error obteniendo sesión de usuario:', error);
      return null;
    }
  }

  /**
   * Establece si la sesión persistente está habilitada
   */
  async setPersistentSessionEnabled(enabled) {
    try {
      await AsyncStorage.setItem(this.KEYS.PERSISTENT_SESSION_ENABLED, JSON.stringify(enabled));
    } catch (error) {
      console.error('Error estableciendo sesión persistente:', error);
      throw error;
    }
  }

  /**
   * Verifica si la sesión persistente está habilitada
   */
  async isPersistentSessionEnabled() {
    try {
      const enabled = await AsyncStorage.getItem(this.KEYS.PERSISTENT_SESSION_ENABLED);
      return enabled ? JSON.parse(enabled) : false;
    } catch (error) {
      console.error('Error verificando sesión persistente:', error);
      return false;
    }
  }

  /**
   * Verifica si hay credenciales almacenadas
   */
  async hasStoredCredentials() {
    try {
      const refreshToken = await this.getStoredRefreshToken();
      const userSession = await this.getUserSession();
      return !!(refreshToken && userSession);
    } catch (error) {
      console.error('Error verificando credenciales:', error);
      return false;
    }
  }

  /**
   * Limpia solo las credenciales y datos de sesión, mantiene preferencias
   */
  async clearStoredCredentials() {
    try {
      await AsyncStorage.multiRemove([
        this.KEYS.REFRESH_TOKEN,
        this.KEYS.USER_SESSION
      ]);
    } catch (error) {
      console.error('Error limpiando credenciales:', error);
    }
  }

  /**
   * Limpia todos los datos de autenticación incluyendo preferencias
   */
  async clearAllSessionData() {
    try {
      await AsyncStorage.multiRemove([
        this.KEYS.REFRESH_TOKEN,
        this.KEYS.USER_SESSION,
        this.KEYS.PERSISTENT_SESSION_ENABLED
      ]);
    } catch (error) {
      console.error('Error limpiando todos los datos de sesión:', error);
    }
  }
}

// Exportar instancia singleton
export const secureStorage = new SecureStorage();