import { query } from '../db';

export interface TrackedPerson {
  person_id: string;
  name: string;
  age?: number;
  description?: string;
  photo_url?: string;
  current_zone: string;
  current_gps_lat: number;
  current_gps_lng: number;
  status: 'active' | 'inactive' | 'resolved';
  last_detection_time: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PersonMovement {
  movement_id: number;
  person_id: string;
  from_zone: string;
  to_zone: string;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  detection_method: 'cctv' | 'manual' | 'sherlock' | 'simulated';
  detection_source?: string;
  confidence_score?: number;
  moved_at: Date;
}

class PersonTrackingService {
  /**
   * Create or update a tracked person
   */
  async trackPerson(data: {
    person_id?: string;
    name: string;
    age?: number;
    description?: string;
    photo_url?: string;
    zone: string;
    gps_lat: number;
    gps_lng: number;
  }): Promise<TrackedPerson> {
    const person_id = data.person_id || `PERSON-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    const result = await query(`
      INSERT INTO tracked_persons (
        person_id, name, age, description, photo_url,
        current_zone, current_gps_lat, current_gps_lng,
        current_gps_point, status, last_detection_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 
                ST_SetSRID(ST_MakePoint($8, $7), 4326)::geography, 
                'active', NOW())
      ON CONFLICT (person_id) DO UPDATE SET
        current_zone = EXCLUDED.current_zone,
        current_gps_lat = EXCLUDED.current_gps_lat,
        current_gps_lng = EXCLUDED.current_gps_lng,
        current_gps_point = EXCLUDED.current_gps_point,
        last_detection_time = NOW(),
        updated_at = NOW()
      RETURNING *
    `, [
      person_id,
      data.name,
      data.age || null,
      data.description || null,
      data.photo_url || null,
      data.zone,
      data.gps_lat,
      data.gps_lng
    ]);
    
    return result.rows[0];
  }

  /**
   * Move person to a new zone
   */
  async movePerson(
    person_id: string,
    to_zone: string,
    to_lat: number,
    to_lng: number,
    detection_method: 'cctv' | 'manual' | 'sherlock' | 'simulated' = 'simulated',
    detection_source?: string,
    confidence_score?: number
  ): Promise<{ person: TrackedPerson; movement: PersonMovement }> {
    // Get current location
    const currentPerson = await this.getPersonById(person_id);
    if (!currentPerson) {
      throw new Error('Person not found');
    }

    // Record movement in history
    const movementResult = await query(`
      INSERT INTO person_movements (
        person_id, from_zone, to_zone, from_lat, from_lng,
        to_lat, to_lng, detection_method, detection_source, confidence_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      person_id,
      currentPerson.current_zone,
      to_zone,
      currentPerson.current_gps_lat,
      currentPerson.current_gps_lng,
      to_lat,
      to_lng,
      detection_method,
      detection_source || null,
      confidence_score || null
    ]);

    // Update person's current location
    const personResult = await query(`
      UPDATE tracked_persons SET
        current_zone = $2,
        current_gps_lat = $3,
        current_gps_lng = $4,
        current_gps_point = ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography,
        last_detection_time = NOW(),
        updated_at = NOW()
      WHERE person_id = $1
      RETURNING *
    `, [person_id, to_zone, to_lat, to_lng]);

    return {
      person: personResult.rows[0],
      movement: movementResult.rows[0]
    };
  }

  /**
   * Get person by ID
   */
  async getPersonById(person_id: string): Promise<TrackedPerson | null> {
    const result = await query(`
      SELECT * FROM tracked_persons WHERE person_id = $1
    `, [person_id]);
    
    return result.rows[0] || null;
  }

  /**
   * Get all persons in a zone
   */
  async getPersonsInZone(zone_id: string, status: 'active' | 'inactive' | 'resolved' = 'active'): Promise<TrackedPerson[]> {
    const result = await query(`
      SELECT * FROM tracked_persons 
      WHERE current_zone = $1 AND status = $2
      ORDER BY last_detection_time DESC
    `, [zone_id, status]);
    
    return result.rows;
  }

  /**
   * Get movement history for a person
   */
  async getPersonMovements(person_id: string, limit: number = 50): Promise<PersonMovement[]> {
    const result = await query(`
      SELECT * FROM person_movements 
      WHERE person_id = $1 
      ORDER BY moved_at DESC 
      LIMIT $2
    `, [person_id, limit]);
    
    return result.rows;
  }

  /**
   * Get all active tracked persons
   */
  async getAllActivePersons(): Promise<TrackedPerson[]> {
    const result = await query(`
      SELECT * FROM tracked_persons 
      WHERE status = 'active'
      ORDER BY last_detection_time DESC
    `);
    
    return result.rows;
  }

  /**
   * Update person status
   */
  async updatePersonStatus(person_id: string, status: 'active' | 'inactive' | 'resolved'): Promise<TrackedPerson> {
    const result = await query(`
      UPDATE tracked_persons SET
        status = $2,
        updated_at = NOW()
      WHERE person_id = $1
      RETURNING *
    `, [person_id, status]);
    
    return result.rows[0];
  }
}

export default new PersonTrackingService();
