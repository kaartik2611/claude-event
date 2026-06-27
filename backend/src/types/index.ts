// Type definitions for Kumbh Mela system

export interface Zone {
  zone_id: string;
  zone_name: string;
  zone_boundary?: string;
  center_lat: number;
  center_lng: number;
  area_sq_km?: number;
  population_density?: number;
  zone_type?: string;
}

export interface PoliceStation {
  station_id: string;
  station_name: string;
  zone_id: string;
  gps_lat: number;
  gps_lng: number;
  phone?: string;
  officer_in_charge?: string;
  login_id: string;
  password_hash: string;
  is_active: boolean;
}

export interface Sherlock {
  sherlock_id: string;
  name: string;
  phone: string;
  assigned_zone: string;
  languages?: string[];
  status: 'active' | 'inactive' | 'busy';
  current_gps_lat?: number;
  current_gps_lng?: number;
  location_last_updated?: Date;
  reports_filed: number;
  cases_resolved: number;
}

export type CaseType = 'lost' | 'searching' | 'found';
export type CaseStatus = 'active' | 'resolved' | 'expired' | 'cancelled';
export type Urgency = 'P1' | 'P2' | 'P3';

export interface Case {
  case_id: string;
  case_type: CaseType;
  status: CaseStatus;
  urgency: Urgency;
  
  // Reporter info
  reporter_name: string;
  reporter_phone: string;
  reporter_photo_url?: string;
  
  // Person info
  person_name?: string;
  person_age?: number;
  person_gender?: string;
  person_height?: number;
  person_clothing?: string;
  person_physical_features?: string;
  person_language?: string;
  person_photo_url?: string;
  
  // Found person
  found_person_photo_url?: string;
  found_person_description?: string;
  
  // Location
  report_gps_lat: number;
  report_gps_lng: number;
  report_zone_id: string;
  last_seen_location?: string;
  last_seen_zone?: string;
  
  // Voice
  voice_recording_url?: string;
  voice_transcript?: string;
  voice_parsed_data?: any;
  
  // Sherlock
  sherlock_id: string;
  
  // Broadcast
  broadcast_active: boolean;
  broadcast_started_at?: Date;
  broadcast_expires_at?: Date;
  broadcast_extended_count: number;
  
  // Matching
  matched_with_case_id?: string;
  match_score?: number;
  resolved_at?: Date;
  resolution_notes?: string;
  
  created_at: Date;
  updated_at: Date;
}

export interface CCTVCamera {
  camera_id: string;
  zone_id: string;
  location_name: string;
  gps_lat: number;
  gps_lng: number;
  camera_type: 'fixed' | 'ptz' | 'mobile';
  coverage_area?: string;
  coverage_radius: number;
  is_active: boolean;
}

export interface Chokepoint {
  chokepoint_id: string;
  chokepoint_name: string;
  chokepoint_type: string;
  gps_lat: number;
  gps_lng: number;
  zone_id: string;
  avg_daily_traffic?: number;
  peak_hours?: string;
  risk_level: 'very high' | 'high' | 'medium' | 'low';
  description?: string;
}

export interface MLPrediction {
  prediction_id: number;
  case_id: string;
  predicted_zones: ZonePrediction[];
  input_factors: any;
  model_version: string;
  confidence_avg: number;
  predicted_at: Date;
  actual_zone?: string;
  was_correct?: boolean;
}

export interface ZonePrediction {
  zone_id: string;
  zone_name: string;
  confidence: number;
  cctv_cameras?: CCTVCamera[];
  nearby_chokepoints?: Chokepoint[];
  reasoning?: string;
}

export interface Match {
  match_id: number;
  case1_id: string;
  case2_id: string;
  match_score: number;
  match_type: 'photo' | 'text' | 'features' | 'voice' | 'bilateral';
  match_details: any;
  status: 'potential' | 'confirmed' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: Date;
}

export interface Dispatch {
  dispatch_id: number;
  case_id: string;
  station_id: string;
  officer_names: string[];
  vehicle_number: string;
  target_lat: number;
  target_lng: number;
  target_zone: string;
  status: 'dispatched' | 'arrived' | 'completed' | 'cancelled';
  dispatched_at: Date;
  arrived_at?: Date;
  completed_at?: Date;
  notes?: string;
}

export interface AdminUser {
  admin_id: string;
  username: string;
  password_hash: string;
  full_name: string;
  email?: string;
  role: 'admin' | 'superadmin';
  is_active: boolean;
}

// API Request/Response types

export interface CreateCaseRequest {
  case_type: CaseType;
  reporter_name: string;
  reporter_phone: string;
  person_name?: string;
  person_age?: number;
  person_gender?: string;
  person_height?: number;
  person_clothing?: string;
  person_physical_features?: string;
  person_language?: string;
  last_seen_location?: string;
  found_person_description?: string;
  gps_lat: number;
  gps_lng: number;
  urgency?: Urgency;
  // Photos uploaded as multipart/form-data
}

export interface SearchCasesQuery {
  status?: CaseStatus;
  urgency?: Urgency;
  zone?: string;
  age?: number;
  gender?: string;
  has_photo?: boolean;
  broadcast_active?: boolean;
  text?: string;
  limit?: number;
  offset?: number;
}

export interface LoginRequest {
  login_id: string;
  password: string;
  role: 'sherlock' | 'police' | 'admin';
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    role: string;
    zone_id?: string;
  };
}

export interface GPSLocation {
  lat: number;
  lng: number;
}

// Socket.IO events

export interface SocketEvents {
  // Server → Client
  'case:new': (data: Case) => void;
  'case:updated': (data: Case) => void;
  'alert:p1': (data: { case: Case; message: string }) => void;
  'ml:prediction': (data: { case_id: string; predictions: ZonePrediction[] }) => void;
  'broadcast:timer': (data: { case_id: string; minutes_left: number }) => void;
  'broadcast:expired': (data: { case_id: string }) => void;
  'match:found': (data: Match) => void;
  'sherlock:location': (data: { sherlock_id: string; location: GPSLocation }) => void;
  'zone:prediction_update': (data: any) => void;
  
  // Client → Server
  'zone:join': (zone_id: string) => void;
  'zone:leave': (zone_id: string) => void;
  'sherlock:heartbeat': (data: { sherlock_id: string; location: GPSLocation }) => void;
  'case:subscribe': (case_id: string) => void;
  'case:unsubscribe': (case_id: string) => void;
}
