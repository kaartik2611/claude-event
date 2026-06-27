-- Kumbh Mela Missing Person Response System - Database Schema
-- PostgreSQL 16 with PostGIS

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ZONES TABLE
CREATE TABLE IF NOT EXISTS zones (
    zone_id VARCHAR(50) PRIMARY KEY,
    zone_name VARCHAR(100) NOT NULL,
    zone_boundary GEOGRAPHY(POLYGON, 4326),
    center_lat DECIMAL(10, 7) NOT NULL,
    center_lng DECIMAL(10, 7) NOT NULL,
    area_sq_km DECIMAL(10, 2),
    population_density INTEGER,
    zone_type VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_zones_boundary ON zones USING GIST(zone_boundary);

-- 2. POLICE STATIONS TABLE
CREATE TABLE IF NOT EXISTS police_stations (
    station_id VARCHAR(50) PRIMARY KEY,
    station_name VARCHAR(100) NOT NULL,
    zone_id VARCHAR(50) REFERENCES zones(zone_id),
    gps_lat DECIMAL(10, 7) NOT NULL,
    gps_lng DECIMAL(10, 7) NOT NULL,
    gps_point GEOGRAPHY(POINT, 4326),
    phone VARCHAR(20),
    officer_in_charge VARCHAR(100),
    login_id VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_police_stations_zone ON police_stations(zone_id);
CREATE INDEX idx_police_stations_gps ON police_stations USING GIST(gps_point);

-- 3. SHERLOCKS TABLE
CREATE TABLE IF NOT EXISTS sherlocks (
    sherlock_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    assigned_zone VARCHAR(50) REFERENCES zones(zone_id),
    languages TEXT[],
    status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'busy')),
    current_gps_lat DECIMAL(10, 7),
    current_gps_lng DECIMAL(10, 7),
    current_gps_point GEOGRAPHY(POINT, 4326),
    location_last_updated TIMESTAMP,
    reports_filed INTEGER DEFAULT 0,
    cases_resolved INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sherlocks_zone ON sherlocks(assigned_zone);
CREATE INDEX idx_sherlocks_status ON sherlocks(status);
CREATE INDEX idx_sherlocks_gps ON sherlocks USING GIST(current_gps_point);

-- 4. CASES TABLE (Main table)
CREATE TABLE IF NOT EXISTS cases (
    case_id VARCHAR(50) PRIMARY KEY,
    case_type VARCHAR(20) NOT NULL CHECK(case_type IN ('lost', 'searching', 'found')),
    status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('active', 'resolved', 'expired', 'cancelled')),
    urgency VARCHAR(10) DEFAULT 'P2' CHECK(urgency IN ('P1', 'P2', 'P3')),
    
    -- Reporter info
    reporter_name VARCHAR(100) NOT NULL,
    reporter_phone VARCHAR(20) NOT NULL,
    reporter_photo_url TEXT,
    
    -- Person info
    person_name VARCHAR(100),
    person_age INTEGER,
    person_gender VARCHAR(20),
    person_height INTEGER,
    person_clothing TEXT,
    person_physical_features TEXT,
    person_language VARCHAR(50),
    person_photo_url TEXT,
    
    -- Found person (Case 3)
    found_person_photo_url TEXT,
    found_person_description TEXT,
    
    -- Location info
    report_gps_lat DECIMAL(10, 7) NOT NULL,
    report_gps_lng DECIMAL(10, 7) NOT NULL,
    report_gps_point GEOGRAPHY(POINT, 4326),
    report_zone_id VARCHAR(50) REFERENCES zones(zone_id),
    last_seen_location TEXT,
    last_seen_zone VARCHAR(50) REFERENCES zones(zone_id),
    
    -- Voice recording
    voice_recording_url TEXT,
    voice_transcript TEXT,
    voice_parsed_data JSONB,
    
    -- Sherlock info
    sherlock_id VARCHAR(50) REFERENCES sherlocks(sherlock_id),
    
    -- Broadcast info
    broadcast_active BOOLEAN DEFAULT FALSE,
    broadcast_started_at TIMESTAMP,
    broadcast_expires_at TIMESTAMP,
    broadcast_extended_count INTEGER DEFAULT 0,
    
    -- Full-text search
    search_vector TSVECTOR,
    
    -- Matching
    matched_with_case_id VARCHAR(50) REFERENCES cases(case_id),
    match_score DECIMAL(4, 2),
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for cases table
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_urgency ON cases(urgency);
CREATE INDEX idx_cases_type ON cases(case_type);
CREATE INDEX idx_cases_sherlock ON cases(sherlock_id);
CREATE INDEX idx_cases_zone ON cases(report_zone_id);
CREATE INDEX idx_cases_gps ON cases USING GIST(report_gps_point);
CREATE INDEX idx_cases_broadcast ON cases(broadcast_active, broadcast_expires_at);
CREATE INDEX idx_cases_person_name_trgm ON cases USING GIN(person_name gin_trgm_ops);
CREATE INDEX idx_cases_search_vector ON cases USING GIN(search_vector);
CREATE INDEX idx_cases_created ON cases(created_at DESC);

-- Trigger to update search_vector
CREATE OR REPLACE FUNCTION update_case_search_vector() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.person_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.person_clothing, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.person_physical_features, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.last_seen_location, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.voice_transcript, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_case_search_vector
    BEFORE INSERT OR UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION update_case_search_vector();

-- 5. CCTV CAMERAS TABLE
CREATE TABLE IF NOT EXISTS cctv_cameras (
    camera_id VARCHAR(50) PRIMARY KEY,
    zone_id VARCHAR(50) REFERENCES zones(zone_id),
    location_name VARCHAR(200),
    gps_lat DECIMAL(10, 7) NOT NULL,
    gps_lng DECIMAL(10, 7) NOT NULL,
    gps_point GEOGRAPHY(POINT, 4326),
    camera_type VARCHAR(50) DEFAULT 'fixed' CHECK(camera_type IN ('fixed', 'ptz', 'mobile')),
    coverage_area TEXT,
    coverage_radius INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cctv_zone ON cctv_cameras(zone_id);
CREATE INDEX idx_cctv_gps ON cctv_cameras USING GIST(gps_point);
CREATE INDEX idx_cctv_active ON cctv_cameras(is_active);

-- 6. CHOKEPOINTS TABLE
CREATE TABLE IF NOT EXISTS chokepoints (
    chokepoint_id VARCHAR(50) PRIMARY KEY,
    chokepoint_name VARCHAR(200) NOT NULL,
    chokepoint_type VARCHAR(100),
    gps_lat DECIMAL(10, 7) NOT NULL,
    gps_lng DECIMAL(10, 7) NOT NULL,
    gps_point GEOGRAPHY(POINT, 4326),
    zone_id VARCHAR(50) REFERENCES zones(zone_id),
    avg_daily_traffic INTEGER,
    peak_hours VARCHAR(50),
    risk_level VARCHAR(20) DEFAULT 'medium' CHECK(risk_level IN ('very high', 'high', 'medium', 'low')),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chokepoints_zone ON chokepoints(zone_id);
CREATE INDEX idx_chokepoints_gps ON chokepoints USING GIST(gps_point);
CREATE INDEX idx_chokepoints_risk ON chokepoints(risk_level);

-- 7. ML PREDICTIONS TABLE
CREATE TABLE IF NOT EXISTS ml_predictions (
    prediction_id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(case_id) ON DELETE CASCADE,
    predicted_zones JSONB NOT NULL,
    input_factors JSONB,
    model_version VARCHAR(20) DEFAULT 'v1.0',
    confidence_avg DECIMAL(4, 2),
    predicted_at TIMESTAMP DEFAULT NOW(),
    actual_zone VARCHAR(50),
    was_correct BOOLEAN,
    previous_prediction_id INTEGER REFERENCES ml_predictions(prediction_id)
);

CREATE INDEX idx_ml_predictions_case ON ml_predictions(case_id);
CREATE INDEX idx_ml_predictions_created ON ml_predictions(predicted_at DESC);

-- 8. MATCHES TABLE
CREATE TABLE IF NOT EXISTS matches (
    match_id SERIAL PRIMARY KEY,
    case1_id VARCHAR(50) REFERENCES cases(case_id) ON DELETE CASCADE,
    case2_id VARCHAR(50) REFERENCES cases(case_id) ON DELETE CASCADE,
    match_score DECIMAL(4, 2) NOT NULL CHECK(match_score BETWEEN 0 AND 1),
    match_type VARCHAR(50) NOT NULL CHECK(match_type IN ('photo', 'text', 'features', 'voice', 'bilateral')),
    match_details JSONB,
    status VARCHAR(20) DEFAULT 'potential' CHECK(status IN ('potential', 'confirmed', 'rejected')),
    reviewed_by VARCHAR(50),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_matches_case1 ON matches(case1_id);
CREATE INDEX idx_matches_case2 ON matches(case2_id);
CREATE INDEX idx_matches_score ON matches(match_score DESC);
CREATE INDEX idx_matches_status ON matches(status);

-- 9. DISPATCHES TABLE
CREATE TABLE IF NOT EXISTS dispatches (
    dispatch_id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) REFERENCES cases(case_id) ON DELETE CASCADE,
    station_id VARCHAR(50) REFERENCES police_stations(station_id),
    officer_names TEXT[],
    vehicle_number VARCHAR(50),
    target_lat DECIMAL(10, 7) NOT NULL,
    target_lng DECIMAL(10, 7) NOT NULL,
    target_zone VARCHAR(50) REFERENCES zones(zone_id),
    status VARCHAR(20) DEFAULT 'dispatched' CHECK(status IN ('dispatched', 'arrived', 'completed', 'cancelled')),
    dispatched_at TIMESTAMP DEFAULT NOW(),
    arrived_at TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT
);

CREATE INDEX idx_dispatches_case ON dispatches(case_id);
CREATE INDEX idx_dispatches_station ON dispatches(station_id);
CREATE INDEX idx_dispatches_status ON dispatches(status);

-- 10. ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS admin_users (
    admin_id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    email VARCHAR(100),
    role VARCHAR(20) DEFAULT 'admin' CHECK(role IN ('admin', 'superadmin')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_users_username ON admin_users(username);

-- Insert default admin user (password: admin123)
INSERT INTO admin_users (admin_id, username, password_hash, full_name, role)
VALUES (
    'ADMIN-001',
    'admin',
    '$2b$10$rK8YvJZZZ5QyX7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X7X',
    'System Administrator',
    'superadmin'
) ON CONFLICT (admin_id) DO NOTHING;

-- Views for analytics

-- Active cases by zone
CREATE OR REPLACE VIEW v_active_cases_by_zone AS
SELECT 
    z.zone_id,
    z.zone_name,
    COUNT(c.case_id) as active_cases,
    COUNT(CASE WHEN c.urgency = 'P1' THEN 1 END) as p1_cases,
    COUNT(CASE WHEN c.urgency = 'P2' THEN 1 END) as p2_cases,
    COUNT(CASE WHEN c.urgency = 'P3' THEN 1 END) as p3_cases
FROM zones z
LEFT JOIN cases c ON c.report_zone_id = z.zone_id AND c.status = 'active'
GROUP BY z.zone_id, z.zone_name;

-- Sherlock performance
CREATE OR REPLACE VIEW v_sherlock_performance AS
SELECT 
    s.sherlock_id,
    s.name,
    s.phone,
    s.assigned_zone,
    s.reports_filed,
    s.cases_resolved,
    CASE 
        WHEN s.reports_filed > 0 THEN ROUND((s.cases_resolved::DECIMAL / s.reports_filed) * 100, 2)
        ELSE 0 
    END as resolution_rate,
    s.status,
    s.location_last_updated
FROM sherlocks s;

-- Case statistics
CREATE OR REPLACE VIEW v_case_statistics AS
SELECT 
    COUNT(*) FILTER (WHERE status = 'active') as active_cases,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_cases,
    COUNT(*) FILTER (WHERE status = 'expired') as expired_cases,
    COUNT(*) FILTER (WHERE urgency = 'P1') as p1_cases,
    COUNT(*) FILTER (WHERE urgency = 'P2') as p2_cases,
    COUNT(*) FILTER (WHERE urgency = 'P3') as p3_cases,
    COUNT(*) FILTER (WHERE case_type = 'lost') as lost_cases,
    COUNT(*) FILTER (WHERE case_type = 'searching') as searching_cases,
    COUNT(*) FILTER (WHERE case_type = 'found') as found_cases,
    COUNT(*) FILTER (WHERE broadcast_active = TRUE) as active_broadcasts
FROM cases;
