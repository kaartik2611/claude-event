import { useState, useEffect } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';

interface GPSCaptureProps {
  onLocationCapture: (location: { lat: number; lng: number }) => void;
}

export default function GPSCapture({ onLocationCapture }: GPSCaptureProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    
    setLoading(true);
    setError('');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setLocation(loc);
        onLocationCapture(loc);
        setLoading(false);
      },
      (error) => {
        setError('Unable to retrieve location. Please enable GPS.');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };
  
  // Auto-capture on mount
  useEffect(() => {
    captureLocation();
  }, []);
  
  return (
    <div className="space-y-2">
      {!location && !error && (
        <button
          type="button"
          onClick={captureLocation}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Getting Location...</span>
            </>
          ) : (
            <>
              <MapPin className="w-5 h-5" />
              <span>Capture GPS Location</span>
            </>
          )}
        </button>
      )}
      
      {location && (
        <div className="flex items-center justify-between px-4 py-3 bg-green-100 text-green-700 rounded-lg">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            <span className="text-sm">
              📍 {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </span>
          </div>
          <button
            type="button"
            onClick={captureLocation}
            className="p-1 hover:bg-green-200 rounded"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {error && (
        <div className="px-4 py-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
