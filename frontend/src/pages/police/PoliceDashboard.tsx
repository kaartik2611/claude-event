import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { AlertCircle, MapPin, Users } from 'lucide-react';

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

export default function PoliceDashboard() {
  const { user, logout } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'P1' | 'P2' | 'P3'>('all');
  
  useEffect(() => {
    fetchCases();
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
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-kumbh-blue text-white shadow-lg">
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
        
        {/* Filter */}
        <div className="mb-6 flex gap-2">
          {(['all', 'P1', 'P2', 'P3'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === f
                  ? 'bg-kumbh-blue text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'All Cases' : f}
            </button>
          ))}
        </div>
        
        {/* Cases List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold">Active Cases</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : cases.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No cases found</div>
          ) : (
            <div className="divide-y">
              {cases.map((case_) => (
                <div key={case_.case_id} className="p-4 hover:bg-gray-50 transition">
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
                        <span className="text-sm text-gray-500">
                          {case_.case_id}
                        </span>
                      </div>
                      
                      <h3 className="font-semibold text-lg">
                        {case_.person_name || 'Unknown Person'}
                      </h3>
                      
                      <div className="mt-2 text-sm text-gray-600 space-y-1">
                        <p>Age: {case_.person_age || 'N/A'} | Gender: {case_.person_gender || 'N/A'}</p>
                        <p className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          Zone: {case_.report_zone_id}
                        </p>
                        <p>Reported: {new Date(case_.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <button className="px-4 py-2 bg-kumbh-blue text-white rounded-lg hover:bg-blue-700 transition">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
