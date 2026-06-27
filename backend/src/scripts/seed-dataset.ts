import fs from 'fs';
import xml2js from 'xml2js';
import { query, pool } from '../db';
import bcrypt from 'bcrypt';

class KMLParser {
  async parseFile(filePath: string): Promise<any> {
    const xml = fs.readFileSync(filePath, 'utf-8');
    const result = await xml2js.parseStringPromise(xml);
    return result;
  }
  
  parseCoordinates(coordString: string): Array<[number, number]> {
    return coordString.trim().split(/\s+/)
      .filter(Boolean)
      .map(coord => {
        const [lng, lat] = coord.split(',');
        return [parseFloat(lng), parseFloat(lat)];
      });
  }
  
  parsePoint(coordString: string): { lat: number; lng: number } {
    const [lng, lat] = coordString.trim().split(',');
    return { lat: parseFloat(lat), lng: parseFloat(lng) };
  }
  
  calculateCentroid(coords: Array<[number, number]>): { lat: number; lng: number } {
    const sum = coords.reduce((acc, [lng, lat]) => ({
      lat: acc.lat + lat,
      lng: acc.lng + lng
    }), { lat: 0, lng: 0 });
    
    return {
      lat: sum.lat / coords.length,
      lng: sum.lng / coords.length
    };
  }
  
  createPostGISPolygon(coords: Array<[number, number]>): string {
    const coordString = coords.map(([lng, lat]) => `${lng} ${lat}`).join(',');
    return `POLYGON((${coordString}))`;
  }
}

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');
  const parser = new KMLParser();
  
  try {
    // 1. Parse CCTV Dataset
    console.log('📹 Parsing CCTV Dataset...');
    const cctvData = await parser.parseFile('../dataset/CCTV Dataset.kml');
    const placemarks = cctvData.kml.Document[0].Placemark;
    
    let zoneCount = 0;
    let cameraCount = 0;
    
    for (const placemark of placemarks) {
      const name = placemark.name[0];
      
      // Zone (has Polygon)
      if (placemark.Polygon) {
        const coords = parser.parseCoordinates(
          placemark.Polygon[0].outerBoundaryIs[0].LinearRing[0].coordinates[0]
        );
        const centroid = parser.calculateCentroid(coords);
        const polygon = parser.createPostGISPolygon(coords);
        
        const zoneId = `ZONE-${name.replace(/[^0-9]/g, '').padStart(3, '0')}`;
        
        const centerLat = parseFloat(centroid.lat.toString());
        const centerLng = parseFloat(centroid.lng.toString());
        
        // Use pool.query directly with prepared: false to avoid type caching issues
        await pool.query({
          text: `
            INSERT INTO zones (zone_id, zone_name, zone_boundary, center_lat, center_lng)
            VALUES ($1, $2, ST_GeomFromText($3, 4326), $4, $5)
            ON CONFLICT (zone_id) DO NOTHING
          `,
          values: [zoneId, name, polygon, centerLat, centerLng],
          rowMode: 'array'
        });
        
        zoneCount++;
      }
      
      // Camera (has Point and name like Z1-C1)
      else if (placemark.Point && name.match(/^Z\d+-C\d+$/)) {
        const point = parser.parsePoint(placemark.Point[0].coordinates[0]);
        const zoneId = `ZONE-${name.split('-')[0].replace('Z', '').padStart(3, '0')}`;
        
        await query(`
          INSERT INTO cctv_cameras (
            camera_id, zone_id, location_name, gps_lat, gps_lng,
            gps_point, camera_type, is_active
          ) VALUES (
            $1, $2, $3, $4, $5,
            ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
            'fixed', true
          )
          ON CONFLICT (camera_id) DO NOTHING
        `, [name, zoneId, name, point.lat, point.lng]);
        
        cameraCount++;
      }
    }
    
    console.log(`   ✅ Zones: ${zoneCount}, CCTV Cameras: ${cameraCount}\n`);
    
    // 2. Parse Police Stations
    console.log('👮 Parsing Police Stations...');
    const policeData = await parser.parseFile('../dataset/Police Stations.kml');
    const stationPlacemarks = policeData.kml.Document[0].Placemark;
    
    let stationCount = 0;
    const defaultPassword = await bcrypt.hash('kumbh2027', 10);
    
    for (const placemark of stationPlacemarks) {
      const name = placemark.name[0];
      const point = parser.parsePoint(placemark.Point[0].coordinates[0]);
      
      // Find nearest zone
      const zoneResult = await query(`
        SELECT zone_id FROM zones
        ORDER BY ST_Distance(
          zone_boundary::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )
        LIMIT 1
      `, [point.lng, point.lat]);
      
      const zoneId = zoneResult.rows[0]?.zone_id || 'UNKNOWN';
      const stationId = `PS-${name.replace(/\s+/g, '-').substring(0, 30).toUpperCase()}`;
      const loginId = name.replace(/\s+/g, '_').toLowerCase();
      
      await query(`
        INSERT INTO police_stations (
          station_id, station_name, zone_id, gps_lat, gps_lng,
          gps_point, login_id, password_hash, is_active
        ) VALUES (
          $1, $2, $3, $4, $5,
          ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
          $6, $7, true
        )
        ON CONFLICT (station_id) DO NOTHING
      `, [stationId, name, zoneId, point.lat, point.lng, loginId, defaultPassword]);
      
      stationCount++;
    }
    
    console.log(`   ✅ Police Stations: ${stationCount}\n`);
    
    // 3. Parse Chokepoints
    console.log('🚦 Parsing Chokepoints...');
    const chokepointData = await parser.parseFile('../dataset/nashik_kumbh_chokepoints_parking_map.kml');
    const chokepointPlacemarks = chokepointData.kml.Document[0].Placemark;
    
    let chokepointCount = 0;
    
    for (const placemark of chokepointPlacemarks) {
      const name = placemark.name[0];
      const description = placemark.description?.[0] || '';
      const point = parser.parsePoint(placemark.Point[0].coordinates[0]);
      
      // Parse description
      const categoryMatch = description.match(/Category:\s*([^|]+)/);
      const riskMatch = description.match(/Risk:\s*([^|]+)/);
      
      const category = categoryMatch ? categoryMatch[1].trim() : 'unknown';
      const risk = riskMatch ? riskMatch[1].trim() : 'medium';
      
      // Find nearest zone
      const zoneResult = await query(`
        SELECT zone_id FROM zones
        ORDER BY ST_Distance(
          zone_boundary::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )
        LIMIT 1
      `, [point.lng, point.lat]);
      
      const zoneId = zoneResult.rows[0]?.zone_id || 'UNKNOWN';
      const chokepointId = `CP-${name.replace(/\s+/g, '-').substring(0, 30).toUpperCase()}`;
      
      await query(`
        INSERT INTO chokepoints (
          chokepoint_id, chokepoint_name, chokepoint_type,
          gps_lat, gps_lng, gps_point, zone_id, risk_level, description
        ) VALUES (
          $1, $2, $3, $4, $5,
          ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
          $6, $7, $8
        )
        ON CONFLICT (chokepoint_id) DO NOTHING
      `, [chokepointId, name, category, point.lat, point.lng, zoneId, risk, description]);
      
      chokepointCount++;
    }
    
    console.log(`   ✅ Chokepoints: ${chokepointCount}\n`);
    
    // Summary
    console.log('🎉 Database seeding completed successfully!');
    console.log(`
Summary:
--------
Zones: ${zoneCount}
CCTV Cameras: ${cameraCount}
Police Stations: ${stationCount}
Chokepoints: ${chokepointCount}

Default police password: kumbh2027
    `);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
  
  process.exit(0);
}

seedDatabase();
