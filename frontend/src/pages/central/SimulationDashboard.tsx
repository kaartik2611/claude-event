import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Users, Play, Square, MapPin, ArrowRight, Activity, ArrowLeft } from 'lucide-react';

interface TrackedPerson {
  person_id: string;
  name: string;
  age?: number;
  description?: string;
  photo_url?: string;
  zone: string;
  zone_name: string;
  gps_lat: number;
  gps_lng: number;
  timestamp: Date;
}

interface Zone {
  id: string;
  name: string;
  persons: TrackedPerson[];
  color: string;
}

const ZONES: Zone[] = [
  { id: 'ZONE-1', name: 'Zone 1 - Ramkund Ghat', persons: [], color: 'from-blue-500 to-cyan-600' },
  { id: 'ZONE-2', name: 'Zone 2 - Main Bazaar', persons: [], color: 'from-green-500 to-emerald-600' },
  { id: 'ZONE-3', name: 'Zone 3 - Panchavati', persons: [], color: 'from-amber-500 to-orange-600' },
  { id: 'ZONE-4', name: 'Zone 4 - Exit Point', persons: [], color: 'from-purple-500 to-pink-600' },
];

export default function SimulationDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [zones, setZones] = useState<Zone[]>(ZONES);
  const [isSimulating, setIsSimulating] = useState(false);
  const [movements, setMovements] = useState<any[]>([]);

  // Initialize WebSocket
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const newSocket = io('http://localhost:3000', {
      auth: { token },
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to WebSocket');
      
      // Subscribe to all zones
      ZONES.forEach(zone => {
        newSocket.emit('zone:join', zone.id);
      });
    });

    // Person detected in a zone
    newSocket.on('person:detected', (data: TrackedPerson) => {
      console.log('👤 Person detected:', data);
      setZones(prev => prev.map(zone => {
        if (zone.id === data.zone) {
          return { ...zone, persons: [...zone.persons, data] };
        }
        return zone;
      }));
    });

    // Person entered a zone
    newSocket.on('person:entered', (data: any) => {
      console.log('➡️ Person entered:', data);
      setZones(prev => prev.map(zone => {
        if (zone.id === data.to_zone) {
          return {
            ...zone,
            persons: [...zone.persons, {
              person_id: data.person_id,
              name: data.name,
              age: data.age,
              description: data.description,
              photo_url: data.photo_url,
              zone: data.to_zone,
              zone_name: data.to_zone_name,
              gps_lat: data.to_lat,
              gps_lng: data.to_lng,
              timestamp: new Date(data.timestamp),
            }],
          };
        }
        return zone;
      }));

      setMovements(prev => [{
        id: Date.now(),
        person_name: data.name,
        from_zone: data.from_zone_name,
        to_zone: data.to_zone_name,
        timestamp: new Date(data.timestamp),
      }, ...prev.slice(0, 9)]); // Keep last 10 movements
    });

    // Person left a zone
    newSocket.on('person:left', (data: any) => {
      console.log('⬅️ Person left:', data);
      setZones(prev => prev.map(zone => {
        if (zone.id === data.from_zone) {
          return {
            ...zone,
            persons: zone.persons.filter(p => p.person_id !== data.person_id),
          };
        }
        return zone;
      }));
    });

    // Person completed journey
    newSocket.on('person:completed', (data: any) => {
      console.log('✅ Person completed:', data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const startSimulation = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/simulation/crowd', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ count: 3 }),
      });

      const result = await response.json();
      if (result.success) {
        setIsSimulating(true);
        console.log('✅ Simulation started:', result);
      }
    } catch (error) {
      console.error('Failed to start simulation:', error);
    }
  };

  const startSinglePerson = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/simulation/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: `Visitor ${Date.now()}`,
          age: Math.floor(Math.random() * 50) + 20,
          description: 'Simulated visitor',
        }),
      });

      const result = await response.json();
      if (result.success) {
        console.log('✅ Single person simulation started:', result);
      }
    } catch (error) {
      console.error('Failed to start simulation:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/central')}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold mb-2">Zone Movement Simulation</h1>
            <p className="text-gray-400">Real-time person tracking across zones</p>
          </div>
        </div>
        <div className="flex gap-3">
            <button
              onClick={startSinglePerson}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition"
            >
              <Users className="w-4 h-4" />
              Add Person
            </button>
            <button
              onClick={startSimulation}
              disabled={isSimulating}
              className="flex items-center gap-2 bg-gradient-to-r from-kumbh-orange to-kumbh-gold px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Start Crowd Simulation
            </button>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 text-sm mb-6">
        <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg">
          <Activity className={`w-4 h-4 ${socket?.connected ? 'text-green-400 animate-pulse' : 'text-gray-500'}`} />
          <span>{socket?.connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg">
          <Users className="w-4 h-4 text-blue-400" />
          <span>Total: {zones.reduce((acc, zone) => acc + zone.persons.length, 0)} persons</span>
        </div>
      </div>

      {/* Zones Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
        {zones.map((zone, idx) => (
          <div key={zone.id} className="relative">
            <div className="bg-gray-900 rounded-xl p-6 border-2 border-gray-800 hover:border-gray-700 transition">
              {/* Zone Header */}
              <div className={`flex items-center gap-3 mb-4 pb-4 border-b border-gray-800`}>
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${zone.color} flex items-center justify-center text-white font-bold shadow-lg`}>
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm">{zone.name}</h3>
                  <p className="text-xs text-gray-500">{zone.persons.length} persons</p>
                </div>
              </div>

              {/* Persons List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {zone.persons.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No persons detected</p>
                  </div>
                ) : (
                  zone.persons.map(person => (
                    <div
                      key={person.person_id}
                      className="bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800 transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-xs font-bold">
                          {person.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{person.name}</p>
                          <p className="text-[10px] text-gray-500">
                            ID: {person.person_id.slice(-8)}
                          </p>
                        </div>
                      </div>
                      {person.age && (
                        <div className="text-xs text-gray-400 mt-1">Age: {person.age}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Arrow to next zone */}
            {idx < zones.length - 1 && (
              <div className="hidden lg:block absolute -right-6 top-1/2 -translate-y-1/2 z-10">
                <ArrowRight className="w-12 h-12 text-gray-700" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent Movements */}
      <div className="bg-gray-900 rounded-xl p-6 border-2 border-gray-800">
        <h3 className="text-xl font-bold mb-4">Recent Movements</h3>
        <div className="space-y-2">
          {movements.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No movements yet. Start a simulation to see live tracking.</p>
          ) : (
            movements.map(movement => (
              <div
                key={movement.id}
                className="flex items-center gap-4 bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800 transition"
              >
                <div className="flex-1">
                  <p className="font-semibold text-sm">{movement.person_name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <span>{movement.from_zone}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span>{movement.to_zone}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(movement.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
