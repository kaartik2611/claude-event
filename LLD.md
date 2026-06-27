# Low-Level Design (LLD) - Kumbh Mela Missing Person System

## Table of Contents
1. [System Architecture](#system-architecture)
2. [API Specifications](#api-specifications)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Services](#backend-services)
5. [Database Schemas](#database-schemas)
6. [Real-time Communication](#real-time-communication)
7. [Queue Architecture](#queue-architecture)

---

## 1. System Architecture

### Deployment Model
```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                      │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐     │
│  │   Sherlock   │  │    Central    │  │   Police    │     │
│  │  Station PWA │  │   Command     │  │   Portal    │     │
│  └──────────────┘  └───────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTPS (JWT Auth)
                            │
┌─────────────────────────────────────────────────────────────┐
│                  API GATEWAY / Load Balancer                 │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼─────────┐
│  Case Service  │  │ Match Service  │  │ Sherlock Svc   │
│  (Express TS)  │  │  (Express TS)  │  │  (Express TS)  │
└────────┬───────┘  └────────┬───────┘  └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼─────────┐
│  PostgreSQL    │  │     Redis      │  │   S3/MinIO     │
│   (Primary)    │  │ (Cache+Queue)  │  │    (Photos)    │
└────────────────┘  └────────────────┘  └────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Bull Workers  │
                    │  (Background)  │
                    └────────────────┘
```

### Tech Stack Summary
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js 20 + Express + TypeScript
- **Database**: PostgreSQL 16 + PostGIS + pg_trgm
- **Cache/Queue**: Redis 7 + Bull
- **Real-time**: Socket.IO
- **AI/ML**: Claude Haiku API (Anthropic)
- **Storage**: S3/MinIO for photos and voice
- **Auth**: JWT (jsonwebtoken)
- **Maps**: Leaflet + react-leaflet + leaflet.heat

---

## 2. API Specifications

### 2.1 Authentication APIs

#### `POST /api/auth/login`
**Description**: Authenticate user and get JWT token

**Request Body**:
```typescript
{
  "role": "sherlock" | "police" | "admin",
  "identifier": string,  // sherlock_id, police_station_id, or admin_email
  "password": string
}
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "token": string,  // JWT token
  "user": {
    "id": string,
    "role": "sherlock" | "police" | "admin",
    "name": string,
    "zone_id"?: string,  // for police/sherlock
    "assigned_zone"?: string,
    "permissions": string[]
  },
  "expiresIn": number  // seconds
}
```

**Response** (401 Unauthorized):
```typescript
{
  "success": false,
  "error": "Invalid credentials"
}
```

---

#### `POST /api/auth/refresh`
**Description**: Refresh JWT token

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "token": string,
  "expiresIn": number
}
```

---

### 2.2 Case Management APIs

#### `POST /api/cases`
**Description**: Create new missing person case (Sherlock Station)

**Headers**:
```
Authorization: Bearer <sherlock_jwt>
Content-Type: multipart/form-data
```

**Request Body** (multipart/form-data):
```typescript
{
  "case_type": "lost" | "searching" | "found",  // Case 1, 2, or 3
  "sherlock_id": string,
  
  // Reporter info
  "reporter_name": string,
  "reporter_phone": string,
  "reporter_photo": File,  // Image file
  
  // Missing person info
  "person_name"?: string,
  "person_age"?: number,
  "person_gender"?: "M" | "F" | "O",
  "person_description": string,
  "person_photo"?: File,  // Required for Case 1 & 3
  "person_clothing"?: string,
  "person_height"?: number,  // cm
  
  // Location data
  "report_gps_lat": number,
  "report_gps_lng": number,
  "last_seen_zone"?: string,
  "last_seen_time"?: string,  // ISO 8601
  
  // Voice recording (Case 2 option)
  "voice_recording"?: File,  // Audio file
  
  // Case 3 specific
  "found_person_photo"?: File,
  "found_person_condition": "healthy" | "injured" | "distressed",
  
  // Additional
  "urgency": "P1" | "P2" | "P3",  // Auto-set for Case 3
  "notes"?: string
}
```

**Response** (201 Created):
```typescript
{
  "success": true,
  "case": {
    "case_id": string,  // "KMP-2027-00001234"
    "case_type": string,
    "status": "active" | "matched" | "resolved",
    "urgency": string,
    "created_at": string,
    "sherlock_id": string,
    "sherlock_name": string,
    
    // Photos (URLs)
    "reporter_photo_url": string,
    "person_photo_url"?: string,
    "found_person_photo_url"?: string,
    
    // GPS
    "report_gps": {
      "lat": number,
      "lng": number
    },
    
    // Broadcast
    "broadcast_active": boolean,
    "broadcast_expires_at"?: string,
    
    // ML predictions (if available)
    "predicted_zones"?: [
      {
        "zone_id": string,
        "zone_name": string,
        "confidence": number  // 0-1
      }
    ]
  },
  "queue_position": number  // Position in processing queue
}
```

**Response** (400 Bad Request):
```typescript
{
  "success": false,
  "error": "Missing required fields",
  "missing_fields": string[]
}
```

---

#### `GET /api/cases/:case_id`
**Description**: Get case details

**Headers**:
```
Authorization: Bearer <jwt>
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "case": {
    "case_id": string,
    "case_type": "lost" | "searching" | "found",
    "status": "active" | "matched" | "resolved" | "expired",
    "urgency": "P1" | "P2" | "P3",
    
    // Reporter
    "reporter": {
      "name": string,
      "phone": string,
      "photo_url": string
    },
    
    // Missing person
    "person": {
      "name"?: string,
      "age"?: number,
      "gender"?: string,
      "description": string,
      "photo_url"?: string,
      "clothing"?: string,
      "height"?: number,
      "features": string[]  // Extracted by SLM
    },
    
    // Location
    "report_gps": {
      "lat": number,
      "lng": number
    },
    "last_seen_zone"?: string,
    "last_seen_time"?: string,
    
    // Media
    "voice_recording_url"?: string,
    "found_person_photo_url"?: string,
    
    // Sherlock info
    "sherlock": {
      "id": string,
      "name": string,
      "phone": string,
      "assigned_zone": string
    },
    
    // Broadcast
    "broadcast_active": boolean,
    "broadcast_started_at"?: string,
    "broadcast_expires_at"?: string,
    "broadcast_time_remaining"?: number,  // seconds
    
    // ML Predictions
    "ml_predictions": [
      {
        "zone_id": string,
        "zone_name": string,
        "confidence": number,
        "cctv_cameras": [
          {
            "camera_id": string,
            "location": string,
            "coverage_area": string
          }
        ]
      }
    ],
    
    // Match suggestions
    "potential_matches": [
      {
        "case_id": string,
        "match_score": number,  // 0-1
        "match_reasons": string[]
      }
    ],
    
    // Timestamps
    "created_at": string,
    "updated_at": string,
    "resolved_at"?: string
  }
}
```

---

#### `GET /api/cases`
**Description**: Search and list cases (with filters)

**Headers**:
```
Authorization: Bearer <jwt>
```

**Query Parameters**:
```typescript
{
  "search"?: string,  // Name or description
  "status"?: "active" | "matched" | "resolved" | "expired",
  "urgency"?: "P1" | "P2" | "P3",
  "zone_id"?: string,  // Police portal (auto-filtered by JWT)
  "case_type"?: "lost" | "searching" | "found",
  "sherlock_id"?: string,
  "date_from"?: string,  // ISO 8601
  "date_to"?: string,
  "has_photo"?: boolean,
  "has_match"?: boolean,
  "age_min"?: number,
  "age_max"?: number,
  "gender"?: "M" | "F" | "O",
  "broadcast_active"?: boolean,
  "page"?: number,  // Default: 1
  "limit"?: number,  // Default: 20, Max: 100
  "sort"?: "newest" | "oldest" | "urgency" | "match_score"
}
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "cases": [
    {
      "case_id": string,
      "case_type": string,
      "status": string,
      "urgency": string,
      "person_name"?: string,
      "person_age"?: number,
      "person_gender"?: string,
      "person_photo_url"?: string,
      "reporter_name": string,
      "report_gps": { lat: number, lng: number },
      "last_seen_zone"?: string,
      "sherlock_name": string,
      "broadcast_active": boolean,
      "broadcast_expires_at"?: string,
      "match_score"?: number,
      "created_at": string
    }
  ],
  "pagination": {
    "page": number,
    "limit": number,
    "total": number,
    "total_pages": number,
    "has_next": boolean,
    "has_prev": boolean
  },
  "filters_applied": object
}
```

---

#### `PATCH /api/cases/:case_id`
**Description**: Update case (status, notes, broadcast timer)

**Headers**:
```
Authorization: Bearer <jwt>
```

**Request Body**:
```typescript
{
  "status"?: "active" | "matched" | "resolved" | "expired",
  "notes"?: string,
  "broadcast_extend"?: number,  // Extend by X minutes
  "broadcast_stop"?: boolean,
  "resolved_by"?: string,  // Officer name
  "resolution_notes"?: string,
  "matched_with_case_id"?: string
}
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "case": { /* Updated case object */ },
  "changes": {
    "status": { old: string, new: string },
    "broadcast_expires_at": { old: string, new: string }
  }
}
```

---

#### `POST /api/cases/:case_id/still-searching`
**Description**: Extend broadcast timer (Sherlock renewal)

**Headers**:
```
Authorization: Bearer <sherlock_jwt>
```

**Request Body**:
```typescript
{
  "extend_by": number,  // minutes (default: 60)
  "update_notes"?: string
}
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "case_id": string,
  "broadcast_expires_at": string,
  "time_remaining": number,  // seconds
  "renewals_count": number
}
```

---

### 2.3 Search APIs

#### `POST /api/search`
**Description**: Advanced search with fuzzy matching, photo similarity, voice

**Headers**:
```
Authorization: Bearer <jwt>
```

**Request Body** (multipart/form-data):
```typescript
{
  "query_type": "text" | "photo" | "voice",
  
  // Text search
  "search_text"?: string,  // Fuzzy search on names, descriptions
  
  // Photo search
  "search_photo"?: File,  // Image file
  
  // Voice search
  "search_voice"?: File,  // Audio file (will be processed by SLM)
  
  // Filters
  "zone_id"?: string,
  "age_range"?: { min: number, max: number },
  "gender"?: "M" | "F" | "O",
  "date_range"?: { from: string, to: string },
  "status"?: string[],
  
  // Options
  "limit"?: number,  // Default: 10
  "similarity_threshold"?: number  // 0-1, default: 0.7
}
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "results": [
    {
      "case_id": string,
      "match_score": number,  // 0-1
      "match_type": "text" | "photo" | "features" | "voice",
      "match_details": {
        "text_similarity"?: number,
        "photo_similarity"?: number,
        "feature_matches"?: string[],
        "confidence": number
      },
      "case": { /* Full case object */ }
    }
  ],
  "search_metadata": {
    "query": string,
    "processing_time_ms": number,
    "total_results": number,
    "slm_processed": boolean,
    "photo_processed": boolean
  }
}
```

---

### 2.4 Sherlock Management APIs

#### `POST /api/sherlocks`
**Description**: Register new Sherlock volunteer

**Headers**:
```
Authorization: Bearer <admin_jwt>
```

**Request Body**:
```typescript
{
  "name": string,
  "phone": string,
  "email"?: string,
  "assigned_zone": string,
  "languages": string[],  // ["hindi", "bhojpuri", "urdu"]
  "password": string
}
```

**Response** (201 Created):
```typescript
{
  "success": true,
  "sherlock": {
    "sherlock_id": string,  // "SHK-2027-00123"
    "name": string,
    "phone": string,
    "email"?: string,
    "assigned_zone": string,
    "languages": string[],
    "status": "active",
    "created_at": string
  },
  "credentials": {
    "sherlock_id": string,
    "password": string  // Show once, then hash
  }
}
```

---

#### `GET /api/sherlocks/:sherlock_id`
**Description**: Get Sherlock details and statistics

**Headers**:
```
Authorization: Bearer <jwt>
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "sherlock": {
    "sherlock_id": string,
    "name": string,
    "phone": string,
    "email"?: string,
    "assigned_zone": string,
    "languages": string[],
    "status": "active" | "inactive" | "offline",
    
    // Real-time location
    "current_gps": {
      "lat": number,
      "lng": number,
      "last_updated": string
    },
    
    // Statistics
    "stats": {
      "reports_filed": number,
      "reports_today": number,
      "cases_resolved": number,
      "avg_response_time": number,  // minutes
      "active_since": string
    },
    
    // Recent cases
    "recent_cases": [
      {
        "case_id": string,
        "case_type": string,
        "status": string,
        "created_at": string
      }
    ],
    
    "created_at": string,
    "last_active": string
  }
}
```

---

#### `GET /api/sherlocks/zone/:zone_id`
**Description**: Get all Sherlocks in a zone

**Headers**:
```
Authorization: Bearer <jwt>
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "zone_id": string,
  "zone_name": string,
  "sherlocks": [
    {
      "sherlock_id": string,
      "name": string,
      "status": "active" | "inactive" | "offline",
      "current_gps": { lat: number, lng: number },
      "reports_filed_today": number,
      "last_active": string
    }
  ],
  "summary": {
    "total": number,
    "active": number,
    "offline": number,
    "total_reports_today": number
  }
}
```

---

#### `PATCH /api/sherlocks/:sherlock_id/location`
**Description**: Update Sherlock GPS location (real-time)

**Headers**:
```
Authorization: Bearer <sherlock_jwt>
```

**Request Body**:
```typescript
{
  "gps_lat": number,
  "gps_lng": number,
  "accuracy": number,  // meters
  "timestamp": string  // ISO 8601
}
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "sherlock_id": string,
  "location_updated": true,
  "timestamp": string
}
```

---

### 2.5 Police Portal APIs

#### `GET /api/police/dashboard/:station_id`
**Description**: Get zone-specific dashboard data for police station

**Headers**:
```
Authorization: Bearer <police_jwt>
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "station": {
    "station_id": string,
    "station_name": string,
    "zone_id": string,
    "zone_name": string,
    "gps": { lat: number, lng: number }
  },
  
  "cases": {
    "active": number,
    "p1_alerts": number,
    "resolved_today": number,
    "pending_action": number
  },
  
  "p1_alerts": [
    {
      "case_id": string,
      "alert_type": "found_unknown",
      "person_photo_url": string,
      "found_person_photo_url": string,
      "report_gps": { lat: number, lng: number },
      "sherlock_name": string,
      "created_at": string,
      "time_elapsed": number  // minutes
    }
  ],
  
  "ml_predictions": [
    {
      "case_id": string,
      "person_name": string,
      "person_photo_url": string,
      "predicted_zones": [
        {
          "zone_id": string,
          "confidence": number,
          "is_my_zone": boolean,
          "cctv_cameras": [
            {
              "camera_id": string,
              "location": string,
              "type": "fixed" | "ptz" | "mobile"
            }
          ]
        }
      ],
      "last_prediction": string
    }
  ],
  
  "recent_activity": [
    {
      "case_id": string,
      "event_type": "new_case" | "status_update" | "match_found" | "resolved",
      "details": string,
      "timestamp": string
    }
  ]
}
```

---

#### `POST /api/police/cases/:case_id/dispatch`
**Description**: Dispatch team for a case

**Headers**:
```
Authorization: Bearer <police_jwt>
```

**Request Body**:
```typescript
{
  "officer_names": string[],
  "vehicle_number"?: string,
  "target_location": {
    "lat": number,
    "lng": number,
    "description": string  // "CCTV Zone 5, Sector A"
  },
  "notes"?: string
}
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "dispatch_id": string,
  "case_id": string,
  "dispatched_at": string,
  "officers": string[],
  "estimated_arrival": string
}
```

---

### 2.6 Analytics APIs

#### `GET /api/analytics/heatmap`
**Description**: Get heatmap data for missing person density

**Headers**:
```
Authorization: Bearer <admin_jwt>
```

**Query Parameters**:
```typescript
{
  "date_from"?: string,
  "date_to"?: string,
  "status"?: string,
  "case_type"?: string
}
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "heatmap_data": [
    {
      "lat": number,
      "lng": number,
      "intensity": number,  // 0-1
      "case_count": number
    }
  ],
  "metadata": {
    "total_points": number,
    "max_intensity": number,
    "date_range": { from: string, to: string }
  }
}
```

---

#### `GET /api/analytics/stats`
**Description**: Get overall statistics

**Headers**:
```
Authorization: Bearer <admin_jwt>
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "stats": {
    "cases": {
      "total": number,
      "active": number,
      "resolved": number,
      "resolution_rate": number,  // percentage
      "avg_resolution_time": number  // minutes
    },
    "today": {
      "new_cases": number,
      "resolved": number,
      "p1_alerts": number
    },
    "sherlocks": {
      "total": number,
      "active_now": number,
      "reports_today": number
    },
    "zones": [
      {
        "zone_id": string,
        "zone_name": string,
        "active_cases": number,
        "density": "low" | "medium" | "high"
      }
    ],
    "ml_predictions": {
      "total_predictions": number,
      "successful_matches": number,
      "accuracy": number  // percentage
    }
  },
  "timestamp": string
}
```

---

### 2.7 ML/SLM APIs (Internal)

#### `POST /api/ml/parse-voice`
**Description**: Process voice recording with SLM (Internal use by workers)

**Headers**:
```
X-Internal-Service-Key: <service_key>
```

**Request Body**:
```typescript
{
  "voice_file_url": string,
  "language": "hindi" | "bhojpuri" | "urdu" | "english",
  "context": "missing_person_description"
}
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "parsed_data": {
    "person_name"?: string,
    "age_estimate"?: number,
    "age_range"?: { min: number, max: number },
    "gender"?: "M" | "F" | "O",
    "height_estimate"?: number,
    "clothing": string[],
    "physical_features": string[],
    "distinguishing_marks": string[],
    "urgency": "P1" | "P2" | "P3",
    "emotional_state"?: string,
    "confidence": number  // 0-1
  },
  "raw_transcript": string,
  "language_detected": string,
  "processing_time_ms": number
}
```

---

#### `POST /api/ml/predict-zones`
**Description**: Run zone prediction for a case (runs every 15 min)

**Headers**:
```
X-Internal-Service-Key: <service_key>
```

**Request Body**:
```typescript
{
  "case_id": string,
  "person_age": number,
  "last_seen_zone"?: string,
  "last_seen_time": string,
  "report_gps": { lat: number, lng: number },
  "time_elapsed_minutes": number
}
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "case_id": string,
  "predictions": [
    {
      "zone_id": string,
      "zone_name": string,
      "confidence": number,  // 0-1
      "reasoning": string[],
      "cctv_cameras": string[],
      "distance_from_report": number,  // km
      "estimated_travel_time": number  // minutes
    }
  ],
  "prediction_timestamp": string,
  "model_version": string
}
```

---

### 2.8 Photo Upload/Retrieve APIs

#### `POST /api/photos/upload`
**Description**: Upload photo (used by cases API internally)

**Headers**:
```
Authorization: Bearer <jwt>
Content-Type: multipart/form-data
```

**Request Body**:
```typescript
{
  "photo": File,
  "photo_type": "reporter" | "lost_person" | "found_person",
  "case_id": string,
  "metadata"?: {
    "gps": { lat: number, lng: number },
    "timestamp": string
  }
}
```

**Response** (200 OK):
```typescript
{
  "success": true,
  "photo_id": string,
  "photo_url": string,
  "thumbnail_url": string,
  "metadata": {
    "size": number,
    "dimensions": { width: number, height: number },
    "format": string
  }
}
```

---

#### `GET /api/photos/:photo_id`
**Description**: Get photo by ID

**Headers**:
```
Authorization: Bearer <jwt>
```

**Response**: Image file (binary) or presigned URL

---

## 3. Frontend Architecture

### 3.1 Project Structure

```
frontend/
├── src/
│   ├── main.tsx                 # Entry point
│   ├── App.tsx                  # Root component with routing
│   ├── vite-env.d.ts
│   │
│   ├── features/                # Feature-based organization
│   │   ├── auth/
│   │   │   ├── Login.tsx
│   │   │   ├── useAuth.ts      # Auth hook
│   │   │   └── authSlice.ts    # Redux slice
│   │   │
│   │   ├── sherlock/           # Sherlock Station PWA
│   │   │   ├── SherlockDashboard.tsx
│   │   │   ├── CaseForm.tsx
│   │   │   ├── Case1Lost.tsx
│   │   │   ├── Case2Searching.tsx
│   │   │   ├── Case3Found.tsx
│   │   │   ├── CameraCapture.tsx
│   │   │   ├── VoiceRecorder.tsx
│   │   │   ├── GPSCapture.tsx
│   │   │   ├── BroadcastDisplay.tsx
│   │   │   └── StillSearching.tsx
│   │   │
│   │   ├── police/             # Police Portal
│   │   │   ├── PoliceDashboard.tsx
│   │   │   ├── CaseList.tsx
│   │   │   ├── CaseDetails.tsx
│   │   │   ├── MLPredictions.tsx
│   │   │   ├── P1Alerts.tsx
│   │   │   ├── CCTVMap.tsx
│   │   │   └── DispatchForm.tsx
│   │   │
│   │   ├── central/            # Central Command
│   │   │   ├── CentralDashboard.tsx
│   │   │   ├── Heatmap.tsx
│   │   │   ├── Analytics.tsx
│   │   │   ├── SherlockMonitor.tsx
│   │   │   ├── BroadcastManager.tsx
│   │   │   └── PhotoGallery.tsx
│   │   │
│   │   ├── search/             # Search functionality
│   │   │   ├── SearchBar.tsx
│   │   │   ├── SearchResults.tsx
│   │   │   ├── PhotoSearch.tsx
│   │   │   └── VoiceSearch.tsx
│   │   │
│   │   └── cases/              # Shared case components
│   │       ├── CaseCard.tsx
│   │       ├── CaseTimeline.tsx
│   │       ├── PhotoViewer.tsx
│   │       └── StatusBadge.tsx
│   │
│   ├── components/             # Shared UI components
│   │   ├── ui/                 # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   └── ...
│   │   ├── Layout.tsx
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Map.tsx
│   │   └── Loader.tsx
│   │
│   ├── hooks/                  # Custom hooks
│   │   ├── useCamera.ts
│   │   ├── useGPS.ts
│   │   ├── useSocket.ts
│   │   ├── useOffline.ts
│   │   └── usePWA.ts
│   │
│   ├── store/                  # Redux store
│   │   ├── index.ts
│   │   ├── authSlice.ts
│   │   ├── casesSlice.ts
│   │   ├── sherlockSlice.ts
│   │   └── policeSlice.ts
│   │
│   ├── services/               # API services
│   │   ├── api.ts              # Axios instance
│   │   ├── authService.ts
│   │   ├── caseService.ts
│   │   ├── searchService.ts
│   │   ├── sherlockService.ts
│   │   └── socketService.ts
│   │
│   ├── utils/                  # Utility functions
│   │   ├── camera.ts
│   │   ├── gps.ts
│   │   ├── validation.ts
│   │   ├── formatters.ts
│   │   └── constants.ts
│   │
│   ├── types/                  # TypeScript types
│   │   ├── case.ts
│   │   ├── user.ts
│   │   ├── sherlock.ts
│   │   └── api.ts
│   │
│   └── styles/
│       ├── index.css           # Tailwind imports
│       └── globals.css
│
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── service-worker.js       # PWA service worker
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
│
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### 3.2 Key Frontend Components

#### **SherlockDashboard.tsx**
```typescript
interface SherlockDashboardProps {
  sherlockId: string;
}

// Features:
// - Show 3 case type buttons (Case 1, 2, 3)
// - Display current GPS location
// - Show today's reports count
// - Broadcast display of active cases
// - "Still Searching" renewal button
// - Offline sync indicator
```

#### **CameraCapture.tsx**
```typescript
interface CameraCaptureProps {
  onCapture: (photo: Blob) => void;
  photoType: 'reporter' | 'lost_person' | 'found_person';
  required: boolean;
}

// Features:
// - Access device camera via getUserMedia
// - Show camera preview
// - Capture photo
// - Retake option
// - Compress image before upload
```

#### **GPSCapture.tsx**
```typescript
interface GPSCaptureProps {
  onCapture: (gps: { lat: number; lng: number }) => void;
  autoCapture?: boolean;
}

// Features:
// - Get current GPS using navigator.geolocation
// - Show accuracy indicator
// - Manual refresh button
// - Offline fallback (use last known)
```

#### **Map.tsx** (Leaflet)
```typescript
interface MapProps {
  cases: Case[];
  center: [number, number];
  zoom: number;
  heatmapMode?: boolean;
  onCaseClick?: (caseId: string) => void;
}

// Features:
// - Display cases as markers
// - Heatmap overlay (leaflet.heat)
// - Cluster markers
// - CCTV camera overlay
// - Zone boundaries
// - Click for case details
```

---

## 4. Backend Services

### 4.1 Microservices Architecture

```
┌─────────────────────────────────────────────────────┐
│               API Gateway (Port 3000)                │
│            Express + JWT Middleware                  │
└──────────────┬──────────────────────────────────────┘
               │
   ┌───────────┼───────────┬───────────┬──────────┐
   │           │           │           │          │
┌──▼───┐  ┌───▼───┐  ┌────▼────┐  ┌──▼──┐  ┌───▼────┐
│ Case │  │ Match │  │Sherlock │  │Auth │  │Analytics│
│ Svc  │  │  Svc  │  │   Svc   │  │ Svc │  │   Svc   │
└──┬───┘  └───┬───┘  └────┬────┘  └─────┘  └───┬────┘
   │          │           │                     │
   └──────────┴───────────┴─────────────────────┘
                          │
                    ┌─────▼──────┐
                    │  Database  │
                    │PostgreSQL  │
                    └────────────┘
```

### 4.2 Service Breakdown

#### **Case Service** (`src/services/case.service.ts`)
```typescript
class CaseService {
  // Create new case
  async createCase(data: CreateCaseDTO): Promise<Case>
  
  // Get case by ID
  async getCaseById(caseId: string): Promise<Case | null>
  
  // Search cases
  async searchCases(filters: CaseFilters): Promise<Case[]>
  
  // Update case
  async updateCase(caseId: string, updates: Partial<Case>): Promise<Case>
  
  // Get cases by zone (for police portal)
  async getCasesByZone(zoneId: string, filters?: CaseFilters): Promise<Case[]>
  
  // Get active broadcasts
  async getActiveBroadcasts(): Promise<Case[]>
  
  // Extend broadcast timer
  async extendBroadcast(caseId: string, minutes: number): Promise<Case>
  
  // Expire old broadcasts (cron job)
  async expireBroadcasts(): Promise<void>
}
```

#### **Match Service** (`src/services/match.service.ts`)
```typescript
class MatchService {
  // Find potential matches for a case
  async findMatches(caseId: string): Promise<Match[]>
  
  // Bilateral matching (lost + searching)
  async bilateralMatch(case1Id: string, case2Id: string): Promise<MatchResult>
  
  // Photo similarity matching
  async photoMatch(photoUrl: string, threshold: number): Promise<Case[]>
  
  // Voice/text feature matching
  async featureMatch(features: string[]): Promise<Case[]>
  
  // Deduplication check
  async checkDuplicate(caseData: CreateCaseDTO): Promise<Case | null>
  
  // Score match quality
  calculateMatchScore(case1: Case, case2: Case): number
}
```

#### **Sherlock Service** (`src/services/sherlock.service.ts`)
```typescript
class SherlockService {
  // Register new Sherlock
  async registerSherlock(data: RegisterSherlockDTO): Promise<Sherlock>
  
  // Get Sherlock by ID
  async getSherlockById(id: string): Promise<Sherlock | null>
  
  // Update Sherlock location
  async updateLocation(id: string, gps: GPS): Promise<void>
  
  // Get Sherlocks by zone
  async getSherlocksByZone(zoneId: string): Promise<Sherlock[]>
  
  // Get Sherlock statistics
  async getStats(id: string): Promise<SherlockStats>
  
  // Set Sherlock status (active/inactive)
  async setStatus(id: string, status: SherlockStatus): Promise<void>
}
```

#### **SLM Service** (`src/services/slm.service.ts`)
```typescript
class SLMService {
  // Parse voice recording to structured data
  async parseVoice(audioUrl: string, language: string): Promise<ParsedData>
  
  // Extract features from text description
  async extractFeatures(description: string): Promise<string[]>
  
  // Triage urgency (P1/P2/P3)
  async triageUrgency(caseData: any): Promise<UrgencyLevel>
  
  // Match scoring with AI
  async scoreMatch(case1: Case, case2: Case): Promise<number>
  
  // Translate voice to English for ML pipeline
  async translateToEnglish(text: string, sourceLang: string): Promise<string>
}
```

#### **ML Prediction Service** (`src/services/ml.service.ts`)
```typescript
class MLService {
  // Predict zones for a case
  async predictZones(caseId: string): Promise<ZonePrediction[]>
  
  // Run prediction for all active cases (cron: every 15 min)
  async runBatchPredictions(): Promise<void>
  
  // Calculate zone probability based on:
  // - Time elapsed
  // - Last seen location
  // - Person age (children wander less)
  // - CCTV coverage
  // - Chokepoint distances
  // - Historical patterns
  calculateZoneProbability(case: Case, zone: Zone): number
  
  // Get CCTV cameras for predicted zones
  async getCCTVForZones(zoneIds: string[]): Promise<CCTVCamera[]>
}
```

---

## 5. Database Schemas

### 5.1 PostgreSQL Tables

#### **cases** table
```sql
CREATE TABLE cases (
  -- Identity
  case_id VARCHAR(50) PRIMARY KEY,  -- 'KMP-2027-00001234'
  case_type VARCHAR(20) NOT NULL,   -- 'lost', 'searching', 'found'
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active', 'matched', 'resolved', 'expired'
  urgency VARCHAR(5) NOT NULL DEFAULT 'P2',  -- 'P1', 'P2', 'P3'
  
  -- Reporter info
  reporter_name VARCHAR(255) NOT NULL,
  reporter_phone VARCHAR(20) NOT NULL,
  reporter_photo_url TEXT,
  
  -- Missing person info
  person_name VARCHAR(255),
  person_age INTEGER,
  person_gender CHAR(1),  -- 'M', 'F', 'O'
  person_description TEXT NOT NULL,
  person_photo_url TEXT,
  person_clothing TEXT,
  person_height INTEGER,  -- cm
  person_features TEXT[],  -- Array of extracted features
  
  -- Found person (Case 3)
  found_person_photo_url TEXT,
  found_person_condition VARCHAR(50),
  
  -- Location data
  report_gps_lat DECIMAL(10, 8) NOT NULL,
  report_gps_lng DECIMAL(11, 8) NOT NULL,
  report_gps_point GEOGRAPHY(POINT, 4326),  -- PostGIS
  last_seen_zone VARCHAR(50),
  last_seen_time TIMESTAMP,
  
  -- Sherlock info
  sherlock_id VARCHAR(50) NOT NULL REFERENCES sherlocks(sherlock_id),
  sherlock_name VARCHAR(255),
  
  -- Broadcast management
  broadcast_active BOOLEAN DEFAULT FALSE,
  broadcast_started_at TIMESTAMP,
  broadcast_expires_at TIMESTAMP,
  broadcast_renewals INTEGER DEFAULT 0,
  
  -- Voice/media
  voice_recording_url TEXT,
  
  -- Search vectors (PostgreSQL full-text search)
  search_vector TSVECTOR,
  
  -- Matching
  matched_with_case_id VARCHAR(50) REFERENCES cases(case_id),
  match_score DECIMAL(3, 2),
  
  -- Resolution
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution_notes TEXT,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  CONSTRAINT chk_status CHECK (status IN ('active', 'matched', 'resolved', 'expired')),
  CONSTRAINT chk_urgency CHECK (urgency IN ('P1', 'P2', 'P3'))
);

-- Indexes for performance
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_urgency ON cases(urgency);
CREATE INDEX idx_cases_sherlock ON cases(sherlock_id);
CREATE INDEX idx_cases_zone ON cases(last_seen_zone);
CREATE INDEX idx_cases_gps ON cases USING GIST (report_gps_point);
CREATE INDEX idx_cases_broadcast ON cases(broadcast_active, broadcast_expires_at) WHERE broadcast_active = TRUE;
CREATE INDEX idx_cases_created ON cases(created_at DESC);

-- Full-text search index (trigram for fuzzy matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_cases_person_name_trgm ON cases USING gin (person_name gin_trgm_ops);
CREATE INDEX idx_cases_description_trgm ON cases USING gin (person_description gin_trgm_ops);

-- Full-text search vector
CREATE INDEX idx_cases_search_vector ON cases USING gin(search_vector);

-- Auto-update search_vector trigger
CREATE OR REPLACE FUNCTION update_case_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.person_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.person_description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.reporter_name, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_update_case_search_vector
  BEFORE INSERT OR UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_case_search_vector();
```

---

#### **sherlocks** table
```sql
CREATE TABLE sherlocks (
  sherlock_id VARCHAR(50) PRIMARY KEY,  -- 'SHK-2027-00123'
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  password_hash TEXT NOT NULL,
  
  -- Assignment
  assigned_zone VARCHAR(50) NOT NULL,
  languages TEXT[],  -- ['hindi', 'bhojpuri', 'urdu']
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',  -- 'active', 'inactive', 'offline'
  
  -- Current location
  current_gps_lat DECIMAL(10, 8),
  current_gps_lng DECIMAL(11, 8),
  current_gps_point GEOGRAPHY(POINT, 4326),
  location_last_updated TIMESTAMP,
  
  -- Statistics
  reports_filed INTEGER DEFAULT 0,
  cases_resolved INTEGER DEFAULT 0,
  avg_response_time INTEGER,  -- minutes
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP,
  
  CONSTRAINT chk_sherlock_status CHECK (status IN ('active', 'inactive', 'offline'))
);

CREATE INDEX idx_sherlocks_zone ON sherlocks(assigned_zone);
CREATE INDEX idx_sherlocks_status ON sherlocks(status);
CREATE INDEX idx_sherlocks_gps ON sherlocks USING GIST (current_gps_point);
```

---

#### **zones** table
```sql
CREATE TABLE zones (
  zone_id VARCHAR(50) PRIMARY KEY,
  zone_name VARCHAR(255) NOT NULL,
  zone_description TEXT,
  
  -- Geometry (polygon boundaries)
  zone_boundary GEOGRAPHY(POLYGON, 4326),
  
  -- Center point for reference
  center_lat DECIMAL(10, 8) NOT NULL,
  center_lng DECIMAL(11, 8) NOT NULL,
  
  -- Metadata
  area_sq_km DECIMAL(10, 2),
  population_density VARCHAR(20),  -- 'low', 'medium', 'high'
  zone_type VARCHAR(50),  -- 'residential', 'commercial', 'transit', 'religious'
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_zones_boundary ON zones USING GIST (zone_boundary);
```

---

#### **police_stations** table
```sql
CREATE TABLE police_stations (
  station_id VARCHAR(50) PRIMARY KEY,
  station_name VARCHAR(255) NOT NULL,
  zone_id VARCHAR(50) REFERENCES zones(zone_id),
  
  -- Location
  gps_lat DECIMAL(10, 8) NOT NULL,
  gps_lng DECIMAL(11, 8) NOT NULL,
  gps_point GEOGRAPHY(POINT, 4326),
  
  -- Contact
  phone VARCHAR(20),
  email VARCHAR(255),
  officer_in_charge VARCHAR(255),
  
  -- Credentials for police portal
  login_id VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_police_zone ON police_stations(zone_id);
CREATE INDEX idx_police_gps ON police_stations USING GIST (gps_point);
```

---

#### **cctv_cameras** table
```sql
CREATE TABLE cctv_cameras (
  camera_id VARCHAR(50) PRIMARY KEY,
  zone_id VARCHAR(50) REFERENCES zones(zone_id),
  
  -- Location
  location_name VARCHAR(255) NOT NULL,
  gps_lat DECIMAL(10, 8) NOT NULL,
  gps_lng DECIMAL(11, 8) NOT NULL,
  gps_point GEOGRAPHY(POINT, 4326),
  
  -- Camera specs
  camera_type VARCHAR(20),  -- 'fixed', 'ptz', 'mobile'
  coverage_area TEXT,
  coverage_radius DECIMAL(5, 2),  -- meters
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_checked TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cctv_zone ON cctv_cameras(zone_id);
CREATE INDEX idx_cctv_gps ON cctv_cameras USING GIST (gps_point);
CREATE INDEX idx_cctv_active ON cctv_cameras(is_active);
```

---

#### **chokepoints** table
```sql
CREATE TABLE chokepoints (
  chokepoint_id VARCHAR(50) PRIMARY KEY,
  chokepoint_name VARCHAR(255) NOT NULL,
  chokepoint_type VARCHAR(50),  -- 'parking', 'bus_stop', 'metro', 'ghat', 'temple'
  
  -- Location
  gps_lat DECIMAL(10, 8) NOT NULL,
  gps_lng DECIMAL(11, 8) NOT NULL,
  gps_point GEOGRAPHY(POINT, 4326),
  
  zone_id VARCHAR(50) REFERENCES zones(zone_id),
  
  -- Foot traffic estimate
  avg_daily_traffic INTEGER,
  peak_hours TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chokepoints_zone ON chokepoints(zone_id);
CREATE INDEX idx_chokepoints_gps ON chokepoints USING GIST (gps_point);
```

---

#### **ml_predictions** table
```sql
CREATE TABLE ml_predictions (
  prediction_id SERIAL PRIMARY KEY,
  case_id VARCHAR(50) REFERENCES cases(case_id),
  
  -- Predicted zones (array of JSON)
  predicted_zones JSONB NOT NULL,  -- [{ zone_id, confidence, reasoning }]
  
  -- Input factors
  input_factors JSONB,  -- { time_elapsed, age, last_zone, gps, ... }
  
  -- Metadata
  model_version VARCHAR(20),
  confidence_avg DECIMAL(3, 2),
  predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Outcome (for ML training feedback)
  actual_zone VARCHAR(50),
  was_correct BOOLEAN
);

CREATE INDEX idx_ml_predictions_case ON ml_predictions(case_id);
CREATE INDEX idx_ml_predictions_time ON ml_predictions(predicted_at DESC);
```

---

#### **matches** table
```sql
CREATE TABLE matches (
  match_id SERIAL PRIMARY KEY,
  case1_id VARCHAR(50) REFERENCES cases(case_id),
  case2_id VARCHAR(50) REFERENCES cases(case_id),
  
  -- Match score and type
  match_score DECIMAL(3, 2) NOT NULL,  -- 0.00 to 1.00
  match_type VARCHAR(50),  -- 'photo', 'text', 'features', 'voice', 'bilateral'
  
  -- Match details
  match_details JSONB,  -- { photo_similarity, feature_matches, ... }
  
  -- Status
  status VARCHAR(20) DEFAULT 'potential',  -- 'potential', 'confirmed', 'rejected'
  verified_by VARCHAR(255),
  verified_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT chk_match_score CHECK (match_score >= 0 AND match_score <= 1)
);

CREATE INDEX idx_matches_case1 ON matches(case1_id);
CREATE INDEX idx_matches_case2 ON matches(case2_id);
CREATE INDEX idx_matches_score ON matches(match_score DESC);
CREATE INDEX idx_matches_status ON matches(status);
```

---

#### **dispatches** table
```sql
CREATE TABLE dispatches (
  dispatch_id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) REFERENCES cases(case_id),
  station_id VARCHAR(50) REFERENCES police_stations(station_id),
  
  -- Team details
  officer_names TEXT[],
  vehicle_number VARCHAR(50),
  
  -- Target location
  target_lat DECIMAL(10, 8) NOT NULL,
  target_lng DECIMAL(11, 8) NOT NULL,
  target_description TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'dispatched',  -- 'dispatched', 'arrived', 'completed'
  dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  arrived_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Notes
  notes TEXT,
  outcome TEXT
);

CREATE INDEX idx_dispatches_case ON dispatches(case_id);
CREATE INDEX idx_dispatches_station ON dispatches(station_id);
CREATE INDEX idx_dispatches_status ON dispatches(status);
```

---

## 6. Real-time Communication (Socket.IO)

### 6.1 Socket.IO Events

#### **Server → Client Events**

```typescript
// Broadcast: New case created
socket.emit('case:new', {
  case_id: string,
  case_type: string,
  person_name: string,
  person_photo_url: string,
  zone_id: string,
  urgency: string,
  created_at: string
});

// Broadcast: Case updated
socket.emit('case:updated', {
  case_id: string,
  updates: Partial<Case>,
  updated_by: string
});

// P1 Alert (to police in zone)
socket.emit('alert:p1', {
  case_id: string,
  alert_type: 'found_unknown',
  person_photo_url: string,
  found_person_photo_url: string,
  report_gps: { lat: number, lng: number },
  sherlock_name: string,
  zone_id: string
});

// ML Prediction ready
socket.emit('ml:prediction', {
  case_id: string,
  predictions: ZonePrediction[],
  predicted_at: string
});

// Broadcast timer update
socket.emit('broadcast:timer', {
  case_id: string,
  time_remaining: number,  // seconds
  expires_at: string
});

// Broadcast expired
socket.emit('broadcast:expired', {
  case_id: string
});

// Match found
socket.emit('match:found', {
  case1_id: string,
  case2_id: string,
  match_score: number,
  match_type: string
});

// Sherlock location update (for admin monitoring)
socket.emit('sherlock:location', {
  sherlock_id: string,
  gps: { lat: number, lng: number },
  timestamp: string
});
```

#### **Client → Server Events**

```typescript
// Join zone room (for police portal)
socket.emit('zone:join', {
  zone_id: string,
  user_role: 'police' | 'admin'
});

// Leave zone room
socket.emit('zone:leave', {
  zone_id: string
});

// Sherlock heartbeat (location update)
socket.emit('sherlock:heartbeat', {
  sherlock_id: string,
  gps: { lat: number, lng: number },
  timestamp: string
});

// Request case details
socket.emit('case:subscribe', {
  case_id: string
});

// Unsubscribe from case updates
socket.emit('case:unsubscribe', {
  case_id: string
});
```

### 6.2 Socket.IO Room Structure

```typescript
// Rooms:
// - 'zone:{zone_id}' - All users in a specific zone
// - 'police:{station_id}' - Specific police station
// - 'sherlock:{sherlock_id}' - Individual Sherlock
// - 'admin' - Central command dashboard
// - 'case:{case_id}' - Updates for specific case
```

---

## 7. Queue Architecture (Redis Bull)

### 7.1 Queue Definitions

> **🔄 PERIODIC ML ZONE UPDATES**: All active cases get zone predictions updated every 15 minutes via the `ml-prediction-queue`. Zone positions are dynamically recalculated based on time elapsed, person movement patterns, and real-time data from CCTV/chokepoints.

#### **intake-queue**
- **Purpose**: Process incoming case submissions
- **Jobs**:
  - Validate case data
  - Upload photos to S3
  - Generate case_id
  - Save to PostgreSQL
  - Trigger match queue

**Job Data**:
```typescript
{
  case_type: string,
  reporter: { name, phone, photo },
  person: { name, age, gender, description, photo },
  gps: { lat, lng },
  sherlock_id: string,
  voice_recording?: Blob,
  urgency: string
}
```

**Priority**: P1 = 1 (highest), P2 = 5, P3 = 10

---

#### **match-queue**
- **Purpose**: Find potential matches for a case
- **Jobs**:
  - Run fuzzy text search
  - Photo similarity matching
  - Feature matching
  - Bilateral matching (lost + searching)
  - Save matches to database

**Job Data**:
```typescript
{
  case_id: string,
  search_params: {
    person_name?: string,
    features: string[],
    photo_url?: string,
    zone_id?: string
  }
}
```

---

#### **broadcast-queue**
- **Purpose**: Manage broadcast timers
- **Jobs**:
  - Start broadcast (60 min timer)
  - Send Socket.IO updates every 1 min
  - Expire broadcast after 60 min
  - Notify Sherlock of expiration

**Job Data**:
```typescript
{
  case_id: string,
  action: 'start' | 'extend' | 'stop',
  duration_minutes?: number
}
```

**Delayed Jobs**: Set expiry time, auto-process

---

#### **slm-queue**
- **Purpose**: Process voice recordings with Claude Haiku
- **Jobs**:
  - Transcribe voice to text
  - Extract structured data
  - Parse features (age, gender, clothing, etc.)
  - Triage urgency
  - Update case with parsed data

**Job Data**:
```typescript
{
  case_id: string,
  voice_recording_url: string,
  language: string
}
```

---

#### **ml-prediction-queue**
- **Purpose**: Generate zone predictions **periodically** and update zone positions
- **Jobs**:
  - Calculate zone probabilities based on time elapsed
  - Update predicted zone positions dynamically
  - Find CCTV cameras in predicted zones
  - Save predictions to database with timestamp
  - Push real-time updates to Police Portal via Socket.IO
  - Archive old predictions for ML training

**Job Data**:
```typescript
{
  case_id: string,
  run_type: 'immediate' | 'scheduled' | 'periodic_update',
  time_elapsed_minutes: number,  // Auto-calculated
  force_recalculate?: boolean,    // Force full recalc
  previous_zones?: string[]       // For position tracking
}
```

**Cron**: Runs every 15 minutes for all active cases (Bull repeat job)

**Periodic Update Logic**:
```typescript
// Every 15 minutes:
// 1. Get all active cases (status = 'active')
// 2. For each case:
//    a. Calculate time elapsed since report
//    b. Get previous predicted zones
//    c. Recalculate zone probabilities based on:
//       - Time elapsed (movement radius)
//       - Person age (children move slower)
//       - Last seen zone
//       - CCTV coverage
//       - Chokepoint proximity
//       - Historical patterns
//    d. Update zone positions if predictions change
//    e. Push Socket.IO update to police portal
//    f. Log prediction change for ML training
// 3. Archive predictions older than 24 hours
```

**Example Prediction Update**:
```typescript
// T = 0 min (report filed):
predictions = [
  { zone_id: "Zone 8", confidence: 0.85 },  // Last seen zone
  { zone_id: "Zone 7", confidence: 0.62 },  // Adjacent zone
  { zone_id: "Zone 9", confidence: 0.45 }
]

// T = 15 min (first update):
predictions = [
  { zone_id: "Zone 8", confidence: 0.72 },  // Decreasing (time passed)
  { zone_id: "Zone 7", confidence: 0.68 },  // Increasing (likely moved)
  { zone_id: "Zone 6", confidence: 0.54 }   // New zone appeared
]

// T = 30 min (second update):
predictions = [
  { zone_id: "Zone 7", confidence: 0.78 },  // Now top zone
  { zone_id: "Zone 6", confidence: 0.65 },
  { zone_id: "Zone 8", confidence: 0.48 }   // Dropped to 3rd
]
```

---

#### **photo-queue**
- **Purpose**: Process photo uploads
- **Jobs**:
  - Resize/compress photos
  - Generate thumbnails
  - Upload to S3/MinIO
  - Save URLs to database

**Job Data**:
```typescript
{8. Dataset Integration

### 8.1 KML Dataset Files

The system uses 3 KML dataset files located in `/dataset/`:

#### **1. CCTV Dataset.kml**
- **Contains**: Zone boundaries (polygons) and CCTV camera locations
- **Structure**:
  - Zone areas (e.g., "Zone Area 1") with polygon coordinates
  - CCTV cameras (e.g., "Z1-C1", "Z1-C2") with point coordinates
- **Sample Data**:
```xml
<Placemark id="5D126CE828000001">
  <name>Zone Area 1</name>
  <Polygon>
    <coordinates>73.71160,19.98166,0 ...</coordinates>
  </Polygon>
</Placemark>
<Placemark id="5D126CE828000002">
  <name>Z1-C1</name>
  <Point>
    <coordinates>73.71176,19.98371,0</coordinates>
  </Point>
</Placemark>
```

#### **2. Police Stations.kml**
- **Contains**: Police station names and GPS locations
- **Sample Data**:
```xml
<Placemark>
  <name>Adgaon Police station</name>
  <Point>
    <coordinates>73.82694,20.01548,0</coordinates>
  </Point>
</Placemark>
<Placemark>
  <name>Bhadrakali Police station</name>
  <Point>
    <coordinates>73.78920,19.99779,0</coordinates>
  </Point>
</Placemark>
```

#### **3. nashik_kumbh_chokepoints_parking_map.kml**
- **Contains**: Traffic chokepoints, parking areas, transfer nodes
- **Categories**:
  - Traffic choke point (e.g., Dwarka Circle, Nashik Road-Dwarka corridor)
  - Transfer node (e.g., Nashik Road Railway Station, CBS)
  - No-vehicle pressure zone (e.g., Ramkund, Panchavati)
- **Risk Levels**: very high, high, medium
- **Sample Data**:
```xml
<Placemark>
  <name>Dwarka Circle / Dwarka Chowk</name>
  <description>
    Category: Traffic choke point | 
    Status: confirmed 2027 project | 
    Risk: very high | 
    Note: Vital artery connecting Mumbai-Agra NH
  </description>
  <Point>
    <coordinates>73.79564,19.98695,0</coordinates>
  </Point>
</Placemark>
```

### 8.2 KML Parser Service

Create a service to parse KML files and seed the database:

```typescript
// src/services/kml-parser.service.ts

import * as fs from 'fs';
import * as xml2js from 'xml2js';

class KMLParserService {
  // Parse CCTV Dataset
  async parseCCTVDataset(filePath: string): Promise<{
    zones: Zone[],
    cameras: CCTVCamera[]
  }> {
    const xml = fs.readFileSync(filePath, 'utf-8');
    const result = await xml2js.parseStringPromise(xml);
    
    const zones: Zone[] = [];
    const cameras: CCTVCamera[] = [];
    
    // Extract Placemarks
    const placemarks = result.kml.Document[0].Placemark;
    
    for (const placemark of placemarks) {
      const name = placemark.name[0];
      
      // Check if it's a zone (has Polygon)
      if (placemark.Polygon) {
        const coords = this.parseCoordinates(
          placemark.Polygon[0].outerBoundaryIs[0]
            .LinearRing[0].coordinates[0]
        );
        
        zones.push({
          zone_id: this.generateZoneId(name),
          zone_name: name,
          zone_boundary: this.createPostGISPolygon(coords),
          center_lat: this.calculateCentroid(coords).lat,
          center_lng: this.calculateCentroid(coords).lng
        });
      }
      
      // Check if it's a camera (has Point and starts with Z)
      else if (placemark.Point && name.match(/^Z\d+-C\d+$/)) {
        const [lng, lat] = this.parsePoint(
          placemark.Point[0].coordinates[0]
        );
        
        cameras.push({
          camera_id: name,
          zone_id: name.split('-')[0], // Extract "Z1" from "Z1-C1"
          location_name: name,
          gps_lat: parseFloat(lat),
          gps_lng: parseFloat(lng),
          camera_type: 'fixed',
          is_active: true
        });
      }
    }
    
    return { zones, cameras };
  }
  
  // Parse Police Stations
  async parsePoliceStations(filePath: string): Promise<PoliceStation[]> {
    const xml = fs.readFileSync(filePath, 'utf-8');
    const result = await xml2js.parseStringPromise(xml);
    
    const stations: PoliceStation[] = [];
    const placemarks = result.kml.Document[0].Placemark;
    
    for (const placemark of placemarks) {
      const name = placemark.name[0];
      const [lng, lat] = this.parsePoint(
        placemark.Point[0].coordinates[0]
      );
      
      // Determine zone based on GPS proximity
      const zoneId = await this.findNearestZone(
        parseFloat(lat), 
        parseFloat(lng)
      );
      
      stations.push({
        station_id: this.generateStationId(name),
        station_name: name,
        zone_id: zoneId,
        gps_lat: parseFloat(lat),
        gps_lng: parseFloat(lng),
        login_id: this.generateLoginId(name),
        // password_hash will be set during seeding
      });
    }
    
    return stations;
  }
  
  // Parse Chokepoints
  async parseChokepoints(filePath: string): Promise<Chokepoint[]> {
    const xml = fs.readFileSync(filePath, 'utf-8');
    const result = await xml2js.parseStringPromise(xml);
    
    const chokepoints: Chokepoint[] = [];
    const placemarks = result.kml.Document[0].Placemark;
    
    for (const placemark of placemarks) {
      const name = placemark.name[0];
      const description = placemark.description?.[0] || '';
      const [lng, lat] = this.parsePoint(
        placemark.Point[0].coordinates[0]
      );
      
      // Parse description for category and risk
      const category = this.extractCategory(description);
      const risk = this.extractRisk(description);
      
      // Find nearest zone
      const zoneId = await this.findNearestZone(
        parseFloat(lat), 
        parseFloat(lng)
      );
      
      chokepoints.push({
        chokepoint_id: this.generateChokepointId(name),
        chokepoint_name: name,
        chokepoint_type: category,
        gps_lat: parseFloat(lat),
        gps_lng: parseFloat(lng),
        zone_id: zoneId,
        risk_level: risk,
        description: description
      });
    }
    
    return chokepoints;
  }
  
  // Helper: Parse coordinates string
  private parseCoordinates(coordString: string): Array<[number, number]> {
    return coordString.trim().split(' ')
      .filter(Boolean)
      .map(coord => {
        const [lng, lat] = coord.split(',');
        return [parseFloat(lng), parseFloat(lat)];
      });
  }
  
  // Helper: Parse single point
  private parsePoint(coordString: string): [string, string] {
    const [lng, lat] = coordString.trim().split(',');
    return [lng, lat];
  }
  
  // Helper: Calculate centroid of polygon
  private calculateCentroid(coords: Array<[number, number]>): 
    { lat: number, lng: number } {
    const sum = coords.reduce(
      (acc, [lng, lat]) => ({
        lat: acc.lat + lat,
        lng: acc.lng + lng
      }),
      { lat: 0, lng: 0 }
    );
    
    return {
      lat: sum.lat / coords.length,
      lng: sum.lng / coords.length
    };
  }
  
  // Helper: Create PostGIS polygon string
  private createPostGISPolygon(coords: Array<[number, number]>): string {
    const coordString = coords
      .map(([lng, lat]) => `${lng} ${lat}`)
      .join(',');
    return `POLYGON((${coordString}))`;
  }
  
  // Helper: Find nearest zone using PostGIS
  private async findNearestZone(lat: number, lng: number): 
    Promise<string> {
    // Use ST_Distance to find nearest zone
    const query = `
      SELECT zone_id 
      FROM zones 
      ORDER BY ST_Distance(
        zone_boundary::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      )
      LIMIT 1
    `;
    
    const result = await db.query(query, [lng, lat]);
    return result.rows[0]?.zone_id || 'UNKNOWN';
  }
  
  // Helper: Extract category from description
  private extractCategory(description: string): string {
    const match = description.match(/Category:\s*([^|]+)/);
    return match ? match[1].trim() : 'unknown';
  }
  
  // Helper: Extract risk level from description
  private extractRisk(description: string): string {
    const match = description.match(/Risk:\s*([^|]+)/);
    return match ? match[1].trim() : 'medium';
  }
  
  // ID generators
  private generateZoneId(name: string): string {
    return `ZONE-${name.replace(/[^0-9]/g, '').padStart(3, '0')}`;
  }
  
  private generateStationId(name: string): string {
    return `PS-${name.replace(/\s+/g, '-').toUpperCase()}`;
  }
  
  private generateChokepointId(name: string): string {
    return `CP-${name.replace(/\s+/g, '-').substring(0, 20).toUpperCase()}`;
  }
  
  private generateLoginId(stationName: string): string {
    return stationName.replace(/\s+/g, '_').toLowerCase();
  }
}

export default new KMLParserService();
```

### 8.3 Database Seeding Script

Create a seeding script to populate the database with KML data:

```typescript
// src/scripts/seed-dataset.ts

import kmlParser from '../services/kml-parser.service';
import db from '../db';

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');
  
  try {
    // 1. Parse and seed zones + CCTV cameras
    console.log('📹 Parsing CCTV Dataset...');
    const { zones, cameras } = await kmlParser.parseCCTVDataset(
      './dataset/CCTV Dataset.kml'
    );
    
    console.log(`   ✓ Found ${zones.length} zones`);
    console.log(`   ✓ Found ${cameras.length} CCTV cameras`);
    
    // Insert zones
    for (const zone of zones) {
      await db.query(`
        INSERT INTO zones (zone_id, zone_name, zone_boundary, center_lat, center_lng)
        VALUES ($1, $2, ST_GeomFromText($3, 4326), $4, $5)
        ON CONFLICT (zone_id) DO NOTHING
      `, [zone.zone_id, zone.zone_name, zone.zone_boundary, zone.center_lat, zone.center_lng]);
    }
    
    // Insert CCTV cameras
    for (const camera of cameras) {
      await db.query(`
        INSERT INTO cctv_cameras (
          camera_id, zone_id, location_name, gps_lat, gps_lng, 
          gps_point, camera_type, is_active
        )
        VALUES (
          $1, $2, $3, $4, $5, 
          ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
          $6, $7
        )
        ON CONFLICT (camera_id) DO NOTHING
      `, [
        camera.camera_id, camera.zone_id, camera.location_name,
        camera.gps_lat, camera.gps_lng, camera.camera_type, camera.is_active
      ]);
    }
    
    console.log('   ✅ Zones and CCTV cameras seeded!\n');
    
    // 2. Parse and seed police stations
    console.log('👮 Parsing Police Stations...');
    const stations = await kmlParser.parsePoliceStations(
      './dataset/Police Stations.kml'
    );
    
    console.log(`   ✓ Found ${stations.length} police stations`);
    
    for (const station of stations) {
      await db.query(`
        INSERT INTO police_stations (
          station_id, station_name, zone_id, gps_lat, gps_lng,
          gps_point, login_id, password_hash
        )
        VALUES (
          $1, $2, $3, $4, $5,
          ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
          $6, $7
        )
        ON CONFLICT (station_id) DO NOTHING
      `, [
        station.station_id, station.station_name, station.zone_id,
        station.gps_lat, station.gps_lng, station.login_id,
        await bcrypt.hash('kumbh2027', 10) // Default password
      ]);
    }
    
    console.log('   ✅ Police stations seeded!\n');
    
    // 3. Parse and seed chokepoints
    console.log('🚦 Parsing Chokepoints...');
    const chokepoints = await kmlParser.parseChokepoints(
      './dataset/nashik_kumbh_chokepoints_parking_map.kml'
    );
    
    console.log(`   ✓ Found ${chokepoints.length} chokepoints`);
    
    for (const cp of chokepoints) {
      await db.query(`
        INSERT INTO chokepoints (
          chokepoint_id, chokepoint_name, chokepoint_type,
          gps_lat, gps_lng, gps_point, zone_id, risk_level, description
        )
        VALUES (
          $1, $2, $3, $4, $5,
          ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
          $6, $7, $8
        )
        ON CONFLICT (chokepoint_id) DO NOTHING
      `, [
        cp.chokepoint_id, cp.chokepoint_name, cp.chokepoint_type,
        cp.gps_lat, cp.gps_lng, cp.zone_id, cp.risk_level, cp.description
      ]);
    }
    
    console.log('   ✅ Chokepoints seeded!\n');
    
    // Summary
    console.log('🎉 Database seeding completed successfully!');
    console.log(`
    Summary:
    --------
    Zones: ${zones.length}
    CCTV Cameras: ${cameras.length}
    Police Stations: ${stations.length}
    Chokepoints: ${chokepoints.length}
    `);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run seeding
seedDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

**Run Command**:
```bash
npm run seed
# or
ts-node src/scripts/seed-dataset.ts
```

### 8.4 Using Dataset in ML Predictions

The ML prediction service uses the seeded dataset to calculate zone probabilities:

```typescript
// src/services/ml.service.ts (enhanced)

class MLService {
  async predictZones(caseId: string): Promise<ZonePrediction[]> {
    const caseData = await this.getCaseData(caseId);
    const allZones = await this.getAllZones();
    
    const predictions: ZonePrediction[] = [];
    
    for (const zone of allZones) {
      // Calculate probability for this zone
      const probability = await this.calculateZoneProbability(
        caseData,
        zone
      );
      
      if (probability > 0.3) { // Threshold
        // Get CCTV cameras in this zone
        const cameras = await this.getCCTVCamerasInZone(zone.zone_id);
        
        // Get nearby chokepoints
        const chokepoints = await this.getChokepointsInZone(zone.zone_id);
        
        predictions.push({
          zone_id: zone.zone_id,
          zone_name: zone.zone_name,
          confidence: probability,
          cctv_cameras: cameras,
          nearby_chokepoints: chokepoints,
          reasoning: this.generateReasoning(caseData, zone, probability)
        });
      }
    }
    
    // Sort by confidence and return top 3
    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }
  
  private async calculateZoneProbability(
    caseData: Case,
    zone: Zone
  ): Promise<number> {
    let probability = 0;
    
    // Factor 1: Distance from report location (decay over time)
    const distance = this.calculateDistance(
      caseData.report_gps,
      { lat: zone.center_lat, lng: zone.center_lng }
    );
    
    const timeElapsed = Date.now() - new Date(caseData.created_at).getTime();
    const hoursElapsed = timeElapsed / (1000 * 60 * 60);
    
    // Movement radius estimation (km per hour based on age)
    const movementSpeed = this.estimateMovementSpeed(caseData.person_age);
    const maxDistance = movementSpeed * hoursElapsed;
    
    if (distance <= maxDistance) {
      probability += 0.4 * (1 - distance / maxDistance);
    }
    
    // Factor 2: CCTV coverage
    const cctvCoverage = await this.getCCTVCoverageScore(zone.zone_id);
    probability += 0.2 * cctvCoverage;
    
    // Factor 3: Chokepoint proximity
    const chokepointScore = await this.getChokepointScore(
      zone.zone_id,
      caseData.report_gps
    );
    probability += 0.15 * chokepointScore;
    
    // Factor 4: Last seen zone
    if (caseData.last_seen_zone === zone.zone_id) {
      probability += 0.25;
    }
    
    // Normalize to 0-1
    return Math.min(1, probability);
  }
  
  private estimateMovementSpeed(age?: number): number {
    if (!age) return 2.5; // Default: 2.5 km/hr
    if (age < 12) return 1.5;  // Children move slower
    if (age < 60) return 3.0;  // Adults
    return 1.0;  // Elderly move slower
  }
  
  private async getCCTVCoverageScore(zoneId: string): Promise<number> {
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM cctv_cameras
      WHERE zone_id = $1 AND is_active = true
    `, [zoneId]);
    
    const count = parseInt(result.rows[0].count);
    return Math.min(1, count / 10); // Normalize by 10 cameras
  }
  
  private async getChokepointScore(
    zoneId: string,
    reportGPS: { lat: number, lng: number }
  ): Promise<number> {
    // Get high-risk chokepoints in zone
    const result = await db.query(`
      SELECT 
        chokepoint_id,
        gps_lat,
        gps_lng,
        CASE risk_level
          WHEN 'very high' THEN 1.0
          WHEN 'high' THEN 0.7
          WHEN 'medium' THEN 0.4
          ELSE 0.2
        END as risk_weight
      FROM chokepoints
      WHERE zone_id = $1
      ORDER BY risk_weight DESC
      LIMIT 5
    `, [zoneId]);
    
    if (result.rows.length === 0) return 0;
    
    // Calculate weighted average of chokepoint proximity
    let totalScore = 0;
    for (const cp of result.rows) {
      const distance = this.calculateDistance(
        reportGPS,
        { lat: cp.gps_lat, lng: cp.gps_lng }
      );
      
      // Closer chokepoints have higher influence
      const proximityScore = Math.max(0, 1 - distance / 5); // 5km radius
      totalScore += proximityScore * cp.risk_weight;
    }
    
    return Math.min(1, totalScore / result.rows.length);
  }
}
```

---

## 
  case_id: string,
  photo_type: 'reporter' | 'lost_person' | 'found_person',
  photo_buffer: Buffer
}
```

---

### 7.2 Queue Worker Example

```typescript
import Queue from 'bull';
import { processIntake } from './workers/intake.worker';

const intakeQueue = new Queue('intake', {
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

// Add job to queue
intakeQueue.add('process-case', jobData, {
  priority: urgency === 'P1' ? 1 : urgency === 'P2' ? 5 : 10,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
});

// Process jobs
intakeQueue.process('process-case', 5, async (job) => {
  return await processIntake(job.data);
});

// Event handlers
intakeQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

intakeQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});
```

---

### 8.5 Zone Position Update Mechanism

**Real-time Zone Position Updates via Queue**:

When the `ml-prediction-queue` runs every 15 minutes, it:
1. Fetches all active cases
2. Calculates new zone predictions
3. Compares with previous predictions
4. If zone positions change → Push Socket.IO update

**Socket.IO Zone Update Event**:
```typescript
// Server → Police Portal
socket.to(`zone:${zone_id}`).emit('zone:prediction_update', {
  case_id: string,
  previous_zones: [
    { zone_id: "Zone 8", confidence: 0.85, rank: 1 },
    { zone_id: "Zone 7", confidence: 0.62, rank: 2 }
  ],
  new_zones: [
    { zone_id: "Zone 7", confidence: 0.78, rank: 1 },  // MOVED UP
    { zone_id: "Zone 8", confidence: 0.65, rank: 2 },  // MOVED DOWN
    { zone_id: "Zone 6", confidence: 0.54, rank: 3 }   // NEW ENTRY
  ],
  change_summary: {
    new_top_zone: true,
    zones_added: ["Zone 6"],
    zones_dropped: [],
    time_elapsed: "30 minutes"
  },
  updated_at: string
});
```

**Police Portal UI Updates**:
- 🔔 **Notification**: "Zone 7 is now the top predicted zone for Case KMP-2027-00123"
- 📍 **Map markers update**: Highlight moves from Zone 8 → Zone 7
- 📊 **Confidence bars animate**: Zone 7 bar grows, Zone 8 bar shrinks
- 🎥 **CCTV list refreshes**: Show Zone 7 cameras prominently

**Database Tracking**:
```sql
-- ml_predictions table stores all predictions with timestamps
INSERT INTO ml_predictions (
  case_id, predicted_zones, input_factors, 
  prediction_timestamp, previous_prediction_id
) VALUES (
  'KMP-2027-00123',
  '[{"zone_id": "Zone 7", "confidence": 0.78}, ...]'::jsonb,
  '{"time_elapsed": 30, "age": 6, ...}'::jsonb,
  NOW(),
  12345  -- Reference to previous prediction
);

-- Query prediction history for a case
SELECT 
  prediction_id,
  predicted_zones,
  prediction_timestamp,
  LAG(predicted_zones) OVER (
    PARTITION BY case_id 
    ORDER BY prediction_timestamp
  ) as previous_zones
FROM ml_predictions
WHERE case_id = 'KMP-2027-00123'
ORDER BY prediction_timestamp DESC;
```

---

## Summary

This LLD provides:
- ✅ **25+ REST API endpoints** with exact input/output schemas
- ✅ **Frontend architecture** with component structure for 3 portals
- ✅ **5 microservices** (Case, Match, Sherlock, SLM, ML)
- ✅ **10 database tables** with indexes and full-text search
- ✅ **Socket.IO events** for real-time updates
- ✅ **6 Redis Bull queues** for background processing
- ✅ **🔄 Periodic ML zone updates** every 15 minutes with position tracking
- ✅ **📊 Dataset integration** - KML parser for CCTV, Police Stations, Chokepoints
- ✅ **🗄️ Database seeding script** to populate from KML files

**Dataset Coverage**:
- **CCTV Cameras**: Zone-mapped camera locations for ML predictions
- **Police Stations**: Zone-assigned stations with authentication
- **Chokepoints**: Risk-weighted traffic points for probability calculations

**Next Steps**: Implementation of each service with actual code!
