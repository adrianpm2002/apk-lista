import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Módulo de caché para estadísticas de usuario
 * - MOBILE COMPILADO (APK/IPA): Cachea TODO (recent, thisMonth, lastMonth) - AsyncStorage ilimitado
 * - EXPO GO: Solo cachea 'recent' (7 días) - usa localStorage, limitado a ~5-10MB
 * - WEB: Solo cachea 'recent' (7 días) - localStorage limitado a ~5-10MB
 * - Caché infinito (nunca expira automáticamente)
 */

const CACHE_VERSION = '1.0';
const CACHE_PREFIX = 'stats_v1';

// Detectar si estamos en Expo Go (usa localStorage como web)
const isExpoGo = Constants.appOwnership === 'expo';

// Detectar plataforma
// Expo Go siempre cachea como web (localStorage limitado)
// APK/IPA compilado cachea todo (AsyncStorage ilimitado)
const isMobile = !isExpoGo && (Platform.OS === 'android' || Platform.OS === 'ios');
const isWeb = Platform.OS === 'web' || isExpoGo;

/**
 * Generar clave de caché para un usuario y período específico
 */
const getCacheKey = (userId, period) => {
  return `${CACHE_PREFIX}_${userId}_${period}`;
};

/**
 * Generar clave de metadatos
 */
const getMetadataKey = (userId) => {
  return `${CACHE_PREFIX}_${userId}_metadata`;
};

/**
 * Guardar datos en caché
 * @param {string} userId - ID del usuario
 * @param {string} period - Período ('recent', 'thisMonth', 'lastMonth')
 * @param {Array} data - Datos a guardar
 */
export const saveToCache = async (userId, period, data) => {
  try {
    if (!userId || !period || !data) {
      console.warn('[StatisticsCache] Parámetros inválidos para guardar en caché');
      return false;
    }

    // EXPO GO + WEB: Solo cachear 'recent' (7 días) para evitar QuotaExceededError
    // APK/IPA: Cachear todo (AsyncStorage ilimitado)
    if (isWeb && period !== 'recent') {
      const platform = isExpoGo ? 'Expo Go' : 'Web';
      console.log(`[StatisticsCache] ⏭️ ${platform}: Saltando caché para período largo: ${period}`);
      return false;
    }

    if (isMobile) {
      console.log(`[StatisticsCache] 📱 APK/IPA: Cacheando período: ${period}`);
    }

    const key = getCacheKey(userId, period);
    const cacheData = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
      period,
    };

    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    
    // Actualizar metadatos
    await updateMetadata(userId, period);
    
    console.log(`[StatisticsCache] ✅ Guardado en caché: ${period} (${data.length} registros)`);
    return true;
  } catch (error) {
    console.error('[StatisticsCache] ❌ Error al guardar en caché:', error);
    return false;
  }
};

/**
 * Leer datos del caché
 * @param {string} userId - ID del usuario
 * @param {string} period - Período (solo 'recent' soportado)
 * @returns {Object|null} Datos del caché o null si no existe
 */
export const readFromCache = async (userId, period) => {
  try {
    if (!userId || !period) {
      console.warn('[StatisticsCache] Parámetros inválidos para leer del caché');
      return null;
    }

    const key = getCacheKey(userId, period);
    const cachedData = await AsyncStorage.getItem(key);

    if (!cachedData) {
      console.log(`[StatisticsCache] ℹ️ No hay caché para: ${period}`);
      return null;
    }

    const parsed = JSON.parse(cachedData);
    
    // Verificar versión
    if (parsed.version !== CACHE_VERSION) {
      console.log(`[StatisticsCache] ⚠️ Versión de caché obsoleta, eliminando...`);
      await clearCache(userId, period);
      return null;
    }

    const age = Date.now() - parsed.timestamp;
    const ageMinutes = Math.floor(age / 60000);
    
    console.log(`[StatisticsCache] ✅ Caché leído: ${period} (${parsed.data.length} registros, ${ageMinutes} min antiguos)`);
    
    return {
      data: parsed.data,
      timestamp: parsed.timestamp,
      age: ageMinutes,
    };
  } catch (error) {
    console.error('[StatisticsCache] ❌ Error al leer del caché:', error);
    return null;
  }
};

/**
 * Verificar si existe caché para un período
 */
export const hasCacheFor = async (userId, period) => {
  try {
    const key = getCacheKey(userId, period);
    const value = await AsyncStorage.getItem(key);
    return value !== null;
  } catch (error) {
    console.error('[StatisticsCache] Error al verificar caché:', error);
    return false;
  }
};

/**
 * Actualizar metadatos del caché
 */
const updateMetadata = async (userId, period) => {
  try {
    const metadataKey = getMetadataKey(userId);
    const existingMetadata = await AsyncStorage.getItem(metadataKey);
    
    const metadata = existingMetadata ? JSON.parse(existingMetadata) : {};
    
    metadata[period] = {
      lastUpdated: Date.now(),
      version: CACHE_VERSION,
    };
    
    await AsyncStorage.setItem(metadataKey, JSON.stringify(metadata));
  } catch (error) {
    console.error('[StatisticsCache] Error al actualizar metadatos:', error);
  }
};

/**
 * Obtener metadatos del caché
 */
export const getCacheMetadata = async (userId) => {
  try {
    const metadataKey = getMetadataKey(userId);
    const metadata = await AsyncStorage.getItem(metadataKey);
    return metadata ? JSON.parse(metadata) : {};
  } catch (error) {
    console.error('[StatisticsCache] Error al obtener metadatos:', error);
    return {};
  }
};

/**
 * Limpiar caché de un período específico
 */
export const clearCache = async (userId, period) => {
  try {
    const key = getCacheKey(userId, period);
    await AsyncStorage.removeItem(key);
    console.log(`[StatisticsCache] 🗑️ Caché eliminado: ${period}`);
    return true;
  } catch (error) {
    console.error('[StatisticsCache] Error al limpiar caché:', error);
    return false;
  }
};

/**
 * Limpiar todo el caché de un usuario
 */
export const clearAllCache = async (userId) => {
  try {
    // En MOBILE: limpiar todos los períodos
    // En WEB: solo 'recent' (pero limpiamos todos por si acaso)
    const periods = ['recent', 'thisMonth', 'lastMonth'];
    await Promise.all(periods.map(period => clearCache(userId, period)));
    
    // Limpiar metadatos
    const metadataKey = getMetadataKey(userId);
    await AsyncStorage.removeItem(metadataKey);
    
    console.log(`[StatisticsCache] 🗑️ Todo el caché eliminado para usuario: ${userId}`);
    return true;
  } catch (error) {
    console.error('[StatisticsCache] Error al limpiar todo el caché:', error);
    return false;
  }
};

/**
 * Filtrar datos localmente por fecha
 * @param {Array} data - Datos completos
 * @param {Date} startDate - Fecha inicio
 * @param {Date} endDate - Fecha fin
 */
export const filterByDateRange = (data, startDate, endDate) => {
  if (!data || !Array.isArray(data)) return [];
  
  const start = startDate.getTime();
  const end = endDate.getTime();
  
  return data.filter(item => {
    const itemDate = new Date(item.fecha_jugada || item.created_at).getTime();
    return itemDate >= start && itemDate <= end;
  });
};

/**
 * Obtener rango de fechas para "Hoy"
 */
export const getTodayRange = () => {
  const today = new Date();
  return {
    startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0),
    endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
  };
};

/**
 * Obtener rango de fechas para "Ayer"
 */
export const getYesterdayRange = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return {
    startDate: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0),
    endDate: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999),
  };
};

/**
 * Obtener estadísticas del caché
 */
export const getCacheStats = async (userId) => {
  try {
    const metadata = await getCacheMetadata(userId);
    const stats = {};
    
    // Verificar todos los períodos (mobile cachea todo, web solo 'recent')
    const periods = ['recent', 'thisMonth', 'lastMonth'];
    for (const period of periods) {
      const hasCache = await hasCacheFor(userId, period);
      stats[period] = {
        exists: hasCache,
        lastUpdated: metadata[period]?.lastUpdated || null,
        age: metadata[period]?.lastUpdated 
          ? Math.floor((Date.now() - metadata[period].lastUpdated) / 60000) 
          : null,
      };
    }
    
    return stats;
  } catch (error) {
    console.error('[StatisticsCache] Error al obtener stats:', error);
    return {};
  }
};

export default {
  saveToCache,
  readFromCache,
  hasCacheFor,
  clearCache,
  clearAllCache,
  getCacheMetadata,
  filterByDateRange,
  getTodayRange,
  getYesterdayRange,
  getCacheStats,
};
