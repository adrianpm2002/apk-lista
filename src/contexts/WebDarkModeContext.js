import React, { createContext, useContext } from 'react';

const WebDarkModeContext = createContext();

export const useWebDarkMode = () => {
  const context = useContext(WebDarkModeContext);
  if (!context) {
    throw new Error('useWebDarkMode debe usarse dentro de WebDarkModeProvider');
  }
  return context;
};

export const WebDarkModeProvider = ({ children }) => {
  // Para web, siempre modo claro (sin modo oscuro)
  const toggleDarkMode = () => {
    // No hace nada en web
  };

  return (
    <WebDarkModeContext.Provider 
      value={{ 
        isDarkMode: false, // Siempre modo claro en web
        toggleDarkMode
      }}
    >
      {children}
    </WebDarkModeContext.Provider>
  );
};
