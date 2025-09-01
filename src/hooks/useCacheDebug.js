import { useEffect } from 'react';
import { useCache } from '../contexts/CacheContext';

export const useCacheDebug = (screenName) => {
  const { cache, userRole, currentBankId } = useCache();
  
  useEffect(() => {
    if (__DEV__) {
      console.log(`[CacheDebug - ${screenName}] Context state:`, {
        userRole,
        currentBankId,
        cacheKeys: Object.keys(cache),
        isLoading: cache.isLoading,
        statisticsAvailable: !!cache.statistics,
        resultsCount: Array.isArray(cache.todayResults) ? cache.todayResults.length : 'N/A',
        usersCount: Array.isArray(cache.users) ? cache.users.length : 'N/A',
        lotteriesCount: Array.isArray(cache.lotteries) ? cache.lotteries.length : 'N/A',
        pricesAvailable: !!cache.prices,
        limitsAvailable: !!cache.numberLimits,
      });
    }
  }, [screenName, cache, userRole, currentBankId]);
  
  return {
    debugInfo: {
      screenName,
      userRole,
      currentBankId,
      cacheState: cache,
    },
    logCacheState: () => {
      if (__DEV__) {
        console.log(`[CacheDebug - ${screenName}] Manual log:`, {
          cache,
          userRole,
          currentBankId,
        });
      }
    }
  };
};
