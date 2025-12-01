import { useState } from 'react';
import * as OfflineStorage from '../services/offlineStorageService';

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
        created_at: new Date().toISOString(),
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

  return {
    savePlayOffline,
    loading,
    error,
  };
};

export default useOfflinePlaySubmission;
