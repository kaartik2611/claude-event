import { Router, Response } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

/**
 * GET /api/analytics/stats
 * Main dashboard statistics — case counts, zone breakdown, infrastructure summary
 */
router.get('/stats', authenticate, requireRole('admin', 'police'), async (req: AuthRequest, res: Response) => {
  try {
    // Case statistics from view
    const caseStats = await query('SELECT * FROM v_case_statistics');

    // Zone-wise active case breakdown
    const zoneBreakdown = await query(`
      SELECT * FROM v_active_cases_by_zone
      WHERE active_cases > 0
      ORDER BY active_cases DESC
    `);

    // Infrastructure counts
    const infra = await query(`
      SELECT
        (SELECT COUNT(*) FROM zones) AS total_zones,
        (SELECT COUNT(*) FROM cctv_cameras) AS total_cameras,
        (SELECT COUNT(*) FROM cctv_cameras WHERE is_active = TRUE) AS active_cameras,
        (SELECT COUNT(*) FROM police_stations) AS total_police_stations,
        (SELECT COUNT(*) FROM chokepoints) AS total_chokepoints,
        (SELECT COUNT(*) FROM sherlocks) AS total_sherlocks,
        (SELECT COUNT(*) FROM sherlocks WHERE status = 'active') AS active_sherlocks
    `);

    // Recent cases (last 24h)
    const recentActivity = await query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS cases_last_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS cases_last_hour,
        COUNT(*) FILTER (WHERE resolved_at > NOW() - INTERVAL '24 hours') AS resolved_last_24h
      FROM cases
    `);

    // Chokepoint category breakdown
    const chokepointBreakdown = await query(`
      SELECT chokepoint_type AS category, COUNT(*) AS count
      FROM chokepoints
      GROUP BY chokepoint_type
      ORDER BY count DESC
    `);

    // Camera coverage per zone
    const cameraCoverage = await query(`
      SELECT
        z.zone_id,
        z.zone_name,
        COUNT(cc.camera_id) AS camera_count
      FROM zones z
      LEFT JOIN cctv_cameras cc ON cc.zone_id = z.zone_id
      GROUP BY z.zone_id, z.zone_name
      ORDER BY camera_count DESC
      LIMIT 10
    `);

    // Urgency distribution for active cases
    const urgencyDistribution = await query(`
      SELECT urgency, COUNT(*) AS count
      FROM cases
      WHERE status = 'active'
      GROUP BY urgency
      ORDER BY urgency
    `);

    // Matches stats
    const matchStats = await query(`
      SELECT
        COUNT(*) AS total_matches,
        COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_matches,
        COUNT(*) FILTER (WHERE status = 'potential') AS potential_matches,
        ROUND(AVG(match_score)::numeric, 2) AS avg_match_score
      FROM matches
    `);

    const stats = caseStats.rows[0] || {};
    const infrastructure = infra.rows[0] || {};
    const activity = recentActivity.rows[0] || {};
    const matching = matchStats.rows[0] || {};

    res.json({
      // Case stats (what CentralDashboard expects)
      active_cases: parseInt(stats.active_cases) || 0,
      resolved_cases: parseInt(stats.resolved_cases) || 0,
      expired_cases: parseInt(stats.expired_cases) || 0,
      p1_cases: parseInt(stats.p1_cases) || 0,
      p2_cases: parseInt(stats.p2_cases) || 0,
      p3_cases: parseInt(stats.p3_cases) || 0,
      lost_cases: parseInt(stats.lost_cases) || 0,
      searching_cases: parseInt(stats.searching_cases) || 0,
      found_cases: parseInt(stats.found_cases) || 0,
      active_broadcasts: parseInt(stats.active_broadcasts) || 0,

      // Infrastructure
      infrastructure: {
        total_zones: parseInt(infrastructure.total_zones) || 0,
        total_cameras: parseInt(infrastructure.total_cameras) || 0,
        active_cameras: parseInt(infrastructure.active_cameras) || 0,
        total_police_stations: parseInt(infrastructure.total_police_stations) || 0,
        total_chokepoints: parseInt(infrastructure.total_chokepoints) || 0,
        total_sherlocks: parseInt(infrastructure.total_sherlocks) || 0,
        active_sherlocks: parseInt(infrastructure.active_sherlocks) || 0,
      },

      // Recent activity
      activity: {
        cases_last_24h: parseInt(activity.cases_last_24h) || 0,
        cases_last_hour: parseInt(activity.cases_last_hour) || 0,
        resolved_last_24h: parseInt(activity.resolved_last_24h) || 0,
      },

      // Matching
      matching: {
        total_matches: parseInt(matching.total_matches) || 0,
        confirmed_matches: parseInt(matching.confirmed_matches) || 0,
        potential_matches: parseInt(matching.potential_matches) || 0,
        avg_match_score: parseFloat(matching.avg_match_score) || 0,
      },

      // Breakdowns
      zone_breakdown: zoneBreakdown.rows,
      chokepoint_breakdown: chokepointBreakdown.rows,
      camera_coverage: cameraCoverage.rows,
      urgency_distribution: urgencyDistribution.rows,
    });
  } catch (error) {
    console.error('❌ Analytics stats error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/analytics/zones
 * Zone-wise statistics with camera and case data
 */
router.get('/zones', authenticate, requireRole('admin', 'police'), async (req: AuthRequest, res: Response) => {
  try {
    const zones = await query(`
      SELECT
        z.zone_id,
        z.zone_name,
        z.center_lat,
        z.center_lng,
        COUNT(DISTINCT cc.camera_id) AS camera_count,
        COUNT(DISTINCT c.case_id) FILTER (WHERE c.status = 'active') AS active_cases,
        COUNT(DISTINCT c.case_id) FILTER (WHERE c.urgency = 'P1' AND c.status = 'active') AS p1_cases,
        COUNT(DISTINCT ch.chokepoint_id) AS chokepoint_count,
        COUNT(DISTINCT ps.station_id) AS police_station_count
      FROM zones z
      LEFT JOIN cctv_cameras cc ON cc.zone_id = z.zone_id
      LEFT JOIN cases c ON c.report_zone_id = z.zone_id
      LEFT JOIN chokepoints ch ON ch.zone_id = z.zone_id
      LEFT JOIN police_stations ps ON ps.zone_id = z.zone_id
      GROUP BY z.zone_id, z.zone_name, z.center_lat, z.center_lng
      ORDER BY z.zone_id
    `);

    res.json({ zones: zones.rows });
  } catch (error) {
    console.error('❌ Analytics zones error:', error);
    res.status(500).json({ error: 'Failed to fetch zone analytics' });
  }
});

/**
 * GET /api/analytics/heatmap
 * GPS points for case heatmap overlay
 */
router.get('/heatmap', authenticate, requireRole('admin', 'police'), async (req: AuthRequest, res: Response) => {
  try {
    const cases = await query(`
      SELECT
        report_gps_lat AS lat,
        report_gps_lng AS lng,
        CASE urgency
          WHEN 'P1' THEN 1.0
          WHEN 'P2' THEN 0.6
          ELSE 0.3
        END AS intensity
      FROM cases
      WHERE status = 'active'
        AND report_gps_lat IS NOT NULL
    `);

    res.json({ points: cases.rows });
  } catch (error) {
    console.error('❌ Heatmap error:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

/**
 * GET /api/analytics/predictive-zones/:caseId
 * Time-based predictive zone changes for a specific case
 * Shows how predicted zones shift as time passes (for police)
 * Query params: ?steps=6&intervalMinutes=30
 */
router.get('/predictive-zones/:caseId', authenticate, requireRole('admin', 'police'), async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const steps = Math.min(parseInt(req.query.steps as string) || 6, 12);
    const intervalMinutes = Math.min(parseInt(req.query.intervalMinutes as string) || 30, 120);

    // Get the case
    const caseResult = await query('SELECT * FROM cases WHERE case_id = $1', [caseId]);
    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    const caseData = caseResult.rows[0];

    // Get all zones with their cameras and chokepoints
    const zonesResult = await query('SELECT * FROM zones');
    const allZones = zonesResult.rows;

    // Movement speed based on age
    const age = caseData.person_age;
    let movementSpeed = 2.5; // km/hr default
    let personProfile = 'unknown';
    if (age) {
      if (age < 12) { movementSpeed = 1.5; personProfile = 'child'; }
      else if (age < 60) { movementSpeed = 3.0; personProfile = 'adult'; }
      else { movementSpeed = 1.0; personProfile = 'elderly'; }
    }

    // Actual time elapsed since report
    const actualElapsedMinutes = Math.floor(
      (Date.now() - new Date(caseData.created_at).getTime()) / (1000 * 60)
    );

    // Calculate predictions at each time step
    const timeline: any[] = [];

    for (let step = 0; step < steps; step++) {
      const timeMinutes = (step + 1) * intervalMinutes;
      const hoursElapsed = timeMinutes / 60;
      const maxDistance = movementSpeed * hoursElapsed;

      const zonePredictions: any[] = [];

      for (const zone of allZones) {
        // Haversine distance
        const distance = haversineDistance(
          caseData.report_gps_lat, caseData.report_gps_lng,
          zone.center_lat, zone.center_lng
        );

        let probability = 0;

        // Factor 1: Distance decay (40% weight)
        if (distance <= maxDistance) {
          probability += 0.4 * (1 - distance / Math.max(maxDistance, 0.01));
        }

        // Factor 2: Same zone bonus (25%)
        if (caseData.report_zone_id === zone.zone_id) {
          // Probability decays over time — person is less likely to stay
          const stayDecay = Math.max(0.05, 1 - (hoursElapsed / 6));
          probability += 0.25 * stayDecay;
        }

        // Factor 3: Crowd drift toward chokepoints at peak hours (20%)
        // Peak: 4-6 AM (Amrit Snan), 7-9 AM, 4-7 PM
        const currentHour = new Date(new Date(caseData.created_at).getTime() + timeMinutes * 60000).getHours();
        const isPeakHour = (currentHour >= 4 && currentHour <= 9) || (currentHour >= 16 && currentHour <= 19);
        if (isPeakHour && distance <= maxDistance * 1.5) {
          probability += 0.10;
        }

        // Factor 4: Adjacent zone drift (15%)
        // As time passes, adjacent zones become more likely
        if (distance > 0 && distance <= maxDistance * 0.8) {
          probability += 0.15 * (1 - distance / (maxDistance * 0.8));
        }

        if (probability > 0.05) {
          zonePredictions.push({
            zone_id: zone.zone_id,
            zone_name: zone.zone_name,
            center_lat: parseFloat(zone.center_lat),
            center_lng: parseFloat(zone.center_lng),
            probability: Math.min(1, Math.round(probability * 100) / 100),
            distance_km: Math.round(distance * 100) / 100,
            reachable: distance <= maxDistance,
          });
        }
      }

      // Sort by probability, top 5
      zonePredictions.sort((a: any, b: any) => b.probability - a.probability);
      const topZones = zonePredictions.slice(0, 5);

      timeline.push({
        time_label: `+${timeMinutes} min (${hoursElapsed.toFixed(1)} hr)`,
        time_minutes: timeMinutes,
        max_search_radius_km: Math.round(maxDistance * 100) / 100,
        is_peak_hour: ((new Date(new Date(caseData.created_at).getTime() + timeMinutes * 60000).getHours()) >= 4 &&
          (new Date(new Date(caseData.created_at).getTime() + timeMinutes * 60000).getHours()) <= 9) ||
          ((new Date(new Date(caseData.created_at).getTime() + timeMinutes * 60000).getHours()) >= 16 &&
          (new Date(new Date(caseData.created_at).getTime() + timeMinutes * 60000).getHours()) <= 19),
        top_zones: topZones,
      });
    }

    // Get nearest police stations to the case
    const nearestStations = await query(`
      SELECT station_name, gps_lat, gps_lng,
        ST_Distance(
          gps_point,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000 AS distance_km
      FROM police_stations
      WHERE is_active = TRUE
      ORDER BY distance_km
      LIMIT 3
    `, [caseData.report_gps_lng, caseData.report_gps_lat]);

    // Get nearby chokepoints (within max reachable distance)
    const maxReach = movementSpeed * (steps * intervalMinutes / 60);
    const nearbyChokepoints = await query(`
      SELECT chokepoint_name, chokepoint_type, gps_lat, gps_lng, risk_level,
        ST_Distance(
          gps_point,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000 AS distance_km
      FROM chokepoints
      WHERE ST_DWithin(
        gps_point,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
      ORDER BY risk_level DESC, distance_km
      LIMIT 10
    `, [caseData.report_gps_lng, caseData.report_gps_lat, maxReach * 1000]);

    res.json({
      case_id: caseId,
      person_name: caseData.person_name || 'Unknown',
      person_age: caseData.person_age,
      person_gender: caseData.person_gender,
      person_profile: personProfile,
      movement_speed_kmh: movementSpeed,
      report_location: {
        lat: parseFloat(caseData.report_gps_lat),
        lng: parseFloat(caseData.report_gps_lng),
        zone_id: caseData.report_zone_id,
      },
      reported_at: caseData.created_at,
      actual_elapsed_minutes: actualElapsedMinutes,
      prediction_timeline: timeline,
      nearest_police_stations: nearestStations.rows,
      nearby_chokepoints: nearbyChokepoints.rows,
      insight: generatePredictiveInsight(personProfile, movementSpeed, steps * intervalMinutes, timeline),
    });
  } catch (error) {
    console.error('❌ Predictive zones error:', error);
    res.status(500).json({ error: 'Failed to generate predictive zones' });
  }
});

/**
 * GET /api/analytics/zone-risk-timeline
 * Aggregate: which zones become high-risk over time across ALL active cases
 * Used by police to pre-position resources
 */
router.get('/zone-risk-timeline', authenticate, requireRole('admin', 'police'), async (req: AuthRequest, res: Response) => {
  try {
    const hours = Math.min(parseInt(req.query.hours as string) || 3, 6);

    // Get all active cases
    const casesResult = await query(`
      SELECT case_id, report_gps_lat, report_gps_lng, report_zone_id,
             person_age, urgency, created_at
      FROM cases WHERE status = 'active'
    `);

    const zonesResult = await query('SELECT * FROM zones');
    const allZones = zonesResult.rows;

    // For each hour, aggregate zone risk across all cases
    const hourlyRisk: any[] = [];

    for (let h = 1; h <= hours; h++) {
      const zoneScores: Record<string, { score: number; case_count: number; p1_count: number }> = {};

      for (const c of casesResult.rows) {
        const age = c.person_age;
        let speed = 2.5;
        if (age && age < 12) speed = 1.5;
        else if (age && age >= 60) speed = 1.0;
        else if (age) speed = 3.0;

        const maxDist = speed * h;

        for (const zone of allZones) {
          const dist = haversineDistance(c.report_gps_lat, c.report_gps_lng, zone.center_lat, zone.center_lng);
          if (dist <= maxDist) {
            const prob = (1 - dist / Math.max(maxDist, 0.01));
            const urgencyMultiplier = c.urgency === 'P1' ? 2.0 : c.urgency === 'P2' ? 1.0 : 0.5;

            if (!zoneScores[zone.zone_id]) {
              zoneScores[zone.zone_id] = { score: 0, case_count: 0, p1_count: 0 };
            }
            zoneScores[zone.zone_id].score += prob * urgencyMultiplier;
            zoneScores[zone.zone_id].case_count++;
            if (c.urgency === 'P1') zoneScores[zone.zone_id].p1_count++;
          }
        }
      }

      // Convert to sorted array
      const ranked = Object.entries(zoneScores)
        .map(([zone_id, data]) => {
          const zone = allZones.find((z: any) => z.zone_id === zone_id);
          return {
            zone_id,
            zone_name: zone?.zone_name || zone_id,
            center_lat: parseFloat(zone?.center_lat),
            center_lng: parseFloat(zone?.center_lng),
            risk_score: Math.round(data.score * 100) / 100,
            potential_cases: data.case_count,
            p1_cases: data.p1_count,
          };
        })
        .sort((a, b) => b.risk_score - a.risk_score)
        .slice(0, 10);

      hourlyRisk.push({
        hour: h,
        label: `+${h} hour${h > 1 ? 's' : ''}`,
        high_risk_zones: ranked,
      });
    }

    res.json({
      total_active_cases: casesResult.rows.length,
      prediction_window_hours: hours,
      hourly_risk: hourlyRisk,
    });
  } catch (error) {
    console.error('❌ Zone risk timeline error:', error);
    res.status(500).json({ error: 'Failed to generate zone risk timeline' });
  }
});

// --- Utility functions ---

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generatePredictiveInsight(profile: string, speed: number, totalMinutes: number, timeline: any[]): string {
  const totalHours = totalMinutes / 60;
  const maxReach = speed * totalHours;
  const firstZones = timeline[0]?.top_zones?.map((z: any) => z.zone_name).join(', ') || 'unknown';
  const lastZones = timeline[timeline.length - 1]?.top_zones?.map((z: any) => z.zone_name).join(', ') || 'unknown';

  if (profile === 'elderly') {
    return `Elderly person — slow movement (${speed} km/hr). After ${totalHours} hours, max radius is ${maxReach.toFixed(1)} km. Focus search on: ${firstZones}. They are unlikely to move far; check nearby ghats, temples, and rest areas first.`;
  }
  if (profile === 'child') {
    return `Child — moderate movement (${speed} km/hr). After ${totalHours} hours, could reach ${maxReach.toFixed(1)} km. Initial zones: ${firstZones}. Later: ${lastZones}. Check chokepoints and transfer nodes — children often follow crowds.`;
  }
  return `After ${totalHours} hours at ${speed} km/hr, search radius expands to ${maxReach.toFixed(1)} km. Priority zones shift from ${firstZones} to ${lastZones}. Deploy sherlocks to high-probability zones.`;
}

/**
 * GET /api/analytics/infrastructure
 * All CCTV cameras, police stations, chokepoints for map overlay
 */
router.get('/infrastructure', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const [cameras, stations, chokepoints] = await Promise.all([
      query(`
        SELECT camera_id, zone_id, gps_lat, gps_lng, camera_type, is_active
        FROM cctv_cameras
        ORDER BY zone_id, camera_id
      `),
      query(`
        SELECT station_id, station_name, zone_id, gps_lat, gps_lng
        FROM police_stations
        WHERE is_active = TRUE
      `),
      query(`
        SELECT chokepoint_id, chokepoint_name, chokepoint_type, gps_lat, gps_lng, risk_level
        FROM chokepoints
        ORDER BY risk_level DESC
      `)
    ]);

    res.json({
      cameras: cameras.rows,
      police_stations: stations.rows,
      chokepoints: chokepoints.rows,
    });
  } catch (error) {
    console.error('❌ Infrastructure error:', error);
    res.status(500).json({ error: 'Failed to fetch infrastructure data' });
  }
});

export default router;
