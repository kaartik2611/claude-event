import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const PWAUpdatePrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <div className="bg-white rounded-lg shadow-lg border-2 border-orange-500 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {offlineReady ? (
              <div>
                <p className="font-semibold text-gray-900">App ready to work offline</p>
                <p className="text-sm text-gray-600 mt-1">
                  You can now use this app without an internet connection.
                </p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-gray-900">New version available</p>
                <p className="text-sm text-gray-600 mt-1">
                  Click reload to update to the latest version.
                </p>
              </div>
            )}
          </div>
          <button
            onClick={close}
            className="ml-4 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          {needRefresh && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
            >
              Reload
            </button>
          )}
          <button
            onClick={close}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
