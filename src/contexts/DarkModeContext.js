import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DarkModeContext = createContext();

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    // Fallback para desarrollo: devolver valores por defecto
    console.warn('useDarkMode debe ser usado dentro de DarkModeProvider. Usando valores por defecto.');
    return {
      isDarkMode: false,
      toggleDarkMode: () => console.warn('toggleDarkMode no disponible fuera del DarkModeProvider'),
      isLoading: false,
    };
  }
  return context;
};

export const DarkModeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar preferencia de modo oscuro al inicializar
  useEffect(() => {
    const loadDarkModePreference = async () => {
      try {
        const savedPreference = await AsyncStorage.getItem('isDarkMode');
        if (savedPreference !== null) {
          setIsDarkMode(JSON.parse(savedPreference));
        }
      } catch (error) {
        console.error('Error loading dark mode preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDarkModePreference();
  }, []);

  // Guardar preferencia cuando cambie el estado
  const toggleDarkMode = async () => {
    try {
      const newValue = !isDarkMode;
      setIsDarkMode(newValue);
      await AsyncStorage.setItem('isDarkMode', JSON.stringify(newValue));
    } catch (error) {
      console.error('Error saving dark mode preference:', error);
    }
  };

  const value = {
    isDarkMode,
    toggleDarkMode,
    isLoading,
  };

  return (
    <DarkModeContext.Provider value={value}>
      {children}
    </DarkModeContext.Provider>
  );
};

export default DarkModeContext;
