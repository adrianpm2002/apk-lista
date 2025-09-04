// Test para verificar el servicio listeroStatsService
const testListeroStatsService = async () => {
  console.log('🧪 Probando el servicio listeroStatsService...');
  
  try {
    // Simular datos de entrada
    const mockUserId = 'test-user-id';
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const options = {
      from: sevenDaysAgo,
      to: today,
      lotteryId: null,
      scheduleId: null,
      includeToday: true,
      onlyClosedToday: false
    };
    
    console.log('📋 Parámetros de prueba:');
    console.log('  - Usuario ID:', mockUserId);
    console.log('  - Desde:', sevenDaysAgo.toISOString().split('T')[0]);
    console.log('  - Hasta:', today.toISOString().split('T')[0]);
    console.log('  - Opciones:', options);
    
    // Importar el servicio
    const { getDailyStats, getPlaysDetails, getTotalRecogidoHistorico, getTotalPagadoHistorico } = require('./src/services/listeroStatsService');
    
    console.log('\n🔄 Llamando a getDailyStats...');
    const dailyStats = await getDailyStats(mockUserId, options);
    
    console.log('✅ Resultado de getDailyStats:');
    console.log('  - Tipo:', typeof dailyStats);
    console.log('  - Es array:', Array.isArray(dailyStats));
    console.log('  - Longitud:', dailyStats?.length || 0);
    console.log('  - Primeros 2 elementos:', dailyStats?.slice(0, 2) || []);
    
    if (!dailyStats || dailyStats.length === 0) {
      console.log('❌ getDailyStats retornó un array vacío');
      console.log('💡 Posibles causas:');
      console.log('  1. Usuario no autenticado');
      console.log('  2. No hay datos en la base de datos');
      console.log('  3. Error en la consulta SQL');
      console.log('  4. Filtros muy restrictivos');
    } else {
      console.log('✅ getDailyStats retornó datos');
      
      // Verificar estructura de datos
      const firstItem = dailyStats[0];
      console.log('\n📊 Estructura del primer elemento:');
      console.log('  - Keys:', Object.keys(firstItem || {}));
      console.log('  - total_recogido:', firstItem?.total_recogido);
      console.log('  - total_pagado:', firstItem?.total_pagado);
      console.log('  - total_listero_earning:', firstItem?.total_listero_earning);
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando el test:', error.message);
    console.log('\n💡 Esto indica que el servicio no está funcionando');
    console.log('   El problema puede ser:');
    console.log('   1. Error de importación del servicio');
    console.log('   2. Error de autenticación con Supabase'); 
    console.log('   3. Error en la consulta a la base de datos');
    console.log('   4. Servicio no implementado correctamente');
  }
};

// Ejecutar test
testListeroStatsService();
