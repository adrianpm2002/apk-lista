// Configuración adicional para forzar JSC en lugar de Hermes
process.env.EXPO_USE_HERMES = 'false';
process.env.HERMES_ENABLED = 'false';
process.env.RN_ENABLE_NEW_ARCHITECTURE = 'false';

module.exports = {};
