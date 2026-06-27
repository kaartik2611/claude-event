import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import CaseForm from '../../components/sherlock/CaseForm';
import { Camera, Search, UserCheck } from 'lucide-react';

export default function SherlockDashboard() {
  const { user, logout } = useAuth();
  const [selectedCase, setSelectedCase] = useState<'lost' | 'searching' | 'found' | null>(null);
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-kumbh-orange text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Sherlock Station</h1>
            <p className="text-sm opacity-90">{user?.name}</p>
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
        {!selectedCase ? (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                Welcome, {user?.name}
              </h2>
              <p className="text-gray-600">
                Select the type of report you need to file
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {/* Case 1: My Person is Lost */}
              <button
                onClick={() => setSelectedCase('lost')}
                className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow border-2 border-transparent hover:border-red-400"
              >
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Case 1: Person Lost
                </h3>
                <p className="text-gray-600 text-sm">
                  Report a missing person (family member, child, or companion)
                </p>
                <div className="mt-4 text-xs text-gray-500">
                  📸 Reporter + Lost Person Photos<br />
                  📍 GPS Location<br />
                  🎙️ Voice Recording (Optional)
                </div>
              </button>
              
              {/* Case 2: Searching for Someone */}
              <button
                onClick={() => setSelectedCase('searching')}
                className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow border-2 border-transparent hover:border-yellow-400"
              >
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Camera className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Case 2: Searching
                </h3>
                <p className="text-gray-600 text-sm">
                  Someone is searching for you or their family member
                </p>
                <div className="mt-4 text-xs text-gray-500">
                  📸 Reporter Photo<br />
                  📤 Upload Photo OR<br />
                  🎙️ Voice Description
                </div>
              </button>
              
              {/* Case 3: Found Unknown Person */}
              <button
                onClick={() => setSelectedCase('found')}
                className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow border-2 border-transparent hover:border-blue-400"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserCheck className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Case 3: Found Person
                </h3>
                <p className="text-gray-600 text-sm">
                  Found an unknown person who appears lost or disoriented
                </p>
                <div className="mt-4 text-xs text-gray-500">
                  📸 Reporter + Found Person Photos<br />
                  📍 GPS Location<br />
                  🚨 Auto P1 Alert to Police
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setSelectedCase(null)}
              className="mb-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
            >
              ← Back to Case Selection
            </button>
            
            <CaseForm caseType={selectedCase} onSuccess={() => setSelectedCase(null)} />
          </div>
        )}
      </main>
    </div>
  );
}
