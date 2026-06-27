import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [role, setRole] = useState<'sherlock' | 'police' | 'admin'>('sherlock');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(loginId, password, role);
      
      // Navigate based on role
      if (role === 'sherlock') navigate('/sherlock');
      else if (role === 'police') navigate('/police');
      else navigate('/central');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-kumbh-orange to-kumbh-blue p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🕉️ Kumbh Mela 2027
          </h1>
          <p className="text-gray-600">Missing Person Response System</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Login As
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['sherlock', 'police', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    role === r
                      ? 'bg-kumbh-orange text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          {/* Login ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {role === 'sherlock' ? 'Phone Number' : role === 'police' ? 'Station ID' : 'Username'}
            </label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kumbh-orange focus:border-transparent"
              placeholder={role === 'sherlock' ? '+91 XXXXXXXXXX' : role === 'police' ? 'test_station' : 'admin'}
              required
            />
          </div>
          
          {/* Password (not for Sherlock in production) */}
          {role !== 'sherlock' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-kumbh-orange focus:border-transparent"
                placeholder="Enter password"
                required
              />
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-kumbh-orange text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-gray-600">
          <p className="font-semibold mb-2">Quick Test Credentials:</p>
          <div className="space-y-1 text-xs">
            <p>Sherlock: <code className="bg-gray-100 px-2 py-1 rounded">+919876543210</code></p>
            <p>Police: <code className="bg-gray-100 px-2 py-1 rounded">test_station</code> / <code className="bg-gray-100 px-2 py-1 rounded">kumbh2027</code></p>
            <p>Admin: <code className="bg-gray-100 px-2 py-1 rounded">admin</code> / <code className="bg-gray-100 px-2 py-1 rounded">admin123</code></p>
          </div>
        </div>
      </div>
    </div>
  );
}
