import { Platform } from 'react-native';
import { useWebDarkMode, WebDarkModeProvider } from './WebDarkModeContext';
import { useNativeDarkMode, NativeDarkModeProvider } from './NativeDarkModeContext';

// Exportar el contexto correcto según la plataforma
export const useDarkMode = Platform.OS === 'web' ? useWebDarkMode : useNativeDarkMode;
export const DarkModeProvider = Platform.OS === 'web' ? WebDarkModeProvider : NativeDarkModeProvider;
