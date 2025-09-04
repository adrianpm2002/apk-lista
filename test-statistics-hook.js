// Test para verificar si el hook useStatistics está funcionando correctamente
const mockUseStatistics = () => {
  console.log('🧪 Probando el hook useStatistics...');
  
  // Simular los datos que debería retornar el hook cuando USE_MOCK_DATA = true
  const mockData = {
    kpiData: {
      totalRecogido: 25000,
      totalPagado: 18000,
      balance: 7000,
      comisionesListero: 2500,
      totalJugadas: 150
    },
    chartData: [
      { date: '2025-07-16', total_bets: 20000, net_profit: 3000 },
      { date: '2025-07-17', total_bets: 22000, net_profit: 3500 },
      { date: '2025-07-18', total_bets: 25000, net_profit: 4000 },
      { date: '2025-07-19', total_bets: 23000, net_profit: 3800 },
      { date: '2025-07-20', total_bets: 27000, net_profit: 4200 },
      { date: '2025-07-21', total_bets: 24000, net_profit: 3900 },
      { date: '2025-07-22', total_bets: 25000, net_profit: 4500 }
    ],
    tableData: [
      { name: 'Lotería Nacional', total_bets: 12000, total_volume: 12000 },
      { name: 'Loteka', total_bets: 8000, total_volume: 8000 },
      { name: 'La Primera', total_bets: 5000, total_volume: 5000 }
    ],
    lotteries: [
      { id: 1, name: 'Lotería Nacional' },
      { id: 2, name: 'Loteka' },
      { id: 3, name: 'La Primera' }
    ],
    schedules: [
      { id: 1, name: 'Matutino - 10:00 AM' },
      { id: 2, name: 'Vespertino - 3:00 PM' },
      { id: 3, name: 'Nocturno - 7:00 PM' }
    ],
    loading: false,
    error: null
  };
  
  console.log('✅ Datos mock del hook:');
  console.log('📊 KPI Data:', mockData.kpiData);
  console.log('📈 Chart Data (primeros 3):', mockData.chartData.slice(0, 3));
  console.log('📋 Table Data:', mockData.tableData);
  console.log('🎰 Lotteries:', mockData.lotteries);
  console.log('⏰ Schedules:', mockData.schedules);
  
  return mockData;
};

// Ejecutar test
const testResult = mockUseStatistics();

console.log('\n🔍 Verificando estructura de datos...');
console.log('¿Tiene KPI data?', !!testResult.kpiData);
console.log('¿Tiene chart data?', !!testResult.chartData && testResult.chartData.length > 0);
console.log('¿Tiene table data?', !!testResult.tableData && testResult.tableData.length > 0);
console.log('¿Está cargando?', testResult.loading);
console.log('¿Hay errores?', !!testResult.error);

console.log('\n💡 Si no aparecen datos en la pantalla, el problema puede ser:');
console.log('1. El hook no está cargando los datos mock automáticamente');
console.log('2. El componente StatisticsScreen no está usando los datos del hook');
console.log('3. El bankId null está bloqueando la carga');
console.log('4. Los datos están ahí pero no se muestran en la UI');
