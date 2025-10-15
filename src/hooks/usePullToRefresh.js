import { useState, useCallback } from 'react';

export const usePullToRefresh = (onRefreshCallback) => {
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = useCallback(async () => {
    if (!onRefreshCallback) {
      return;
    }
    
    setRefreshing(true);
    try {
      await onRefreshCallback();
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [onRefreshCallback]);

  return { refreshing, onRefresh };
};

