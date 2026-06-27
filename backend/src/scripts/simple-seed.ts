#!/usr/bin/env node
/**
 * Simple database seeding script
 * Seeds sample data for testing
 */

import { pool } from '../db';
import bcrypt from 'bcrypt';

async function seed() {
  try {
    console.log('\ud83c\udf31 Starting simple database seeding...\n');

    // Create a test zone
    console.log('Creating test zone...');
    await pool.query(`
      INSERT INTO zones (zone_id, zone_name, zone_boundary, center_lat, center_lng)
      VALUES (
        'ZONE-001',
        'Test Zone 1',
        ST_GeomFromText('POLYGON((73.7 19.9, 73.8 19.9, 73.8 20.0, 73.7 20.0, 73.7 19.9))', 4326),
        19.95,
        73.75
      )
      ON CONFLICT (zone_id) DO NOTHING;
    `);

    // Create test police station
    console.log('Creating test police station...');
    const hashedPassword = await bcrypt.hash('kumbh2027', 10);
    await pool.query(`
      INSERT INTO police_stations (
        station_id, station_name, zone_id, gps_lat, gps_lng,
        gps_point, officer_in_charge, phone, login_id, password_hash, is_active
      ) VALUES (
        'test_station',
        'Test Police Station',
        'ZONE-001',
        19.95,
        73.75,
        ST_SetSRID(ST_MakePoint(73.75, 19.95), 4326)::geography,
        'Officer Test',
        '+91 9876543210',
        'test_station',
        $1,
        true
      )
      ON CONFLICT (station_id) DO NOTHING;
    `, [hashedPassword]);

    // Create test CCTV camera
    console.log('Creating test CCTV camera...');
    await pool.query(`
      INSERT INTO cctv_cameras (
        camera_id, zone_id, location_name, gps_lat, gps_lng,
        gps_point, camera_type, is_active
      ) VALUES (
        'CAM-001',
        'ZONE-001',
        'Test Camera 1',
        19.95,
        73.75,
        ST_SetSRID(ST_MakePoint(73.75, 19.95), 4326)::geography,
        'fixed',
        true
      )
      ON CONFLICT (camera_id) DO NOTHING;
    `);

    // Create test Sherlock volunteer
    console.log('Creating test Sherlock volunteer...');
    await pool.query(`
      INSERT INTO sherlocks (
        sherlock_id, name, phone, assigned_zone, status
      ) VALUES (
        'SHERLOCK-001',
        'Test Volunteer',
        '+91 9876543210',
        'ZONE-001',
        'active'
      )
      ON CONFLICT (sherlock_id) DO NOTHING;
    `);

    // Create admin user
    console.log('Creating admin user...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    await pool.query(`
      INSERT INTO admin_users (admin_id, username, password_hash, full_name, role, is_active)
      VALUES ('ADMIN-001', 'admin', $1, 'System Administrator', 'superadmin', true)
      ON CONFLICT (username) DO NOTHING;
    `, [adminPassword]);

    console.log('\n✅ Database seeded successfully!');
    console.log('\n🔐 Test Credentials:');
    console.log('   Sherlock: +91 9876543210 (no password)');
    console.log('   Police: test_station / kumbh2027');
    console.log('   Admin: admin / admin123');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    await pool.end();
    process.exit(1);
  }
}

seed();
