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
   * @param {string} playData.user_id - ID del usuario
   * @param {string} playData.id_loteria - ID de la lotería
   * @param {string} playData.id_horario - ID del horario
   * @param {string} playData.numeros - Números separados por coma
   * @param {string} playData.tipo - Tipo de jugada (quiniela/pale/tripleta)
   * @param {number} playData.monto_quiniela - Monto quiniela
   * @param {number} playData.monto_pale - Monto palé
   * @param {number} playData.monto_tripleta - Monto tripleta
   * @param {number} playData.monto_total - Monto total
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

      if (!playData.id_loteria) {
        throw new Error('Lotería requerida');
      }

      if (!playData.id_horario) {
        throw new Error('Horario requerido');
      }

      if (!playData.numeros || playData.numeros.trim() === '') {
        throw new Error('Números requeridos');
      }

      if (!playData.tipo) {
        throw new Error('Tipo de jugada requerido');
      }

      // Validar que al menos un monto sea mayor que 0
      const montoQuiniela = parseFloat(playData.monto_quiniela) || 0;
      const montoPale = parseFloat(playData.monto_pale) || 0;
      const montoTripleta = parseFloat(playData.monto_tripleta) || 0;
      const montoTotal = montoQuiniela + montoPale + montoTripleta;

      if (montoTotal <= 0) {
        throw new Error('Debe especificar al menos un monto');
      }

      // Preparar datos para SQLite
      const offlinePlay = {
        user_id: playData.user_id,
        id_loteria: playData.id_loteria,
        id_horario: playData.id_horario,
        numeros: playData.numeros.trim(),
        tipo: playData.tipo,
        monto_quiniela: montoQuiniela,
        monto_pale: montoPale,
        monto_tripleta: montoTripleta,
        monto_total: montoTotal,
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
        tipo: offlinePlay.tipo,
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
