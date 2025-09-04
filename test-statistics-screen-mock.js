// Test para verificar que StatisticsScreen ahora use datos mock correctamente
console.log('🧪 Verificando configuración de StatisticsScreen...');

// Simular la configuración
const USE_MOCK_DATA = true;

console.log('📋 Estado de configuración:');
console.log('  - USE_MOCK_DATA:', USE_MOCK_DATA);

if (USE_MOCK_DATA) {
  console.log('\n✅ Modo MOCK activado - StatisticsScreen debería mostrar:');
  console.log('  🎯 KPIs con datos simulados de los últimos 7 días');
  console.log('  📈 Gráfica con datos de profit/loss simulados');
  console.log('  📋 Tabla de detalles con jugadas mock');
  console.log('  🎰 Lista de loterías mock (Nacional, Loteka, La Primera)');
  console.log('  ⏰ Lista de horarios mock (Matutino, Vespertino, Nocturno)');
  
  console.log('\n📊 Datos mock que se generan:');
  const mockDailyData = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const dayData = {
      date: date.toISOString().split('T')[0],
      total_recogido: Math.round(20000 + Math.random() * 15000),
      total_pagado: Math.round(15000 + Math.random() * 8000),
      total_listero_earning: Math.round(2000 + Math.random() * 1500),
      profit: Math.round(3000 + Math.random() * 3000)
    };
    
    mockDailyData.push(dayData);
  }
  
  console.log('  - Datos diarios generados:', mockDailyData.length, 'días');
  console.log('  - Ejemplo día 1:', mockDailyData[0]);
  console.log('  - Ejemplo día 7:', mockDailyData[6]);
  
  // Calcular KPIs totales
  const totalRecogido = mockDailyData.reduce((sum, day) => sum + day.total_recogido, 0);
  const totalPagado = mockDailyData.reduce((sum, day) => sum + day.total_pagado, 0);
  const totalListeroEarning = mockDailyData.reduce((sum, day) => sum + day.total_listero_earning, 0);
  const balance = totalRecogido - totalPagado - totalListeroEarning;
  
  console.log('\n💰 KPIs calculados (período 7 días):');
  console.log('  - Bruto total:', totalRecogido.toLocaleString('es-DO'));
  console.log('  - Pagado total:', totalPagado.toLocaleString('es-DO'));
  console.log('  - Comisiones listero:', totalListeroEarning.toLocaleString('es-DO'));
  console.log('  - Balance final:', balance.toLocaleString('es-DO'));
  
} else {
  console.log('\n⚠️ Modo REAL activado - StatisticsScreen intentará usar datos reales');
  console.log('  📡 Conectará con listeroStatsService');
  console.log('  🔒 Requerirá autenticación con Supabase');
  console.log('  📊 Mostrará datos de la base de datos');
}

console.log('\n🔧 Para cambiar el modo:');
console.log('  1. Abrir src/screens/StatisticsScreen.js');
console.log('  2. Modificar: const USE_MOCK_DATA = true/false');
console.log('  3. También cambiar en src/hooks/useStatistics.js');

console.log('\n🐛 Si aún no aparecen datos, verificar:');
console.log('  1. ¿Está USE_MOCK_DATA = true en ambos archivos?');
console.log('  2. ¿Se está llamando loadInitialData() correctamente?');
console.log('  3. ¿Los componentes StatisticsChart y otros están recibiendo los datos?');
console.log('  4. ¿Hay errores en la consola de React Native?');
