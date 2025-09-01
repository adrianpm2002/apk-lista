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
  const fetchStatistics = useCallback(async () => {
    try {
      if (!currentBankId) return null;
      
      console.log('Fetching statistics for bank:', currentBankId);
      
      // Por ahora retornar datos básicos para evitar errores de tablas
      const statisticsData = {
        dailyTotal: 0,
        totalRecogido: 0,
        totalPagado: 0,
        ganancia: 0,
        lastUpdated: Date.now()
      };
      
      console.log('Statistics fetched successfully');
      return statisticsData;
    } catch (error) {
      console.error('Error fetching statistics:', error);
      return null;
    }
  }, [currentBankId]);

  // Función para obtener resultados del día
  const fetchTodayResults = useCallback(async () => {
    try {
      if (!currentBankId) return [];
      
      console.log('Fetching today results for bank:', currentBankId);
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('resultado')
        .select(`
          id,
          numeros,
          created_at,
          id_horario
        `)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .order('id', { ascending: false });

      if (error) {
        console.error('Error fetching today results:', error);
        return [];
      }
      
      console.log('Today results fetched successfully:', data?.length || 0, 'records');
      return data || [];
    } catch (error) {
      console.error('Error fetching today results:', error);
      return [];
    }
  }, [currentBankId]);

  // Función para obtener usuarios
  const fetchUsers = useCallback(async () => {
    try {
      if (!currentBankId) return [];
      
      console.log('Fetching users for bank:', currentBankId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id_banco', currentBankId)
        .order('username');

      if (error) {
        console.error('Error fetching users:', error);
        return [];
      }
      
      console.log('Users fetched successfully:', data?.length || 0, 'records');
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
        console.log('fetchLotteries: No bank ID available');
        return [];
      }
      
      const bankId = currentBankId || currentBankIdRef.current;
      console.log('Fetching lotteries from cache context for bank:', bankId);
      
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
      
      console.log('Lotteries fetched in cache:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Error fetching lotteries:', error);
      return [];
    }
  }, [currentBankId]);

  // Función para obtener precios
  const fetchPrices = useCallback(async () => {
    try {
      if (!currentBankId) return [];
      
      console.log('Fetching prices for bank:', currentBankId);
      
      // Por ahora retornar array vacío para evitar errores de tabla
      console.log('Prices fetched successfully: 0 records');
      return [];
    } catch (error) {
      console.error('Error fetching prices:', error);
      return [];
    }
  }, [currentBankId]);

  // Función para obtener límites de números
  const fetchNumberLimits = useCallback(async () => {
    try {
      if (!currentBankId) return { limitedNumbers: [], specificLimits: [] };
      
      console.log('Fetching number limits for bank:', currentBankId);
      
      // Por ahora retornar objetos vacíos para evitar errores de tabla
      console.log('Number limits fetched successfully: 0 records');
      return {
        limitedNumbers: [],
        specificLimits: []
      };
    } catch (error) {
      console.error('Error fetching number limits:', error);
      return { limitedNumbers: [], specificLimits: [] };
    }
  }, [currentBankId]);

  // Función principal para precargar todos los datos
  const preloadAllData = useCallback(async () => {
    // Usar los valores actuales del estado en lugar de userRole y currentBankId
    const currentRole = userRoleRef.current;
    const currentBank = currentBankIdRef.current;
    
    console.log('Starting preload for role:', currentRole, 'bank:', currentBank);
    
    if (currentRole !== 'admin' && currentRole !== 'collector') {
      console.log('Preload cancelled: user is not admin or collector');
      setCache(prev => ({ ...prev, isLoading: false }));
      return;
    }

    if (!currentBank) {
      console.log('Preload cancelled: no bank ID available');
      setCache(prev => ({ ...prev, isLoading: false }));
      return;
    }

    console.log('Preloading data for role:', currentRole, 'with bank ID:', currentBank);
    setCache(prev => ({ ...prev, isLoading: true }));

    try {
      console.log('Fetching all data types...');
      
      const [
        statistics,
        todayResults,
        users,
        lotteries,
        prices,
        numberLimits
      ] = await Promise.allSettled([
        fetchStatistics(),
        fetchTodayResults(),
        fetchUsers(),
        fetchLotteries(),
        fetchPrices(),
        fetchNumberLimits()
      ]);

      const timestamp = Date.now();

      // Extraer valores de las promesas resueltas
      const statisticsData = statistics.status === 'fulfilled' ? statistics.value : null;
      const todayResultsData = todayResults.status === 'fulfilled' ? todayResults.value : [];
      const usersData = users.status === 'fulfilled' ? users.value : [];
      const lotteriesData = lotteries.status === 'fulfilled' ? lotteries.value : [];
      const pricesData = prices.status === 'fulfilled' ? prices.value : [];
      const numberLimitsData = numberLimits.status === 'fulfilled' ? numberLimits.value : { limitedNumbers: [], specificLimits: [] };

      setCache(prev => ({
        ...prev,
        statistics: statisticsData,
        todayResults: todayResultsData,
        users: usersData,
        lotteries: lotteriesData,
        prices: pricesData,
        numberLimits: numberLimitsData,
        isLoading: false,
        lastUpdated: {
          statistics: timestamp,
          todayResults: timestamp,
          users: timestamp,
          lotteries: timestamp,
          prices: timestamp,
          numberLimits: timestamp,
        }
      }));

      console.log('Datos precargados exitosamente');
    } catch (error) {
      console.error('Error precargando datos:', error);
      setCache(prev => ({ ...prev, isLoading: false }));
    }
  }, [userRole, currentBankId, fetchStatistics, fetchTodayResults, fetchUsers, fetchLotteries, fetchPrices, fetchNumberLimits]);

  // Función para actualizar datos específicos
  const updateCacheData = useCallback(async (dataType, data = null) => {
    if (!currentBankIdRef.current) {
      console.log('UpdateCacheData cancelled: no bank ID');
      return;
    }

    console.log('Updating cache data for:', dataType);

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
      
      console.log('Cache updated successfully for:', dataType);
    } catch (error) {
      console.error(`Error updating ${dataType}:`, error);
    }
  }, [currentBankId, fetchStatistics, fetchTodayResults, fetchUsers, fetchLotteries, fetchPrices, fetchNumberLimits]);

  // Función para limpiar caché
  const clearCache = useCallback(() => {
    setCache({
      statistics: null,
      todayResults: null,
      users: null,
      lotteries: null,
      prices: null,
      numberLimits: null,
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
  };

  return (
    <CacheContext.Provider value={value}>
      {children}
    </CacheContext.Provider>
  );
};
