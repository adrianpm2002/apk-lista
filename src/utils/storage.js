import AsyncStorage from '@react-native-async-storage/async-storage';

// Claves para el almacenamiento
const STORAGE_KEYS = {
  SAVED_PLAYS: 'saved_plays',
  APP_SETTINGS: 'app_settings',
  USER_PREFERENCES: 'user_preferences'
};

// Funciones para manejar jugadas guardadas
export const SavedPlaysStorage = {
  // Obtener todas las jugadas guardadas
  async getAll() {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PLAYS);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('Error al obtener jugadas guardadas:', error);
      return [];
    }
  },

  // Guardar una nueva jugada
  async save(play) {
    try {
      const existingPlays = await this.getAll();
      const newPlay = {
        ...play,
        id: Date.now(), // ID único basado en timestamp
        timestamp: new Date(),
      };
      const updatedPlays = [newPlay, ...existingPlays];
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PLAYS, JSON.stringify(updatedPlays));
      return newPlay;
    } catch (error) {
      console.error('Error al guardar jugada:', error);
      throw error;
    }
  },

  // Actualizar una jugada existente
  async update(playId, updatedData) {
    try {
      const existingPlays = await this.getAll();
      const updatedPlays = existingPlays.map(play => 
        play.id === playId ? { ...play, ...updatedData } : play
      );
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PLAYS, JSON.stringify(updatedPlays));
      return updatedPlays.find(play => play.id === playId);
    } catch (error) {
      console.error('Error al actualizar jugada:', error);
      throw error;
    }
  },

  // Eliminar una jugada
  async delete(playId) {
    try {
      console.log('Storage.delete - Eliminando ID:', playId, 'Tipo:', typeof playId);
      const existingPlays = await this.getAll();
      console.log('Storage.delete - Jugadas existentes:', existingPlays.length);
      console.log('Storage.delete - IDs existentes:', existingPlays.map(p => ({ id: p.id, type: typeof p.id })));
      
      const updatedPlays = existingPlays.filter(play => play.id !== playId);
      console.log('Storage.delete - Jugadas después del filtro:', updatedPlays.length);
      
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PLAYS, JSON.stringify(updatedPlays));
      console.log('Storage.delete - Eliminación completada');
      return true;
    } catch (error) {
      console.error('Error al eliminar jugada:', error);
      throw error;
    }
  },

  // Eliminar múltiples jugadas
  async deleteMultiple(playIds) {
    try {
      console.log('Storage.deleteMultiple - Eliminando IDs:', playIds);
      const existingPlays = await this.getAll();
      console.log('Storage.deleteMultiple - Jugadas existentes:', existingPlays.length);
      console.log('Storage.deleteMultiple - IDs existentes:', existingPlays.map(p => p.id));
      
      const updatedPlays = existingPlays.filter(play => !playIds.includes(play.id));
      console.log('Storage.deleteMultiple - Jugadas después del filtro:', updatedPlays.length);
      
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PLAYS, JSON.stringify(updatedPlays));
      console.log('Storage.deleteMultiple - Eliminación múltiple completada');
      return true;
    } catch (error) {
      console.error('Error al eliminar jugadas múltiples:', error);
      throw error;
    }
  },

  // Limpiar todas las jugadas (útil para testing)
  async clear() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SAVED_PLAYS);
      return true;
    } catch (error) {
      console.error('Error al limpiar jugadas:', error);
      throw error;
    }
  },

  // Inicializar con datos de prueba
  async initializeWithMockData() {
    try {
      const mockData = [
        {
          id: 1,
          lottery: 'Georgia',
          schedule: 'mediodia',
          playType: 'fijo',
          numbers: '12, 34, 56, 78, 90',
          amount: 100,
          total: 500,
          note: 'María González',
          timestamp: new Date('2025-01-13T12:00:00'),
          result: '12',
          prize: 5000,
          hasPrize: true
        },
        {
          id: 2,
          lottery: 'Florida',
          schedule: 'noche',
          playType: 'corrido',
          numbers: '01, 23, 45, 67, 89, 12, 34, 56, 78, 90, 11, 22, 33, 44, 55, 66, 77, 88, 99, 00, 13, 24, 35, 46, 57',
          amount: 50,
          total: 1250,
          note: 'Carlos Rodríguez',
          timestamp: new Date('2025-01-13T18:00:00'),
          result: 'no disponible',
          prize: 'desconocido',
          hasPrize: false
        },
        {
          id: 3,
          lottery: 'New York',
          schedule: 'mediodia',
          playType: 'parle',
          numbers: '23, 45, 67, 89',
          amount: 75,
          total: 300,
          note: 'Ana Martínez',
          timestamp: new Date('2025-01-12T12:30:00'),
          result: '23',
          prize: 3750,
          hasPrize: true
        },
        {
          id: 4,
          lottery: 'Georgia',
          schedule: 'noche',
          playType: 'centena',
          numbers: '123, 456, 789, 012, 345, 678, 901, 234, 567, 890',
          amount: 25,
          total: 250,
          note: 'José Pérez',
          timestamp: new Date('2025-01-12T19:15:00'),
          result: 'no disponible',
          prize: 'desconocido',
          hasPrize: false
        },
        {
          id: 5,
          lottery: 'Florida',
          schedule: 'mediodia',
          playType: 'fijo',
          numbers: '01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30',
          amount: 20,
          total: 600,
          note: 'Familia Hernández',
          timestamp: new Date('2025-01-11T12:45:00'),
          result: '15',
          prize: 1200,
          hasPrize: true
        },
        {
          id: 6,
          lottery: 'New York',
          schedule: 'noche',
          playType: 'corrido',
          numbers: '12, 34, 56, 78, 90, 01, 23, 45, 67, 89, 11, 33, 55, 77, 99',
          amount: 40,
          total: 600,
          note: 'Pedro Sánchez',
          timestamp: new Date('2025-01-11T20:30:00'),
          result: 'no disponible',
          prize: 'desconocido',
          hasPrize: false
        },
        {
          id: 7,
          lottery: 'Georgia',
          schedule: 'mediodia',
          playType: 'parle',
          numbers: '07, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 91, 98',
          amount: 30,
          total: 420,
          note: 'Luisa Morales',
          timestamp: new Date('2025-01-10T13:15:00'),
          result: '07',
          prize: 2100,
          hasPrize: true
        }
      ];

      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PLAYS, JSON.stringify(mockData));
      return mockData;
    } catch (error) {
      console.error('Error al inicializar datos de prueba:', error);
      throw error;
    }
  }
};

// Funciones para configuraciones de la app
export const AppSettingsStorage = {
  async get() {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
      return jsonValue != null ? JSON.parse(jsonValue) : {
        isDarkMode: false,
        visibleModes: { visual: true, text: true },
        defaultLottery: 'Georgia',
        defaultSchedule: 'mediodia'
      };
    } catch (error) {
      console.error('Error al obtener configuraciones:', error);
      return {};
    }
  },

  async update(settings) {
    try {
      const currentSettings = await this.get();
      const updatedSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(updatedSettings));
      return updatedSettings;
    } catch (error) {
      console.error('Error al actualizar configuraciones:', error);
      throw error;
    }
  }
};

// Funciones para preferencias del usuario
export const UserPreferencesStorage = {
  async get() {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      return jsonValue != null ? JSON.parse(jsonValue) : {
        notifications: true,
        autoSave: true,
        showTutorial: true
      };
    } catch (error) {
      console.error('Error al obtener preferencias:', error);
      return {};
    }
  },

  async update(preferences) {
    try {
      const currentPreferences = await this.get();
      const updatedPreferences = { ...currentPreferences, ...preferences };
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(updatedPreferences));
      return updatedPreferences;
    } catch (error) {
      console.error('Error al actualizar preferencias:', error);
      throw error;
    }
  }
};

export default {
  SavedPlaysStorage,
  AppSettingsStorage,
  UserPreferencesStorage
};
