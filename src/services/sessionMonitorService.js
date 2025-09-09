import { supabase } from '../supabaseClient';
import { authService } from './authService';
import { secureStorage } from '../utils/storage';

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
      console.log('El monitoreo de sesión ya está activo');
      return;
    }

    console.log('Iniciando monitoreo de sesión...');
    this.isMonitoring = true;

    // Escuchar cambios en el estado de autenticación
    this.authStateSubscription = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Estado de autenticación cambió: ${event}`);
        
        await this.handleAuthStateChange(event, session);
        
        // Notificar a todos los listeners
        this.notifyListeners(event, session);
      }
    );
  }

  /**
   * Detiene el monitoreo de la sesión
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('Deteniendo monitoreo de sesión...');
    this.isMonitoring = false;

    if (this.authStateSubscription) {
      this.authStateSubscription.subscription.unsubscribe();
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
          console.log('Recuperación de contraseña iniciada');
          break;
        
        default:
          console.log(`Evento de autenticación no manejado: ${event}`);
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

    console.log('Usuario autenticado, actualizando datos...');
    
    // Verificar si la sesión persistente está habilitada
    const isPersistentEnabled = await secureStorage.isPersistentSessionEnabled();
    
    if (isPersistentEnabled && session.refresh_token) {
      // Actualizar el refresh token almacenado
      await secureStorage.saveRefreshToken(session.refresh_token);
      console.log('Refresh token actualizado en almacenamiento seguro');
    }

    // Obtener y guardar información del perfil del usuario
    const userProfile = await authService.getUserProfile(session.user.id);
    if (userProfile) {
      await secureStorage.saveUserSession({
        userId: session.user.id,
        role: userProfile.role,
        bankId: userProfile.bankId,
        activo: userProfile.activo,
        lastActivity: new Date().toISOString()
      });
    }
  }

  /**
   * Maneja el evento de cierre de sesión
   */
  async handleSignedOut() {
    console.log('Usuario desautenticado, limpiando datos locales...');
    
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

    console.log('Token renovado, actualizando almacenamiento...');
    
    const isPersistentEnabled = await secureStorage.isPersistentSessionEnabled();
    
    if (isPersistentEnabled && session.refresh_token) {
      await secureStorage.saveRefreshToken(session.refresh_token);
      console.log('Refresh token actualizado tras renovación');
    }

    // Actualizar timestamp de última actividad
    const existingSession = await secureStorage.getUserSession();
    if (existingSession) {
      await secureStorage.saveUserSession({
        ...existingSession,
        lastActivity: new Date().toISOString()
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
