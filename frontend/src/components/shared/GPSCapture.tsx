import { useState, useEffect } from 'react';
import { MapPin, RefreshCw, AlertCircle } from 'lucide-react';

interface GPSCaptureProps {
  onLocationCapture: (location: { lat: number; lng: number }) => void;
}

export default function GPSCapture({ onLocationCapture }: GPSCaptureProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      return;
    }
    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setLocation(loc);
        onLocationCapture(loc);
        setLoading(false);
      },
      () => {
        setError('Unable to get location. Please enable GPS.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => { captureLocation(); }, []);

  return (
    <div>
      {!location && !error && (
        <button
          type="button"
          onClick={captureLocation}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/20 transition disabled:opacity-50"
        >
          {loading ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Getting Location...</>
          ) : (
            <><MapPin className="w-4 h-4" /> Capture GPS Location</>
          )}
        </button>
      )}

      {location && (
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-mono">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
          </div>
          <button type="button" onClick={captureLocation} className="p-1.5 hover:bg-emerald-500/20 rounded-lg transition">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button type="button" onClick={captureLocation} className="ml-auto text-xs underline hover:no-underline">Retry</button>
        </div>
      )}
    </div>
  );
}
