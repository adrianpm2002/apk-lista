import { supabase } from '../supabaseClient';
import { authService } from './authService';
import { secureStorage } from '../utils/storage';

/**
 * Obtener timestamp en hora local (NO UTC)
 */
const getLocalTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Servicio para monitorear el estado de la sesión en tiempo real
 */
class SessionMonitorService {
  constructor() {
    this.listeners = new Set();
    this.isMonitoring = false;
    this.authStateSubscription = null;
  }

  /**
   * Inicia el monitoreo de la sesión
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    try {
      this.isMonitoring = true;

      // Escuchar cambios en el estado de autenticación
      this.authStateSubscription = supabase.auth.onAuthStateChange(
        async (event, session) => {
          await this.handleAuthStateChange(event, session);
          
          // Notificar a todos los listeners
          this.notifyListeners(event, session);
        }
      );

    } catch (error) {
      console.error('Error al iniciar monitoreo de sesión:', error);
      this.isMonitoring = false;
      this.authStateSubscription = null;
    }
  }

  /**
   * Detiene el monitoreo de la sesión
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    // Verificar si existe la suscripción antes de intentar cancelarla
    if (this.authStateSubscription) {
      try {
        // Diferentes versiones de Supabase pueden retornar diferentes estructuras
        if (typeof this.authStateSubscription.unsubscribe === 'function') {
          // Versión nueva - retorna objeto con método unsubscribe directo
          this.authStateSubscription.unsubscribe();
        } else if (this.authStateSubscription.subscription && 
                   typeof this.authStateSubscription.subscription.unsubscribe === 'function') {
          // Versión anterior - retorna objeto con propiedad subscription
          this.authStateSubscription.subscription.unsubscribe();
        } else if (typeof this.authStateSubscription === 'function') {
          // Algunas versiones retornan directamente la función de cleanup
          this.authStateSubscription();
        } else {
          console.warn('Estructura de suscripción no reconocida:', this.authStateSubscription);
        }
      } catch (error) {
        console.error('Error al cancelar suscripción de auth state:', error);
      }
      this.authStateSubscription = null;
    }

    this.listeners.clear();
  }

  /**
   * Maneja cambios en el estado de autenticación
   * @param {string} event - Tipo de evento
   * @param {Object} session - Datos de sesión
   */
  async handleAuthStateChange(event, session) {
    try {
      switch (event) {
        case 'SIGNED_IN':
          await this.handleSignedIn(session);
          break;
        
        case 'SIGNED_OUT':
          await this.handleSignedOut();
          break;
        
        case 'TOKEN_REFRESHED':
          await this.handleTokenRefreshed(session);
          break;
        
        case 'PASSWORD_RECOVERY':
          break;
        
        default:
          break;
      }
    } catch (error) {
      console.error('Error al manejar cambio de estado de autenticación:', error);
    }
  }

  /**
   * Maneja el evento de inicio de sesión
   * @param {Object} session - Datos de sesión
   */
  async handleSignedIn(session) {
    if (!session) return;

    // Verificar si la sesión persistente está habilitada
    const isPersistentEnabled = await secureStorage.isPersistentSessionEnabled();
    
    if (isPersistentEnabled && session.refresh_token) {
      // Actualizar el refresh token almacenado
      await secureStorage.saveRefreshToken(session.refresh_token);
    }

    // Obtener y guardar información del perfil del usuario
    const userProfile = await authService.getUserProfile(session.user.id);
    if (userProfile) {
      await secureStorage.saveUserSession({
        userId: session.user.id,
        role: userProfile.role,
        bankId: userProfile.bankId,
        activo: userProfile.activo,
        lastActivity: getLocalTimestamp()
      });
    }
  }

  /**
   * Maneja el evento de cierre de sesión
   */
  async handleSignedOut() {
    // No limpiar la preferencia de sesión persistente al cerrar sesión
    // Solo limpiar las credenciales y datos de sesión
    await secureStorage.clearStoredCredentials();
  }

  /**
   * Maneja la renovación de tokens
   * @param {Object} session - Datos de sesión actualizados
   */
  async handleTokenRefreshed(session) {
    if (!session) return;

    const isPersistentEnabled = await secureStorage.isPersistentSessionEnabled();
    
    if (isPersistentEnabled && session.refresh_token) {
      await secureStorage.saveRefreshToken(session.refresh_token);
    }

    // Actualizar timestamp de última actividad
    const existingSession = await secureStorage.getUserSession();
    if (existingSession) {
      await secureStorage.saveUserSession({
        ...existingSession,
        lastActivity: getLocalTimestamp()
      });
    }
  }

  /**
   * Añade un listener para cambios de estado
   * @param {Function} listener - Función callback
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remueve un listener
   * @param {Function} listener - Función callback a remover
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notifica a todos los listeners
   * @param {string} event - Tipo de evento
   * @param {Object} session - Datos de sesión
   */
  notifyListeners(event, session) {
    this.listeners.forEach(listener => {
      try {
        listener(event, session);
      } catch (error) {
        console.error('Error en listener de sesión:', error);
      }
    });
  }

  /**
   * Verifica el estado actual de la sesión
   * @returns {Promise<Object>} Estado de la sesión
   */
  async checkSessionStatus() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const isPersistentEnabled = await secureStorage.isPersistentSessionEnabled();
      const hasStoredCredentials = await secureStorage.hasStoredCredentials();
      const userSession = await secureStorage.getUserSession();

      return {
        hasActiveSession: !!session,
        isPersistentEnabled,
        hasStoredCredentials,
        userSession,
        sessionUser: session?.user || null,
      };
    } catch (error) {
      console.error('Error al verificar estado de sesión:', error);
      return {
        hasActiveSession: false,
        isPersistentEnabled: false,
        hasStoredCredentials: false,
        userSession: null,
        sessionUser: null,
      };
    }
  }
}

// Exportar instancia singleton
export const sessionMonitor = new SessionMonitorService();

export default SessionMonitorService;
