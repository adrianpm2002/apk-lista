import React, { createContext, useContext } from 'react';
import { useAppStateManager } from '../hooks/useAppStateManager';

const AppStateContext = createContext({});

export const AppStateProvider = ({ children }) => {
  const appStateData = useAppStateManager();

  return (
    <AppStateContext.Provider value={appStateData}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState debe ser usado dentro de AppStateProvider');
  }
  return context;
};

export default AppStateProvider;