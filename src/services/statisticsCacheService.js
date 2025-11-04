/**
 * Servicio para cachear estadísticas en SQLite
 * Reduce consultas a Supabase y mejora rendimiento
 * Cache expira después de 24 horas
 */

import { offlineStorage } from './offlineStorageService';

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

/**
 * Guardar estadísticas en cache
 * @param {string} key - Clave única del cache (ej: 'stats_listero_123')
 * @param {Object} data - Datos a cachear
 * @returns {Promise<boolean>} - Éxito de la operación
 */
export async function setCachedStatistics(key, data) {
  try {
    const now = new Date().toISOString();
    const dataString = JSON.stringify(data);

    const query = `
      INSERT OR REPLACE INTO statistics_cache (cache_key, data, created_at, expires_at)
      VALUES (?, ?, ?, datetime(?, '+24 hours'))
    `;

    await offlineStorage.executeSql(query, [key, dataString, now, now]);
    
    console.log(`✅ Estadísticas cacheadas: ${key}`);
    return true;
  } catch (error) {
    console.error('❌ Error al cachear estadísticas:', error);
    return false;
  }
}

/**
 * Obtener estadísticas del cache
 * @param {string} key - Clave del cache
 * @returns {Promise<Object|null>} - Datos cacheados o null si no existe/expiró
 */
export async function getCachedStatistics(key) {
  try {
    const query = `
      SELECT data, created_at, expires_at 
      FROM statistics_cache 
      WHERE cache_key = ?
      AND datetime(expires_at) > datetime('now')
      LIMIT 1
    `;

    const result = await offlineStorage.executeSql(query, [key]);

    if (result.rows.length === 0) {
      console.log(`📭 No hay cache válido para: ${key}`);
      return null;
    }

    const row = result.rows.item(0);
    const data = JSON.parse(row.data);
    const createdAt = new Date(row.created_at);
    const expiresAt = new Date(row.expires_at);
    const age = Date.now() - createdAt.getTime();
    const ageHours = Math.floor(age / (60 * 60 * 1000));

    console.log(`📦 Cache encontrado: ${key} (edad: ${ageHours}h, expira: ${expiresAt.toLocaleString()})`);
    
    return {
      data,
      cached: true,
      cachedAt: createdAt,
      expiresAt: expiresAt,
      ageHours
    };
  } catch (error) {
    console.error('❌ Error al obtener cache:', error);
    return null;
  }
}

/**
 * Invalidar cache específico (forzar recarga)
 * @param {string} key - Clave del cache a invalidar
 */
export async function invalidateCache(key) {
  try {
    const query = `DELETE FROM statistics_cache WHERE cache_key = ?`;
    await offlineStorage.executeSql(query, [key]);
    console.log(`🗑️ Cache invalidado: ${key}`);
  } catch (error) {
    console.error('❌ Error al invalidar cache:', error);
  }
}

/**
 * Invalidar todo el cache de estadísticas
 */
export async function invalidateAllCache() {
  try {
    const query = `DELETE FROM statistics_cache`;
    await offlineStorage.executeSql(query, []);
    console.log('🗑️ Todo el cache de estadísticas invalidado');
  } catch (error) {
    console.error('❌ Error al invalidar todo el cache:', error);
  }
}

/**
 * Limpiar cache expirado automáticamente
 */
export async function cleanExpiredCache() {
  try {
    const query = `DELETE FROM statistics_cache WHERE datetime(expires_at) <= datetime('now')`;
    const result = await offlineStorage.executeSql(query, []);
    const deletedCount = result.rowsAffected;
    
    if (deletedCount > 0) {
      console.log(`🧹 ${deletedCount} caches expirados eliminados`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('❌ Error al limpiar cache expirado:', error);
    return 0;
  }
}

/**
 * Obtener estadísticas del tamaño del cache
 * @returns {Promise<Object>} - Estadísticas del cache
 */
export async function getCacheStats() {
  try {
    const queries = {
      total: `SELECT COUNT(*) as count FROM statistics_cache`,
      expired: `SELECT COUNT(*) as count FROM statistics_cache WHERE datetime(expires_at) <= datetime('now')`,
      valid: `SELECT COUNT(*) as count FROM statistics_cache WHERE datetime(expires_at) > datetime('now')`,
      totalSize: `SELECT SUM(LENGTH(data)) as size FROM statistics_cache`
    };

    const stats = {};

    for (const [key, query] of Object.entries(queries)) {
      const result = await offlineStorage.executeSql(query, []);
      stats[key] = result.rows.item(0)[key === 'totalSize' ? 'size' : 'count'] || 0;
    }

    // Convertir tamaño a KB
    stats.totalSizeKB = Math.round(stats.totalSize / 1024);

    return stats;
  } catch (error) {
    console.error('❌ Error al obtener estadísticas del cache:', error);
    return {
      total: 0,
      expired: 0,
      valid: 0,
      totalSize: 0,
      totalSizeKB: 0
    };
  }
}

/**
 * Verificar si un cache específico está expirado
 * @param {string} key - Clave del cache
 * @returns {Promise<boolean>} - true si expiró o no existe
 */
export async function isCacheExpired(key) {
  try {
    const query = `
      SELECT 1 FROM statistics_cache 
      WHERE cache_key = ? 
      AND datetime(expires_at) > datetime('now')
    `;

    const result = await offlineStorage.executeSql(query, [key]);
    const isValid = result.rows.length > 0;
    
    return !isValid; // true si no hay cache válido (expirado o no existe)
  } catch (error) {
    console.error('❌ Error al verificar expiración de cache:', error);
    return true; // Asumir expirado en caso de error
  }
}

/**
 * Generar clave de cache basada en parámetros
 * @param {string} type - Tipo de estadística ('listero', 'collector', 'admin')
 * @param {string} userId - ID del usuario
 * @param {Object} filters - Filtros adicionales (opcional)
 * @returns {string} - Clave única del cache
 */
export function generateCacheKey(type, userId, filters = {}) {
  const filterString = Object.keys(filters).length > 0 
    ? `_${JSON.stringify(filters)}` 
    : '';
  
  return `stats_${type}_${userId}${filterString}`;
}

/**
 * Wrapper para obtener o crear cache de estadísticas
 * @param {string} cacheKey - Clave del cache
 * @param {Function} fetchFunction - Función para obtener datos frescos de Supabase
 * @returns {Promise<Object>} - Datos (del cache o frescos)
 */
export async function getOrFetchStatistics(cacheKey, fetchFunction) {
  try {
    // 1. Intentar obtener del cache
    const cached = await getCachedStatistics(cacheKey);
    
    if (cached && cached.data) {
      console.log(`✅ Usando datos del cache: ${cacheKey}`);
      return {
        ...cached.data,
        fromCache: true,
        cachedAt: cached.cachedAt,
        ageHours: cached.ageHours
      };
    }

    // 2. Cache no existe o expiró, obtener datos frescos
    console.log(`🔄 Obteniendo datos frescos: ${cacheKey}`);
    const freshData = await fetchFunction();

    // 3. Guardar en cache
    await setCachedStatistics(cacheKey, freshData);

    return {
      ...freshData,
      fromCache: false
    };
  } catch (error) {
    console.error('❌ Error en getOrFetchStatistics:', error);
    throw error;
  }
}
