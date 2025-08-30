import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Alert } from 'react-native';

export const useNumberLimits = () => {
  const [globalLimits, setGlobalLimits] = useState([]);
  const [specificLimits, setSpecificLimits] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar límites globales
  const loadGlobalLimits = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('number_limits')
        .select(`
          *,
          loteria:id_loteria(id, nombre),
          horario:id_horario(id, nombre)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGlobalLimits(data || []);
    } catch (err) {
      console.error('Error cargando límites globales:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar límites específicos
  const loadSpecificLimits = async (lotteryId = null, scheduleId = null, playType = null) => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('specific_number_limits')
        .select(`
          *,
          loteria:id_loteria(id, nombre),
          horario:id_horario(id, nombre)
        `)
        .order('number');

      if (lotteryId) query = query.eq('id_loteria', lotteryId);
      if (scheduleId) query = query.eq('id_horario', scheduleId);
      if (playType) query = query.eq('play_type', playType);

      const { data, error } = await query;
      if (error) throw error;
      setSpecificLimits(data || []);
    } catch (err) {
      console.error('Error cargando límites específicos:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar si una apuesta excede los límites
  const checkBetLimits = async (lotteryId, scheduleId, playType, number, betAmount) => {
    try {
      const paddedNumber = number.toString().padStart(3, '0');

      // Verificar límite específico del número
      const { data: specificLimit } = await supabase
        .from('specific_number_limits')
        .select('*')
        .eq('id_loteria', lotteryId)
        .eq('id_horario', scheduleId)
        .eq('play_type', playType)
        .eq('number', paddedNumber)
        .single();

      if (specificLimit) {
        const newTotal = parseFloat(specificLimit.current_amount) + parseFloat(betAmount);
        if (newTotal > parseFloat(specificLimit.limit_amount)) {
          return {
            allowed: false,
            reason: `El número ${number} excede su límite de $${specificLimit.limit_amount}. Actual: $${specificLimit.current_amount}`,
            limitType: 'specific',
            currentAmount: specificLimit.current_amount,
            limitAmount: specificLimit.limit_amount
          };
        }
      }

      // Verificar límite global si no hay específico
      const { data: globalLimit } = await supabase
        .from('number_limits')
        .select('*')
        .eq('id_loteria', lotteryId)
        .eq('id_horario', scheduleId)
        .eq('play_type', playType)
        .single();

      if (globalLimit && parseFloat(globalLimit.global_limit) > 0) {
        // Calcular total actual del número desde el tracking
        const { data: currentBets } = await supabase
          .from('number_bets_tracking')
          .select('bet_amount')
          .eq('id_loteria', lotteryId)
          .eq('id_horario', scheduleId)
          .eq('play_type', playType)
          .eq('number', paddedNumber);

        const currentTotal = currentBets?.reduce((sum, bet) => sum + parseFloat(bet.bet_amount), 0) || 0;
        const newTotal = currentTotal + parseFloat(betAmount);

        if (newTotal > parseFloat(globalLimit.global_limit)) {
          return {
            allowed: false,
            reason: `El número ${number} excede el límite global de $${globalLimit.global_limit}. Actual: $${currentTotal.toFixed(2)}`,
            limitType: 'global',
            currentAmount: currentTotal,
            limitAmount: globalLimit.global_limit
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error verificando límites:', error);
      return { allowed: true }; // Permitir en caso de error para no bloquear operaciones
    }
  };

  // Registrar nueva apuesta
  const registerBet = async (lotteryId, scheduleId, playType, number, betAmount, playerName) => {
    try {
      const paddedNumber = number.toString().padStart(3, '0');

      // Registrar en tracking
      const { error: trackingError } = await supabase
        .from('number_bets_tracking')
        .insert({
          id_loteria: lotteryId,
          id_horario: scheduleId,
          play_type: playType,
          number: paddedNumber,
          bet_amount: parseFloat(betAmount),
          player_name: playerName
        });

      if (trackingError) throw trackingError;

      // Actualizar límite específico si existe
      const { data: specificLimit } = await supabase
        .from('specific_number_limits')
        .select('*')
        .eq('id_loteria', lotteryId)
        .eq('id_horario', scheduleId)
        .eq('play_type', playType)
        .eq('number', paddedNumber)
        .single();

      if (specificLimit) {
        const newAmount = parseFloat(specificLimit.current_amount) + parseFloat(betAmount);
        const { error: updateError } = await supabase
          .from('specific_number_limits')
          .update({
            current_amount: newAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', specificLimit.id);

        if (updateError) throw updateError;
      }

      return { success: true };
    } catch (error) {
      console.error('Error registrando apuesta:', error);
      return { success: false, error: error.message };
    }
  };

  // Obtener resumen de límites
  const getLimitsSummary = async (lotteryId, scheduleId, playType) => {
    try {
      const { data: summary } = await supabase
        .from('specific_number_limits')
        .select('number, limit_amount, current_amount')
        .eq('id_loteria', lotteryId)
        .eq('id_horario', scheduleId)
        .eq('play_type', playType)
        .order('number');

      return summary || [];
    } catch (error) {
      console.error('Error obteniendo resumen:', error);
      return [];
    }
  };

  // Crear/actualizar límite global
  const saveGlobalLimit = async (lotteryId, scheduleId, playType, globalLimit) => {
    try {
      const { data, error } = await supabase
        .from('number_limits')
        .upsert({
          id_loteria: lotteryId,
          id_horario: scheduleId,
          play_type: playType,
          global_limit: parseFloat(globalLimit),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id_loteria,id_horario,play_type'
        });

      if (error) throw error;
      await loadGlobalLimits();
      return { success: true };
    } catch (error) {
      console.error('Error guardando límite global:', error);
      return { success: false, error: error.message };
    }
  };

  // Crear/actualizar límite específico
  const saveSpecificLimit = async (lotteryId, scheduleId, playType, number, limitAmount) => {
    try {
      const paddedNumber = number.toString().padStart(3, '0');
      
      const { error } = await supabase
        .from('specific_number_limits')
        .upsert({
          id_loteria: lotteryId,
          id_horario: scheduleId,
          play_type: playType,
          number: paddedNumber,
          limit_amount: parseFloat(limitAmount),
          current_amount: 0, // Solo actualizar si es nuevo
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id_loteria,id_horario,play_type,number',
          ignoreDuplicates: false
        });

      if (error) throw error;
      await loadSpecificLimits();
      return { success: true };
    } catch (error) {
      console.error('Error guardando límite específico:', error);
      return { success: false, error: error.message };
    }
  };

  // Eliminar límite específico
  const deleteSpecificLimit = async (limitId) => {
    try {
      const { error } = await supabase
        .from('specific_number_limits')
        .delete()
        .eq('id', limitId);

      if (error) throw error;
      await loadSpecificLimits();
      return { success: true };
    } catch (error) {
      console.error('Error eliminando límite:', error);
      return { success: false, error: error.message };
    }
  };

  // Resetear montos actuales (útil para nuevo sorteo)
  const resetCurrentAmounts = async (lotteryId, scheduleId, playType) => {
    try {
      const { error } = await supabase
        .from('specific_number_limits')
        .update({ current_amount: 0 })
        .eq('id_loteria', lotteryId)
        .eq('id_horario', scheduleId)
        .eq('play_type', playType);

      if (error) throw error;
      
      // También limpiar tracking histórico si se desea
      // await supabase.from('number_bets_tracking').delete()...
      
      await loadSpecificLimits();
      return { success: true };
    } catch (error) {
      console.error('Error reseteando montos:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    // Estados
    globalLimits,
    specificLimits,
    isLoading,
    error,
    
    // Funciones de carga
    loadGlobalLimits,
    loadSpecificLimits,
    
    // Funciones de verificación
    checkBetLimits,
    registerBet,
    getLimitsSummary,
    
    // Funciones de gestión
    saveGlobalLimit,
    saveSpecificLimit,
    deleteSpecificLimit,
    resetCurrentAmounts
  };
};
