import { useState, useEffect } from "react";
import { offlineCacheService } from "../services/offlineCache";

/**
 * Hook to manage offline cache state
 */
export function useOfflineCache() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(
    offlineCacheService.getPendingCount(),
  );
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncCache();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check pending count periodically
    const interval = setInterval(() => {
      setPendingCount(offlineCacheService.getPendingCount());
    }, 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  const syncCache = async () => {
    setIsSyncing(true);
    try {
      await offlineCacheService.syncCachedRequests();
      setPendingCount(offlineCacheService.getPendingCount());
    } finally {
      setIsSyncing(false);
    }
  };

  const clearCache = () => {
    offlineCacheService.clearCache();
    setPendingCount(0);
  };

  return {
    isOnline,
    pendingCount,
    isSyncing,
    syncCache,
    clearCache,
    cacheService: offlineCacheService,
  };
}
