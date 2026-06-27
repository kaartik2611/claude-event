import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { BarChart3, Users, MapPin, AlertCircle } from 'lucide-react';

export default function CentralDashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchStats();
  }, []);
  
  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/analytics/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-kumbh-orange to-kumbh-blue text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Central Command Dashboard</h1>
            <p className="text-sm opacity-90">Kumbh Mela 2027 - Nashik</p>
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
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 text-sm font-medium">Total Cases</h3>
              <BarChart3 className="w-6 h-6 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-gray-800">
              {loading ? '...' : (stats?.active_cases || 0) + (stats?.resolved_cases || 0)}
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 text-sm font-medium">Active Cases</h3>
              <AlertCircle className="w-6 h-6 text-orange-500" />
            </div>
            <p className="text-3xl font-bold text-orange-600">
              {loading ? '...' : stats?.active_cases || 0}
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 text-sm font-medium">Resolved</h3>
              <Users className="w-6 h-6 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-green-600">
              {loading ? '...' : stats?.resolved_cases || 0}
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 text-sm font-medium">P1 Urgent</h3>
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-red-600">
              {loading ? '...' : stats?.p1_cases || 0}
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">Case Distribution</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Lost Cases</span>
                <span className="text-sm font-medium">{stats?.lost_cases || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full" style={{width: '60%'}}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Searching Cases</span>
                <span className="text-sm font-medium">{stats?.searching_cases || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-yellow-500 h-2 rounded-full" style={{width: '30%'}}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Found Cases</span>
                <span className="text-sm font-medium">{stats?.found_cases || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{width: '10%'}}></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
