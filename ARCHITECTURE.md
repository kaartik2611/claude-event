# Kumbh Mela Missing Person Response System — Architecture & Tech Stack

---

## Tech Stack Decision

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React + Vite + TypeScript | Fast build, kiosk-friendly SPA, hot reload for dev |
| **UI Framework** | Tailwind CSS + shadcn/ui | Rapid prototyping, accessible components, large touch targets |
| **Maps** | Leaflet + react-leaflet | Free, offline-capable tile caching, lightweight |
| **Heatmap** | leaflet.heat | Density heatmap layer on Leaflet map |
| **Backend** | Node.js + Express + TypeScript | Fast API, same language as frontend, easy deploy |
| **Database** | PostgreSQL | Structured data, full-text search, PostGIS for geo queries |
| **Cache/Queue** | Redis (Bull queue) | High-throughput kiosk intake, pub/sub for broadcasts |
| **SLM Integration** | Claude API (Haiku) | Parse messy input → structured record, duplicate matching |
| **Real-time** | Socket.IO | Live broadcast updates, timer sync across kiosks |
| **Search** | PostgreSQL trigram + ts_vector | Fuzzy name search, multilingual full-text search |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KIOSK DEVICES (N kiosks)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Kiosk Z1 │  │ Kiosk Z4 │  │ Kiosk Z8 │  │ Kiosk Zn │           │
│  │ (React)  │  │ (React)  │  │ (React)  │  │ (React)  │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       │              │              │              │                │
│       └──────────────┴──────┬───────┴──────────────┘                │
│                             │  HTTP + WebSocket                     │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVER (Express)                       │
│                                                                     │
│  ┌───────────────┐   ┌───────────────┐   ┌──────────────────┐      │
│  │  REST API     │   │  Socket.IO    │   │  Bull Queue      │      │
│  │  /api/cases   │   │  Server       │   │  (Redis-backed)  │      │
│  │  /api/search  │   │  - broadcasts │   │  - intake queue  │      │
│  │  /api/zones   │   │  - timers     │   │  - match queue   │      │
│  │  /api/stats   │   │  - alerts     │   │  - broadcast q   │      │
│  └───────┬───────┘   └───────┬───────┘   └────────┬─────────┘      │
│          │                   │                     │                │
│  ┌───────┴───────────────────┴─────────────────────┴─────────┐      │
│  │                   SERVICE LAYER                            │      │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │      │
│  │  │ Case     │ │ Match    │ │Broadcast │ │ Analytics   │  │      │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service     │  │      │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘  │      │
│  │       │             │            │              │         │      │
│  │  ┌────┴─────────────┴────────────┴──────────────┴──────┐  │      │
│  │  │              SLM PROCESSOR (Claude Haiku)           │  │      │
│  │  │  - Parse messy input → structured record            │  │      │
│  │  │  - Urgency triage (child/elderly → P1)              │  │      │
│  │  │  - Bilateral match scoring                          │  │      │
│  │  │  - Duplicate detection                              │  │      │
│  │  └────────────────────────────────────────────────────┘  │      │
│  └───────────────────────────────────────────────────────────┘      │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  PostgreSQL  │  │    Redis     │  │  File Store  │
    │              │  │              │  │  (CSV data)  │
    │  - cases     │  │  - queues    │  │              │
    │  - zones     │  │  - pub/sub   │  └──────────────┘
    │  - cameras   │  │  - cache     │
    │  - stations  │  │  - timers    │
    │  - chokepoints│ │              │
    │  - FTS index │  │              │
    └──────────────┘  └──────────────┘
```

---

## Data Flow Diagrams

### Flow 1: Missing Person Report (Family → System)

```
Family at Kiosk                    Backend                        Database
     │                               │                              │
     │  1. Fill form / voice input   │                              │
     │──────────────────────────────>│                              │
     │                               │  2. Push to Redis            │
     │                               │     intake queue             │
     │                               │──────────────────────>       │
     │                               │                     [Redis]  │
     │                               │  3. Worker picks up          │
     │                               │<─────────────────────        │
     │                               │                              │
     │                               │  4. SLM parses input         │
     │                               │     → structured record      │
     │                               │                              │
     │                               │  5. Urgency triage           │
     │                               │     child/elderly → P1       │
     │                               │                              │
     │                               │  6. Check for bilateral      │
     │                               │     match (lost person        │
     │                               │     registered themselves?)   │
     │                               │                              │
     │                               │  7. Check for duplicates     │
     │                               │     across centers            │
     │                               │                              │
     │                               │  8. INSERT case              │
     │                               │──────────────────────────────>│
     │                               │                              │
     │                               │  9. Emit broadcast via       │
     │                               │     Socket.IO to zone kiosks │
     │                               │                              │
     │  10. Confirmation + case ID   │                              │
     │<──────────────────────────────│                              │
```

### Flow 2: Cross-Center Search

```
Family at Center B                 Backend                     PostgreSQL
     │                               │                              │
     │  Search: "elderly woman       │                              │
     │   white saree zone 4"         │                              │
     │──────────────────────────────>│                              │
     │                               │  1. SLM extracts:            │
     │                               │     age_band: 61-70          │
     │                               │     gender: Female           │
     │                               │     description: white saree │
     │                               │     zone: 4                  │
     │                               │                              │
     │                               │  2. Fuzzy search across      │
     │                               │     ALL centers (trigram +   │
     │                               │     full-text + filters)     │
     │                               │──────────────────────────────>│
     │                               │                              │
     │                               │  3. Results ranked by        │
     │                               │     match score              │
     │                               │<──────────────────────────────│
     │                               │                              │
     │  4. Show matching cases       │                              │
     │     from ALL centers          │                              │
     │<──────────────────────────────│                              │
```

### Flow 3: Dead Man's Switch Broadcast

```
                  Kiosk Screen                  Redis                Backend
                       │                          │                     │
  Case created ───────>│  Start 60-min timer      │                     │
                       │  (local + server)        │                     │
                       │                          │                     │
                       │  Display broadcast:      │                     │
                       │  "SOHAM MHATRE is        │                     │
                       │   searching for you      │                     │
                       │   in Zone 8"             │                     │
                       │                          │                     │
                       │         ... 55 min pass ...                    │
                       │                          │                     │
  Family taps          │                          │                     │
  "Still Searching" ──>│──────────────────────────────────────────────>│
                       │                          │   Reset timer to    │
                       │                          │   60 min            │
                       │                          │<────────────────────│
                       │  Timer reset to 60 min   │                     │
                       │<─────────────────────────│                     │
                       │                          │                     │
                       │     ... OR timer hits 0 ...                    │
                       │                          │                     │
                       │  Auto-remove broadcast   │                     │
                       │  Mark case "silent"       │                     │
                       │  (presumed resolved)     │                     │
```

### Flow 4: Redis Queue — High Volume Intake

```
  Kiosk 1 ──┐
  Kiosk 2 ──┤                    ┌─────────────────┐
  Kiosk 3 ──┤  HTTP POST /api/   │   Redis Bull     │     Worker 1 ──> Process
  Kiosk 4 ──┼─────────────────>  │   Intake Queue   │──>  Worker 2 ──> Process
  ...       │                    │                   │     Worker 3 ──> Process
  Kiosk N ──┘                    │  [FIFO, priority  │
                                 │   P1 = high]      │
                                 └─────────────────┘

  Why Redis Queue?
  - 80M pilgrims, thousands of reports on snan days
  - Spikes of 4-5x normal on Amrit Snan days
  - Queue absorbs burst, workers process at steady rate
  - P1 cases (children, elderly) get priority in queue
  - No dropped reports even under extreme load
```

---

## Database Schema

```sql
-- Core cases table (unified registry)
CREATE TABLE cases (
  id              SERIAL PRIMARY KEY,
  case_id         VARCHAR(20) UNIQUE NOT NULL,     -- KMP-2027-XXXXX
  reported_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Missing person info
  missing_person_name  VARCHAR(200),               -- 15% may be blank
  gender              VARCHAR(20),
  age_band            VARCHAR(10),                 -- 0-12, 13-17, etc.
  state               VARCHAR(100),
  district            VARCHAR(100),
  language            VARCHAR(50),
  physical_description TEXT,
  
  -- Location & reporting
  last_seen_location   VARCHAR(200),
  last_seen_zone_id    INTEGER REFERENCES zones(id),
  reporting_center     VARCHAR(100),
  reporter_mobile      VARCHAR(15),                -- 20% may be blank
  
  -- Status & resolution
  status              VARCHAR(30) DEFAULT 'Pending',
  priority            VARCHAR(5) DEFAULT 'P2',     -- P1 = child/elderly
  resolution_hours    DECIMAL(6,2),
  is_duplicate_report BOOLEAN DEFAULT FALSE,
  duplicate_of_case_id VARCHAR(20),
  remarks             TEXT,
  
  -- Broadcast timer (Dead Man's Switch)
  broadcast_active    BOOLEAN DEFAULT TRUE,
  broadcast_expires_at TIMESTAMP,
  broadcast_zone_ids  INTEGER[],                   -- zones to display in
  
  -- Report type
  report_type         VARCHAR(20) DEFAULT 'missing', -- 'missing' or 'found_self'
  
  -- Search optimization
  search_vector       TSVECTOR,                    -- full-text search
  
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- Trigram index for fuzzy name search
CREATE INDEX idx_cases_name_trgm ON cases 
  USING gin (missing_person_name gin_trgm_ops);

-- Full-text search index
CREATE INDEX idx_cases_search ON cases USING gin(search_vector);

-- Status + priority for quick filtering
CREATE INDEX idx_cases_status ON cases(status, priority);

-- Zone lookup
CREATE INDEX idx_cases_zone ON cases(last_seen_zone_id);


-- Zones table
CREATE TABLE zones (
  id                    SERIAL PRIMARY KEY,
  zone_name             VARCHAR(50) NOT NULL,
  centroid_lat          DECIMAL(10,7),
  centroid_lng          DECIMAL(10,7),
  approx_boundary_points INTEGER
);

-- CCTV cameras
CREATE TABLE cameras (
  id          SERIAL PRIMARY KEY,
  camera_id   VARCHAR(20) UNIQUE NOT NULL,
  zone_id     INTEGER REFERENCES zones(id),
  latitude    DECIMAL(10,7),
  longitude   DECIMAL(10,7)
);

-- Police stations
CREATE TABLE police_stations (
  id            SERIAL PRIMARY KEY,
  station_name  VARCHAR(100) NOT NULL,
  latitude      DECIMAL(10,7),
  longitude     DECIMAL(10,7)
);

-- Chokepoints & parking
CREATE TABLE chokepoints (
  id             SERIAL PRIMARY KEY,
  location_name  VARCHAR(200) NOT NULL,
  category       VARCHAR(50),
  latitude       DECIMAL(10,7),
  longitude      DECIMAL(10,7)
);

-- Audit log for all actions
CREATE TABLE audit_log (
  id          SERIAL PRIMARY KEY,
  case_id     VARCHAR(20),
  action      VARCHAR(50),    -- 'created', 'searched', 'renewed', 'expired', 'matched'
  actor       VARCHAR(100),   -- kiosk_id or operator_id
  details     JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## UI Screens

### Screen 1: Admin Portal / Command Center Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  🔴 KUMBH MELA COMMAND CENTER          [Live] [Stats] [Map]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │  2,341  │ │   187   │ │    42   │ │   85%   │          │
│  │ Active  │ │   P1    │ │ Unresol │ │ Reunion │          │
│  │ Cases   │ │ Urgent  │ │  >6hrs  │ │  Rate   │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                             │
│  ┌──────────────────────────────┐ ┌──────────────────────┐ │
│  │     DENSITY HEATMAP          │ │  LIVE FEED           │ │
│  │                              │ │                      │ │
│  │   [Leaflet map with          │ │  KMP-2027-01234  P1  │ │
│  │    heatmap overlay           │ │  Elderly woman, Z4   │ │
│  │    showing missing           │ │  2 min ago           │ │
│  │    person density            │ │                      │ │
│  │    per zone]                 │ │  KMP-2027-01235  P2  │ │
│  │                              │ │  Male, 30s, Z12      │ │
│  │   🔴 = high density          │ │  5 min ago           │ │
│  │   🟡 = medium                │ │                      │ │
│  │   🟢 = low                   │ │  KMP-2027-01236  P1  │ │
│  │                              │ │  Child, Z8           │ │
│  │   📍 Police stations         │ │  7 min ago           │ │
│  │   📷 CCTV cameras            │ │                      │ │
│  │   ⚠️  Chokepoints            │ │  [View All →]        │ │
│  └──────────────────────────────┘ └──────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ZONE-WISE BREAKDOWN              [Filter ▼]        │   │
│  │  Zone 4  ████████████████  142 cases  (12 P1)       │   │
│  │  Zone 8  ███████████████   138 cases  (9 P1)        │   │
│  │  Zone 12 ██████████████    121 cases  (15 P1)       │   │
│  │  Zone 1  ████████████      98 cases   (5 P1)        │   │
│  │  ...                                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Screen 2: Kiosk — Home Screen
```
┌─────────────────────────────────────────┐
│                                         │
│         KUMBH MELA SAHAYATA             │
│         कुंभ मेला सहायता                  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │    🔍 मेरा कोई खो गया है          │    │
│  │    REPORT MISSING PERSON        │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │    🙋 मैं खो गया/गई हूँ             │    │
│  │    I AM LOST                    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │    🔎 किसी को खोजें                │    │
│  │    SEARCH FOR SOMEONE           │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │    🔄 अभी भी खोज रहे हैं          │    │
│  │    STILL SEARCHING              │    │
│  │    (Renew broadcast)            │    │
│  └─────────────────────────────────┘    │
│                                         │
│          Zone 8 • Kiosk K8-03           │
└─────────────────────────────────────────┘
```

### Screen 3: Kiosk — Registration Form
```
┌─────────────────────────────────────────┐
│  ← Back          REPORT MISSING PERSON  │
├─────────────────────────────────────────┤
│                                         │
│  नाम (Name)                             │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  लिंग (Gender)                          │
│  [ पुरुष/Male ] [ महिला/Female ] [ अन्य ]│
│                                         │
│  उम्र (Age Group)                       │
│  [0-12] [13-17] [18-40] [41-60]        │
│  [61-70] [71-80] [80+]                 │
│                                         │
│  कहाँ देखा (Last Seen Zone)              │
│  ┌─────────────────────────────────┐    │
│  │  Zone 4 - Ram Ghat         ▼   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  पहचान (Description)                    │
│  ┌─────────────────────────────────┐    │
│  │  white saree, red bag,          │    │
│  │  spectacles...                  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  मोबाइल नंबर (Mobile - optional)        │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │      ✅ रिपोर्ट दर्ज करें           │    │
│  │         SUBMIT REPORT           │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Screen 4: Broadcast Display (Zone Kiosk Screen)
```
┌─────────────────────────────────────────┐
│  📢 ACTIVE BROADCASTS — Zone 8          │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  SOHAM MHATRE आपको खोज रहे हैं    │    │
│  │  Zone 8 में • ⏱️ 42:17 remaining  │    │
│  │  Elderly woman, white saree      │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  PRIYA SHARMA आपको खोज रही हैं    │    │
│  │  Zone 8 में • ⏱️ 18:03 remaining  │    │
│  │  Male child, ~8 years, blue shirt│    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  RAMESH PATIL आपको खोज रहे हैं    │    │
│  │  Zone 8 में • ⏱️ 55:41 remaining  │    │
│  │  Elderly man, walking stick      │    │
│  └─────────────────────────────────┘    │
│                                         │
│  If you recognize a name above,         │
│  please go to the nearest kiosk.        │
│  अगर ऊपर कोई नाम पहचानते हैं,            │
│  तो नजदीकी कियोस्क पर जाएं।              │
│                                         │
└─────────────────────────────────────────┘
```

---

## Project Structure

```
claude-hack/
├── README.md
├── ARCHITECTURE.md              ← this file
├── docker-compose.yml           ← PostgreSQL + Redis
├── data/                        ← CSV datasets
│   ├── Synthetic_Missing_Persons_2500.csv
│   ├── CCTV_Locations.csv
│   ├── Zone_Boundaries.csv
│   ├── Police_Stations.csv
│   └── Chokepoints_Parking.csv
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts             ← Express server entry
│   │   ├── config/
│   │   │   ├── database.ts      ← PostgreSQL connection
│   │   │   └── redis.ts         ← Redis connection
│   │   ├── routes/
│   │   │   ├── cases.ts         ← CRUD + search API
│   │   │   ├── zones.ts         ← Zone data API
│   │   │   ├── stats.ts         ← Analytics/heatmap API
│   │   │   └── broadcast.ts     ← Broadcast management
│   │   ├── services/
│   │   │   ├── caseService.ts   ← Case business logic
│   │   │   ├── matchService.ts  ← Duplicate + bilateral matching
│   │   │   ├── broadcastService.ts ← Timer management
│   │   │   ├── searchService.ts ← Fuzzy + full-text search
│   │   │   ├── slmService.ts    ← Claude API integration
│   │   │   └── analyticsService.ts ← Heatmap data
│   │   ├── queues/
│   │   │   ├── intakeQueue.ts   ← Bull queue for new reports
│   │   │   ├── matchQueue.ts    ← Bull queue for matching jobs
│   │   │   └── workers.ts      ← Queue workers
│   │   ├── models/
│   │   │   └── schema.ts       ← DB schema / migrations
│   │   ├── socket/
│   │   │   └── handler.ts      ← Socket.IO event handlers
│   │   └── seed/
│   │       └── loadCSV.ts      ← Load CSV data into DB
│   └── .env.example
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    ← Command center with heatmap
│   │   │   ├── KioskHome.tsx    ← Kiosk landing (big buttons)
│   │   │   ├── ReportForm.tsx   ← Missing person registration
│   │   │   ├── LostForm.tsx     ← "I am lost" bilateral form
│   │   │   ├── Search.tsx       ← Cross-center search
│   │   │   ├── Broadcast.tsx    ← Zone broadcast display
│   │   │   └── CaseDetail.tsx   ← Single case view
│   │   ├── components/
│   │   │   ├── HeatMap.tsx      ← Leaflet density heatmap
│   │   │   ├── ZoneMap.tsx      ← Map with zones/cameras/stations
│   │   │   ├── CaseCard.tsx     ← Case summary card
│   │   │   ├── Timer.tsx        ← 60-min countdown component
│   │   │   ├── StatsBar.tsx     ← Top-level metrics
│   │   │   └── SearchBar.tsx    ← Smart search input
│   │   ├── hooks/
│   │   │   ├── useSocket.ts     ← Socket.IO connection
│   │   │   └── useTimer.ts      ← Local countdown logic
│   │   ├── lib/
│   │   │   ├── api.ts           ← API client
│   │   │   └── types.ts         ← Shared TypeScript types
│   │   └── styles/
│   │       └── globals.css      ← Tailwind base
│   └── public/
│       └── favicon.ico
│
└── scripts/
    └── seed-db.sh               ← One-command DB setup
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cases` | Submit new missing person report (goes to Redis queue) |
| POST | `/api/cases/lost` | Submit "I am lost" bilateral report |
| GET | `/api/cases/search?q=...` | Cross-center fuzzy search |
| GET | `/api/cases/:id` | Get single case details |
| PATCH | `/api/cases/:id/renew` | Renew broadcast timer (Still Searching) |
| PATCH | `/api/cases/:id/resolve` | Mark case as resolved |
| GET | `/api/cases/broadcast/:zoneId` | Get active broadcasts for a zone |
| GET | `/api/zones` | List all 32 zones |
| GET | `/api/zones/:id/cameras` | CCTV cameras in a zone |
| GET | `/api/stats/heatmap` | Missing person density per zone (for heatmap) |
| GET | `/api/stats/overview` | Dashboard stats (active, P1, resolved %) |
| GET | `/api/stations` | Police station locations |
| GET | `/api/chokepoints` | Chokepoint + parking locations |

---

## Key Design Decisions

### 1. Redis Queue for Intake
Reports from kiosks hit `POST /api/cases` → immediately pushed to Redis Bull queue → return 202 Accepted with case_id. Workers process asynchronously: SLM parsing, duplicate check, bilateral match, DB insert, broadcast emit. This decouples intake from processing. On Amrit Snan days with 4-5x spike, the queue absorbs the burst.

### 2. Priority Queue
P1 cases (children 0-12, elderly 61+) are added to the queue with higher priority. Workers pick P1 first. A child missing for 30 minutes is categorically more urgent than an adult missing for 10 minutes.

### 3. Dead Man's Switch Timer
- Timer starts at 60 minutes when broadcast is created
- Stored in Redis with TTL for server-side expiry
- Also runs locally on kiosk via JavaScript `setInterval` for offline resilience
- `PATCH /api/cases/:id/renew` resets both timers
- When Redis TTL expires → worker marks case as "silent/presumed resolved"

### 4. Heatmap
`GET /api/stats/heatmap` returns array of `[lat, lng, intensity]` where intensity = number of active missing person cases in that zone. Frontend renders via `leaflet.heat` plugin. Updates every 30 seconds via Socket.IO push.

### 5. Duplicate Detection
When a new case enters the match queue:
1. Fuzzy name match (trigram similarity > 0.4) against existing active cases
2. Same age_band + gender filter
3. SLM compares physical descriptions of top candidates
4. If match confidence > 0.8 → flag as duplicate, link to original case

### 6. Privacy by Design
- No photos stored (descriptions only)
- Mobile numbers hashed at rest, shown only to authorized operators
- Cases auto-archive after 6 hours with no renewal
- Audit log tracks all access
- No PII in broadcast messages (only searcher's name, not the lost person's details)

---

## How to Run (Dev)

```bash
# 1. Start infrastructure
docker-compose up -d   # PostgreSQL + Redis

# 2. Backend
cd backend
npm install
npm run seed           # Load CSV data
npm run dev            # Starts on :3001

# 3. Frontend
cd frontend
npm install
npm run dev            # Starts on :5173

# 4. Open
# Dashboard:  http://localhost:5173/dashboard
# Kiosk:      http://localhost:5173/kiosk
# Broadcast:  http://localhost:5173/broadcast/zone/8
```
