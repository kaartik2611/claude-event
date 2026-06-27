# Zone Movement Simulation & Offline Caching Guide

## 🎯 Overview

This system now includes **two major features**:

1. **Zone-to-Zone Person Tracking Simulation** - Live WebSocket-based tracking of people moving across zones
2. **Offline Request Caching** - Automatic caching of Sherlock requests when internet is unavailable

---

## 📍 Zone Movement Simulation

### What It Does

The simulation tracks people as they move through 4 zones in sequence:
- **Zone 1**: Ramkund Ghat (Entry)
- **Zone 2**: Main Bazaar
- **Zone 3**: Panchavati
- **Zone 4**: Exit Point

When a person enters Zone 1, the system automatically tracks their movement through subsequent zones every 30 seconds via live WebSocket updates.

### How to Use

#### 1. Access the Simulation Dashboard

- **Login as Admin**: Use credentials `admin` / `admin123`
- Navigate to the **Central Dashboard**
- Click the **"Zone Simulation"** button in the header (orange gradient button)

#### 2. Start Simulations

You have two options:

##### Option A: Add Single Person
```
Click "Add Person" button
→ Creates 1 simulated visitor
→ Appears in Zone 1 immediately
→ Moves to Zone 2 after 30 seconds
→ Moves to Zone 3 after 60 seconds
→ Moves to Zone 4 after 90 seconds
```

##### Option B: Start Crowd Simulation
```
Click "Start Crowd Simulation" button
→ Creates 3 simulated visitors
→ Each starts in Zone 1 with 5-second intervals
→ All move through zones automatically
```

#### 3. Watch Live Movement

The dashboard shows:
- **Zone Cards**: Current people in each zone (real-time)
- **Movement Log**: Recent transitions between zones
- **Connection Status**: WebSocket connection indicator
- **Total Count**: Active persons across all zones

#### 4. WebSocket Events

The system emits these real-time events:
- `person:detected` - Person appears in Zone 1
- `person:entered` - Person enters a zone
- `person:left` - Person leaves a zone
- `person:moved` - Person transitions between zones
- `person:completed` - Person completes journey at Zone 4

---

## 📴 Offline Request Caching

### What It Does

When a Sherlock loses internet connection while filing a case:
1. The request is **automatically cached** in localStorage
2. A notification shows **"Offline mode: Request cached"**
3. When connection returns, requests **auto-sync** to the server
4. The Sherlock can continue working without interruption

### How to Test

#### 1. Setup
- Open **Sherlock Dashboard**: Login with `+919876543210` (no password)
- Open browser DevTools (F12)
- Go to **Network tab**

#### 2. Simulate Offline Mode

In DevTools Console, run:
```javascript
// Go offline
Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
window.dispatchEvent(new Event('offline'));
```

#### 3. File a Case While Offline

- Select a case type (Lost Person, Searching, or Found)
- Fill in the form
- Submit the case
- You'll see: **"📴 Offline mode: Request cached and will sync when online"**

#### 4. Go Back Online

In DevTools Console:
```javascript
// Go back online
Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
window.dispatchEvent(new Event('online'));
```

The cached request will automatically sync!

#### 5. Visual Indicators

**Offline Indicator** (bottom-right corner):
- **Red**: Offline - shows pending requests count
- **Amber**: Online but syncing cached requests
- **Hidden**: Online with no pending requests

---

## 🔧 API Endpoints

### Simulation APIs

All require authentication token:

#### Start Single Person Simulation
```bash
POST /api/simulation/start
Authorization: Bearer <token>

Body:
{
  "name": "Visitor Name",
  "age": 30,
  "description": "Optional description"
}

Response:
{
  "success": true,
  "person_id": "PERSON-123456-XYZ",
  "message": "Simulation started for Visitor Name"
}
```

#### Start Crowd Simulation
```bash
POST /api/simulation/crowd
Authorization: Bearer <token>

Body:
{
  "count": 3  // Number of people (1-10)
}

Response:
{
  "success": true,
  "person_ids": ["PERSON-...", "PERSON-...", "PERSON-..."],
  "count": 3,
  "message": "Started simulation for 3 people"
}
```

#### Get Persons in Zone
```bash
GET /api/simulation/zone/:zone_id/persons
Authorization: Bearer <token>

Response:
{
  "success": true,
  "zone_id": "ZONE-1",
  "persons": [
    {
      "person_id": "PERSON-...",
      "name": "Rajesh Kumar",
      "age": 35,
      "current_zone": "ZONE-1",
      "current_gps_lat": 19.9975,
      "current_gps_lng": 73.7898,
      "status": "active",
      "last_detection_time": "2027-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

#### Get Person Movement History
```bash
GET /api/simulation/person/:person_id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "person": { ... },
  "movements": [
    {
      "movement_id": 1,
      "person_id": "PERSON-...",
      "from_zone": "ZONE-1",
      "to_zone": "ZONE-2",
      "from_lat": 19.9975,
      "from_lng": 73.7898,
      "to_lat": 19.9965,
      "to_lng": 73.7908,
      "detection_method": "simulated",
      "moved_at": "2027-01-15T10:30:30Z"
    }
  ],
  "movement_count": 3
}
```

#### Stop Simulation
```bash
POST /api/simulation/stop/:person_id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Simulation stopped for PERSON-..."
}
```

---

## 🗄️ Database Schema

### Tracked Persons Table
```sql
tracked_persons
├── person_id (PK)
├── name
├── age
├── description
├── photo_url
├── current_zone → zones(zone_id)
├── current_gps_lat
├── current_gps_lng
├── current_gps_point (PostGIS)
├── status (active/inactive/resolved)
├── last_detection_time
├── created_at
└── updated_at
```

### Person Movements Table
```sql
person_movements
├── movement_id (PK)
├── person_id → tracked_persons(person_id)
├── from_zone → zones(zone_id)
├── to_zone → zones(zone_id)
├── from_lat
├── from_lng
├── to_lat
├── to_lng
├── detection_method (cctv/manual/sherlock/simulated)
├── detection_source
├── confidence_score
└── moved_at
```

---

## 🔌 WebSocket Integration

### Connect to WebSocket
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});

// Join zone rooms
socket.emit('zone:join', 'ZONE-1');
socket.emit('zone:join', 'ZONE-2');
```

### Listen to Events
```javascript
// Person detected
socket.on('person:detected', (data) => {
  console.log('New person in', data.zone_name, ':', data.name);
});

// Person entered zone
socket.on('person:entered', (data) => {
  console.log(`${data.name} entered ${data.to_zone_name}`);
});

// Person left zone
socket.on('person:left', (data) => {
  console.log(`${data.name} left ${data.from_zone_name}`);
});

// Person completed journey
socket.on('person:completed', (data) => {
  console.log(`${data.name} reached ${data.final_zone}`);
});
```

---

## 💾 Offline Cache Service

### Usage in Components

```javascript
import { cachedFetch, offlineCacheService } from '../services/offlineCache';

// Make a request (auto-caches if offline)
const response = await cachedFetch('/api/cases', {
  method: 'POST',
  cacheType: 'case',  // 'case' | 'update' | 'location'
  body: JSON.stringify(data)
});

// Check if cached
if (response.status === 202) {
  console.log('Request cached offline!');
}

// Get pending count
const pendingCount = offlineCacheService.getPendingCount();

// Manual sync
await offlineCacheService.syncCachedRequests();

// Clear cache
offlineCacheService.clearCache();
```

### React Hook

```javascript
import { useOfflineCache } from '../hooks/useOfflineCache';

function MyComponent() {
  const { isOnline, pendingCount, isSyncing, syncCache } = useOfflineCache();
  
  return (
    <div>
      <p>Status: {isOnline ? 'Online' : 'Offline'}</p>
      <p>Pending: {pendingCount} requests</p>
      {isSyncing && <p>Syncing...</p>}
      <button onClick={syncCache}>Sync Now</button>
    </div>
  );
}
```

---

## 🧪 Testing Checklist

### Simulation Testing
- [ ] Login as admin
- [ ] Navigate to simulation dashboard
- [ ] Start single person simulation
- [ ] Verify person appears in Zone 1
- [ ] Wait 30 seconds - person should move to Zone 2
- [ ] Check "Recent Movements" log updates
- [ ] Start crowd simulation
- [ ] Verify 3 people appear with intervals
- [ ] Check all zones update correctly
- [ ] Verify WebSocket connection indicator is green

### Offline Testing
- [ ] Login as Sherlock
- [ ] Open DevTools Network tab
- [ ] Throttle to "Offline" mode
- [ ] Try to file a case
- [ ] Verify "Request cached" message appears
- [ ] Check offline indicator shows at bottom-right
- [ ] Go back online
- [ ] Verify auto-sync starts
- [ ] Check offline indicator disappears
- [ ] Verify case appears in database

---

## 🚀 Running the System

### Backend
```bash
cd backend
npm install
npm run dev  # Runs on http://localhost:3000
```

### Frontend
```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173
```

### Database Setup
```bash
# Ensure PostgreSQL is running
psql -d kumbh_mela -f backend/src/db/schema.sql
```

---

## 📊 Performance Notes

- **Movement Interval**: 30 seconds between zones (configurable)
- **Max Simulations**: Recommended 10 concurrent people
- **Cache Storage**: Uses localStorage (5-10MB limit)
- **Sync Retries**: Up to 3 retries before marking failed
- **WebSocket Rooms**: Zone-based rooms for efficient broadcasting

---

## 🐛 Troubleshooting

### Simulation Not Working
1. Check WebSocket connection (green indicator)
2. Verify admin authentication
3. Check browser console for errors
4. Ensure backend is running on port 3000

### Offline Caching Not Working
1. Check localStorage is enabled
2. Verify browser supports navigator.onLine
3. Check DevTools Application → Local Storage
4. Look for key: `kumbh_offline_cache`

### Person Not Moving Between Zones
1. Check backend logs for movement events
2. Verify zone coordinates in simulation.service.ts
3. Ensure WebSocket rooms are joined correctly
4. Check person status is 'active'

---

## 📝 Notes

- All simulated movements use detection_method: 'simulated'
- Person IDs format: `PERSON-{timestamp}-{random}`
- Zones are hard-coded for Nashik Kumbh Mela
- Offline cache max size: ~100 requests
- Failed requests kept in cache for inspection

---

**Built for Nashik Kumbh Mela 2027** 🕉️
