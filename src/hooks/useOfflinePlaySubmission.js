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

      // Preparar datos para SQLite
      const offlinePlay = {
        user_id: playData.user_id,
        id_horario: playData.id_horario,
        numeros: playData.numeros.trim(),
        monto_unitario: montoUnitario,
        monto_total: montoTotal,
        jugada: playData.numeros.trim(), // Repetir numeros en jugada
        nota: playData.nota || `${playData.nombres?.loteria || 'Lotería'} - ${playData.nombres?.horario || 'Horario'}`,
        comando: playData.comando || null,
        id_cliente: playData.id_cliente || null,
        nombre_loteria: playData.nombres?.loteria || 'Desconocida',
        nombre_horario: playData.nombres?.horario || 'Desconocido',
        status: 'pending', // pending, sending, success, failed
        sync_attempts: 0,
        last_error: null,
        created_at: new Date().toISOString(),
      };

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
