import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import { query, pool } from '../db';
import bcrypt from 'bcrypt';

class KMLParser {
  async parseFile(filePath: string): Promise<any> {
    const resolved = path.resolve(__dirname, filePath);
    console.log(`   Loading: ${resolved}`);
    const xml = fs.readFileSync(resolved, 'utf-8');
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
    // Ensure polygon is closed
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push(first);
    }
    const coordString = coords.map(([lng, lat]) => `${lng} ${lat}`).join(',');
    return `POLYGON((${coordString}))`;
  }

  // Recursively extract all Placemarks from a KML document
  extractPlacemarks(node: any): any[] {
    const placemarks: any[] = [];

    if (node.Placemark) {
      placemarks.push(...node.Placemark);
    }

    if (node.Folder) {
      for (const folder of node.Folder) {
        placemarks.push(...this.extractPlacemarks(folder));
      }
    }

    if (node.Document) {
      for (const doc of node.Document) {
        placemarks.push(...this.extractPlacemarks(doc));
      }
    }

    return placemarks;
  }
}

const VALID_RISK_LEVELS = ['very high', 'high', 'medium', 'low'];

function normalizeRiskLevel(risk: string): string {
  const normalized = risk.trim().toLowerCase();
  if (VALID_RISK_LEVELS.includes(normalized)) return normalized;
  // Fuzzy match
  if (normalized.includes('very') && normalized.includes('high')) return 'very high';
  if (normalized.includes('high')) return 'high';
  if (normalized.includes('low')) return 'low';
  return 'medium';
}

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');
  const parser = new KMLParser();

  // Resolve dataset path relative to project root
  const datasetDir = path.resolve(__dirname, '../../../dataset');

  try {
    // ==============================
    // 1. Parse CCTV Dataset — Zones + Cameras
    // ==============================
    console.log('📹 Parsing CCTV Dataset...');
    const cctvData = await parser.parseFile(path.join(datasetDir, 'CCTV Dataset.kml'));
    const allPlacemarks = parser.extractPlacemarks(cctvData.kml);

    let zoneCount = 0;
    let cameraCount = 0;
    let skippedCount = 0;

    // First pass: insert all zones
    for (const placemark of allPlacemarks) {
      const name = placemark.name?.[0];
      if (!name) continue;

      if (placemark.Polygon && name.startsWith('Zone Area')) {
        try {
          const coords = parser.parseCoordinates(
            placemark.Polygon[0].outerBoundaryIs[0].LinearRing[0].coordinates[0]
          );
          const centroid = parser.calculateCentroid(coords);
          const polygon = parser.createPostGISPolygon(coords);

          const zoneNum = name.replace(/[^0-9]/g, '');
          const zoneId = `ZONE-${zoneNum.padStart(3, '0')}`;

          await pool.query({
            text: `
              INSERT INTO zones (zone_id, zone_name, zone_boundary, center_lat, center_lng)
              VALUES ($1, $2, ST_GeogFromText($3), $4, $5)
              ON CONFLICT (zone_id) DO NOTHING
            `,
            values: [zoneId, name, polygon, centroid.lat, centroid.lng],
          });
          zoneCount++;
        } catch (err: any) {
          console.error(`   ⚠️  Failed to insert zone "${name}":`, err.message);
        }
      }
    }
    console.log(`   ✅ Zones inserted: ${zoneCount}`);

    // Second pass: insert all cameras (Z-cameras, C-cameras, M-cameras)
    for (const placemark of allPlacemarks) {
      const name = placemark.name?.[0];
      if (!name || !placemark.Point) continue;

      // Z-cameras: Z1-C1 format — have explicit zone
      const zMatch = name.match(/^Z(\d+)-C(\d+)$/);
      // C-cameras: C-0001 format — unzoned, assign to nearest
      const cMatch = name.match(/^C-(\d+)$/);
      // M-cameras: M-001 format — mobile, assign to nearest
      const mMatch = name.match(/^M-(\d+)$/);

      if (!zMatch && !cMatch && !mMatch) {
        skippedCount++;
        continue;
      }

      try {
        const point = parser.parsePoint(placemark.Point[0].coordinates[0]);
        let zoneId: string;
        let cameraType: string = 'fixed';

        if (zMatch) {
          // Zone camera — zone is explicit
          zoneId = `ZONE-${zMatch[1].padStart(3, '0')}`;
        } else {
          // C- or M- camera — find nearest zone
          cameraType = mMatch ? 'mobile' : 'fixed';
          const zoneResult = await pool.query({
            text: `
              SELECT zone_id FROM zones
              ORDER BY ST_Distance(
                zone_boundary,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
              )
              LIMIT 1
            `,
            values: [point.lng, point.lat],
          });
          zoneId = zoneResult.rows[0]?.zone_id || 'ZONE-001';
        }

        await pool.query({
          text: `
            INSERT INTO cctv_cameras (
              camera_id, zone_id, location_name, gps_lat, gps_lng,
              gps_point, camera_type, is_active
            ) VALUES (
              $1, $2, $3, $4, $5,
              ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
              $8, true
            )
            ON CONFLICT (camera_id) DO NOTHING
          `,
          values: [name, zoneId, name, point.lat, point.lng, point.lng, point.lat, cameraType],
        });
        cameraCount++;

        if (cameraCount % 500 === 0) {
          console.log(`   ... ${cameraCount} cameras inserted`);
        }
      } catch (err: any) {
        console.error(`   ⚠️  Failed camera "${name}":`, err.message);
      }
    }
    console.log(`   ✅ Cameras: ${cameraCount} inserted, ${skippedCount} non-camera placemarks skipped\n`);

    // ==============================
    // 2. Parse Police Stations
    // ==============================
    console.log('👮 Parsing Police Stations...');
    const policeData = await parser.parseFile(path.join(datasetDir, 'Police Stations.kml'));
    const stationPlacemarks = parser.extractPlacemarks(policeData.kml);

    let stationCount = 0;
    const defaultPassword = await bcrypt.hash('kumbh2027', 10);

    for (const placemark of stationPlacemarks) {
      const name = placemark.name?.[0];
      if (!name || !placemark.Point) continue;

      try {
        const point = parser.parsePoint(placemark.Point[0].coordinates[0]);

        // Find nearest zone
        const zoneResult = await pool.query({
          text: `
            SELECT zone_id FROM zones
            ORDER BY ST_Distance(
              zone_boundary,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            )
            LIMIT 1
          `,
          values: [point.lng, point.lat],
        });

        const zoneId = zoneResult.rows[0]?.zone_id || 'ZONE-001';
        const stationId = `PS-${name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30).toUpperCase()}`;
        const loginId = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 50);

        await pool.query({
          text: `
            INSERT INTO police_stations (
              station_id, station_name, zone_id, gps_lat, gps_lng,
              gps_point, login_id, password_hash, is_active
            ) VALUES (
              $1, $2, $3, $4, $5,
              ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
              $8, $9, true
            )
            ON CONFLICT (station_id) DO NOTHING
          `,
          values: [stationId, name, zoneId, point.lat, point.lng, point.lng, point.lat, loginId, defaultPassword],
        });
        stationCount++;
      } catch (err: any) {
        console.error(`   ⚠️  Failed station "${name}":`, err.message);
      }
    }
    console.log(`   ✅ Police Stations: ${stationCount}\n`);

    // ==============================
    // 3. Parse Chokepoints & Parking
    // ==============================
    console.log('🚦 Parsing Chokepoints & Parking...');
    const chokepointData = await parser.parseFile(path.join(datasetDir, 'nashik_kumbh_chokepoints_parking_map.kml'));
    const chokepointPlacemarks = parser.extractPlacemarks(chokepointData.kml);

    let chokepointCount = 0;

    for (const placemark of chokepointPlacemarks) {
      const name = placemark.name?.[0];
      if (!name || !placemark.Point) continue;

      try {
        const description = placemark.description?.[0] || '';
        const point = parser.parsePoint(placemark.Point[0].coordinates[0]);

        // Parse category and risk from description
        const categoryMatch = description.match(/Category:\s*([^|]+)/);
        const riskMatch = description.match(/Risk:\s*([^|]+)/);

        const category = categoryMatch ? categoryMatch[1].trim() : 'unknown';
        const risk = normalizeRiskLevel(riskMatch ? riskMatch[1].trim() : 'medium');

        // Find nearest zone
        const zoneResult = await pool.query({
          text: `
            SELECT zone_id FROM zones
            ORDER BY ST_Distance(
              zone_boundary,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            )
            LIMIT 1
          `,
          values: [point.lng, point.lat],
        });

        const zoneId = zoneResult.rows[0]?.zone_id || 'ZONE-001';
        // Create a unique ID by hashing the name
        const chokepointId = `CP-${name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 40).toUpperCase()}`;

        await pool.query({
          text: `
            INSERT INTO chokepoints (
              chokepoint_id, chokepoint_name, chokepoint_type,
              gps_lat, gps_lng, gps_point, zone_id, risk_level, description
            ) VALUES (
              $1, $2, $3, $4, $5,
              ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
              $8, $9, $10
            )
            ON CONFLICT (chokepoint_id) DO NOTHING
          `,
          values: [chokepointId, name, category, point.lat, point.lng, point.lng, point.lat, zoneId, risk, description],
        });
        chokepointCount++;
      } catch (err: any) {
        console.error(`   ⚠️  Failed chokepoint "${name}":`, err.message);
      }
    }
    console.log(`   ✅ Chokepoints: ${chokepointCount}\n`);

    // ==============================
    // Summary
    // ==============================
    console.log('🎉 Database seeding completed!\n');
    console.log(`Summary:
────────────────────────
  Zones:           ${zoneCount}
  CCTV Cameras:    ${cameraCount} (Z: ~1280, C: ~1200, M: ~600)
  Police Stations: ${stationCount}
  Chokepoints:     ${chokepointCount}
────────────────────────
  Default police password: kumbh2027
`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }

  await pool.end();
  process.exit(0);
}

seedDatabase();
