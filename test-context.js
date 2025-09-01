// Test simple para verificar que las funciones estén exportadas del CacheContext
import { useCache } from './src/contexts/CacheContext';

// Esta función simula el destructuring que hacen las pantallas
function testCacheContextExports() {
  // Simulamos lo que hace InsertResultsScreen
  const { 
    cache, 
    userRole, 
    currentBankId, 
    updateCacheData, 
    fetchTodayResults, 
    fetchLotteries, 
    fetchSchedules 
  } = useCache();

  console.log('Funciones disponibles:');
  console.log('fetchTodayResults:', typeof fetchTodayResults);
  console.log('fetchLotteries:', typeof fetchLotteries);
  console.log('fetchSchedules:', typeof fetchSchedules);
  console.log('updateCacheData:', typeof updateCacheData);

  return {
    fetchTodayResults,
    fetchLotteries,
    fetchSchedules,
    updateCacheData
  };
}

export default testCacheContextExports;
