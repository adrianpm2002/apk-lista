import AsyncStorage from '@react-native-async-storage/async-storage';

// Claves de almacenamiento
const STORAGE_KEYS = {
  PERSISTENT_SESSION: 'PERSISTENT_SESSION',
  REFRESH_TOKEN: 'REFRESH_TOKEN',
  USER_SESSION: 'USER_SESSION',
};

/**
 * Servicio de almacenamiento seguro para sesiones persistentes
 */
class SecureStorageService {
  
  /**
   * Guarda el estado de sesión persistente
   * @param {boolean} enabled - Si la sesión persistente está habilitada
   */
  async setPersistentSessionEnabled(enabled) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PERSISTENT_SESSION, JSON.stringify(enabled));
      console.log(`Sesión persistente ${enabled ? 'habilitada' : 'deshabilitada'}`);
    } catch (error) {
      console.error('Error al guardar estado de sesión persistente:', error);
      throw error;
    }
  }

  /**
   * Obtiene el estado de sesión persistente
   * @returns {Promise<boolean>} Estado de sesión persistente
   */
  async isPersistentSessionEnabled() {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.PERSISTENT_SESSION);
      return value ? JSON.parse(value) : false;
    } catch (error) {
      console.error('Error al obtener estado de sesión persistente:', error);
      return false;
    }
  }

  /**
   * Guarda el refresh token de Supabase de forma segura
   * @param {string} refreshToken - Token de refresco de Supabase
   */
  async saveRefreshToken(refreshToken) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      console.log('Refresh token guardado de forma segura');
    } catch (error) {
      console.error('Error al guardar refresh token:', error);
      throw error;
    }
  }

  /**
   * Obtiene el refresh token almacenado
   * @returns {Promise<string|null>} Refresh token o null si no existe
   */
  async getStoredRefreshToken() {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Error al obtener refresh token:', error);
      return null;
    }
  }

  /**
   * Guarda información básica de la sesión del usuario
   * @param {Object} sessionData - Datos de sesión del usuario
   */
  async saveUserSession(sessionData) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(sessionData));
      console.log('Datos de sesión de usuario guardados');
    } catch (error) {
      console.error('Error al guardar datos de sesión:', error);
      throw error;
    }
  }

  /**
   * Obtiene los datos de sesión del usuario
   * @returns {Promise<Object|null>} Datos de sesión o null si no existen
   */
  async getUserSession() {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.USER_SESSION);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error al obtener datos de sesión:', error);
      return null;
    }
  }

  /**
   * Limpia todas las credenciales almacenadas
   */
  async clearStoredCredentials() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER_SESSION,
      ]);
      console.log('Credenciales almacenadas eliminadas');
    } catch (error) {
      console.error('Error al limpiar credenciales:', error);
      throw error;
    }
  }

  /**
   * Limpia completamente todos los datos de sesión incluida la preferencia
   */
  async clearAllSessionData() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.PERSISTENT_SESSION,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER_SESSION,
      ]);
      console.log('Todos los datos de sesión eliminados');
    } catch (error) {
      console.error('Error al limpiar todos los datos de sesión:', error);
      throw error;
    }
  }

  /**
   * Verifica si hay credenciales válidas almacenadas
   * @returns {Promise<boolean>} True si hay credenciales almacenadas
   */
  async hasStoredCredentials() {
    try {
      const refreshToken = await this.getStoredRefreshToken();
      return !!refreshToken;
    } catch (error) {
      console.error('Error al verificar credenciales almacenadas:', error);
      return false;
    }
  }
}

// Exportar instancia singleton
export const secureStorage = new SecureStorageService();

// Exportar también las claves para referencia
export { STORAGE_KEYS };