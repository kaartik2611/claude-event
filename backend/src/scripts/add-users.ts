#!/usr/bin/env node
import { pool } from '../db';
import bcrypt from 'bcrypt';

async function addUsers() {
  try {
    console.log('🔐 Adding test users...\n');

    // Add multiple Sherlock volunteers
    const sherlocks = [
      { id: 'SHERLOCK-001', name: 'Rajesh Kumar', phone: '+919876543210' },
      { id: 'SHERLOCK-002', name: 'Priya Sharma', phone: '+919876543211' },
      { id: 'SHERLOCK-003', name: 'Amit Patel', phone: '+919876543212' },
      { id: 'SHERLOCK-004', name: 'Sneha Desai', phone: '+919123456789' },
      { id: 'SHERLOCK-005', name: 'Vikram Singh', phone: '+919999999999' },
    ];

    for (const s of sherlocks) {
      await pool.query(`
        INSERT INTO sherlocks (sherlock_id, name, phone, assigned_zone, status)
        VALUES ($1, $2, $3, 'ZONE-001', 'active')
        ON CONFLICT (sherlock_id) DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          status = 'active';
      `, [s.id, s.name, s.phone]);
      console.log(`✅ Sherlock: ${s.name} (${s.phone})`);
    }

    // Add more police stations
    const stations = [
      { id: 'PS-001', name: 'Nashik Police Station 1', login: 'nashik_ps1', pass: 'police123' },
      { id: 'PS-002', name: 'Nashik Police Station 2', login: 'nashik_ps2', pass: 'police123' },
      { id: 'test_station', name: 'Test Police Station', login: 'test_station', pass: 'kumbh2027' },
    ];

    for (const st of stations) {
      const hash = await bcrypt.hash(st.pass, 10);
      const officerName = `Officer ${st.id}`;
      await pool.query(`
        INSERT INTO police_stations (
          station_id, station_name, zone_id, gps_lat, gps_lng,
          gps_point, officer_in_charge, phone, login_id, password_hash, is_active
        ) VALUES (
          $1, $2, 'ZONE-001', 19.95, 73.75,
          ST_SetSRID(ST_MakePoint(73.75, 19.95), 4326)::geography,
          $3, '+919876543200', $4, $5, true
        )
        ON CONFLICT (station_id) DO UPDATE SET
          login_id = EXCLUDED.login_id,
          password_hash = EXCLUDED.password_hash,
          is_active = true;
      `, [st.id, st.name, officerName, st.login, hash]);
      console.log(`✅ Police: ${st.login} / ${st.pass}`);
    }

    // Add admin users
    const admins = [
      { id: 'ADMIN-001', user: 'admin', pass: 'admin123', name: 'System Admin', role: 'superadmin' },
      { id: 'ADMIN-002', user: 'control', pass: 'control123', name: 'Control Room', role: 'admin' },
    ];

    for (const ad of admins) {
      const hash = await bcrypt.hash(ad.pass, 10);
      await pool.query(`
        INSERT INTO admin_users (admin_id, username, password_hash, full_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (username) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          is_active = true;
      `, [ad.id, ad.user, hash, ad.name, ad.role]);
      console.log(`✅ Admin: ${ad.user} / ${ad.pass}`);
    }

    console.log('\n✅ All users added successfully!\n');
    console.log('📋 SHERLOCK LOGINS (no password):');
    sherlocks.forEach(s => console.log(`   ${s.phone} - ${s.name}`));
    console.log('\n📋 POLICE LOGINS:');
    stations.forEach(s => console.log(`   ${s.login} / ${s.pass}`));
    console.log('\n📋 ADMIN LOGINS:');
    admins.forEach(a => console.log(`   ${a.user} / ${a.pass}`));

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

addUsers();
