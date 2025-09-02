import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const CacheContext = createContext();

export const useCache = () => {
  const context = useContext(CacheContext);
  if (!context) {
    // Solo mostrar el warning una vez por sesión
    if (typeof window !== 'undefined' && !window._cacheWarningShown) {
      window._cacheWarningShown = true;
      console.warn('useCache debe ser usado dentro de un CacheProvider. Retornando valores por defecto.');
    }
    return {
      cache: {
        statistics: null,
        todayResults: null,
        users: null,
        lotteries: null,
        prices: null,
        numberLimits: null,
        schedules: null,
        limitedNumbers: null,
        priceConfigurations: null,
        activePlayTypes: null,
        isLoading: false,
        lastUpdated: {},
      },
      userRole: null,
      setUserRole: () => {},
      currentBankId: null,
      setCurrentBankId: () => {},
      preloadAllData: () => Promise.resolve(),
      updateCacheData: () => Promise.resolve(),
      clearCache: () => {},
      fetchActivePlayTypes: () => Promise.resolve([]),
    };
  }
  return context;
};

export const CacheProvider = ({ children }) => {
  const [cache, setCache] = useState({
    statistics: null,
    todayResults: null,
    users: null,
    lotteries: null,
    prices: null,
    numberLimits: null,
    schedules: null,
    limitedNumbers: null,
    priceConfigurations: null,
    activePlayTypes: null,
    isLoading: false,
    lastUpdated: {},
  });

  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);

  // Refs para mantener valores actuales
  const userRoleRef = useRef(null);
  const currentBankIdRef = useRef(null);

  // Actualizar refs cuando cambien los valores
  useEffect(() => {
    userRoleRef.current = userRole;
  }, [userRole]);

  useEffect(() => {
    currentBankIdRef.current = currentBankId;
  }, [currentBankId]);

  // Función para obtener estadísticas
      // Función para obtener estadísticas
  const fetchStatistics = useCallback(async () => {
    try {
      // Siempre usar la referencia actual primero
      const bankId = currentBankIdRef.current || currentBankId;
      if (!bankId) return null;
      
      // Por ahora retornar datos básicos para evitar errores de tablas
      const statisticsData = {
        dailyTotal: 0,
        totalRecogido: 0,
        totalPagado: 0,
        ganancia: 0,
        lastUpdated: Date.now()
      };
      
      return statisticsData;
    } catch (error) {
      console.error('Error fetching statistics:', error);
      return null;
    }
  }, [currentBankId]);

  // Función para obtener resultados del día
  const fetchTodayResults = useCallback(async () => {
    console.log('[CacheContext] fetchTodayResults - INICIO');
    try {
      // Siempre usar la referencia actual primero
      const bankId = currentBankIdRef.current || currentBankId;
      console.log('[CacheContext] bankId para fetch:', bankId);
      
      if (!bankId) {
        console.log('[CacheContext] ❌ No bankId disponible');
        return [];
      }
      
      // Obtener fecha actual en zona horaria de La Habana, Cuba
      const now = new Date();
      const todayUTC = now.toISOString().split('T')[0];
      
      // Crear fecha en zona horaria de La Habana (CDT = UTC-4 o CST = UTC-5)
      // Cuba está en CDT (UTC-4) en septiembre
      const havanaTime = new Date(now.getTime() - (4 * 60 * 60 * 1000)); // Restar 4 horas
      const todayHavana = havanaTime.toISOString().split('T')[0];
      
      console.log('[CacheContext] Fecha UTC:', todayUTC);
      console.log('[CacheContext] Fecha La Habana:', todayHavana);
      console.log('[CacheContext] Hora actual UTC:', now.toISOString());
      console.log('[CacheContext] Hora La Habana calculada:', havanaTime.toISOString());
      
      const today = todayHavana;
      console.log('[CacheContext] Fecha de hoy (usada):', today);
      
      // Primero obtener IDs de horarios válidos para el banco
      console.log('[CacheContext] 🔄 Buscando horarios válidos...');
      const { data: validSchedules, error: schedulesError } = await supabase
        .from('horario')
        .select('id, loteria!inner(id_banco)')
        .eq('loteria.id_banco', bankId);
      
      if (schedulesError) {
        console.error('[CacheContext] ❌ Error fetching valid schedules:', schedulesError);
        return [];
      }
      
      console.log('[CacheContext] Horarios válidos encontrados:', validSchedules);
      
      if (!validSchedules || validSchedules.length === 0) {
        console.log('[CacheContext] ⚠️ No hay horarios válidos para este banco');
        return [];
      }
      
      const validScheduleIds = validSchedules.map(s => s.id);
      console.log('[CacheContext] IDs de horarios válidos:', validScheduleIds);
      
      // Luego buscar resultados solo de esos horarios
      console.log('[CacheContext] 🔄 Buscando resultados del día...');
      const { data, error } = await supabase
        .from('resultado')
        .select(`
          id,
          numeros,
          rol,
          created_at,
          id_horario,
          horario:id_horario (
            id,
            nombre,
            hora_inicio,
            hora_fin,
            id_loteria,
            loteria:id_loteria (
              id,
              nombre,
              id_banco
            )
          )
        `)
        .in('id_horario', validScheduleIds)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[CacheContext] ❌ Error fetching today results:', error);
        return [];
      }
      
      console.log('[CacheContext] ✅ Resultados encontrados:', data);
      console.log('[CacheContext] Cantidad de resultados:', data?.length || 0);
      
      // Actualizar el cache
      setCache(prev => ({
        ...prev,
        todayResults: data || [],
        lastUpdated: { ...prev.lastUpdated, todayResults: Date.now() }
      }));
      
      console.log('[CacheContext] ✅ Cache actualizado con resultados');
      
      // Ya no necesitamos filtrar porque consultamos directamente con .in('id_horario', validScheduleIds)
      return data || [];
    } catch (error) {
      console.error('[CacheContext] ❌ Error general en fetchTodayResults:', error);
      return [];
    }
  }, [currentBankId]);

  // Función para obtener usuarios
  const fetchUsers = useCallback(async () => {
    try {
      // Siempre usar la referencia actual primero
      const bankId = currentBankIdRef.current || currentBankId;
      
      let query = supabase.from('profiles').select('*');
      
      // Si hay un banco específico, filtrar por él
      // Si es admin sin banco específico, obtener todos los usuarios
      if (bankId) {
        query = query.eq('id_banco', bankId);
      }
      
      const { data, error } = await query.order('username');

      if (error) {
        console.error('Error fetching users:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }, [currentBankId]);

  // Función para obtener loterías
  const fetchLotteries = useCallback(async () => {
    try {
      if (!currentBankId && !currentBankIdRef.current) {
        return [];
      }
      
      const bankId = currentBankId || currentBankIdRef.current;
      
      const { data, error } = await supabase
        .from('loteria')
        .select(`
          *,
          horario (*)
        `)
        .eq('id_banco', bankId)
        .order('nombre');

      if (error) {
        console.error('Error fetching lotteries:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching lotteries:', error);
      return [];
    }
  }, [currentBankId]);

  // Función para obtener precios
  const fetchPrices = useCallback(async () => {
    try {
      // Siempre usar la referencia actual primero
      const bankId = currentBankIdRef.current || currentBankId;
      if (!bankId) return [];
      
      const { data, error } = await supabase
        .from('jugadas_activas')
        .select('*')
        .eq('id_banco', bankId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching active plays:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching active plays:', error);
      return [];
    }
  }, [currentBankId]);

  // Función para obtener límites de números
  const fetchNumberLimits = useCallback(async () => {
    try {
      // Siempre usar la referencia actual primero
      const bankId = currentBankIdRef.current || currentBankId;
      if (!bankId) return { limitedNumbers: [], specificLimits: [] };
      
      const { data, error } = await supabase
        .from('limite_numero')
        .select(`
          id,
          numero,
          limite,
          jugada,
          created_at,
          id_horario,
          horario:id_horario (
            id,
            nombre,
            hora_inicio,
            hora_fin
          )
        `)
        .eq('id_banco', bankId)
        .order('numero', { ascending: true });

      if (error) {
        console.error('Error fetching number limits:', error);
        return { limitedNumbers: [], specificLimits: [] };
      }
      
      // Procesar los datos para separar por tipo
      const processedData = data || [];
      const limitedNumbers = processedData.map(item => ({
        numero: item.numero,
        limite: item.limite,
        jugada: item.jugada,
        horario: item.horario,
        id: item.id
      }));
      
      return {
        limitedNumbers,
        specificLimits: processedData
      };
    } catch (error) {
      console.error('Error fetching number limits:', error);
      return { limitedNumbers: [], specificLimits: [] };
    }
  }, [currentBankId]);

  // Función para obtener horarios
  const fetchSchedules = useCallback(async () => {
    try {
      // Siempre usar la referencia actual primero
      const bankId = currentBankIdRef.current || currentBankId;
      if (!bankId) return [];
      
      // Consulta directa con JOIN para obtener horarios del banco
      const { data, error } = await supabase
        .from('horario')
        .select(`
          id,
          nombre,
          hora_inicio,
          hora_fin,
          created_at,
          id_loteria,
          loteria:id_loteria (
            id,
            nombre,
            id_banco
          )
        `)
        .not('id_loteria', 'is', null)  // Excluir horarios sin lotería asignada
        .eq('loteria.id_banco', bankId)  // Filtrar por banco usando JOIN
        .order('hora_inicio', { ascending: true });

      if (error) {
        console.error('Error fetching schedules:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching schedules:', error);
      return [];
    }
  }, [currentBankId]);

  // Función para obtener números limitados (lado izquierdo)
  const fetchLimitedNumbers = useCallback(async () => {
    try {
      // Siempre usar la referencia actual primero
      const bankId = currentBankIdRef.current || currentBankId;
      if (!bankId) return [];
      
      const { data, error } = await supabase
        .from('numero_limitado')
        .select(`
          id,
          numero,
          jugada,
          created_at,
          id_horario,
          horario:id_horario (
            id,
            nombre,
            hora_inicio,
            hora_fin
          )
        `)
        .eq('id_banco', bankId)
        .order('numero', { ascending: true });

      if (error) {
        console.error('Error fetching limited numbers:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching limited numbers:', error);
      return [];
    }
  }, [currentBankId]);

  // Función para obtener configuraciones de precios
  const fetchPriceConfigurations = useCallback(async () => {
    try {
      // Siempre usar la referencia actual primero
      const bankId = currentBankIdRef.current || currentBankId;
      if (!bankId) return [];
      
      const { data, error } = await supabase
        .from('precio')
        .select('*')
        .eq('id_banco', bankId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching price configurations:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching price configurations:', error);
      return [];
    }
  }, [currentBankId]);

  // Función para obtener tipos de jugadas activas
  const fetchActivePlayTypes = useCallback(async () => {
    try {
      // Siempre usar la referencia actual primero
      const bankId = currentBankIdRef.current || currentBankId;
      if (!bankId) return [];

      const JUGADA_ORDER = ['fijo','corrido','posicion','parle','centena','tripleta'];
      
      const { data, error } = await supabase
        .from('jugadas_activas')
        .select('jugadas')
        .eq('id_banco', bankId)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') { // ignorar no rows
        console.error('Error fetching active play types:', error);
        return [];
      }
      
      const jugadas = data?.jugadas || { fijo:true, corrido:true, posicion:true, parle:true, centena:true, tripleta:true };
      const actives = Object.keys(jugadas).filter(k => jugadas[k]);
      
      // Ordenar según orden canónico
      actives.sort((a,b) => {
        const ia = JUGADA_ORDER.indexOf(a);
        const ib = JUGADA_ORDER.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
      
      // Actualizar cache
      setCache(prev => ({
        ...prev,
        activePlayTypes: actives,
        lastUpdated: { ...prev.lastUpdated, activePlayTypes: Date.now() }
      }));
      
      return actives;
    } catch (error) {
      console.error('Error fetching active play types:', error);
      return [];
    }
  }, [currentBankId]);

  // Función principal para precargar todos los datos
  const preloadAllData = useCallback(async () => {
    // Usar los valores actuales del estado en lugar de userRole y currentBankId
    const currentRole = userRoleRef.current;
    const currentBank = currentBankIdRef.current;
    
    if (currentRole !== 'admin' && currentRole !== 'collector') {
      setCache(prev => ({ ...prev, isLoading: false }));
      return;
    }

    if (!currentBank) {
      setCache(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setCache(prev => ({ ...prev, isLoading: true }));

    try {
      const [
        statistics,
        todayResults,
        users,
        lotteries,
        prices,
        numberLimits,
        schedules,
        limitedNumbers,
        priceConfigurations
      ] = await Promise.allSettled([
        fetchStatistics(),
        fetchTodayResults(),
        fetchUsers(),
        fetchLotteries(),
        fetchPrices(),
        fetchNumberLimits(),
        fetchSchedules(),
        fetchLimitedNumbers(),
        fetchPriceConfigurations()
      ]);

      const timestamp = Date.now();

      // Extraer valores de las promesas resueltas y log errores
      const statisticsData = statistics.status === 'fulfilled' ? statistics.value : null;
      if (statistics.status === 'rejected') {
        console.error('Error fetching statistics:', statistics.reason);
      }

      const todayResultsData = todayResults.status === 'fulfilled' ? todayResults.value : [];
      if (todayResults.status === 'rejected') {
        console.error('Error fetching today results:', todayResults.reason);
      }

      const usersData = users.status === 'fulfilled' ? users.value : [];
      if (users.status === 'rejected') {
        console.error('Error fetching users:', users.reason);
      }

      const lotteriesData = lotteries.status === 'fulfilled' ? lotteries.value : [];
      if (lotteries.status === 'rejected') {
        console.error('Error fetching lotteries:', lotteries.reason);
      }

      const pricesData = prices.status === 'fulfilled' ? prices.value : [];
      if (prices.status === 'rejected') {
        console.error('Error fetching prices:', prices.reason);
      }

      const numberLimitsData = numberLimits.status === 'fulfilled' ? numberLimits.value : { limitedNumbers: [], specificLimits: [] };
      if (numberLimits.status === 'rejected') {
        console.error('Error fetching number limits:', numberLimits.reason);
      }

      const schedulesData = schedules.status === 'fulfilled' ? schedules.value : [];
      if (schedules.status === 'rejected') {
        console.error('Error fetching schedules:', schedules.reason);
      }

      const limitedNumbersData = limitedNumbers.status === 'fulfilled' ? limitedNumbers.value : [];
      if (limitedNumbers.status === 'rejected') {
        console.error('Error fetching limited numbers:', limitedNumbers.reason);
      }

      const priceConfigurationsData = priceConfigurations.status === 'fulfilled' ? priceConfigurations.value : [];
      if (priceConfigurations.status === 'rejected') {
        console.error('Error fetching price configurations:', priceConfigurations.reason);
      }

      setCache(prev => ({
        ...prev,
        statistics: statisticsData,
        todayResults: todayResultsData,
        users: usersData,
        lotteries: lotteriesData,
        prices: pricesData,
        numberLimits: numberLimitsData,
        schedules: schedulesData,
        limitedNumbers: limitedNumbersData,
        priceConfigurations: priceConfigurationsData,
        isLoading: false,
        lastUpdated: {
          statistics: timestamp,
          todayResults: timestamp,
          users: timestamp,
          lotteries: timestamp,
          prices: timestamp,
          numberLimits: timestamp,
          schedules: timestamp,
          limitedNumbers: timestamp,
          priceConfigurations: timestamp,
        }
      }));

    } catch (error) {
      console.error('Error precargando datos:', error);
      setCache(prev => ({ ...prev, isLoading: false }));
    }
  }, [userRole, currentBankId, fetchStatistics, fetchTodayResults, fetchUsers, fetchLotteries, fetchPrices, fetchNumberLimits, fetchSchedules, fetchLimitedNumbers, fetchPriceConfigurations]);

  // Función para actualizar datos específicos
  const updateCacheData = useCallback(async (dataType, data = null) => {
    if (!currentBankIdRef.current) {
      return;
    }

    try {
      let newData = data;
      
      // Si no se proporciona data, fetch from database
      if (!newData) {
        const fetchFunctions = {
          statistics: fetchStatistics,
          todayResults: fetchTodayResults,
          users: fetchUsers,
          lotteries: fetchLotteries,
          prices: fetchPrices,
          numberLimits: fetchNumberLimits,
          schedules: fetchSchedules,
          limitedNumbers: fetchLimitedNumbers,
          priceConfigurations: fetchPriceConfigurations,
          activePlayTypes: fetchActivePlayTypes,
        };

        const fetchFunction = fetchFunctions[dataType];
        if (!fetchFunction) {
          console.error('Unknown data type:', dataType);
          return;
        }

        newData = await fetchFunction();
      }

      const timestamp = Date.now();

      setCache(prev => ({
        ...prev,
        [dataType]: newData,
        lastUpdated: {
          ...prev.lastUpdated,
          [dataType]: timestamp,
        }
      }));
      
    } catch (error) {
      console.error(`Error updating ${dataType}:`, error);
    }
  }, [currentBankId, fetchStatistics, fetchTodayResults, fetchUsers, fetchLotteries, fetchPrices, fetchNumberLimits, fetchSchedules, fetchLimitedNumbers, fetchPriceConfigurations, fetchActivePlayTypes]);

  // Función para limpiar caché
  const clearCache = useCallback(() => {
    setCache({
      statistics: null,
      todayResults: null,
      users: null,
      lotteries: null,
      prices: null,
      numberLimits: null,
      schedules: null,
      limitedNumbers: null,
      priceConfigurations: null,
      activePlayTypes: null,
      isLoading: false,
      lastUpdated: {},
    });
  }, []);

  const value = {
    cache,
    userRole,
    setUserRole,
    currentBankId,
    setCurrentBankId,
    preloadAllData,
    updateCacheData,
    clearCache,
    fetchStatistics,
    fetchTodayResults,
    fetchUsers,
    fetchLotteries,
    fetchPrices,
    fetchNumberLimits,
    fetchSchedules,
    fetchLimitedNumbers,
    fetchPriceConfigurations,
    fetchActivePlayTypes,
  };

  return (
    <CacheContext.Provider value={value}>
      {children}
    </CacheContext.Provider>
  );
};
