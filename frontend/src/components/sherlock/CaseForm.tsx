import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import CameraCapture from '../shared/CameraCapture';
import GPSCapture from '../shared/GPSCapture';

interface CaseFormProps {
  caseType: 'lost' | 'searching' | 'found';
  onSuccess: () => void;
}

export default function CaseForm({ caseType, onSuccess }: CaseFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gpsLocation, setGpsLocation] = useState<{lat: number; lng: number} | null>(null);
  
  // Photos
  const [reporterPhoto, setReporterPhoto] = useState<File | null>(null);
  const [personPhoto, setPersonPhoto] = useState<File | null>(null);
  const [foundPersonPhoto, setFoundPersonPhoto] = useState<File | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    reporter_name: '',
    reporter_phone: '',
    person_name: '',
    person_age: '',
    person_gender: '',
    person_height: '',
    person_clothing: '',
    person_physical_features: '',
    last_seen_location: '',
    found_person_description: ''
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gpsLocation) {
      setError('Please enable GPS location');
      return;
    }
    
    if (!reporterPhoto) {
      setError('Reporter photo is required');
      return;
    }
    
    if (caseType === 'lost' && !personPhoto) {
      setError('Lost person photo is required');
      return;
    }
    
    if (caseType === 'found' && !foundPersonPhoto) {
      setError('Found person photo is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('case_type', caseType);
      formDataToSend.append('reporter_name', formData.reporter_name);
      formDataToSend.append('reporter_phone', formData.reporter_phone);
      formDataToSend.append('gps_lat', gpsLocation.lat.toString());
      formDataToSend.append('gps_lng', gpsLocation.lng.toString());
      
      formDataToSend.append('reporter_photo', reporterPhoto);
      
      if (caseType === 'lost' || caseType === 'searching') {
        formDataToSend.append('person_name', formData.person_name);
        formDataToSend.append('person_age', formData.person_age);
        formDataToSend.append('person_gender', formData.person_gender);
        formDataToSend.append('person_height', formData.person_height);
        formDataToSend.append('person_clothing', formData.person_clothing);
        formDataToSend.append('person_physical_features', formData.person_physical_features);
        formDataToSend.append('last_seen_location', formData.last_seen_location);
        
        if (personPhoto) {
          formDataToSend.append('person_photo', personPhoto);
        }
      }
      
      if (caseType === 'found') {
        formDataToSend.append('found_person_description', formData.found_person_description);
        if (foundPersonPhoto) {
          formDataToSend.append('found_person_photo', foundPersonPhoto);
        }
      }
      
      await axios.post('/api/cases', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      alert('Case submitted successfully!');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit case');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">
        {caseType === 'lost' && '🔍 Report Missing Person'}
        {caseType === 'searching' && '📸 Searching for Someone'}
        {caseType === 'found' && '✅ Found Unknown Person'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* GPS Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📍 Current Location
          </label>
          <GPSCapture onLocationCapture={setGpsLocation} />
        </div>
        
        {/* Reporter Info */}
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-4">Your Information</h3>
          
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="Your Name"
              value={formData.reporter_name}
              onChange={(e) => setFormData({...formData, reporter_name: e.target.value})}
              className="px-4 py-2 border rounded-lg"
              required
            />
            <input
              type="tel"
              placeholder="Your Phone"
              value={formData.reporter_phone}
              onChange={(e) => setFormData({...formData, reporter_phone: e.target.value})}
              className="px-4 py-2 border rounded-lg"
              required
            />
          </div>
          
          <CameraCapture
            label="📸 Your Photo"
            onCapture={setReporterPhoto}
          />
        </div>
        
        {/* Person Details (for lost/searching) */}
        {(caseType === 'lost' || caseType === 'searching') && (
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4">Person Details</h3>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="Person Name"
                value={formData.person_name}
                onChange={(e) => setFormData({...formData, person_name: e.target.value})}
                className="px-4 py-2 border rounded-lg"
              />
              <input
                type="number"
                placeholder="Age"
                value={formData.person_age}
                onChange={(e) => setFormData({...formData, person_age: e.target.value})}
                className="px-4 py-2 border rounded-lg"
              />
              <select
                value={formData.person_gender}
                onChange={(e) => setFormData({...formData, person_gender: e.target.value})}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <input
                type="number"
                placeholder="Height (cm)"
                value={formData.person_height}
                onChange={(e) => setFormData({...formData, person_height: e.target.value})}
                className="px-4 py-2 border rounded-lg"
              />
            </div>
            
            <textarea
              placeholder="Clothing Description"
              value={formData.person_clothing}
              onChange={(e) => setFormData({...formData, person_clothing: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg mb-4"
              rows={2}
            />
            
            <textarea
              placeholder="Physical Features"
              value={formData.person_physical_features}
              onChange={(e) => setFormData({...formData, person_physical_features: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg mb-4"
              rows={2}
            />
            
            {caseType === 'lost' && (
              <CameraCapture
                label="📸 Lost Person Photo"
                onCapture={setPersonPhoto}
              />
            )}
          </div>
        )}
        
        {/* Found Person (for found case) */}
        {caseType === 'found' && (
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4">Found Person Details</h3>
            
            <textarea
              placeholder="Describe the found person (age, gender, clothing, condition, etc.)"
              value={formData.found_person_description}
              onChange={(e) => setFormData({...formData, found_person_description: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg mb-4"
              rows={4}
              required
            />
            
            <CameraCapture
              label="📸 Found Person Photo"
              onCapture={setFoundPersonPhoto}
            />
            
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                🚨 <strong>Auto P1 Alert:</strong> This case will be immediately escalated to police for urgent response.
              </p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        
        <button
          type="submit"
          disabled={loading || !gpsLocation}
          className="w-full bg-kumbh-orange text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}
