import { useState, useEffect } from "react";
import { MapPin, RefreshCw, AlertCircle } from "lucide-react";

interface GPSCaptureProps {
  onLocationCapture: (location: { lat: number; lng: number }) => void;
}

export default function GPSCapture({ onLocationCapture }: GPSCaptureProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(loc);
        onLocationCapture(loc);
        setLoading(false);
      },
      (error) => {
        let errorMessage = "Unable to get location. ";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage +=
              "Please allow location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage +=
              "Location information is unavailable. Please check your GPS is enabled.";
            break;
          case error.TIMEOUT:
            errorMessage += "Location request timed out. Please try again.";
            break;
          default:
            errorMessage += "An unknown error occurred.";
        }
        setError(errorMessage);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    captureLocation();
  }, []);

  return (
    <div>
      {!location && !error && (
        <div>
          <button
            type="button"
            onClick={captureLocation}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/20 transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Getting
                Location...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" /> Capture GPS Location
              </>
            )}
          </button>
          {!loading && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              📍 Your location helps identify the nearest police station
            </p>
          )}
        </div>
      )}

      {location && (
        <div>
          <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <div>
                <span className="text-sm font-mono block">
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </span>
                <span className="text-xs text-emerald-300/70">
                  ✓ Location captured
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={captureLocation}
              className="p-1.5 hover:bg-emerald-500/20 rounded-lg transition"
              title="Refresh location"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
          {error.includes("settings") && (
            <div className="ml-6 mt-2 text-xs text-gray-400 space-y-1">
              <p className="font-semibold text-gray-300">
                How to enable location:
              </p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Click the location icon in the address bar</li>
                <li>Select "Allow" for location access</li>
                <li>Click "Retry" below</li>
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={captureLocation}
            className="mt-3 w-full py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-xs font-medium transition"
          >
            🔄 Retry Location Capture
          </button>
        </div>
      )}
    </div>
  );
}
