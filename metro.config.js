// Configuración de Metro para Expo SDK 52 con ofuscación
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configuración para builds de producción
if (process.env.NODE_ENV === 'production') {
  // Habilitar minificación y ofuscación
  config.transformer = {
    ...config.transformer,
    minifierConfig: {
      mangle: {
        keep_fnames: false, // Ofuscar nombres de funciones
        keep_classnames: false, // Ofuscar nombres de clases
      },
      compress: {
        drop_console: true, // Eliminar console.log en producción
        drop_debugger: true, // Eliminar debugger statements
      },
    },
  };
}

module.exports = config;
