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

  // Mapeo directo de período a vista optimizada
  const getViewByPeriod = (period) => {
    switch (period) {
      case 'today':
        // HOY: Usar vista de 7 días + filtro local (más eficiente)
        return { viewName: 'v_estadisticas_7d', isOptimized: true, period: 'hoy' };
      case 'yesterday':
        // AYER: Usar vista de 7 días + filtro local (más eficiente)
        return { viewName: 'v_estadisticas_7d', isOptimized: true, period: 'ayer' };
      case 'last7days':
        return { viewName: 'v_estadisticas_7d', isOptimized: true, period: 'últimos 7 días' };
      case 'last30days':
        return { viewName: 'v_estadisticas_mes', isOptimized: true, period: 'este mes' };
      case 'lastMonth':
        return { viewName: 'v_estadisticas_mes_pasado', isOptimized: true, period: 'mes pasado' };
      default:
        // Fallback para rangos personalizados fuera de cachés
        return { viewName: 'v_estadisticas', isOptimized: false, period: 'custom' };
    }
  };

  // Helper para detectar si el filtro es para el día de hoy
  const isFilteringToday = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    
    return filterStart.getTime() >= todayStart.getTime() && 
           filterEnd.getTime() <= todayEnd.getTime();
  };

  // Helper para detectar si el filtro es para ayer
  const isFilteringYesterday = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    
    return filterStart.getTime() >= yesterdayStart.getTime() && 
           filterEnd.getTime() <= yesterdayEnd.getTime();
  };

  // Helper para detectar si el filtro es para los últimos 7 días
  const isFilteringLast7Days = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    
    // Verificar si el rango corresponde aproximadamente a "últimos 7 días"
    // Permitir una tolerancia de algunos minutos para diferencias de tiempo
    const timeDiffStart = Math.abs(filterStart.getTime() - sevenDaysAgo.getTime());
    const timeDiffEnd = Math.abs(filterEnd.getTime() - now.getTime());
    
    // Tolerancia de 5 minutos (300000 ms)
    const tolerance = 5 * 60 * 1000;
    
    return timeDiffStart <= tolerance && timeDiffEnd <= tolerance;
  };

  // Helper para detectar si el filtro es para los últimos 30 días (Este mes)
  const isFilteringLast30Days = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    
    // Verificar si el rango corresponde aproximadamente a "últimos 30 días"
    // Permitir una tolerancia de algunos minutos para diferencias de tiempo
    const timeDiffStart = Math.abs(filterStart.getTime() - thirtyDaysAgo.getTime());
    const timeDiffEnd = Math.abs(filterEnd.getTime() - now.getTime());
    
    // Tolerancia de 5 minutos (300000 ms)
    const tolerance = 5 * 60 * 1000;
    
    return timeDiffStart <= tolerance && timeDiffEnd <= tolerance;
  };

  // Helper para detectar si el filtro es para el mes pasado
  const isFilteringLastMonth = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    
    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);
    
    // Verificar si el rango corresponde exactamente al mes pasado
    // Comparar año, mes y día
    const startMatches = filterStart.getFullYear() === lastMonthStart.getFullYear() &&
                        filterStart.getMonth() === lastMonthStart.getMonth() &&
                        filterStart.getDate() === lastMonthStart.getDate();
    
    const endMatches = filterEnd.getFullYear() === lastMonthEnd.getFullYear() &&
                      filterEnd.getMonth() === lastMonthEnd.getMonth() &&
                      filterEnd.getDate() === lastMonthEnd.getDate();
    
    return startMatches && endMatches;
  };

  // Helper para determinar qué vista usar según el filtro de fechas
  const getOptimizedView = (startDate, endDate) => {
    if (isFilteringToday(startDate, endDate)) {
      return { viewName: 'v_estadisticas_hoy', isOptimized: true, period: 'hoy' };
    }
    if (isFilteringYesterday(startDate, endDate)) {
      return { viewName: 'v_estadisticas_ayer', isOptimized: true, period: 'ayer' };
    }
    if (isFilteringLast7Days(startDate, endDate)) {
      return { viewName: 'v_estadisticas_7d', isOptimized: true, period: 'últimos 7 días' };
    }
    if (isFilteringLast30Days(startDate, endDate)) {
      return { viewName: 'v_estadisticas_mes', isOptimized: true, period: 'este mes' };
    }
    if (isFilteringLastMonth(startDate, endDate)) {
      return { viewName: 'v_estadisticas_mes_pasado', isOptimized: true, period: 'mes pasado' };
    }
    return { viewName: 'v_estadisticas', isOptimized: false, period: 'custom' };
  };

  // Función específica para cargar datos de LISTERO
  const loadListeroPlaysData = async (userId, filters = {}) => {
    try {
      if (!userId) {
        return [];
      }

      const { period, startDate, endDate } = filters;
      
      // Determinar qué vista usar según el período o filtro de fechas
      let viewConfig;
      if (period) {
        // Usar mapeo directo por período (nueva funcionalidad)
        viewConfig = getViewByPeriod(period);
      } else {
        // Usar detección por fechas (funcionalidad legacy)
        viewConfig = getOptimizedView(startDate, endDate);
      }
      
      const { viewName, isOptimized } = viewConfig;
      
      let dateFilters = {};
      if (startDate && endDate && !isOptimized) {
        const startStr = formatDateForQuery(startDate) + ' 00:00:00';
        const endStr = formatDateForQuery(endDate) + ' 23:59:59';
        dateFilters = {
          startStr,
          endStr
        };
      }

      let allPlaysData = [];
      let page = 0;
      // Supabase tiene límite máximo de 1000 registros por consulta
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from(viewName)
          .select('*')
          .eq('id_listero', userId);

        // Solo agregar filtro de estado_horario si no estamos usando vista optimizada
        if (!isOptimized) {
          query = query.eq('estado_horario', 'cerrada');
        }
        
        query = query.order('fecha_jugada', { ascending: false });

        // Solo aplicar filtros de fecha si no estamos usando vista optimizada
        if (dateFilters.startStr && dateFilters.endStr && !isOptimized) {
          query = query
            .gte('fecha_jugada', dateFilters.startStr)
            .lte('fecha_jugada', dateFilters.endStr);
        }

        const { data: playsData, error } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          return [];
        }
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
          hasMore = playsData.length === 1000; // Continuar si se obtuvieron exactamente 1000 registros
          page++;
        } else {
          hasMore = false;
        }
        
        if (page > 250) { // Hasta 1.25M registros
          break;
        }
      }

      return allPlaysData || [];
      
    } catch (error) {
      return [];
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

      const { period, startDate, endDate, forceRefresh = false } = filters;
      
      // Si forceRefresh es true, saltar toda la lógica de caché y consultar directamente
      if (forceRefresh) {
        setIsLoading(true);
        const freshData = await loadListeroPlaysData(userId, filters);
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
      const isToday = period === 'today' || isFilteringToday(startDate, endDate);
      const isYesterday = period === 'yesterday' || isFilteringYesterday(startDate, endDate);
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
      } else if (period === 'last30days' || isFilteringLast30Days(startDate, endDate)) {
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
        if (cachedResult && cachedResult.data && cachedResult.data.length > 0) {
          
          // 🎯 APLICAR FILTRO LOCAL si es necesario (Hoy/Ayer)
          let dataToFormat = cachedResult.data;
          
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
              const fetchFilters = needsLocalFilter 
                ? { period: 'last7days', startDate: null, endDate: null }
                : filters;
              
                  
              const freshData = await loadListeroPlaysData(userId, fetchFilters);
              
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
      if (canUseCache) {
      } else {
      }
      setIsLoading(true);
      
      const playsData = await loadListeroPlaysData(userId, filters);
      
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


