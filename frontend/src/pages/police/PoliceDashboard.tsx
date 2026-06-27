import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { AlertCircle, MapPin, Users, Clock, TrendingUp, X, Shield } from 'lucide-react';

interface Case {
  case_id: string;
  case_type: string;
  status: string;
  urgency: string;
  person_name?: string;
  person_age?: number;
  person_gender?: string;
  created_at: string;
  report_zone_id: string;
}

interface PredictiveData {
  case_id: string;
  person_name: string;
  person_age: number;
  person_profile: string;
  movement_speed_kmh: number;
  reported_at: string;
  actual_elapsed_minutes: number;
  prediction_timeline: Array<{
    time_label: string;
    time_minutes: number;
    max_search_radius_km: number;
    is_peak_hour: boolean;
    top_zones: Array<{
      zone_id: string;
      zone_name: string;
      probability: number;
      distance_km: number;
      reachable: boolean;
    }>;
  }>;
  nearest_police_stations: Array<{
    station_name: string;
    distance_km: number;
  }>;
  nearby_chokepoints: Array<{
    chokepoint_name: string;
    chokepoint_type: string;
    risk_level: string;
    distance_km: number;
  }>;
  insight: string;
}

export default function PoliceDashboard() {
  const { user, logout } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'P1' | 'P2' | 'P3'>('all');
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [predictiveData, setPredictiveData] = useState<PredictiveData | null>(null);
  const [predictiveLoading, setPredictiveLoading] = useState(false);
  const [zoneRisk, setZoneRisk] = useState<any>(null);

  useEffect(() => {
    fetchCases();
    fetchZoneRisk();
  }, [filter]);

  const fetchCases = async () => {
    try {
      const params: any = { status: 'active' };
      if (filter !== 'all') {
        params.urgency = filter;
      }
      const response = await axios.get('/api/cases', { params });
      setCases(response.data.cases);
    } catch (error) {
      console.error('Failed to fetch cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchZoneRisk = async () => {
    try {
      const response = await axios.get('/api/analytics/zone-risk-timeline?hours=3');
      setZoneRisk(response.data);
    } catch (error) {
      console.error('Failed to fetch zone risk:', error);
    }
  };

  const fetchPredictiveZones = async (caseId: string) => {
    setSelectedCase(caseId);
    setPredictiveLoading(true);
    try {
      const response = await axios.get(`/api/analytics/predictive-zones/${caseId}?steps=6&intervalMinutes=30`);
      setPredictiveData(response.data);
    } catch (error) {
      console.error('Failed to fetch predictive zones:', error);
    } finally {
      setPredictiveLoading(false);
    }
  };

  const closePredictive = () => {
    setSelectedCase(null);
    setPredictiveData(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Police Control Room</h1>
            <p className="text-sm opacity-90">{user?.name} - Zone {user?.zone_id}</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Cases</p>
                <p className="text-3xl font-bold text-gray-800">{cases.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-6 border-2 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">P1 Urgent</p>
                <p className="text-3xl font-bold text-red-700">
                  {cases.filter(c => c.urgency === 'P1').length}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-6 border-2 border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600">P2 Medium</p>
                <p className="text-3xl font-bold text-yellow-700">
                  {cases.filter(c => c.urgency === 'P2').length}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-6 border-2 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">P3 Low</p>
                <p className="text-3xl font-bold text-green-700">
                  {cases.filter(c => c.urgency === 'P3').length}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Zone Risk Alert Banner */}
        {zoneRisk && zoneRisk.hourly_risk?.[0]?.high_risk_zones?.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4" /> Predictive Zone Alert — Next Hour
            </h3>
            <div className="flex flex-wrap gap-2">
              {zoneRisk.hourly_risk[0].high_risk_zones.slice(0, 5).map((z: any, i: number) => (
                <span key={z.zone_id} className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  i === 0 ? 'bg-red-100 text-red-800' :
                  i === 1 ? 'bg-orange-100 text-orange-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {z.zone_name} (score: {z.risk_score})
                  {z.p1_cases > 0 && ` • P1:${z.p1_cases}`}
                </span>
              ))}
            </div>
            <p className="text-xs text-orange-600 mt-2">
              Zones ranked by predicted missing-person drift based on {zoneRisk.total_active_cases} active cases
            </p>
          </div>
        )}

        {/* Filter */}
        <div className="mb-6 flex gap-2">
          {(['all', 'P1', 'P2', 'P3'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === f
                  ? 'bg-blue-800 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'All Cases' : f}
            </button>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Cases List */}
          <div className={`bg-white rounded-lg shadow ${selectedCase ? 'w-1/2' : 'w-full'} transition-all`}>
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">Active Cases</h2>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : cases.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No cases found</div>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {cases.map((case_) => (
                  <div key={case_.case_id} className={`p-4 hover:bg-gray-50 transition cursor-pointer ${
                    selectedCase === case_.case_id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            case_.urgency === 'P1' ? 'bg-red-100 text-red-700' :
                            case_.urgency === 'P2' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {case_.urgency}
                          </span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                            {case_.case_type.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-500">{case_.case_id}</span>
                        </div>
                        <h3 className="font-semibold text-lg">
                          {case_.person_name || 'Unknown Person'}
                        </h3>
                        <div className="mt-2 text-sm text-gray-600 space-y-1">
                          <p>Age: {case_.person_age || 'N/A'} | Gender: {case_.person_gender || 'N/A'}</p>
                          <p className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" /> Zone: {case_.report_zone_id}
                          </p>
                          <p className="flex items-center gap-1">
                            <Clock className="w-4 h-4" /> {new Date(case_.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => fetchPredictiveZones(case_.case_id)}
                        className="px-3 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1 text-sm"
                      >
                        <TrendingUp className="w-4 h-4" /> Predict Zones
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Predictive Zone Panel */}
          {selectedCase && (
            <div className="w-1/2 bg-white rounded-lg shadow max-h-[700px] overflow-y-auto">
              <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-blue-800 to-blue-600 text-white rounded-t-lg">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Predictive Zone Timeline
                </h2>
                <button onClick={closePredictive} className="p-1 hover:bg-white/20 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {predictiveLoading ? (
                <div className="p-8 text-center text-gray-500">Calculating predictions...</div>
              ) : predictiveData ? (
                <div className="p-4 space-y-4">
                  {/* Person Summary */}
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <h3 className="font-bold text-blue-900">{predictiveData.person_name}</h3>
                    <p className="text-sm text-blue-700">
                      Age: {predictiveData.person_age || 'N/A'} •
                      Profile: <span className="font-semibold capitalize">{predictiveData.person_profile}</span> •
                      Speed: {predictiveData.movement_speed_kmh} km/hr
                    </p>
                    <p className="text-sm text-blue-700">
                      Elapsed: {Math.floor(predictiveData.actual_elapsed_minutes / 60)}h {predictiveData.actual_elapsed_minutes % 60}m since report
                    </p>
                  </div>

                  {/* AI Insight */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-sm text-purple-800">{predictiveData.insight}</p>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-gray-700">Zone Predictions Over Time</h4>
                    {predictiveData.prediction_timeline.map((step, idx) => (
                      <div key={idx} className={`rounded-lg p-3 border ${
                        step.is_peak_hour ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-gray-800">
                            {step.time_label}
                          </span>
                          <div className="flex items-center gap-2">
                            {step.is_peak_hour && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                                PEAK HOUR
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              radius: {step.max_search_radius_km} km
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {step.top_zones.map((zone, zi) => (
                            <div key={zone.zone_id} className="flex items-center gap-2 text-sm">
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                                zi === 0 ? 'bg-red-500' : zi === 1 ? 'bg-orange-500' : 'bg-gray-400'
                              }`}>{zi + 1}</span>
                              <span className="flex-1 text-gray-700">{zone.zone_name}</span>
                              <span className="text-xs text-gray-500">{zone.distance_km} km</span>
                              <div className="w-20 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    zone.probability > 0.6 ? 'bg-red-500' :
                                    zone.probability > 0.3 ? 'bg-orange-500' : 'bg-yellow-500'
                                  }`}
                                  style={{ width: `${zone.probability * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold w-10 text-right">
                                {Math.round(zone.probability * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Nearest Resources */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Police Stations */}
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <h4 className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Nearest Stations
                      </h4>
                      {predictiveData.nearest_police_stations.map((s, i) => (
                        <p key={i} className="text-xs text-blue-700">
                          {s.station_name} ({Number(s.distance_km).toFixed(1)} km)
                        </p>
                      ))}
                    </div>

                    {/* Chokepoints */}
                    <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                      <h4 className="text-xs font-bold text-orange-800 mb-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Nearby Chokepoints
                      </h4>
                      {predictiveData.nearby_chokepoints.slice(0, 4).map((cp, i) => (
                        <p key={i} className="text-xs text-orange-700">
                          <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                            cp.risk_level === 'very high' ? 'bg-red-500' :
                            cp.risk_level === 'high' ? 'bg-orange-500' : 'bg-yellow-500'
                          }`} />
                          {cp.chokepoint_name} ({Number(cp.distance_km).toFixed(1)} km)
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
