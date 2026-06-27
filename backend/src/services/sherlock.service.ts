import { query } from '../db';
import { Sherlock, GPSLocation } from '../types';
import { v4 as uuidv4 } from 'uuid';

class SherlockService {
  /**
   * Register a new Sherlock volunteer
   */
  async registerSherlock(data: {
    name: string;
    phone: string;
    assigned_zone: string;
    languages?: string[];
  }): Promise<Sherlock> {
    const sherlock_id = `SH-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    const result = await query(`
      INSERT INTO sherlocks (
        sherlock_id, name, phone, assigned_zone, languages, status
      ) VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING *
    `, [
      sherlock_id,
      data.name,
      data.phone,
      data.assigned_zone,
      data.languages || []
    ]);
    
    return result.rows[0];
  }
  
  /**
   * Get Sherlock by ID
   */
  async getSherlockById(sherlock_id: string): Promise<Sherlock | null> {
    const result = await query(`
      SELECT * FROM sherlocks WHERE sherlock_id = $1
    `, [sherlock_id]);
    
    return result.rows[0] || null;
  }
  
  /**
   * Get Sherlock by phone
   */
  async getSherlockByPhone(phone: string): Promise<Sherlock | null> {
    const result = await query(`
      SELECT * FROM sherlocks WHERE phone = $1
    `, [phone]);
    
    return result.rows[0] || null;
  }
  
  /**
   * Update Sherlock location
   */
  async updateLocation(sherlock_id: string, location: GPSLocation): Promise<Sherlock> {
    const result = await query(`
      UPDATE sherlocks 
      SET 
        current_gps_lat = $2,
        current_gps_lng = $3,
        current_gps_point = ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
        location_last_updated = NOW()
      WHERE sherlock_id = $1
      RETURNING *
    `, [sherlock_id, location.lat, location.lng]);
    
    return result.rows[0];
  }
  
  /**
   * Get Sherlocks by zone
   */
  async getSherlocksByZone(zone_id: string, activeOnly: boolean = true): Promise<Sherlock[]> {
    const statusFilter = activeOnly ? `AND status = 'active'` : '';
    
    const result = await query(`
      SELECT * FROM sherlocks 
      WHERE assigned_zone = $1 ${statusFilter}
      ORDER BY name
    `, [zone_id]);
    
    return result.rows;
  }
  
  /**
   * Set Sherlock status
   */
  async setStatus(sherlock_id: string, status: 'active' | 'inactive' | 'busy'): Promise<Sherlock> {
    const result = await query(`
      UPDATE sherlocks 
      SET status = $2 
      WHERE sherlock_id = $1
      RETURNING *
    `, [sherlock_id, status]);
    
    return result.rows[0];
  }
  
  /**
   * Get Sherlock statistics
   */
  async getStats(sherlock_id?: string): Promise<any> {
    const whereClause = sherlock_id ? `WHERE sherlock_id = $1` : '';
    const params = sherlock_id ? [sherlock_id] : [];
    
    const result = await query(`
      SELECT * FROM v_sherlock_performance
      ${whereClause}
      ORDER BY resolution_rate DESC
    `, params);
    
    return sherlock_id ? result.rows[0] : result.rows;
  }
  
  /**
   * Get all active Sherlocks
   */
  async getAllActive(): Promise<Sherlock[]> {
    const result = await query(`
      SELECT * FROM sherlocks 
      WHERE status = 'active'
      ORDER BY assigned_zone, name
    `);
    
    return result.rows;
  }
}

export default new SherlockService();
