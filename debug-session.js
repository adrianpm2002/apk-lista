/**
 * Script de debugging para verificar el estado de la sesión persistente
 * Ejecutar en la consola del navegador web
 */

// Función para verificar AsyncStorage en web
async function checkStorageState() {
  try {
    console.log('=== Estado de Almacenamiento ===');
    
    // Verificar AsyncStorage
    const persistentSession = await AsyncStorage.getItem('PERSISTENT_SESSION');
    const refreshToken = await AsyncStorage.getItem('REFRESH_TOKEN');
    const userSession = await AsyncStorage.getItem('USER_SESSION');
    
    console.log('Sesión persistente:', persistentSession);
    console.log('Refresh token:', refreshToken ? 'Presente' : 'No presente');
    console.log('Datos de usuario:', userSession);
    
    return {
      persistentSession: persistentSession ? JSON.parse(persistentSession) : false,
      hasRefreshToken: !!refreshToken,
      userSession: userSession ? JSON.parse(userSession) : null,
      refreshToken: refreshToken ? refreshToken.substring(0, 20) + '...' : null
    };
  } catch (error) {
    console.error('Error al verificar almacenamiento:', error);
    return null;
  }
}

// Función para verificar sesión de Supabase
async function checkSupabaseSession() {
  try {
    console.log('=== Estado de Supabase ===');
    
    const { data: { session }, error } = await supabase.auth.getSession();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    console.log('Sesión de Supabase:', session);
    console.log('Usuario de Supabase:', user);
    console.log('Error de sesión:', error);
    console.log('Error de usuario:', userError);
    
    return {
      hasSession: !!session,
      hasUser: !!user,
      sessionError: error,
      userError: userError
    };
  } catch (error) {
    console.error('Error al verificar Supabase:', error);
    return null;
  }
}

// Función principal de debugging
async function debugSessionState() {
  console.log('🔍 DEBUGGING SESIÓN PERSISTENTE 🔍');
  console.log('=====================================');
  
  const storageState = await checkStorageState();
  const supabaseState = await checkSupabaseSession();
  
  console.log('=== RESUMEN ===');
  console.log('Almacenamiento:', storageState);
  console.log('Supabase:', supabaseState);
  
  // Recomendaciones
  if (storageState?.persistentSession && storageState?.hasRefreshToken && !supabaseState?.hasSession) {
    console.log('⚠️ PROBLEMA: Sesión persistente habilitada con token pero sin sesión activa');
    console.log('💡 SUGERENCIA: Intentar restaurar sesión manualmente');
  } else if (!storageState?.persistentSession) {
    console.log('ℹ️ INFO: Sesión persistente deshabilitada');
  } else if (storageState?.persistentSession && supabaseState?.hasSession) {
    console.log('✅ OK: Sesión persistente funcionando correctamente');
  }
  
  return {
    storage: storageState,
    supabase: supabaseState
  };
}

// Función para limpiar datos de prueba
async function clearSessionData() {
  try {
    console.log('🧹 Limpiando datos de sesión...');
    await AsyncStorage.multiRemove(['PERSISTENT_SESSION', 'REFRESH_TOKEN', 'USER_SESSION']);
    await supabase.auth.signOut();
    console.log('✅ Datos limpiados');
  } catch (error) {
    console.error('❌ Error al limpiar datos:', error);
  }
}

// Función para probar login y persistencia
async function testLoginWithPersistence() {
  try {
    console.log('🧪 Probando login con persistencia...');
    
    // Habilitar sesión persistente
    await AsyncStorage.setItem('PERSISTENT_SESSION', JSON.stringify(true));
    
    // Intentar login (reemplazar con credenciales reales)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    if (error) {
      console.error('❌ Error en login:', error);
      return false;
    }
    
    // Guardar refresh token
    if (data.session?.refresh_token) {
      await AsyncStorage.setItem('REFRESH_TOKEN', data.session.refresh_token);
      console.log('✅ Login exitoso y token guardado');
      return true;
    }
    
    console.log('⚠️ Login exitoso pero sin refresh token');
    return false;
  } catch (error) {
    console.error('❌ Error en test de login:', error);
    return false;
  }
}

// Exportar funciones para uso en consola
window.debugSession = {
  check: debugSessionState,
  clear: clearSessionData,
  testLogin: testLoginWithPersistence,
  storage: checkStorageState,
  supabase: checkSupabaseSession
};

console.log('🛠️ Herramientas de debugging cargadas!');
console.log('📋 Comandos disponibles:');
console.log('  debugSession.check() - Verificar estado completo');
console.log('  debugSession.clear() - Limpiar todos los datos');
console.log('  debugSession.testLogin() - Probar login con persistencia');
console.log('  debugSession.storage() - Solo verificar almacenamiento');
console.log('  debugSession.supabase() - Solo verificar Supabase');

export default window.debugSession;
