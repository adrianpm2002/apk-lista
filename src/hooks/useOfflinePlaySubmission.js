import { useState } from 'react';
import * as OfflineStorage from '../services/offlineStorageService';

/**
 * Obtener timestamp en hora local de La Habana, Cuba (UTC-5)
 * NO usar toISOString() porque convierte a UTC
 */
const getLocalTimestamp = () => {
  const now = new Date();
  // Cuba está en UTC-5 (o UTC-4 en horario de verano)
  // Formatear fecha local en formato ISO: YYYY-MM-DD HH:mm:ss
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Hook para manejar el envío de jugadas en modo offline
 * Similar a usePlaySubmission pero guarda en SQLite en lugar de enviar a Supabase
 */
export const useOfflinePlaySubmission = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Guardar jugada offline en SQLite
   * @param {Object} playData - Datos de la jugada
   * @param {string} playData.user_id - ID del usuario (listero)
   * @param {string} playData.id_horario - ID del horario
   * @param {string} playData.numeros - Números separados por coma
   * @param {string} playData.tipo_jugada - Tipo de jugada (fijo, corrido, parle, centena, tripleta)
   * @param {number} playData.monto_unitario - Monto por cada número
   * @param {string} playData.nota - Nota opcional
   * @param {string} playData.comando - Comando opcional
   * @param {string} playData.id_cliente - ID del cliente opcional
   * @param {Object} playData.nombres - { loteria, horario }
   * @returns {Promise<Object>} { success, data?, error? }
   */
  const savePlayOffline = async (playData) => {
    setLoading(true);
    setError(null);

    try {
      console.log('[OfflinePlay] Guardando jugada offline...', playData);

      // Validaciones básicas
      if (!playData.user_id) {
        throw new Error('ID de usuario requerido');
      }

      if (!playData.id_horario) {
        throw new Error('Horario requerido');
      }

      if (!playData.numeros || playData.numeros.trim() === '') {
        throw new Error('Números requeridos');
      }

      // Validar monto unitario
      const montoUnitario = parseFloat(playData.monto_unitario) || 0;
      if (montoUnitario <= 0) {
        throw new Error('Monto unitario debe ser mayor a 0');
      }

      // Calcular monto total (monto_unitario * cantidad de números)
      const numerosArray = playData.numeros.split(',').filter(n => n.trim());
      const montoTotal = montoUnitario * numerosArray.length;

      // Obtener información del horario desde el caché para obtener id_loteria
      const cachedSchedules = await OfflineStorage.getSchedules(null);
      const scheduleData = cachedSchedules.find(s => s.id === playData.id_horario);
      
      if (!scheduleData) {
        throw new Error('Horario no encontrado en caché. Sincroniza el caché primero.');
      }

      // Obtener información de la lotería desde el caché
      const cachedLotteries = await OfflineStorage.getLotteries(null);
      const lotteryData = cachedLotteries.find(l => l.id === scheduleData.id_loteria);
      
      if (!lotteryData) {
        throw new Error('Lotería no encontrada en caché. Sincroniza el caché primero.');
      }

      // Preparar datos para SQLite con información completa de lotería y horario
      const offlinePlay = {
        user_id: playData.user_id,
        id_horario: playData.id_horario,
        numeros: playData.numeros.trim(),
        tipo_jugada: playData.tipo_jugada || null,
        monto_unitario: montoUnitario,
        monto_total: montoTotal,
        jugada: playData.tipo_jugada || playData.numeros.trim(), // Usar tipo_jugada, sino numeros
        nota: playData.nota || `${lotteryData.nombre} - ${scheduleData.nombre}`,
        comando: playData.comando || null,
        id_cliente: playData.id_cliente || null,
        nombre_loteria: lotteryData.nombre,
        nombre_horario: scheduleData.nombre,
        status: 'pending', // pending, sending, success, failed
        sync_attempts: 0,
        last_error: null,
        created_at: getLocalTimestamp(), // Hora local de La Habana, NO UTC
      };

      console.log('[OfflinePlay] Datos completos con info del caché:', {
        loteria: lotteryData.nombre,
        horario: scheduleData.nombre,
        id_loteria: scheduleData.id_loteria
      });

      // Guardar en SQLite
      const result = await OfflineStorage.saveOfflinePlay(offlinePlay);

      if (!result.success) {
        throw new Error(result.error || 'Error guardando jugada offline');
      }

      console.log('[OfflinePlay] ✅ Jugada guardada offline con ID:', result.id);

      // Log de operación
      await OfflineStorage.addLog('INFO', 'Jugada guardada offline', {
        play_id: result.id,
        numeros: offlinePlay.numeros,
        cantidad: numerosArray.length,
        monto_unitario: offlinePlay.monto_unitario,
        monto_total: offlinePlay.monto_total,
        loteria: offlinePlay.nombre_loteria,
        horario: offlinePlay.nombre_horario,
      });

      setLoading(false);
      return {
        success: true,
        data: {
          id: result.id,
          ...offlinePlay,
        },
      };
    } catch (err) {
      console.error('[OfflinePlay] Error guardando jugada offline:', err);
      setError(err.message);
      setLoading(false);

      await OfflineStorage.addLog('ERROR', 'Error guardando jugada offline', {
        error: err.message,
        playData,
      });

      return {
        success: false,
        error: err.message,
      };
    }
  };

  /**
   * Guardar múltiples jugadas offline en batch (más eficiente)
   * @param {Array<Object>} playsDataArray - Array de datos de jugadas
   * @returns {Promise<Object>} { success, insertedCount, failedCount, errors? }
   */
  const saveBatchPlaysOffline = async (playsDataArray) => {
    setLoading(true);
    setError(null);

    try {
      console.log('[OfflinePlay] Guardando jugadas en batch offline...', playsDataArray.length);
      console.log('[OfflinePlay] Primer elemento del array:', JSON.stringify(playsDataArray[0], null, 2));

      if (!Array.isArray(playsDataArray) || playsDataArray.length === 0) {
        console.error('[OfflinePlay] Array vacío o inválido');
        throw new Error('Array de jugadas vacío o inválido');
      }

      // Procesar todas las jugadas para agregar información completa
      console.log('[OfflinePlay] Procesando jugadas...');
      const processedPlays = await Promise.all(
        playsDataArray.map(async (playData) => {
          // Validaciones básicas
          if (!playData.user_id || !playData.id_horario || !playData.numeros || playData.numeros.trim() === '') {
            throw new Error('Datos incompletos en una de las jugadas');
          }

          const montoUnitario = parseFloat(playData.monto_unitario) || 0;
          if (montoUnitario <= 0) {
            throw new Error('Monto unitario debe ser mayor a 0');
          }

          // Calcular monto total (monto_unitario * cantidad de números)
          const numerosArray = playData.numeros.split(',').filter(n => n.trim());
          const montoTotal = montoUnitario * numerosArray.length;

          // Obtener información del horario desde el caché
          const cachedSchedules = await OfflineStorage.getSchedules(null);
          const scheduleData = cachedSchedules.find(s => s.id === playData.id_horario);
          
          if (!scheduleData) {
            throw new Error('Horario no encontrado en caché. Sincroniza el caché primero.');
          }

          // Obtener información de la lotería desde el caché
          const cachedLotteries = await OfflineStorage.getLotteries(null);
          const lotteryData = cachedLotteries.find(l => l.id === scheduleData.id_loteria);
          
          if (!lotteryData) {
            throw new Error('Lotería no encontrada en caché. Sincroniza el caché primero.');
          }

          return {
            user_id: playData.user_id,
            id_horario: playData.id_horario,
            numeros: playData.numeros.trim(),
            tipo_jugada: playData.tipo_jugada || null,
            monto_unitario: montoUnitario,
            monto_total: montoTotal,
            jugada: playData.tipo_jugada || playData.numeros.trim(),
            nota: playData.nota || `${lotteryData.nombre} - ${scheduleData.nombre}`,
            comando: playData.comando || null,
            id_cliente: playData.id_cliente || null,
            nombre_loteria: lotteryData.nombre,
            nombre_horario: scheduleData.nombre,
            status: 'pending',
            sync_attempts: 0,
            last_error: null,
            created_at: getLocalTimestamp(), // Hora local de La Habana, NO UTC
          };
        })
      );

      console.log('[OfflinePlay] Procesadas jugadas con info del caché:', processedPlays.length);
      console.log('[OfflinePlay] Primera jugada procesada:', JSON.stringify(processedPlays[0], null, 2));

      // Guardar todas las jugadas en batch usando la transacción de SQLite
      console.log('[OfflinePlay] Llamando a saveBatchOfflinePlays...');
      const result = await OfflineStorage.saveBatchOfflinePlays(processedPlays);
      console.log('[OfflinePlay] Resultado de saveBatchOfflinePlays:', JSON.stringify(result, null, 2));

      if (!result.success) {
        throw new Error(result.error || 'Error guardando jugadas offline en batch');
      }

      console.log('[OfflinePlay] ✅ Jugadas guardadas en batch offline:', {
        insertedCount: result.insertedCount,
        failedCount: result.failedCount,
      });

      // Log de operación
      await OfflineStorage.addLog('INFO', 'Jugadas guardadas offline en batch', {
        total: playsDataArray.length,
        inserted: result.insertedCount,
        failed: result.failedCount,
      });

      setLoading(false);
      return {
        success: true,
        insertedCount: result.insertedCount,
        failedCount: result.failedCount,
        errors: result.errors,
      };
    } catch (err) {
      console.error('[OfflinePlay] Error guardando jugadas en batch offline:', err);
      setError(err.message);
      setLoading(false);

      await OfflineStorage.addLog('ERROR', 'Error guardando jugadas en batch offline', {
        error: err.message,
        count: playsDataArray.length,
      });

      return {
        success: false,
        insertedCount: 0,
        failedCount: playsDataArray.length,
        error: err.message,
      };
    }
  };

  return {
    savePlayOffline,
    saveBatchPlaysOffline,
    loading,
    error,
  };
};

export default useOfflinePlaySubmission;
