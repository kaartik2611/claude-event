import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Camera {
  camera_id: string;
  zone_id: string;
  gps_lat: number;
  gps_lng: number;
  is_active: boolean;
}

interface PoliceStation {
  station_id: string;
  station_name: string;
  gps_lat: number;
  gps_lng: number;
}

interface Chokepoint {
  chokepoint_id: string;
  chokepoint_name: string;
  chokepoint_type: string;
  gps_lat: number;
  gps_lng: number;
  risk_level: string;
}

interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number;
}

interface InfrastructureMapProps {
  cameras?: Camera[];
  policeStations?: PoliceStation[];
  chokepoints?: Chokepoint[];
  heatmapPoints?: HeatPoint[];
  layers: {
    cameras: boolean;
    policeStations: boolean;
    chokepoints: boolean;
    heatmap: boolean;
  };
  height?: string;
}

// Custom icons
const policeIcon = new L.DivIcon({
  html: `<div style="background:#1e40af;border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.4)">🏛️</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const riskColors: Record<string, string> = {
  'very high': '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const chokepointTypeEmoji: Record<string, string> = {
  'Traffic choke point': '🚧',
  'No-vehicle pressure zone': '🚫',
  'Transfer node': '🚉',
  Parking: '🅿️',
  'Outer parking': '🅿️',
  'Parking belt': '🅿️',
};

// Heatmap layer component
function HeatmapLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    // @ts-ignore - leaflet.heat typings
    const heat = (L as any).heatLayer(
      points.map((p) => [p.lat, p.lng, p.intensity]),
      {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: { 0.2: '#2196f3', 0.4: '#ffeb3b', 0.6: '#ff9800', 0.8: '#f44336', 1.0: '#b71c1c' },
      }
    );
    heat.addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null;
}

export default function InfrastructureMap({
  cameras = [],
  policeStations = [],
  chokepoints = [],
  heatmapPoints = [],
  layers,
  height = '500px',
}: InfrastructureMapProps) {
  // Nashik center
  const center: [number, number] = [19.9975, 73.7898];

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden border-2 border-gray-600 shadow-2xl">
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={true}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Heatmap */}
        {layers.heatmap && heatmapPoints.length > 0 && <HeatmapLayer points={heatmapPoints} />}

        {/* CCTV Cameras */}
        {layers.cameras &&
          cameras.map((cam) => (
            <CircleMarker
              key={cam.camera_id}
              center={[cam.gps_lat, cam.gps_lng]}
              radius={3}
              pathOptions={{
                color: cam.is_active ? '#06b6d4' : '#6b7280',
                fillColor: cam.is_active ? '#06b6d4' : '#6b7280',
                fillOpacity: 0.6,
                weight: 1,
              }}
            >
              <Popup>
                <div className="text-xs">
                  <strong>{cam.camera_id}</strong>
                  <br />
                  Zone: {cam.zone_id}
                  <br />
                  Status: {cam.is_active ? '🟢 Active' : '🔴 Inactive'}
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* Police Stations */}
        {layers.policeStations &&
          policeStations.map((ps) => (
            <Marker key={ps.station_id} position={[ps.gps_lat, ps.gps_lng]} icon={policeIcon}>
              <Popup>
                <div className="text-sm font-semibold">{ps.station_name}</div>
              </Popup>
            </Marker>
          ))}

        {/* Chokepoints */}
        {layers.chokepoints &&
          chokepoints.map((cp) => (
            <CircleMarker
              key={cp.chokepoint_id}
              center={[cp.gps_lat, cp.gps_lng]}
              radius={8}
              pathOptions={{
                color: riskColors[cp.risk_level] || '#eab308',
                fillColor: riskColors[cp.risk_level] || '#eab308',
                fillOpacity: 0.7,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-xs">
                  <strong>
                    {chokepointTypeEmoji[cp.chokepoint_type] || '📍'} {cp.chokepoint_name}
                  </strong>
                  <br />
                  Type: {cp.chokepoint_type}
                  <br />
                  Risk: <span style={{ color: riskColors[cp.risk_level] }}>{cp.risk_level}</span>
                </div>
              </Popup>
            </CircleMarker>
          ))}
      </MapContainer>
    </div>
  );
}
