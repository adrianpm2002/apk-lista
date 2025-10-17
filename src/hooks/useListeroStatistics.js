import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import * as SQLiteCache from '../utils/sqliteCache';

// Helper para convertir fecha local a string para consultas de base de datos
const formatDateForQuery = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const CACHE_DAYS = 30; // Cachear últimos 30 días

export const useListeroStatistics = (options = {}) => {
  const { enabled = true } = options;
  
  // Estados básicos
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [tableData, setTableData] = useState({
    plays: []
  });
  
  // 🐛 DEBUG: Metadata temporal para debugging
  const [debugInfo, setDebugInfo] = useState({
    source: '', // 'CACHE' | 'SUPABASE'
    totalBeforeFilter: 0,
    totalAfterFilter: 0,
    cacheOldestDate: null,
    rangeRequested: ''
  });
  
  // Estado para el rango de fechas (hoy por defecto)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setHours(23, 59, 59, 999))
  });
  
  // Ref para evitar múltiples cargas simultáneas
  const loadingRef = useRef(false);

  // Detectar userId y auto-cargar datos (se ejecuta cuando enabled cambia)
  useEffect(() => {
    const initializeData = async () => {
      if (!enabled) {
        setUserId(null); // Limpiar userId si se deshabilita
        return;
      }
      
      if (loadingRef.current) {
        return;
      }
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUserId(user.id);
          
          // 🎯 FIX: Cargar solo HOY en la primera carga, no 30 días
          const today = new Date();
          const startDate = new Date(today);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(today);
          endDate.setHours(23, 59, 59, 999);
          
          console.log('🐛 [DEBUG LISTERO] 🚀 Inicialización - Cargando SOLO HOY:', startDate.toLocaleDateString());
          
          // Pasar userId explícitamente porque setUserId es asíncrono
          loadPlaysData({ 
            startDate, 
            endDate, 
            forceRefresh: false 
          }, user.id);
        }
      } catch (error) {
        // Error silencioso
      }
    };

    initializeData();
  }, [enabled]);

  /**
   * Cargar datos desde Supabase
   */
  const loadFromSupabase = async (userId, startDate, endDate) => {
    try {
      const startStr = formatDateForQuery(startDate);
      const endStr = formatDateForQuery(endDate);

      let allPlaysData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: playsData, error } = await supabase
          .from('v_estadisticas')
          .select('*')
          .eq('id_listero', userId)
          .gte('fecha_jugada', startStr)
          .lte('fecha_jugada', endStr)
          .order('fecha_jugada', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          throw error;
        }
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
          hasMore = playsData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
        
        // Límite de seguridad
        if (page > 250) break;
      }

      return allPlaysData || [];
    } catch (error) {
      throw error;
    }
  };

  /**
   * Cargar datos con estrategia de caché inteligente
   */
  const loadPlaysData = async (filters = {}, userIdOverride = null) => {
    const effectiveUserId = userIdOverride || userId;
    
    if (!effectiveUserId || !enabled) {
      return;
    }
    
    if (loadingRef.current) {
      return; // Evitar cargas simultáneas
    }

    loadingRef.current = true;
    setIsLoading(true);

    try {
      // 🎯 FIX: Recalcular fechas "hoy" si no vienen en filters para evitar fechas obsoletas
      let {
        startDate = null,
        endDate = null,
        forceRefresh = false
      } = filters;
      
      // Si no hay startDate/endDate, usar "hoy" recién calculado
      if (!startDate || !endDate) {
        const now = new Date();
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        console.log('🐛 [DEBUG LISTERO] ⚠️ No hay fechas en filters, usando HOY recién calculado');
      }
      
      console.log('🐛 [DEBUG LISTERO] 📅 Fechas finales - start:', startDate.toISOString(), 'end:', endDate.toISOString());
      console.log('🐛 [DEBUG LISTERO] 🔄 forceRefresh:', forceRefresh ? 'SÍ (saltará caché)' : 'NO (intentará caché primero)');

      // 1. Intentar leer del caché SQLite primero
      console.log('🐛 [DEBUG LISTERO] 🔍 PASO 1: Intentando leer desde CACHÉ SQLite...');
      let cachedPlays = [];
      try{
        // Leer TODO el caché disponible (sin filtro de fechas aún)
        cachedPlays = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'listero', {});
        console.log('🐛 [DEBUG LISTERO] 📦 Caché leído:', cachedPlays.length, 'registros');
      } catch (cacheError) {
        console.log('🐛 [DEBUG LISTERO] ❌ Error leyendo caché:', cacheError);
        cachedPlays = [];
      }

      // 2. Si hay datos en caché, verificar si cubren el rango solicitado
      console.log('🐛 [DEBUG LISTERO] 🔍 PASO 2: Evaluando si usar caché o consultar Supabase...');
      console.log('🐛 [DEBUG LISTERO]    - Caché tiene:', cachedPlays.length, 'registros');
      console.log('🐛 [DEBUG LISTERO]    - forceRefresh:', forceRefresh);
      
      if (cachedPlays.length > 0 && !forceRefresh) {
        console.log('🐛 [DEBUG LISTERO]    ✅ Condición 1 cumplida: Caché NO está vacío');
        console.log('🐛 [DEBUG LISTERO]    ✅ Condición 2 cumplida: NO es forceRefresh');
        console.log('🐛 [DEBUG LISTERO] 🔍 PASO 3: Filtrando caché por rango de fechas...');
        
        // Filtrar por el rango solicitado
        const filteredCachedPlays = cachedPlays.filter(play => {
          const playDate = new Date(play.fecha_jugada);
          return playDate >= startDate && playDate <= endDate;
        });
        
        console.log('🐛 [DEBUG LISTERO]    📊 Después del filtro:', filteredCachedPlays.length, 'registros');
        
        // Verificar si el caché cubre el rango completo
        // Si encontramos datos O si el rango está dentro de los últimos 30 días cacheados
        const oldestCached = cachedPlays.length > 0 
          ? new Date(Math.min(...cachedPlays.map(p => new Date(p.fecha_jugada).getTime())))
          : null;
        
        console.log('🐛 [DEBUG LISTERO] 🔍 PASO 4: Verificando cobertura del caché...');
        console.log('🐛 [DEBUG LISTERO]    📆 Fecha más antigua en caché:', oldestCached?.toLocaleDateString());
        console.log('🐛 [DEBUG LISTERO]    📆 Fecha inicio solicitada:', startDate.toLocaleDateString());
        
        const cacheCoversRange = oldestCached && oldestCached <= startDate;
        
        console.log('🐛 [DEBUG LISTERO]    ❓ ¿Caché cubre rango completo?', cacheCoversRange ? '✅ SÍ' : '❌ NO');
        
        // 🎯 FIX CRÍTICO: SOLO usar caché si cubre el rango COMPLETO Y tiene datos
        // Cambio: >= 0 (siempre true) → > 0 (requiere datos)
        if (cacheCoversRange && filteredCachedPlays.length > 0) {
          console.log('🐛 [DEBUG LISTERO] ✅ DECISIÓN: Usando CACHÉ -', filteredCachedPlays.length, 'jugadas');
          console.log('🐛 [DEBUG LISTERO] ⏭️ Saltando consulta a Supabase');
          
          // 🐛 DEBUG: Actualizar metadata
          setDebugInfo({
            source: 'CACHE',
            totalBeforeFilter: cachedPlays.length,
            totalAfterFilter: filteredCachedPlays.length,
            cacheOldestDate: oldestCached?.toLocaleDateString() || 'N/A',
            rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
          });
          
          setTableData({ plays: filteredCachedPlays });

          // Verificar si necesita actualización incremental (solo HOY)
          let needsUpdate = false;
          try {
            needsUpdate = await SQLiteCache.needsIncrementalUpdate(effectiveUserId, 'listero');
          } catch (cacheError) {
            // Error silencioso
          }
          
          if (needsUpdate) {
            updateTodayInBackground(effectiveUserId);
          }

          setIsLoading(false);
          loadingRef.current = false;
          return;
        } else {
          console.log('🐛 [DEBUG LISTERO] ❌ DECISIÓN: Caché NO cubre rango completo');
          console.log('🐛 [DEBUG LISTERO]    ❌ Razón: cacheCoversRange =', cacheCoversRange);
          console.log('🐛 [DEBUG LISTERO] 🌐 Continuando a consulta de Supabase...');
        }
      } else {
        // Caché vacío o forceRefresh
        if (cachedPlays.length === 0) {
          console.log('🐛 [DEBUG LISTERO]    ❌ Condición 1 NO cumplida: Caché está VACÍO');
        }
        if (forceRefresh) {
          console.log('🐛 [DEBUG LISTERO]    ❌ Condición 2 NO cumplida: ES forceRefresh (pull-to-refresh)');
        }
        console.log('🐛 [DEBUG LISTERO] 🌐 Saltando caché, irá directo a Supabase');
      }

      // 3. No hay caché suficiente o forceRefresh: cargar desde Supabase
      console.log('🐛 [DEBUG LISTERO] 🔍 PASO 5: Consultando SUPABASE...');
      console.log('🐛 [DEBUG LISTERO]    📌 Motivo:', forceRefresh ? 'forceRefresh=true' : cachedPlays.length === 0 ? 'Caché vacío' : 'Caché no cubre rango');
      
      // 🎯 Consultar últimos 30 días para cachear, pero mostrar solo el rango solicitado
      const cacheStart = new Date();
      cacheStart.setDate(cacheStart.getDate() - 29); // 30 días incluyendo hoy
      cacheStart.setHours(0, 0, 0, 0);
      
      const cacheEnd = new Date();
      cacheEnd.setHours(23, 59, 59, 999);
      
      console.log('🐛 [DEBUG] Consultando Supabase desde:', cacheStart.toLocaleDateString(), 'hasta:', cacheEnd.toLocaleDateString());
      
      const playsData = await loadFromSupabase(effectiveUserId, cacheStart, cacheEnd);
      
      console.log('🐛 [DEBUG] Supabase devolvió:', playsData.length, 'registros');

      // 4. Guardar TODO en caché SQLite (últimos 30 días)
      if (playsData.length > 0) {
        console.log('🐛 [DEBUG] 💾 Guardando', playsData.length, 'registros en caché SQLite...');
        console.log('🐛 [DEBUG] 💾 Rango a guardar: desde', playsData[playsData.length - 1]?.fecha_jugada, 'hasta', playsData[0]?.fecha_jugada);
        
        try {
          const result = await SQLiteCache.savePlaysToCache(effectiveUserId, 'listero', playsData);
          console.log('🐛 [DEBUG] 💾 Guardado resultado:', result);
          await SQLiteCache.updateIncrementalTimestamp(effectiveUserId, 'listero');
          console.log('🐛 [DEBUG] 💾 Timestamp incremental actualizado');
          
          // 🎯 VERIFICACIÓN: Leer inmediatamente para confirmar guardado
          try {
            const verification = await SQLiteCache.readPlaysFromCache(effectiveUserId, 'listero', {});
            console.log('🐛 [DEBUG] ✅ VERIFICACIÓN: Cache ahora tiene', verification.length, 'registros');
            if (verification.length !== playsData.length) {
              console.log('🐛 [DEBUG] ⚠️ DISCREPANCIA: Guardados', playsData.length, 'pero cache tiene', verification.length);
            }
          } catch (verifyError) {
            console.log('🐛 [DEBUG] ⚠️ No se pudo verificar guardado:', verifyError.message);
          }
        } catch (cacheError) {
          console.log('🐛 [DEBUG] ❌ Error guardando en caché:', cacheError.message, cacheError.stack);
        }
      } else {
        console.log('🐛 [DEBUG] ⚠️ No hay datos para guardar en caché');
      }

      // 5. Filtrar por el rango solicitado y mostrar
      console.log('🐛 [DEBUG] RANGO EXACTO - startDate:', startDate.toISOString(), 'endDate:', endDate.toISOString());
      
      const filteredPlays = playsData.filter(play => {
        const playDate = new Date(play.fecha_jugada);
        const isInRange = playDate >= startDate && playDate <= endDate;
        
        // Log de las primeras 3 jugadas para ver cómo se filtran
        if (playsData.indexOf(play) < 3) {
          console.log(`🐛 [DEBUG] Jugada ${playsData.indexOf(play)}:`, play.fecha_jugada, '→', isInRange ? '✅ PASA' : '❌ NO PASA');
        }
        
        return isInRange;
      });
      
      console.log('🐛 [DEBUG] Después del filtro:', filteredPlays.length, '/', playsData.length, 'jugadas');
      console.log('🐛 [DEBUG] ✅ Usando SUPABASE -', filteredPlays.length, 'jugadas');
      
      // 🐛 DEBUG: Calcular fecha más antigua de los datos cargados
      const oldestPlay = playsData.length > 0
        ? new Date(Math.min(...playsData.map(p => new Date(p.fecha_jugada).getTime())))
        : null;
      
      console.log('🐛 [DEBUG] Fecha más antigua en datos de Supabase:', oldestPlay?.toLocaleDateString());
      
      // 🐛 DEBUG: Actualizar metadata
      setDebugInfo({
        source: 'SUPABASE',
        totalBeforeFilter: playsData.length,
        totalAfterFilter: filteredPlays.length,
        cacheOldestDate: oldestPlay ? oldestPlay.toLocaleDateString() : 'Sin datos',
        rangeRequested: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      });
      
      setTableData({ plays: filteredPlays });

      // 6. Limpiar registros antiguos
      try {
        await SQLiteCache.cleanOldRecords(effectiveUserId, 'listero');
      } catch (cacheError) {
        // Error silencioso
      }

    } catch (error) {
      setTableData({ plays: [] });
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  };

  /**
   * Actualización incremental en background (solo HOY)
   */
  const updateTodayInBackground = async (userId) => {
    try {
      const today = new Date();
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      
      // Ventana de 5 horas hacia atrás para capturar horarios que cierran tarde
      const updateStart = new Date(todayStart);
      updateStart.setHours(updateStart.getHours() - 5);
      
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const todayPlays = await loadFromSupabase(userId, updateStart, todayEnd);

      if (todayPlays.length > 0) {
        try {
          await SQLiteCache.savePlaysToCache(userId, 'listero', todayPlays);
          await SQLiteCache.updateIncrementalTimestamp(userId, 'listero');
        } catch (cacheError) {
          return;
        }
        
        // Refrescar datos si está viendo hoy
        const { startDate, endDate } = dateRange;
        const isViewingToday = 
          startDate.getDate() === today.getDate() &&
          startDate.getMonth() === today.getMonth() &&
          startDate.getFullYear() === today.getFullYear();

        if (isViewingToday) {
          try {
            const cachedPlays = await SQLiteCache.readPlaysFromCache(userId, 'listero', {
              startDate,
              endDate
            });
            setTableData({ plays: cachedPlays });
          } catch (cacheError) {
            // Error silencioso
          }
        }
      }

      // Limpiar registros antiguos
      try {
        await SQLiteCache.cleanOldRecords(userId, 'listero');
      } catch (cacheError) {
        // Error silencioso
      }
    } catch (error) {
      // Error silencioso
    }
  };

  /**
   * Aplicar filtros (cambia el rango de fechas y recarga)
   */
  const applyFilters = async (filters = {}) => {
    const {
      startDate,
      endDate,
      forceRefresh = false
    } = filters;

    if (startDate && endDate) {
      setDateRange({ startDate, endDate });
    }
    
    await loadPlaysData({
      startDate: startDate || dateRange.startDate,
      endDate: endDate || dateRange.endDate,
      forceRefresh
    });
  };  /**
   * Refrescar datos (pull-to-refresh)
   */
  const refresh = async () => {
    await loadPlaysData({ forceRefresh: true });
  };

  // ❌ ELIMINADO: Carga automática causaba double-loading y race conditions
  // StatisticsScreen controla cuándo cargar vía applyPeriodFilter('today')
  // useEffect(() => {
  //   if (userId && enabled) {
  //     loadPlaysData();
  //   }
  // }, [userId, enabled]);

  return {
    tableData,
    loading: isLoading,
    error: null,
    loadPlaysData,
    applyFilters,
    refresh,
    dateRange,
    debugInfo // 🐛 DEBUG: Metadata temporal
  };
};

export default useListeroStatistics;
