import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Utilidad para debuggear AsyncStorage en Android
 */
export const debugAsyncStorage = {
  /**
   * Prueba básica de escritura y lectura
   */
  async basicTest() {

    
    try {
      // Test de escritura
      const testKey = '@debug_test_key';
      const testValue = JSON.stringify({
        timestamp: new Date().toISOString(),
        platform: 'android',
        message: 'Test de AsyncStorage'
      });
      
      console.log('📝 Escribiendo valor de prueba...');
      await AsyncStorage.setItem(testKey, testValue);
      console.log('✅ Escritura exitosa');
      
      // Test de lectura
      console.log('📖 Leyendo valor de prueba...');
      const retrievedValue = await AsyncStorage.getItem(testKey);
      console.log('📋 Valor leído:', retrievedValue);
      
      if (retrievedValue === testValue) {
        console.log('✅ AsyncStorage funciona correctamente');
        return true;
      } else {
        console.log('❌ Los valores no coinciden');
        console.log('Esperado:', testValue);
        console.log('Obtenido:', retrievedValue);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error en test de AsyncStorage:', error);
      console.error('Stack trace:', error.stack);
      return false;
    }
  },

  /**
   * Test de las claves usadas por la app
   */
  async testAppKeys() {
    console.log('=== TESTING CLAVES DE LA APP ===');
    
    const appKeys = [
      'app_refresh_token',
      'app_user_session', 
      'app_persistent_session_enabled',
      'visibleModes'
    ];
    
    try {
      for (const key of appKeys) {
        console.log(`🔍 Verificando clave: ${key}`);
        const value = await AsyncStorage.getItem(key);
        console.log(`📋 Valor: ${value ? 'EXISTE' : 'NO EXISTE'}`);
        if (value) {
          console.log(`📄 Contenido: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
        }
      }
    } catch (error) {
      console.error('❌ Error verificando claves:', error);
    }
  },

  /**
   * Limpia todas las claves de debug
   */
  async cleanup() {
    try {
      await AsyncStorage.removeItem('@debug_test_key');
      console.log('🧹 Limpieza de debug completada');
    } catch (error) {
      console.error('❌ Error en limpieza:', error);
    }
  },

  /**
   * Test completo con reporte
   */
  async fullDiagnostic() {
    console.log('🔍 INICIANDO DIAGNÓSTICO COMPLETO DE ASYNC STORAGE');
    console.log('================================================');
    
    // Test básico
    const basicWorks = await this.basicTest();
    
    // Test de claves de la app
    await this.testAppKeys();
    
    // Limpieza
    await this.cleanup();
    
    console.log('================================================');
    console.log(`📊 RESULTADO: AsyncStorage ${basicWorks ? 'FUNCIONA' : 'TIENE PROBLEMAS'}`);
    console.log('================================================');
    
    return basicWorks;
  }
};

// Auto-ejecutar en desarrollo si se importa directamente
if (__DEV__) {
  // Ejecutar diagnóstico automáticamente después de 2 segundos
  setTimeout(() => {
    debugAsyncStorage.fullDiagnostic();
  }, 2000);
}
