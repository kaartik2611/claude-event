import { useOfflineCache } from '../../hooks/useOfflineCache';
import { WifiOff, Wifi, CloudOff, RefreshCw } from 'lucide-react';

export default function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing, syncCache } = useOfflineCache();

  if (isOnline && pendingCount === 0) {
    return null; // Hide when online with no pending requests
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOnline ? (
        <div className="bg-red-500/90 backdrop-blur text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-pulse">
          <WifiOff className="w-5 h-5" />
          <div className="flex flex-col">
            <span className="font-semibold text-sm">No Internet Connection</span>
            <span className="text-xs opacity-90">Requests will be cached and synced when online</span>
          </div>
          {pendingCount > 0 && (
            <div className="ml-2 bg-red-700 text-white text-xs font-bold px-2 py-1 rounded-full">
              {pendingCount}
            </div>
          )}
        </div>
      ) : pendingCount > 0 ? (
        <div className="bg-amber-500/90 backdrop-blur text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
          {isSyncing ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <div className="flex flex-col">
                <span className="font-semibold text-sm">Syncing Cached Requests...</span>
                <span className="text-xs opacity-90">{pendingCount} requests pending</span>
              </div>
            </>
          ) : (
            <>
              <CloudOff className="w-5 h-5" />
              <div className="flex flex-col">
                <span className="font-semibold text-sm">Pending Sync</span>
                <span className="text-xs opacity-90">{pendingCount} cached requests</span>
              </div>
              <button
                onClick={syncCache}
                className="ml-2 bg-white text-amber-600 text-xs font-semibold px-3 py-1 rounded-lg hover:bg-amber-50 transition"
              >
                Sync Now
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
