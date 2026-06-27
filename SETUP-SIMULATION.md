# 🎯 Zone Tracking Simulation - Setup Guide

## Overview
This guide will help you set up and run the zone-based person tracking simulation with live WebSocket updates and offline caching.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Backend and frontend dependencies installed

## Database Setup

1. **Add the person_tracking table** (if not already added):

```bash
cd backend
npm run migrate
```

Or manually run this SQL:

```sql
CREATE TABLE IF NOT EXISTS person_tracking (
  id SERIAL PRIMARY KEY,
  person_id VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  current_zone INTEGER NOT NULL,
  previous_zone INTEGER,
  photo_url TEXT,
  metadata JSONB,
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_person_tracking_person_id ON person_tracking(person_id);
CREATE INDEX idx_person_tracking_current_zone ON person_tracking(current_zone);
CREATE INDEX idx_person_tracking_last_seen ON person_tracking(last_seen);
```

## Starting the Application

### 1. Start Backend

```bash
cd backend
npm run dev
```

Backend should start on `http://localhost:3000`

### 2. Start Frontend

```bash
cd frontend
npm run dev
```

Frontend should start on `http://localhost:5173`

## Testing the Simulation

### Step 1: Login as Admin

1. Navigate to `http://localhost:5173/login`
2. Login with admin credentials:
   - Email: `admin@kumbh.gov.in`
   - Password: `admin123`

### Step 2: Navigate to Simulation Dashboard

1. From Central Dashboard, click **"Zone Tracking Simulation"** button
2. Or directly go to `http://localhost:5173/simulation`

### Step 3: Start Simulation

1. Click **"Start Simulation"** button
2. The simulation will:
   - Add random people to different zones
   - Move people between zones every 5 seconds
   - Show real-time updates via WebSocket
   - Display zone statistics

### Step 4: Observe Zone Movement

Watch the person cards move from:
- **Zone 1** → **Zone 2** → **Zone 3** → **Zone 4**

Each movement is broadcast in real-time to all connected clients.

## Testing Offline Caching (Sherlock Requests)

### Step 1: Login as Sherlock

1. Open a new browser window/tab (or use incognito)
2. Navigate to `http://localhost:5173/login`
3. Login with Sherlock credentials:
   - Email: `sherlock1@kumbh.gov.in`
   - Password: `sherlock123`

### Step 2: Create a Case While Online

1. Fill out the case form with:
   - Name
   - Age  
   - Gender
   - Last seen location
   - Photo (optional)
2. Submit the form
3. Verify the case is created successfully

### Step 3: Go Offline

Open browser DevTools:
- Chrome: F12 → Network tab → Throttling → Offline
- Firefox: F12 → Network tab → Throttle → Offline

You should see the **"Offline Mode"** indicator appear.

### Step 4: Create Cases Offline

1. Fill out the case form (same as before)
2. Submit the form
3. Notice:
   - Request is cached locally
   - Success message shown
   - Case appears in local cache

### Step 5: Go Back Online

1. Change DevTools throttling back to "Online"
2. The app will automatically:
   - Detect network is back
   - Sync all cached requests
   - Show sync notifications
   - Clear the cache

## API Endpoints

### Simulation Endpoints

```bash
# Start simulation
POST http://localhost:3000/api/simulation/start

# Stop simulation
POST http://localhost:3000/api/simulation/stop

# Get simulation status
GET http://localhost:3000/api/simulation/status

# Get all tracked persons
GET http://localhost:3000/api/simulation/persons

# Get tracked persons by zone
GET http://localhost:3000/api/simulation/zones/{zone_id}

# Manually move person to next zone
POST http://localhost:3000/api/simulation/persons/{person_id}/move
```

### WebSocket Events

**Subscribe to zone tracking:**
```javascript
socket.emit('zone-tracking:subscribe');
```

**Receive person movement:**
```javascript
socket.on('person:zone-change', (data) => {
  console.log('Person moved:', data);
  // data = { person_id, name, from_zone, to_zone, timestamp }
});
```

**Receive new person:**
```javascript
socket.on('person:added', (data) => {
  console.log('New person tracked:', data);
  // data = { person, zone }
});
```

## Offline Cache Structure

Cached requests are stored in IndexedDB:

```javascript
{
  id: "uuid",
  url: "/api/cases",
  method: "POST",
  body: { name, age, gender, ... },
  timestamp: 1719456000000,
  retryCount: 0
}
```

## Troubleshooting

### Simulation not starting
- Check backend logs for errors
- Verify database connection
- Ensure person_tracking table exists

### WebSocket not connecting
- Check CORS settings in backend
- Verify WebSocket URL matches backend URL
- Check browser console for connection errors

### Offline caching not working
- Verify IndexedDB is enabled in browser
- Check Service Worker registration
- Clear browser cache and reload

### Person not moving between zones
- Check simulation interval (default: 5 seconds)
- Verify zone boundaries (1-4)
- Check backend logs for errors

## Architecture

```
┌──────────────┐
│   Frontend   │
│  (React +    │
│  WebSocket)  │
└──────┬───────┘
       │
       ├─── WebSocket Connection ───┐
       │                            │
       ├─── HTTP API ───────────────┤
       │                            │
┌──────▼───────┐           ┌────────▼────────┐
│   Backend    │           │   PostgreSQL    │
│ (Express +   │◄──────────│   Database      │
│  Socket.IO)  │           └─────────────────┘
└──────┬───────┘
       │
       ├─── Simulation Service (Auto Movement)
       │
       └─── Person Tracking Service
```

## Key Features

✅ **Real-time zone tracking** - Live WebSocket updates  
✅ **Automatic zone movement** - People move Zone 1→2→3→4  
✅ **Offline support** - Queue requests when network is down  
✅ **Auto-sync** - Sync when network comes back  
✅ **Visual indicators** - Offline badge, zone statistics  
✅ **Admin dashboard** - Full simulation control  
✅ **Sherlock offline mode** - Cache case submissions

## Next Steps

1. ✅ Test simulation with multiple zones
2. ✅ Test offline mode with Sherlock requests
3. ✅ Verify WebSocket broadcasts to all clients
4. ⬜ Add more complex movement patterns
5. ⬜ Add person search and filtering
6. ⬜ Add zone heatmaps

## Support

For issues or questions:
- Check logs: `backend/logs/` and browser console
- Review database queries in PostgreSQL logs
- Test WebSocket connection with Socket.IO client

---

**Happy Simulating! 🎉**
