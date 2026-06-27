# 🕉️ Kumbh Mela 2027 - Missing Person Response System

## 📌 Overview

A comprehensive AI-powered missing person tracking and response system for Nashik Kumbh Mela 2027, expected to serve 30 lakh visitors over 45 days.

### 🎯 Problem Statement
Families at Center B cannot find persons registered at Center A due to lack of cross-center search capability. Existing systems are isolated and ineffective.

### ✨ Solution
**Sherlock Station Network**: Mobile volunteer-operated PWA system with:
- Real-time broadcasting & ML-powered zone predictions
- Photo capture, GPS tracking, voice recording
- Automated matching & bilateral case resolution
- Police portal with ML predictions & CCTV integration
- Central command dashboard with analytics

---

## 🏗️ Architecture

### Tech Stack

**Frontend**
- React 18 + Vite + TypeScript
- Tailwind CSS + Lucide Icons
- Leaflet Maps + react-leaflet
- Socket.IO Client (real-time)
- PWA (camera, GPS, offline)

**Backend**
- Node.js 20 + Express + TypeScript
- Socket.IO Server (WebSocket)
- Bull + Redis (queue system)
- JWT Authentication
- Multer (file uploads)

**Database**
- PostgreSQL 16 + PostGIS (geography)
- pg_trgm (fuzzy search)
- Full-text search (ts_vector)

**AI/ML**
- Custom ML prediction engine
- Zone probability calculations
- Claude Haiku API integration (optional)

**Infrastructure**
- Docker + Docker Compose
- Redis (cache + queue)
- MinIO/S3 (photo storage)

---

## 📁 Project Structure

```
claude-hack/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.sql          # PostgreSQL schema (10 tables)
│   │   │   └── index.ts            # Database connection
│   │   ├── services/
│   │   │   ├── case.service.ts     # Case management
│   │   │   ├── match.service.ts    # Matching engine
│   │   │   ├── sherlock.service.ts # Sherlock volunteers
│   │   │   ├── ml.service.ts       # ML predictions
│   │   │   └── slm.service.ts      # Voice processing
│   │   ├── routes/
│   │   │   ├── auth.routes.ts      # Login endpoints
│   │   │   └── cases.routes.ts     # Case CRUD + search
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT authentication
│   │   │   └── upload.ts           # Multer photo upload
│   │   ├── queues/
│   │   │   └── index.ts            # Bull queues + workers
│   │   ├── socket/
│   │   │   └── index.ts            # Socket.IO server
│   │   ├── scripts/
│   │   │   └── seed-dataset.ts     # KML parser + seeding
│   │   ├── config/
│   │   │   └── index.ts            # Configuration
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript types
│   │   └── index.ts                # Server entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx       # Login page
│   │   │   ├── sherlock/
│   │   │   │   └── SherlockDashboard.tsx  # Sherlock PWA
│   │   │   ├── police/
│   │   │   │   └── PoliceDashboard.tsx    # Police portal
│   │   │   └── central/
│   │   │       └── CentralDashboard.tsx   # Central command
│   │   ├── components/
│   │   │   ├── sherlock/
│   │   │   │   └── CaseForm.tsx    # Case creation (3 types)
│   │   │   └── shared/
│   │   │       ├── CameraCapture.tsx  # Photo capture
│   │   │       └── GPSCapture.tsx     # GPS location
│   │   ├── context/
│   │   │   └── AuthContext.tsx     # Auth state management
│   │   ├── App.tsx                 # App router
│   │   ├── main.tsx                # Entry point
│   │   └── index.css               # Tailwind styles
│   ├── public/
│   │   └── manifest.json           # PWA manifest
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── index.html
├── dataset/
│   ├── CCTV Dataset.kml            # Zones + cameras
│   ├── Police Stations.kml         # Police stations
│   └── nashik_kumbh_chokepoints_parking_map.kml  # Chokepoints
├── docker-compose.yml              # PostgreSQL + Redis
├── architecture-diagram.html       # Interactive architecture
├── LLD.md                          # Low-level design
└── README.md                       # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16 (with PostGIS extension)
- Redis 7
- Docker & Docker Compose (optional)

### Installation

#### 1. Clone Repository

```bash
cd ~/claude-hack
```

#### 2. Start Database Services (Docker)

```bash
# Install Docker Compose (if not installed)
sudo apt install docker-compose

# Start PostgreSQL + Redis
docker-compose up -d
```

#### 3. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Create database schema
npm run db:setup

# Seed dataset (KML files)
npm run seed

# Start development server
npm run dev
```

Backend will start on **http://localhost:3000**

#### 4. Setup Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will start on **http://localhost:5173**

---

## 📊 Database Setup

### Create Database & Extensions

```bash
# Connect to PostgreSQL
psql -U kumbh -d kumbh_mela

# Run schema
\i backend/src/db/schema.sql
```

### Seed Dataset

```bash
cd backend
npm run seed
```

This will:
- Parse 3 KML files from `/dataset/`
- Insert zones, CCTV cameras, police stations, chokepoints
- Create default admin user

**Default Credentials:**
- Admin: `admin` / `admin123`
- Police: `bhadrakali_police_station` / `kumbh2027`
- Sherlock: Any phone number (no password in dev)

---

## 🔑 Environment Variables

### Backend `.env`

```env
# Database
DATABASE_URL=postgresql://kumbh:kumbh_secure_2027@localhost:5432/kumbh_mela

# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=kumbh_mela_2027_secret_key

# Claude API (optional)
CLAUDE_API_KEY=your_api_key_here

# Photo Storage
PHOTO_STORAGE_PATH=./uploads

# Broadcast
DEFAULT_BROADCAST_DURATION_MINUTES=60

# ML
ML_PREDICTION_INTERVAL_MINUTES=15
```

---

## 📱 Features

### Sherlock Station (Mobile PWA)

**3 Case Workflows:**

#### Case 1: My Person is Lost 🔍
- Reporter details + photo
- Lost person details + photo
- GPS auto-capture
- Voice recording (optional)
- Auto-broadcast for 60 minutes

#### Case 2: Searching for Someone 📸
- Reporter details + photo
- Person description (text/voice)
- Photo upload OR voice description
- Bilateral matching with Case 1

#### Case 3: Found Unknown Person ✅
- Reporter details + photo
- Found person photo + description
- **Auto P1 alert to police**
- Immediate escalation

### Police Portal 👮

- Real-time case dashboard (filtered by zone)
- P1/P2/P3 priority alerts
- ML zone predictions with confidence scores
- CCTV camera locations for predicted zones
- Chokepoint proximity analysis
- Case dispatch management

### Central Command Dashboard 📊

- System-wide analytics
- Case distribution heatmaps
- Sherlock performance metrics
- Resolution rates
- Real-time statistics

---

## 🔄 Queue System

### 6 Bull Queues

1. **intake-queue**: Process new cases (validation, DB save, trigger matching)
2. **match-queue**: Find potential matches (bilateral, features, text, photo)
3. **broadcast-queue**: Manage 60-min timers (start, extend, expire)
4. **ml-prediction-queue**: **Periodic zone predictions every 15 min**
5. **slm-queue**: Claude Haiku voice processing (parse, extract, triage)
6. **photo-queue**: Resize, compress, upload to S3

### Periodic ML Updates

Every 15 minutes:
- Fetch all active cases
- Recalculate zone probabilities
- Update predicted zone positions
- Push Socket.IO updates to police portal
- Track prediction history

**Example Evolution:**
```
T=0:   Zone 8 (85%), Zone 7 (62%), Zone 9 (45%)
T=15:  Zone 8 (72%), Zone 7 (68%), Zone 6 (54%)  ← shifting
T=30:  Zone 7 (78%), Zone 6 (65%), Zone 8 (48%)  ← Zone 7 now #1
```

---

## 📡 Real-time Events (Socket.IO)

### Server → Client

- `case:new`: New case created
- `case:updated`: Case status changed
- `alert:p1`: P1 urgent alert
- `ml:prediction`: Zone predictions updated
- `broadcast:expired`: Broadcast timer expired
- `match:found`: Potential match detected
- `zone:prediction_update`: Zone position changed

### Client → Server

- `zone:join`: Subscribe to zone events
- `sherlock:heartbeat`: Location update (every 30s)
- `case:subscribe`: Subscribe to case updates

---

## 🗺️ ML Prediction Algorithm

```typescript
Zone Probability = 
  0.4 × Distance Decay (time-based movement radius)
  + 0.2 × CCTV Coverage Score (camera density)
  + 0.15 × Chokepoint Proximity (risk-weighted)
  + 0.25 × Last Seen Zone Bonus
```

**Movement Speed Estimation:**
- Children (<12): 1.5 km/hr
- Adults (12-60): 3.0 km/hr
- Elderly (>60): 1.0 km/hr

---

## 🔒 Security

- JWT-based authentication (3 roles: Sherlock, Police, Admin)
- Zone-scoped access control for police
- Photo uploads validated (JPEG/PNG/WebP, 10MB max)
- GPS coordinates validated
- No public search portal (fraud prevention)
- Families must visit Sherlock Station or Police Station for in-person verification

---

## 🧪 Testing

### Test Credentials

**Police:**
```
Login ID: bhadrakali_police_station
Password: kumbh2027
```

**Admin:**
```
Username: admin
Password: admin123
```

**Sherlock:**
```
Phone: +91 9876543210 (any number works in dev)
```

### Test Workflow

1. Login as Sherlock
2. Create Case 1 (Lost Person)
3. Create Case 2 (Searching) with similar details
4. Check matching in Police Portal
5. View ML predictions
6. Test GPS and photo capture

---

## 📚 API Endpoints

### Authentication

- `POST /api/auth/login` - Login (Sherlock/Police/Admin)

### Cases

- `POST /api/cases` - Create case (multipart/form-data)
- `GET /api/cases/:case_id` - Get case details + predictions
- `GET /api/cases` - Search cases (filters: status, urgency, zone, age, gender)
- `PATCH /api/cases/:case_id` - Update case
- `POST /api/cases/:case_id/still-searching` - Extend broadcast
- `GET /api/cases/zone/:zone_id` - Get cases by zone

### Analytics (Admin)

- `GET /api/analytics/stats` - System statistics
- `GET /api/analytics/heatmap` - Case density heatmap

---

## 📈 Dataset

### 3 KML Files

1. **CCTV Dataset.kml** (Zones + Cameras)
   - Zone boundaries as polygons
   - CCTV cameras (Z1-C1, Z1-C2, etc.)

2. **Police Stations.kml**
   - Police station locations
   - GPS coordinates

3. **nashik_kumbh_chokepoints_parking_map.kml**
   - Traffic chokepoints
   - Risk levels (very high, high, medium)
   - Transfer nodes, parking areas

---

## 🎨 Interactive Architecture Diagram

Open `architecture-diagram.html` in browser to view:
- Full system architecture (4-layer)
- Sherlock Station 3 cases
- 3 Portals (Auth Only)
- Data flow
- ML prediction
- Redis queue
- Graceful degradation

---

## 🐛 Troubleshooting

### PostgreSQL Connection Error

```bash
# Check if PostgreSQL is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Restart services
docker-compose restart
```

### Redis Connection Error

```bash
# Check Redis
docker-compose logs redis

# Test Redis
redis-cli ping
```

### Photo Upload Issues

```bash
# Create uploads directory
mkdir -p backend/uploads
chmod 755 backend/uploads
```

### GPS Not Working

- Enable location permissions in browser
- Use HTTPS in production (required for geolocation API)
- Test in Chrome/Firefox (better geolocation support)

---

## 🚀 Production Deployment

### Backend

```bash
cd backend
npm run build
npm start
```

### Frontend

```bash
cd frontend
npm run build
# Serve dist/ folder with nginx or similar
```

### Environment

- Set `NODE_ENV=production`
- Use strong JWT secret
- Enable HTTPS
- Configure S3/MinIO for photo storage
- Set up PostgreSQL backups
- Enable Redis persistence
- Configure firewall rules

---

## 📝 License

MIT License - Kumbh Mela 2027 Hackathon Project

---

## 👥 Team

Claude Impact Lab Mumbai 2026 - Hackathon Submission

---

## 🙏 Acknowledgments

- Nashik Kumbh Mela 2027 organizers for dataset
- Claude by Anthropic for AI assistance
- Open source community

---

## 📞 Support

For issues, questions, or contributions, please contact the development team.

---

**Built with ❤️ for Kumbh Mela 2027 - Bringing families together 🕉️**
