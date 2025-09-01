import { useState, useCallback } from 'react';
import { useCache } from '../contexts/CacheContext';

export const usePullToRefresh = (dataType) => {
  const [refreshing, setRefreshing] = useState(false);
  
  // Obtener el contexto de cache de forma segura
  const cacheContext = useCache();
  const { updateCacheData } = cacheContext;
  
  const onRefresh = useCallback(async () => {
    if (!updateCacheData) {
      console.log('Pull to refresh not available without cache context');
      return;
    }
    
    setRefreshing(true);
    try {
      await updateCacheData(dataType);
    } catch (error) {
      console.error(`Error refreshing ${dataType}:`, error);
    } finally {
      setRefreshing(false);
    }
  }, [dataType, updateCacheData]);

  return { refreshing, onRefresh };
};
