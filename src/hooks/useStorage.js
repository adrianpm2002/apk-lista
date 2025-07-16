import { useState, useEffect } from 'react';
import { SavedPlaysStorage, AppSettingsStorage } from '../utils/storage';

// Hook para manejar las jugadas guardadas
export const useSavedPlays = () => {
  const [plays, setPlays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar jugadas al inicializar
  const loadPlays = async () => {
    try {
      setIsLoading(true);
      setError(null);
      let savedPlays = await SavedPlaysStorage.getAll();
      
      // Si no hay datos, inicializar con datos de prueba
      if (savedPlays.length === 0) {
        console.log('Inicializando con datos de prueba...');
        savedPlays = await SavedPlaysStorage.initializeWithMockData();
      }
      
      // Convertir timestamps de string a Date si es necesario
      const playsWithDates = savedPlays.map(play => ({
        ...play,
        timestamp: new Date(play.timestamp)
      }));
      
      setPlays(playsWithDates.sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
      console.error('Error al cargar jugadas:', err);
      setError('No se pudieron cargar las jugadas');
    } finally {
      setIsLoading(false);
    }
  };

  // Agregar nueva jugada
  const addPlay = async (playData) => {
    try {
      const newPlay = await SavedPlaysStorage.save(playData);
      setPlays(prev => [{ ...newPlay, timestamp: new Date(newPlay.timestamp) }, ...prev]);
      return newPlay;
    } catch (err) {
      console.error('Error al guardar jugada:', err);
      throw new Error('No se pudo guardar la jugada');
    }
  };

  // Actualizar jugada existente
  const updatePlay = async (playId, updatedData) => {
    try {
      const updatedPlay = await SavedPlaysStorage.update(playId, updatedData);
      setPlays(prev => 
        prev.map(play => 
          play.id === playId 
            ? { ...updatedPlay, timestamp: new Date(updatedPlay.timestamp) }
            : play
        )
      );
      return updatedPlay;
    } catch (err) {
      console.error('Error al actualizar jugada:', err);
      throw new Error('No se pudo actualizar la jugada');
    }
  };

  // Eliminar jugada
  const deletePlay = async (playId) => {
    try {
      await SavedPlaysStorage.delete(playId);
      setPlays(prev => prev.filter(play => play.id !== playId));
    } catch (err) {
      console.error('Error al eliminar jugada:', err);
      throw new Error('No se pudo eliminar la jugada');
    }
  };

  // Eliminar múltiples jugadas
  const deleteMultiplePlays = async (playIds) => {
    try {
      await SavedPlaysStorage.deleteMultiple(playIds);
      setPlays(prev => prev.filter(play => !playIds.includes(play.id)));
    } catch (err) {
      console.error('Error al eliminar jugadas:', err);
      throw new Error('No se pudieron eliminar las jugadas');
    }
  };

  // Recargar jugadas
  const reloadPlays = () => {
    loadPlays();
  };

  useEffect(() => {
    loadPlays();
  }, []);

  return {
    plays,
    isLoading,
    error,
    addPlay,
    updatePlay,
    deletePlay,
    deleteMultiplePlays,
    reloadPlays
  };
};

// Hook para manejar configuraciones de la app
export const useAppSettings = () => {
  const [settings, setSettings] = useState({
    isDarkMode: false,
    visibleModes: { visual: true, text: true },
    defaultLottery: 'Georgia',
    defaultSchedule: 'mediodia'
  });
  const [isLoading, setIsLoading] = useState(true);

  // Cargar configuraciones
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const savedSettings = await AppSettingsStorage.get();
      setSettings(savedSettings);
    } catch (error) {
      console.error('Error al cargar configuraciones:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Actualizar configuraciones
  const updateSettings = async (newSettings) => {
    try {
      const updatedSettings = await AppSettingsStorage.update(newSettings);
      setSettings(updatedSettings);
      return updatedSettings;
    } catch (error) {
      console.error('Error al actualizar configuraciones:', error);
      throw new Error('No se pudieron guardar las configuraciones');
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    settings,
    isLoading,
    updateSettings,
    reloadSettings: loadSettings
  };
};

export default {
  useSavedPlays,
  useAppSettings
};
