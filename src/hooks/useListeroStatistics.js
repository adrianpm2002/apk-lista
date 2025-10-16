import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../supabaseClient';
import * as statisticsCache from '../utils/statisticsCache';

// Detectar si estamos en Expo Go (usa localStorage como web)
const isExpoGo = Constants.appOwnership === 'expo';

// Detectar plataforma
// Expo Go cachea como web (localStorage limitado)
// APK/IPA compilado cachea todo (AsyncStorage ilimitado)
const isMobile = !isExpoGo && (Platform.OS === 'android' || Platform.OS === 'ios');
const isWeb = Platform.OS === 'web' || isExpoGo;

// Helper para convertir fecha local a string para consultas de base de datos
const formatDateForQuery = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useListeroStatistics = (options = {}) => {
  const { enabled = true } = options;
  // Estados básicos
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [tableData, setTableData] = useState({
    plays: []
  });
  
  // Estado para el rango de fechas (hoy por defecto)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)), // Hoy 00:00:00
    endDate: new Date(new Date().setHours(23, 59, 59, 999)) // Hoy 23:59:59
  });
  
  // Estado para controlar si hay actualización en background
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Ref para evitar múltiples cargas background simultáneas
  const backgroundLoadingRef = useRef(false);

  const getCacheStartDate = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);
    return new Date(thirtyDaysAgo.getFullYear(), thirtyDaysAgo.getMonth(), thirtyDaysAgo.getDate(), 0, 0, 0, 0);
  };

  const isWithinCacheRange = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    
    const cacheStart = getCacheStartDate();
    const today = new Date();
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    
    return filterStart >= cacheStart && filterEnd <= todayEnd;
  };

  // Funciones helper para detectar filtros específicos
  const isFilteringToday = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    const today = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return (
      start.getFullYear() === today.getFullYear() &&
      start.getMonth() === today.getMonth() &&
      start.getDate() === today.getDate() &&
      end.getFullYear() === today.getFullYear() &&
      end.getMonth() === today.getMonth() &&
      end.getDate() === today.getDate()
    );
  };

  const isFilteringYesterday = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return (
      start.getFullYear() === yesterday.getFullYear() &&
      start.getMonth() === yesterday.getMonth() &&
      start.getDate() === yesterday.getDate() &&
      end.getFullYear() === yesterday.getFullYear() &&
      end.getMonth() === yesterday.getMonth() &&
      end.getDate() === yesterday.getDate()
    );
  };

  const isFilteringLast30Days = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Verificar si el rango coincide con últimos 30 días (con margen de 1 día)
    const diffStart = Math.abs(start - thirtyDaysAgo) / (1000 * 60 * 60 * 24);
    const diffEnd = Math.abs(end - today) / (1000 * 60 * 60 * 24);
    
    return diffStart <= 1 && diffEnd <= 1;
  };

  // Función específica para cargar datos de LISTERO
  const loadListeroPlaysData = async (userId, startStr, endStr) => {
    try {
      let allPlaysData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('v_estadisticas')
          .select('*')
          .eq('id_listero', userId)
          .gte('fecha_jugada', startStr)
          .lte('fecha_jugada', endStr)
          .order('fecha_jugada', { ascending: false });

        const { data: playsData, error } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.warn('[useListeroStatistics] Error al cargar jugadas:', error);
          return [];
        }
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
          hasMore = playsData.length === 1000;
          page++;
        } else {
          hasMore = false;
        }
        
        if (page > 250) {
          break;
        }
      }

      return allPlaysData || [];
      
    } catch (error) {
      console.warn('[useListeroStatistics] Excepción al cargar jugadas:', error);
      return [];
    }
  };
  
  const fetchInitialData = async (userId) => {
    try {
      const cacheStart = getCacheStartDate();
      const startStr = formatDateForQuery(cacheStart) + ' 00:00:00';
      const today = new Date();
      const endStr = formatDateForQuery(today) + ' 23:59:59';
      
      return await loadListeroPlaysData(userId, startStr, endStr);
    } catch (error) {
      console.warn('[useListeroStatistics] Error en fetchInitialData:', error);
      return [];
    }
  };
  
  const fetchIncrementalData = async (userId, lastDate) => {
    try {
      if (!lastDate) return await fetchInitialData(userId);
      
      const startStr = formatDateForQuery(lastDate) + ' 00:00:00';
      const today = new Date();
      const endStr = formatDateForQuery(today) + ' 23:59:59';
      
      return await loadListeroPlaysData(userId, startStr, endStr);
    } catch (error) {
      console.warn('[useListeroStatistics] Error en fetchIncrementalData:', error);
      return [];
    }
  };
  
  const getMaxFechaJugada = (plays) => {
    if (!plays || plays.length === 0) return null;
    const maxDate = plays.reduce((max, play) => {
      const playDate = new Date(play.fecha_jugada);
      return playDate > max ? playDate : max;
    }, new Date(0));
    return maxDate;
  };
  
  const mergePlaysByIdJugada = (existingPlays, newPlays) => {
    const playMap = new Map();
    existingPlays.forEach(play => playMap.set(play.id_jugada, play));
    newPlays.forEach(play => playMap.set(play.id_jugada, play));
    return Array.from(playMap.values());
  };
  
  const filterPlaysByDateRange = (plays, period, startDate, endDate) => {
    if (!plays || plays.length === 0) return [];
    
    if (startDate && endDate) {
      return statisticsCache.filterByDateRange(plays, startDate, endDate, 'fecha_jugada');
    }
    
    switch (period) {
      case 'today': {
        const range = statisticsCache.getTodayRange();
        return statisticsCache.filterByDateRange(plays, range.startDate, range.endDate, 'fecha_jugada');
      }
      case 'yesterday': {
        const range = statisticsCache.getYesterdayRange();
        return statisticsCache.filterByDateRange(plays, range.startDate, range.endDate, 'fecha_jugada');
      }
      case 'last7days': {
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);
        const start = new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate(), 0, 0, 0);
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        return statisticsCache.filterByDateRange(plays, start, end, 'fecha_jugada');
      }
      case 'last30days': {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 29);
        const start = new Date(thirtyDaysAgo.getFullYear(), thirtyDaysAgo.getMonth(), thirtyDaysAgo.getDate(), 0, 0, 0);
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        return statisticsCache.filterByDateRange(plays, start, end, 'fecha_jugada');
      }
      default:
        return plays;
    }
  };

  // Helper para transformar datos raw a formato de componentes
  const formatPlaysData = (playsData) => {
    return (playsData || [])
      .filter(j => {
        // Filtro: verificar que fecha_jugada existe y es válida
        if (!j.fecha_jugada) return false;
        if (j.fecha_jugada === null || j.fecha_jugada === undefined) return false;
        if (typeof j.fecha_jugada === 'string' && j.fecha_jugada.trim() === '') return false;
        
        const testDate = new Date(j.fecha_jugada);
        if (isNaN(testDate.getTime())) return false;
        
        return true;
      })
      .map(j => ({
        id: j.id_listero + '_' + j.fecha_jugada,
        created_at: j.fecha_jugada,
        fecha: new Date(j.fecha_jugada).toLocaleDateString('es-ES'),
        hora: new Date(j.fecha_jugada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        loteria: j.nombre_loteria || 'N/A',
        horario: j.nombre_horario || 'N/A',
        jugada: j.tipo_jugada || 'N/A',
        numeros: j.numeros_jugados || 'N/A',
        monto: j.monto_total || 0,
        nota: j.nota || '',
        // Campos básicos para compatibilidad
        play_type: j.tipo_jugada || 'N/A',
        bruto: j.monto_total || 0,
        resultado: j.resultado || 'Pendiente',
        premio: j.monto_a_pagar || 0,
        pagado: j.monto_a_pagar || 0,
        // Campos específicos para listero
        ganancia: j.ganancia_listero || 0,
        balance: j.balance_listero || 0,
        ganancia_listero: j.ganancia_listero || 0,
        balance_listero: j.balance_listero || 0,
        // IDs para filtrado
        id_listero: j.id_listero || null,
        listero_username: j.listero_username || ''
      }));
  };

  // Función principal para cargar datos de jugadas del listero CON CACHÉ
  const loadPlaysData = async (filters = {}) => {
    try {
      // Prevenir ejecuciones concurrentes
      if (isLoading) {
        return;
      }
      
      if (!userId) {
        setIsLoading(false);
        return;
      }

      const { period, startDate, endDate, customStartDate, customEndDate, directData, forceRefresh = false } = filters;
      
      // Si se proporciona directData (consulta directa desde StatisticsScreen), usarlo
      if (directData) {
        const formattedPlays = formatPlaysData(directData);
        setTableData(prev => ({ ...prev, plays: formattedPlays }));
        return formattedPlays;
      }
      
      // Calcular fechas según el período si no vienen explícitas
      let calculatedStartDate = customStartDate || startDate;
      let calculatedEndDate = customEndDate || endDate;
      
      // Si no vienen fechas, calcularlas según el período
      if (!calculatedStartDate || !calculatedEndDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        switch (period) {
          case 'today':
            calculatedStartDate = new Date(today);
            calculatedEndDate = new Date(today);
            calculatedEndDate.setHours(23, 59, 59, 999);
            break;
          case 'yesterday':
            calculatedStartDate = new Date(today);
            calculatedStartDate.setDate(today.getDate() - 1);
            calculatedEndDate = new Date(calculatedStartDate);
            calculatedEndDate.setHours(23, 59, 59, 999);
            break;
          case 'last7days':
            calculatedStartDate = new Date(today);
            calculatedStartDate.setDate(today.getDate() - 6);
            calculatedEndDate = new Date(today);
            calculatedEndDate.setHours(23, 59, 59, 999);
            break;
          case 'last30days':
            calculatedStartDate = new Date(today);
            calculatedStartDate.setDate(today.getDate() - 29);
            calculatedEndDate = new Date(today);
            calculatedEndDate.setHours(23, 59, 59, 999);
            break;
          default:
            // Fallback a dateRange
            calculatedStartDate = dateRange.startDate;
            calculatedEndDate = dateRange.endDate;
        }
      }
      
      const finalStartDate = calculatedStartDate;
      const finalEndDate = calculatedEndDate;
      
      // Validación defensiva: asegurar que las fechas sean válidas
      if (!finalStartDate || !finalEndDate || !(finalStartDate instanceof Date) || !(finalEndDate instanceof Date)) {
        console.warn('[useListeroStatistics] Fechas inválidas:', { finalStartDate, finalEndDate });
        setIsLoading(false);
        return [];
      }
      
      // Si forceRefresh es true, saltar toda la lógica de caché y consultar directamente
      if (forceRefresh) {
        setIsLoading(true);
        const startStr = formatDateForQuery(finalStartDate) + ' 00:00:00';
        const endStr = formatDateForQuery(finalEndDate) + ' 23:59:59';
        const freshData = await loadListeroPlaysData(userId, startStr, endStr);
        const formattedPlays = formatPlaysData(freshData);
        setTableData(prev => ({ ...prev, plays: formattedPlays }));
        
        // Guardar en caché si es un período cacheable
        const cachePeriod = period === 'today' || period === 'yesterday' ? 'recent' : period;
        if (cachePeriod === 'recent' || cachePeriod === 'last7days') {
          await statisticsCache.saveToCache(userId, cachePeriod, freshData);
        }
        
        setIsLoading(false);
        return formattedPlays;
      }
      
      // 🔍 DETECCIÓN DE FILTROS LOCALES (Hoy/Ayer)
      const isToday = period === 'today' || isFilteringToday(finalStartDate, finalEndDate);
      const isYesterday = period === 'yesterday' || isFilteringYesterday(finalStartDate, finalEndDate);
      const useLocalFilter = isToday || isYesterday;
      
      // Determinar el período para el caché
      // MOBILE (Android/iOS): Cachea TODO (AsyncStorage ilimitado)
      // WEB: Solo cachea 'recent' (7 días) para evitar QuotaExceededError en localStorage
      let cachePeriod = 'recent'; // Default: 7 días
      let needsLocalFilter = false;
      let localFilterRange = null;
      let canUseCache = false; // Variable para determinar si se puede usar caché
      
      if (isToday) {
        cachePeriod = 'recent';
        needsLocalFilter = true;
        localFilterRange = statisticsCache.getTodayRange();
        canUseCache = true;
      } else if (isYesterday) {
        cachePeriod = 'recent';
        needsLocalFilter = true;
        localFilterRange = statisticsCache.getYesterdayRange();
        canUseCache = true;
      } else if (period === 'last7days') {
        cachePeriod = 'recent';
        canUseCache = true;
      } else if (period === 'last30days' || isFilteringLast30Days(finalStartDate, finalEndDate)) {
        cachePeriod = 'thisMonth';
        canUseCache = isMobile;
      } else if (period === 'lastMonth' || isFilteringLastMonth(startDate, endDate)) {
        cachePeriod = 'lastMonth';
        canUseCache = isMobile;
      } else {
        // Períodos custom: NO cachear en ninguna plataforma
        canUseCache = false;
      }
      
      // PASO 1: Intentar cargar desde caché primero (INSTANTÁNEO)
      // Solo si canUseCache es true (períodos cortos: 7 días, Hoy, Ayer)
      const hasCache = canUseCache ? await statisticsCache.hasCacheFor(userId, cachePeriod) : false;
      
      if (hasCache && canUseCache) {
        const cachedResult = await statisticsCache.readFromCache(userId, cachePeriod);
        // Soportar tanto estructura nueva {plays: []} como legacy {data: []}
        const cachedData = cachedResult?.plays || cachedResult?.data || [];
        
        if (cachedData.length > 0) {
          
          // 🎯 APLICAR FILTRO LOCAL si es necesario (Hoy/Ayer)
          let dataToFormat = cachedData;
          
          if (needsLocalFilter && localFilterRange) {
            dataToFormat = statisticsCache.filterByDateRange(
              dataToFormat,
              localFilterRange.startDate,
              localFilterRange.endDate
            );
          }
          
          // Cargar datos del caché INMEDIATAMENTE (filtrados si aplica)
          const formattedPlays = formatPlaysData(dataToFormat);
          
          setTableData(prev => ({
            ...prev,
            plays: formattedPlays
          }));
          
          // Indicar que terminó la carga inicial (desde caché)
          setIsLoading(false);
          
          // PASO 2: Background refresh INTELIGENTE
          // Solo actualizar si caché tiene más de 10 minutos de antigüedad
          const CACHE_REFRESH_THRESHOLD = 10; // minutos
          
          if (cachedResult.age < CACHE_REFRESH_THRESHOLD) {
            return formattedPlays;
          }
          
          setIsRefreshing(true);
          
          // Fetch de Supabase en background
          setTimeout(async () => {
            try {
              // Para filtros locales (Hoy/Ayer), actualizar el caché de 7 días completo
              // NO los datos específicos del día
              let fetchStartDate, fetchEndDate;
              if (needsLocalFilter) {
                // Últimos 7 días
                const today = new Date();
                fetchEndDate = today;
                fetchStartDate = new Date(today);
                fetchStartDate.setDate(today.getDate() - 6);
              } else {
                fetchStartDate = finalStartDate;
                fetchEndDate = finalEndDate;
              }
              
              const startStr = formatDateForQuery(fetchStartDate) + ' 00:00:00';
              const endStr = formatDateForQuery(fetchEndDate) + ' 23:59:59';
              const freshData = await loadListeroPlaysData(userId, startStr, endStr);
              
              // Guardar en caché solo si canUseCache es true (períodos cortos)
              if (canUseCache) {
                await statisticsCache.saveToCache(userId, cachePeriod, freshData);
              }
              
              // 🎯 APLICAR FILTRO LOCAL a los datos frescos si es necesario
              let freshDataToFormat = freshData;
              if (needsLocalFilter && localFilterRange) {
                freshDataToFormat = statisticsCache.filterByDateRange(
                  freshDataToFormat,
                  localFilterRange.startDate,
                  localFilterRange.endDate
                );
              }
              
              // Actualizar UI solo si hay cambios
              const formattedFresh = formatPlaysData(freshDataToFormat);
              if (JSON.stringify(formattedFresh) !== JSON.stringify(formattedPlays)) {
                setTableData(prev => ({
                  ...prev,
                  plays: formattedFresh
                }));
              }
            } catch (error) {
              console.error('[useListeroStatistics] ❌ Error en actualización background:', error);
            } finally {
              setIsRefreshing(false);
            }
          }, 0);
          
          return formattedPlays;
        }
      }
      
      // PASO 3: Si NO hay caché, cargar desde Supabase (primera vez o período largo)
      setIsLoading(true);
      
      const startStr = formatDateForQuery(finalStartDate) + ' 00:00:00';
      const endStr = formatDateForQuery(finalEndDate) + ' 23:59:59';
      const playsData = await loadListeroPlaysData(userId, startStr, endStr);
      
      // Guardar en caché solo si canUseCache es true (períodos cortos)
      if (canUseCache) {
        await statisticsCache.saveToCache(userId, cachePeriod, playsData);
      }
      
      // Transformar y mostrar datos
      const formattedPlays = formatPlaysData(playsData);
      
      setTableData(prev => ({
        ...prev,
        plays: formattedPlays
      }));
      
      return formattedPlays;
      
    } catch (error) {
      console.error('[useListeroStatistics] ❌ Error al cargar datos:', error);
      setTableData(prev => ({
        ...prev,
        plays: []
      }));
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Función para cambiar el rango de fechas
  const updateDateRange = (startDate, endDate) => {
    setDateRange({ startDate, endDate });
  };

  // Efecto para cargar usuario autenticado
  useEffect(() => {
    if (!enabled) return;
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        } else {
          console.warn('[useListeroStatistics] ⚠️ No se encontró usuario autenticado');
        }
      } catch (error) {
        console.error('[useListeroStatistics] ❌ Error al cargar userId:', error);
      }
    };

    loadUserData();
  }, [enabled]);

  // Efecto para cargar datos cuando se obtiene el userId (NO se ejecuta automáticamente)
  // Este efecto está comentado porque ahora usamos carga progresiva desde StatisticsScreen
  // useEffect(() => {
  //   if (!enabled) return;
  //   if (userId && !isLoading) {
  //     loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
  //   }
  // }, [userId, enabled]);

  // Efecto para recargar cuando cambie el rango de fechas
  useEffect(() => {
    if (!enabled) return;
    if (userId && !isLoading) {
      const timeoutId = setTimeout(() => {
        loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
  }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [dateRange.startDate, dateRange.endDate, enabled]);

  return {
    // Estados
    isLoading,
    isRefreshing,
    tableData,
    dateRange,
    userId,
    
    // Funciones
    loadPlaysData,
    updateDateRange
  };
};


