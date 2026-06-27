import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import InfrastructureMap from '../../components/shared/InfrastructureMap';
import {
  BarChart3, MapPin, Camera, Clock,
  Activity, TrendingUp,
  Eye, EyeOff, Zap, Map as MapIcon, Play
} from 'lucide-react';

export default function CentralDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [, setLoading] = useState(true);
  const [zoneRisk, setZoneRisk] = useState<any>(null);
  const [infra, setInfra] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'map' | 'analytics' | 'predict'>('map');
  const [mapLayers, setMapLayers] = useState({
    cameras: true,
    policeStations: true,
    chokepoints: true,
    heatmap: true,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [statsRes, riskRes, infraRes, heatRes] = await Promise.all([
        axios.get('/api/analytics/stats').catch(() => ({ data: null })),
        axios.get('/api/analytics/zone-risk-timeline?hours=3').catch(() => ({ data: null })),
        axios.get('/api/analytics/infrastructure').catch(() => ({ data: null })),
        axios.get('/api/analytics/heatmap').catch(() => ({ data: { points: [] } })),
      ]);
      setStats(statsRes.data);
      setZoneRisk(riskRes.data);
      setInfra(infraRes.data);
      setHeatmap(heatRes.data?.points || []);
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleLayer = (layer: keyof typeof mapLayers) => {
    setMapLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const totalCases = (stats?.active_cases || 0) + (stats?.resolved_cases || 0) + (stats?.expired_cases || 0);
  const resolutionRate = totalCases > 0 ? Math.round(((stats?.resolved_cases || 0) / totalCases) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* HEADER */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-kumbh-orange to-kumbh-gold flex items-center justify-center text-xl font-black text-white shadow-lg">
              K
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Kumbh Mela Command Center</h1>
              <p className="text-xs text-gray-500">Nashik-Trimbakeshwar 2027 &middot; Live Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/simulation')}
              className="flex items-center gap-2 bg-gradient-to-r from-kumbh-orange to-kumbh-gold text-white text-xs font-semibold px-4 py-2 rounded-lg hover:shadow-lg transition"
            >
              <Play className="w-3.5 h-3.5" />
              Zone Simulation
            </button>
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> LIVE
            </span>
            <button onClick={logout} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* STAT BAR */}
      <div className="bg-gray-900/50 border-b border-gray-800">
        <div className="max-w-[1600px] mx-auto px-6 py-3">
          <div className="flex items-center gap-6 overflow-x-auto">
            <Metric label="Total" value={totalCases} color="text-white" />
            <div className="w-px h-8 bg-gray-700" />
            <Metric label="Active" value={stats?.active_cases || 0} color="text-orange-400" />
            <Metric label="Resolved" value={stats?.resolved_cases || 0} color="text-emerald-400" />
            <Metric label="Rate" value={`${resolutionRate}%`} color="text-emerald-400" />
            <div className="w-px h-8 bg-gray-700" />
            <Metric label="P1" value={stats?.p1_cases || 0} color="text-red-400" pulse={!!(stats?.p1_cases)} />
            <Metric label="P2" value={stats?.p2_cases || 0} color="text-yellow-400" />
            <Metric label="P3" value={stats?.p3_cases || 0} color="text-green-400" />
            <div className="w-px h-8 bg-gray-700" />
            <Metric label="Broadcasts" value={stats?.active_broadcasts || 0} color="text-purple-400" />
            <Metric label="Cameras" value={stats?.infrastructure?.total_cameras || 0} color="text-cyan-400" />
            <Metric label="Stations" value={stats?.infrastructure?.total_police_stations || 0} color="text-blue-400" />
            <Metric label="Sherlocks" value={stats?.infrastructure?.active_sherlocks || 0} color="text-kumbh-gold" />
          </div>
        </div>
      </div>

      {/* TAB BAR */}
      <div className="bg-gray-900/30 border-b border-gray-800">
        <div className="max-w-[1600px] mx-auto px-6 flex gap-1">
          {[
            { id: 'map' as const, label: 'Live Map', icon: <MapIcon className="w-4 h-4" /> },
            { id: 'analytics' as const, label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'predict' as const, label: 'Predictive Risk', icon: <TrendingUp className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-kumbh-orange text-kumbh-orange'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 py-5">
        {/* ======= MAP TAB ======= */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            {/* Layer toggles */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 uppercase tracking-wider mr-2">Layers</span>
              <LayerToggle active={mapLayers.cameras} onClick={() => toggleLayer('cameras')} label="CCTV" color="cyan" count={infra?.cameras?.length} />
              <LayerToggle active={mapLayers.policeStations} onClick={() => toggleLayer('policeStations')} label="Police" color="blue" count={infra?.police_stations?.length} />
              <LayerToggle active={mapLayers.chokepoints} onClick={() => toggleLayer('chokepoints')} label="Chokepoints" color="orange" count={infra?.chokepoints?.length} />
              <LayerToggle active={mapLayers.heatmap} onClick={() => toggleLayer('heatmap')} label="Case Heatmap" color="red" count={heatmap.length} />
            </div>

            {/* Map */}
            <InfrastructureMap
              cameras={infra?.cameras || []}
              policeStations={infra?.police_stations || []}
              chokepoints={infra?.chokepoints || []}
              heatmapPoints={heatmap}
              layers={mapLayers}
              height="calc(100vh - 260px)"
            />

            {/* Map Legend */}
            <div className="flex items-center gap-6 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> CCTV Camera</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Police Station</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Very High Risk</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> High Risk</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Medium Risk</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Low Risk</span>
            </div>
          </div>
        )}

        {/* ======= ANALYTICS TAB ======= */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Row 1: Case Distribution + Activity + Matching */}
            <div className="grid lg:grid-cols-3 gap-5">
              {/* Case Types */}
              <Card title="Case Distribution" icon={<Activity className="w-4 h-4 text-orange-400" />}>
                <div className="space-y-3">
                  <ProgressBar label="Lost" value={stats?.lost_cases || 0} max={totalCases || 1} color="bg-red-500" />
                  <ProgressBar label="Searching" value={stats?.searching_cases || 0} max={totalCases || 1} color="bg-amber-500" />
                  <ProgressBar label="Found" value={stats?.found_cases || 0} max={totalCases || 1} color="bg-blue-500" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <PillStat label="P1" count={stats?.p1_cases || 0} bg="bg-red-500/10 text-red-400 ring-red-500/20" />
                  <PillStat label="P2" count={stats?.p2_cases || 0} bg="bg-amber-500/10 text-amber-400 ring-amber-500/20" />
                  <PillStat label="P3" count={stats?.p3_cases || 0} bg="bg-green-500/10 text-green-400 ring-green-500/20" />
                </div>
              </Card>

              {/* Recent Activity */}
              <Card title="Activity (24h)" icon={<Clock className="w-4 h-4 text-blue-400" />}>
                <div className="space-y-3">
                  <ActivityRow label="New cases (1 hr)" value={stats?.activity?.cases_last_hour || 0} color="text-orange-400" />
                  <ActivityRow label="New cases (24 hr)" value={stats?.activity?.cases_last_24h || 0} color="text-blue-400" />
                  <ActivityRow label="Resolved (24 hr)" value={stats?.activity?.resolved_last_24h || 0} color="text-emerald-400" />
                </div>
              </Card>

              {/* AI Matching */}
              <Card title="AI Match Engine" icon={<Zap className="w-4 h-4 text-purple-400" />}>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-2xl font-bold text-purple-400">{stats?.matching?.total_matches || 0}</p>
                    <p className="text-[10px] text-gray-500 uppercase mt-1">Total</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-2xl font-bold text-emerald-400">{stats?.matching?.confirmed_matches || 0}</p>
                    <p className="text-[10px] text-gray-500 uppercase mt-1">Confirmed</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-2xl font-bold text-amber-400">{stats?.matching?.avg_match_score || 0}</p>
                    <p className="text-[10px] text-gray-500 uppercase mt-1">Avg Score</p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-600 mt-3">Bilateral + fuzzy text + feature matching across all centers</p>
              </Card>
            </div>

            {/* Row 2: Infrastructure */}
            <Card title="Infrastructure" icon={<Camera className="w-4 h-4 text-cyan-400" />}>
              <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
                <InfraChip icon="🗺️" label="Zones" value={stats?.infrastructure?.total_zones || 0} />
                <InfraChip icon="📹" label="Cameras" value={stats?.infrastructure?.total_cameras || 0} />
                <InfraChip icon="🟢" label="Active Cam" value={stats?.infrastructure?.active_cameras || 0} />
                <InfraChip icon="🏛️" label="Stations" value={stats?.infrastructure?.total_police_stations || 0} />
                <InfraChip icon="⚠️" label="Chokepoints" value={stats?.infrastructure?.total_chokepoints || 0} />
                <InfraChip icon="🕵️" label="Sherlocks" value={stats?.infrastructure?.total_sherlocks || 0} />
                <InfraChip icon="📡" label="Active Vol." value={stats?.infrastructure?.active_sherlocks || 0} />
              </div>

              {/* Chokepoint breakdown + Camera coverage */}
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                {stats?.chokepoint_breakdown?.length > 0 && (
                  <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Chokepoint Types</h4>
                    <div className="space-y-1">
                      {stats.chokepoint_breakdown.map((cp: any) => (
                        <div key={cp.category} className="flex justify-between text-sm px-2 py-1.5 bg-gray-800/50 rounded">
                          <span className="text-gray-400 capitalize">{cp.category}</span>
                          <span className="font-semibold text-cyan-400">{cp.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {stats?.camera_coverage?.length > 0 && (
                  <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Camera Coverage (Top Zones)</h4>
                    <div className="space-y-1.5">
                      {stats.camera_coverage.map((z: any) => (
                        <div key={z.zone_id} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-20 truncate">{z.zone_name || z.zone_id}</span>
                          <div className="flex-1 bg-gray-800 rounded-full h-2">
                            <div className="bg-cyan-500/70 h-2 rounded-full" style={{ width: `${Math.min(100, (z.camera_count / (stats.camera_coverage[0]?.camera_count || 1)) * 100)}%` }} />
                          </div>
                          <span className="text-xs font-bold text-cyan-300 w-8 text-right">{z.camera_count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Row 3: Zone Breakdown */}
            {stats?.zone_breakdown?.length > 0 && (
              <Card title="Active Cases by Zone" icon={<MapPin className="w-4 h-4 text-green-400" />}>
                <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {stats.zone_breakdown.map((z: any) => (
                    <div key={z.zone_id} className="bg-gray-800/50 rounded-lg p-2.5 text-center border border-gray-700/50">
                      <p className="text-[10px] text-gray-500 truncate">{z.zone_name || z.zone_id}</p>
                      <p className="text-lg font-bold">{z.active_cases}</p>
                      <div className="flex justify-center gap-1 mt-1">
                        {z.p1_cases > 0 && <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded">P1:{z.p1_cases}</span>}
                        {z.p2_cases > 0 && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1 rounded">P2:{z.p2_cases}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ======= PREDICTIVE TAB ======= */}
        {activeTab === 'predict' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Predictive Zone Risk Timeline</h2>
                <p className="text-sm text-gray-500">
                  Based on {zoneRisk?.total_active_cases || 0} active cases — zones shift as missing persons move outward
                </p>
              </div>
              <button onClick={fetchAll} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition border border-gray-700">
                Refresh
              </button>
            </div>

            {zoneRisk?.hourly_risk?.length > 0 ? (
              <div className="grid md:grid-cols-3 gap-5">
                {zoneRisk.hourly_risk.map((hour: any) => (
                  <div key={hour.hour} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-kumbh-orange">{hour.label}</h3>
                      <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded">
                        {hour.high_risk_zones?.length || 0} zones
                      </span>
                    </div>
                    {hour.high_risk_zones?.length > 0 ? (
                      <div className="space-y-2">
                        {hour.high_risk_zones.slice(0, 6).map((z: any, i: number) => (
                          <div key={z.zone_id} className="flex items-center gap-2 text-sm">
                            <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                              i === 0 ? 'bg-red-500 text-white' : i === 1 ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'
                            }`}>{i + 1}</span>
                            <span className="flex-1 text-gray-300 truncate">{z.zone_name}</span>
                            {z.p1_cases > 0 && <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded">P1:{z.p1_cases}</span>}
                            <span className="font-mono font-bold text-kumbh-gold text-xs">{z.risk_score}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">No risk data</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-600">No active cases for prediction</div>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">How Predictions Work</h4>
              <div className="grid md:grid-cols-3 gap-4 text-xs text-gray-500">
                <div className="flex gap-2">
                  <span className="text-lg">👴</span>
                  <div><strong className="text-gray-300">Elderly (60+)</strong>: 1 km/hr movement — stays near report zone, check ghats and temples first</div>
                </div>
                <div className="flex gap-2">
                  <span className="text-lg">🧑</span>
                  <div><strong className="text-gray-300">Adults (18-59)</strong>: 3 km/hr — wider drift, zones shift significantly each hour</div>
                </div>
                <div className="flex gap-2">
                  <span className="text-lg">👶</span>
                  <div><strong className="text-gray-300">Children (&lt;12)</strong>: 1.5 km/hr — tend to follow crowds toward chokepoints and transfer nodes</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ---- Micro components ----

function Metric({ label, value, color, pulse }: { label: string; value: any; color: string; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      <span className={`text-lg font-bold ${color} ${pulse ? 'animate-pulse' : ''}`}>{value}</span>
    </div>
  );
}

function LayerToggle({ active, onClick, label, color, count }: { active: boolean; onClick: () => void; label: string; color: string; count?: number }) {
  const colors: Record<string, string> = {
    cyan: 'bg-cyan-500/10 text-cyan-400 ring-cyan-500/30',
    blue: 'bg-blue-500/10 text-blue-400 ring-blue-500/30',
    orange: 'bg-orange-500/10 text-orange-400 ring-orange-500/30',
    red: 'bg-red-500/10 text-red-400 ring-red-500/30',
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ring-1 transition ${
        active ? colors[color] : 'bg-gray-800 text-gray-600 ring-gray-700'
      }`}
    >
      {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
      {label}
      {count !== undefined && <span className="text-[10px] opacity-70">({count})</span>}
    </button>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-4">{icon} {title}</h3>
      {children}
    </div>
  );
}

function ProgressBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs font-bold text-gray-300">{value}</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PillStat({ label, count, bg }: { label: string; count: number; bg: string }) {
  return (
    <div className={`${bg} ring-1 rounded-lg py-2 text-center`}>
      <p className="text-lg font-bold">{count}</p>
      <p className="text-[10px] uppercase">{label}</p>
    </div>
  );
}

function ActivityRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between items-center py-2 px-3 bg-gray-800/50 rounded-lg">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

function InfraChip({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="bg-gray-800/50 rounded-lg py-2 px-1 text-center">
      <span className="text-lg">{icon}</span>
      <p className="text-lg font-bold mt-0.5">{value}</p>
      <p className="text-[9px] text-gray-500 uppercase">{label}</p>
    </div>
  );
}
