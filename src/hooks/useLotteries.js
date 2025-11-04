import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import * as OfflineStorage from '../services/offlineStorageService';
import { useConnection } from './useConnection';
import { syncLotteries } from '../services/lotterySyncService';

/**
 * Hook para obtener loterías (online o offline)
 * Si online: obtiene desde Supabase y guarda en SQLite
 * Si offline: obtiene desde SQLite
 * 
 * @param {number} id_banco - ID del banco (opcional)
 * @returns {Object} { lotteries, loading, error, refresh }
 */
export const useLotteries = (id_banco = null) => {
  const [lotteries, setLotteries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isOnline } = useConnection();

  /**
   * Cargar loterías (online o offline)
   */
  const loadLotteries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isOnline) {
        console.log('[useLotteries] 🌐 Online - Obteniendo desde Supabase...');
        
        // Obtener desde Supabase
        let query = supabase
          .from('loterias')
          .select('id_loteria, nombre, id_banco, activo')
          .eq('activo', true);

        if (id_banco) {
          query = query.eq('id_banco', id_banco);
        }

        const { data, error: supabaseError } = await query;

        if (supabaseError) {
          console.error('[useLotteries] Error Supabase:', supabaseError);
          throw new Error(supabaseError.message);
        }

        // Guardar en SQLite para uso offline
        await OfflineStorage.saveLotteries(data || [], id_banco);

        setLotteries(data || []);
        console.log(`[useLotteries] ✅ ${data?.length || 0} loterías obtenidas online`);
      } else {
        console.log('[useLotteries] 📵 Offline - Obteniendo desde SQLite...');
        
        // Obtener desde SQLite
        const offlineData = await OfflineStorage.getLotteries(id_banco);
        setLotteries(offlineData);
        console.log(`[useLotteries] ✅ ${offlineData.length} loterías obtenidas offline`);

        if (offlineData.length === 0) {
          setError('No hay loterías guardadas offline. Conecta a internet para sincronizar.');
        }
      }
    } catch (err) {
      console.error('[useLotteries] Error:', err);
      setError(err.message);
      
      // Si falla online, intentar cargar offline como fallback
      if (isOnline) {
        console.log('[useLotteries] ⚠️ Fallback a datos offline...');
        try {
          const offlineData = await OfflineStorage.getLotteries(id_banco);
          setLotteries(offlineData);
        } catch (offlineErr) {
          console.error('[useLotteries] Error en fallback offline:', offlineErr);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, id_banco]);

  /**
   * Recargar loterías manualmente
   */
  const refresh = useCallback(async () => {
    await loadLotteries();
  }, [loadLotteries]);

  /**
   * Cargar al montar y cuando cambie conexión o id_banco
   */
  useEffect(() => {
    loadLotteries();
  }, [loadLotteries]);

  /**
   * Auto-sincronizar cuando vuelve la conexión
   */
  useEffect(() => {
    if (isOnline && lotteries.length === 0) {
      console.log('[useLotteries] 🔄 Conexión restaurada, sincronizando...');
      syncLotteries(id_banco);
    }
  }, [isOnline, id_banco, lotteries.length]);

  return {
    lotteries,
    loading,
    error,
    refresh,
    isOffline: !isOnline
  };
};

export default useLotteries;
