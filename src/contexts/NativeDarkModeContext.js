import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';

const NativeDarkModeContext = createContext();

export const useNativeDarkMode = () => {
  const context = useContext(NativeDarkModeContext);
  if (!context) {
    throw new Error('useNativeDarkMode debe usarse dentro de NativeDarkModeProvider');
  }
  return context;
};

export const NativeDarkModeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Configurar el valor inicial desde el sistema
    setIsDarkMode(Appearance.getColorScheme() === 'dark');

    // Escuchar cambios del sistema
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setIsDarkMode(colorScheme === 'dark');
    });

    return () => subscription?.remove();
  }, []);

  // Función vacía para mantener compatibilidad con componentes existentes
  const toggleDarkMode = () => {
    // No hace nada - el modo oscuro lo controla el sistema
  };

  return (
    <NativeDarkModeContext.Provider 
      value={{ 
        isDarkMode,
        toggleDarkMode
      }}
    >
      {children}
    </NativeDarkModeContext.Provider>
  );
};
