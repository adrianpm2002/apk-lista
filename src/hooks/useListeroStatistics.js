import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Helper para convertir fecha local a string para consultas de base de datos
const formatDateForQuery = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useListeroStatistics = () => {
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

  // Función específica para cargar datos de LISTERO
  const loadListeroPlaysData = async (userId, filters = {}) => {
    try {
      if (!userId) {
        console.warn('⚠️ [loadListeroPlaysData] No userId provided');
        return [];
      }

      console.log('🔍 [loadListeroPlaysData] Starting data fetch for listero...');

      const { startDate, endDate } = filters;
      
      // Formatear fechas si están disponibles
      let dateFilters = {};
      if (startDate && endDate) {
        const startStr = formatDateForQuery(startDate) + ' 00:00:00';
        const endStr = formatDateForQuery(endDate) + ' 23:59:59';
        dateFilters = {
          startStr,
          endStr
        };
      }

      // Obtener todos los datos usando paginación optimizada
      let allPlaysData = [];
      let page = 0;
      const pageSize = 1000; // Tamaño de página que coincide con el límite real de Supabase
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('v_estadisticas')
          .select('*')
          .eq('id_listero', userId)
          .eq('estado_horario', 'cerrada')
          .order('fecha_jugada', { ascending: false });

        // Aplicar filtros de fecha si están disponibles
        if (dateFilters.startStr && dateFilters.endStr) {
          query = query
            .gte('fecha_jugada', dateFilters.startStr)
            .lte('fecha_jugada', dateFilters.endStr);
        }

        const { data: playsData, error } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.error('❌ [loadListeroPlaysData] Error cargando datos:', error);
          return [];
        }
        
        console.log(`🔍 [loadListeroPlaysData] Page ${page + 1}: ${playsData?.length || 0} records`);
        
        if (playsData && playsData.length > 0) {
          allPlaysData = allPlaysData.concat(playsData);
          // CORECCIÓN: Si obtienes exactamente 1000 registros (límite de Supabase), puede haber más
          // Solo parar cuando obtengas menos de 1000 registros
          hasMore = playsData.length === 1000; // Continuar si se obtuvieron exactamente 1000 registros
          page++;
        } else {
          hasMore = false;
        }
        
        // Límite de seguridad para evitar bucles infinitos
        if (page > 250) { // Hasta 1.25M registros
          console.warn('⚠️ [loadListeroPlaysData] Límite de páginas alcanzado (1.25M registros)');
          break;
        }
        
        // Mostrar progreso cada 10 páginas
        if (page % 10 === 0) {
          console.log(`📊 [loadListeroPlaysData] Progress: ${allPlaysData.length} records loaded`);
        }
      }
      
      console.log(`🔍 [loadListeroPlaysData] Total records obtained: ${allPlaysData.length}`);

      return allPlaysData || [];
      
    } catch (error) {
      console.error('❌ Error en loadListeroPlaysData:', error);
      return [];
    }
  };

  // Función principal para cargar datos de jugadas del listero
  const loadPlaysData = async (filters = {}) => {
    try {
      console.log('🔍 [loadPlaysData-Listero] === INICIO ===');
      console.log('🔍 [loadPlaysData-Listero] Filters:', filters);
      
      // Prevenir ejecuciones concurrentes
      if (isLoading) {
        console.log('🔄 [loadPlaysData-Listero] Ya está cargando, abortando...');
        return;
      }
      
      setIsLoading(true);
      
      if (!userId) {
        console.log('❌ [loadPlaysData-Listero] No userId disponible');
        setIsLoading(false);
        return;
      }
      
      const playsData = await loadListeroPlaysData(userId, filters);
      
      // Transformar datos para compatibilidad con componentes
      const formattedPlays = (playsData || [])
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
      
      setTableData(prev => ({
        ...prev,
        plays: formattedPlays
      }));
      
      console.log('✅ [loadPlaysData-Listero] Datos establecidos:', formattedPlays.length, 'registros');
      
      return formattedPlays;
      
    } catch (error) {
      console.error('❌ Error cargando jugadas listero:', error);
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
    console.log('🔄 [useListeroStatistics] Cargando usuario...');
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('👤 [useListeroStatistics] Usuario encontrado:', user.id);
          setUserId(user.id);
        }
      } catch (error) {
        console.error('❌ Error cargando usuario:', error);
      }
    };

    loadUserData();
  }, []);

  // Efecto para cargar datos cuando se obtiene el userId
  useEffect(() => {
    console.log('🔄 [useListeroStatistics] userId cambió:', userId);
    if (userId && !isLoading) {
      console.log('📊 [useListeroStatistics] Cargando datos iniciales...');
      loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
    }
  }, [userId]);

  // Efecto para recargar cuando cambie el rango de fechas
  useEffect(() => {
    console.log('🔄 [useListeroStatistics] Rango de fechas cambió');
    if (userId && !isLoading) {
      console.log('📊 [useListeroStatistics] Recargando por cambio de fechas...');
      const timeoutId = setTimeout(() => {
        loadPlaysData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      }, 300); // Debounce de 300ms
      
      return () => clearTimeout(timeoutId);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  return {
    // Estados
    isLoading,
    tableData,
    dateRange,
    userId,
    
    // Funciones
    loadPlaysData,
    updateDateRange
  };
};
