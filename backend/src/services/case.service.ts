import { query, transaction } from '../db';
import { Case, CaseType, CaseStatus, Urgency, SearchCasesQuery } from '../types';
import { v4 as uuidv4 } from 'uuid';

class CaseService {
  /**
   * Create a new case
   */
  async createCase(data: {
    case_type: CaseType;
    reporter_name: string;
    reporter_phone: string;
    reporter_photo_url?: string;
    person_name?: string;
    person_age?: number;
    person_gender?: string;
    person_height?: number;
    person_clothing?: string;
    person_physical_features?: string;
    person_language?: string;
    person_photo_url?: string;
    found_person_photo_url?: string;
    found_person_description?: string;
    gps_lat: number;
    gps_lng: number;
    last_seen_location?: string;
    sherlock_id: string;
    urgency?: Urgency;
    voice_recording_url?: string;
  }): Promise<Case> {
    const case_id = `KMP-2027-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // Auto-set urgency for Case 3 (found person)
    let urgency = data.urgency || 'P2';
    if (data.case_type === 'found' && !data.urgency) {
      urgency = 'P1'; // Found person is always P1
    }
    
    // Find zone from GPS
    const zoneResult = await query(`
      SELECT zone_id 
      FROM zones 
      ORDER BY ST_Distance(
        zone_boundary::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      )
      LIMIT 1
    `, [data.gps_lng, data.gps_lat]);
    
    const zone_id = zoneResult.rows[0]?.zone_id || 'UNKNOWN';
    
    // Insert case
    const result = await query(`
      INSERT INTO cases (
        case_id, case_type, status, urgency,
        reporter_name, reporter_phone, reporter_photo_url,
        person_name, person_age, person_gender, person_height,
        person_clothing, person_physical_features, person_language,
        person_photo_url, found_person_photo_url, found_person_description,
        report_gps_lat, report_gps_lng, report_gps_point, report_zone_id,
        last_seen_location, sherlock_id, voice_recording_url,
        broadcast_active, broadcast_started_at, broadcast_expires_at
      ) VALUES (
        $1, $2, 'active', $3,
        $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16,
        $17, $18, ST_SetSRID(ST_MakePoint($19, $18), 4326)::geography, $20,
        $21, $22, $23,
        true, NOW(), NOW() + INTERVAL '60 minutes'
      )
      RETURNING *
    `, [
      case_id, data.case_type, urgency,
      data.reporter_name, data.reporter_phone, data.reporter_photo_url,
      data.person_name, data.person_age, data.person_gender, data.person_height,
      data.person_clothing, data.person_physical_features, data.person_language,
      data.person_photo_url, data.found_person_photo_url, data.found_person_description,
      data.gps_lat, data.gps_lng, data.gps_lng, zone_id,
      data.last_seen_location, data.sherlock_id, data.voice_recording_url
    ]);
    
    // Update sherlock stats
    await query(`
      UPDATE sherlocks 
      SET reports_filed = reports_filed + 1 
      WHERE sherlock_id = $1
    `, [data.sherlock_id]);
    
    return result.rows[0];
  }
  
  /**
   * Get case by ID
   */
  async getCaseById(case_id: string): Promise<Case | null> {
    const result = await query(`
      SELECT * FROM cases WHERE case_id = $1
    `, [case_id]);
    
    return result.rows[0] || null;
  }
  
  /**
   * Search cases with filters
   */
  async searchCases(filters: SearchCasesQuery): Promise<{ cases: Case[]; total: number }> {
    let conditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;
    
    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
    
    if (filters.urgency) {
      conditions.push(`urgency = $${paramIndex++}`);
      params.push(filters.urgency);
    }
    
    if (filters.zone) {
      conditions.push(`report_zone_id = $${paramIndex++}`);
      params.push(filters.zone);
    }
    
    if (filters.age) {
      conditions.push(`person_age BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(filters.age - 5, filters.age + 5);
      paramIndex += 2;
    }
    
    if (filters.gender) {
      conditions.push(`person_gender = $${paramIndex++}`);
      params.push(filters.gender);
    }
    
    if (filters.has_photo !== undefined) {
      if (filters.has_photo) {
        conditions.push(`person_photo_url IS NOT NULL`);
      } else {
        conditions.push(`person_photo_url IS NULL`);
      }
    }
    
    if (filters.broadcast_active !== undefined) {
      conditions.push(`broadcast_active = $${paramIndex++}`);
      params.push(filters.broadcast_active);
    }
    
    if (filters.text) {
      conditions.push(`search_vector @@ plainto_tsquery('english', $${paramIndex++})`);
      params.push(filters.text);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Count total
    const countResult = await query(`
      SELECT COUNT(*) FROM cases ${whereClause}
    `, params);
    
    const total = parseInt(countResult.rows[0].count);
    
    // Get cases with pagination
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    
    const casesResult = await query(`
      SELECT * FROM cases 
      ${whereClause}
      ORDER BY 
        CASE urgency 
          WHEN 'P1' THEN 1 
          WHEN 'P2' THEN 2 
          WHEN 'P3' THEN 3 
        END,
        created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, [...params, limit, offset]);
    
    return {
      cases: casesResult.rows,
      total
    };
  }
  
  /**
   * Update case
   */
  async updateCase(case_id: string, updates: Partial<Case>): Promise<Case> {
    const allowedFields = [
      'status', 'urgency', 'person_name', 'person_age', 'person_gender',
      'person_clothing', 'person_physical_features', 'matched_with_case_id',
      'match_score', 'resolution_notes', 'resolved_at'
    ];
    
    const setClause: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramIndex++}`);
        params.push(value);
      }
    }
    
    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    setClause.push(`updated_at = NOW()`);
    params.push(case_id);
    
    const result = await query(`
      UPDATE cases 
      SET ${setClause.join(', ')}
      WHERE case_id = $${paramIndex}
      RETURNING *
    `, params);
    
    return result.rows[0];
  }
  
  /**
   * Get cases by zone
   */
  async getCasesByZone(zone_id: string, status?: CaseStatus): Promise<Case[]> {
    const statusFilter = status ? `AND status = $2` : '';
    const params = status ? [zone_id, status] : [zone_id];
    
    const result = await query(`
      SELECT * FROM cases 
      WHERE report_zone_id = $1 ${statusFilter}
      ORDER BY 
        CASE urgency 
          WHEN 'P1' THEN 1 
          WHEN 'P2' THEN 2 
          WHEN 'P3' THEN 3 
        END,
        created_at DESC
    `, params);
    
    return result.rows;
  }
  
  /**
   * Get active broadcasts
   */
  async getActiveBroadcasts(): Promise<Case[]> {
    const result = await query(`
      SELECT * FROM cases 
      WHERE broadcast_active = true 
        AND broadcast_expires_at > NOW()
      ORDER BY urgency, created_at DESC
    `);
    
    return result.rows;
  }
  
  /**
   * Extend broadcast
   */
  async extendBroadcast(case_id: string, minutes: number): Promise<Case> {
    const result = await query(`
      UPDATE cases 
      SET 
        broadcast_expires_at = broadcast_expires_at + INTERVAL '${minutes} minutes',
        broadcast_extended_count = broadcast_extended_count + 1,
        updated_at = NOW()
      WHERE case_id = $1
      RETURNING *
    `, [case_id]);
    
    return result.rows[0];
  }
  
  /**
   * Expire broadcasts (called by cron)
   */
  async expireBroadcasts(): Promise<number> {
    const result = await query(`
      UPDATE cases 
      SET broadcast_active = false, updated_at = NOW()
      WHERE broadcast_active = true 
        AND broadcast_expires_at <= NOW()
      RETURNING case_id
    `);
    
    return result.rowCount || 0;
  }
  
  /**
   * Get case statistics
   */
  async getStatistics(): Promise<any> {
    const result = await query(`SELECT * FROM v_case_statistics`);
    return result.rows[0];
  }
}

export default new CaseService();
