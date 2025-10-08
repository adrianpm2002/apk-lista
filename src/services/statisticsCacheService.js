import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS = {
  ADMIN_STATS: 'statistics_cache_admin',
  COLLECTOR_STATS: 'statistics_cache_collector',
  LISTERO_STATS: 'statistics_cache_listero',
  CACHE_TIMESTAMPS: 'statistics_cache_timestamps',
};

// Tiempo de vida del caché en milisegundos (1 hora por defecto)
const CACHE_EXPIRY_TIME = 60 * 60 * 1000; // 1 hora

class StatisticsCacheService {
  /**
   * Guarda datos de estadísticas en el caché local
   * @param {string} role - Rol del usuario (admin, collector, listero)
   * @param {object} data - Datos de estadísticas a cachear
   * @param {string} period - Período seleccionado
   */
  async saveStatisticsToCache(role, data, period = 'today') {
    try {
      const cacheKey = this.getCacheKey(role);
      const timestamp = Date.now();
      
      const cacheData = {
        data,
        period,
        timestamp,
        expiry: timestamp + CACHE_EXPIRY_TIME
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      // Actualizar timestamp para este rol
      await this.updateCacheTimestamp(role, timestamp);
      
      console.log(`✅ Estadísticas guardadas en caché para ${role}`);
      return true;
    } catch (error) {
      console.error('❌ Error al guardar estadísticas en caché:', error);
      return false;
    }
  }

  /**
   * Obtiene datos de estadísticas del caché local
   * @param {string} role - Rol del usuario (admin, collector, listero)
   * @param {string} period - Período a verificar (opcional)
   */
  async getStatisticsFromCache(role, period = 'today') {
    try {
      const cacheKey = this.getCacheKey(role);
      const cachedDataString = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedDataString) {
        console.log(`📭 No hay datos en caché para ${role}`);
        return null;
      }

      const cachedData = JSON.parse(cachedDataString);
      const now = Date.now();

      // Verificar si el caché ha expirado
      if (now > cachedData.expiry) {
        console.log(`⏰ Caché expirado para ${role}`);
        await this.clearStatisticsCache(role);
        return null;
      }

      // Verificar si el período coincide
      if (period && cachedData.period !== period) {
        console.log(`📅 Período diferente en caché para ${role}: ${cachedData.period} vs ${period}`);
        return null;
      }

      console.log(`🎯 Datos obtenidos del caché para ${role}`);
      return {
        data: cachedData.data,
        period: cachedData.period,
        cachedAt: new Date(cachedData.timestamp),
        isFromCache: true
      };
    } catch (error) {
      console.error('❌ Error al obtener estadísticas del caché:', error);
      return null;
    }
  }

  /**
   * Verifica si hay datos en caché válidos para un rol específico
   * @param {string} role - Rol del usuario
   * @param {string} period - Período a verificar
   */
  async isCacheValid(role, period = 'today') {
    const cachedData = await this.getStatisticsFromCache(role, period);
    return cachedData !== null;
  }

  /**
   * Limpia el caché de estadísticas para un rol específico
   * @param {string} role - Rol del usuario
   */
  async clearStatisticsCache(role) {
    try {
      const cacheKey = this.getCacheKey(role);
      await AsyncStorage.removeItem(cacheKey);
      
      // Limpiar timestamp
      await this.clearCacheTimestamp(role);
      
      console.log(`🗑️ Caché limpiado para ${role}`);
      return true;
    } catch (error) {
      console.error('❌ Error al limpiar caché:', error);
      return false;
    }
  }

  /**
   * Limpia todo el caché de estadísticas
   */
  async clearAllStatisticsCache() {
    try {
      await AsyncStorage.multiRemove([
        CACHE_KEYS.ADMIN_STATS,
        CACHE_KEYS.COLLECTOR_STATS,
        CACHE_KEYS.LISTERO_STATS,
        CACHE_KEYS.CACHE_TIMESTAMPS
      ]);
      
      console.log('🗑️ Todo el caché de estadísticas ha sido limpiado');
      return true;
    } catch (error) {
      console.error('❌ Error al limpiar todo el caché:', error);
      return false;
    }
  }

  /**
   * Obtiene información sobre el estado del caché
   * @param {string} role - Rol del usuario
   */
  async getCacheInfo(role) {
    try {
      const cacheKey = this.getCacheKey(role);
      const cachedDataString = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedDataString) {
        return {
          exists: false,
          role,
          message: 'No hay datos en caché'
        };
      }

      const cachedData = JSON.parse(cachedDataString);
      const now = Date.now();
      const isExpired = now > cachedData.expiry;
      const timeLeft = Math.max(0, cachedData.expiry - now);

      return {
        exists: true,
        role,
        period: cachedData.period,
        cachedAt: new Date(cachedData.timestamp),
        expiresAt: new Date(cachedData.expiry),
        isExpired,
        timeLeft,
        timeLeftFormatted: this.formatTimeLeft(timeLeft),
        message: isExpired ? 'Caché expirado' : 'Caché válido'
      };
    } catch (error) {
      console.error('❌ Error al obtener info del caché:', error);
      return {
        exists: false,
        role,
        error: error.message,
        message: 'Error al verificar caché'
      };
    }
  }

  /**
   * Actualiza el timestamp de un rol específico
   */
  async updateCacheTimestamp(role, timestamp) {
    try {
      const timestamps = await this.getCacheTimestamps();
      timestamps[role] = timestamp;
      await AsyncStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(timestamps));
    } catch (error) {
      console.error('❌ Error al actualizar timestamp:', error);
    }
  }

  /**
   * Obtiene todos los timestamps del caché
   */
  async getCacheTimestamps() {
    try {
      const timestampsString = await AsyncStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMPS);
      return timestampsString ? JSON.parse(timestampsString) : {};
    } catch (error) {
      console.error('❌ Error al obtener timestamps:', error);
      return {};
    }
  }

  /**
   * Limpia el timestamp de un rol específico
   */
  async clearCacheTimestamp(role) {
    try {
      const timestamps = await this.getCacheTimestamps();
      delete timestamps[role];
      await AsyncStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(timestamps));
    } catch (error) {
      console.error('❌ Error al limpiar timestamp:', error);
    }
  }

  /**
   * Obtiene la clave de caché para un rol específico
   */
  getCacheKey(role) {
    switch (role.toLowerCase()) {
      case 'admin':
        return CACHE_KEYS.ADMIN_STATS;
      case 'collector':
        return CACHE_KEYS.COLLECTOR_STATS;
      case 'listero':
        return CACHE_KEYS.LISTERO_STATS;
      default:
        throw new Error(`Rol no válido para caché: ${role}`);
    }
  }

  /**
   * Formatea el tiempo restante para mostrar al usuario
   */
  formatTimeLeft(milliseconds) {
    if (milliseconds <= 0) return 'Expirado';
    
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Fuerza la actualización del caché (borra el caché existente)
   * @param {string} role - Rol del usuario
   */
  async forceRefresh(role) {
    console.log(`🔄 Forzando actualización del caché para ${role}`);
    await this.clearStatisticsCache(role);
    return true;
  }
}

// Exportar instancia singleton
export const statisticsCacheService = new StatisticsCacheService();
export default statisticsCacheService;