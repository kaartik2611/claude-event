import { query } from '../db';
import { Case, ZonePrediction, MLPrediction, Zone, CCTVCamera, Chokepoint } from '../types';
import { config } from '../config';

class MLService {
  /**
   * Predict zones for a case
   */
  async predictZones(case_id: string, timeElapsedMinutes?: number): Promise<ZonePrediction[]> {
    // Get case data
    const caseResult = await query(`SELECT * FROM cases WHERE case_id = $1`, [case_id]);
    const caseData: Case = caseResult.rows[0];
    
    if (!caseData) {
      throw new Error('Case not found');
    }
    
    // Calculate time elapsed
    const elapsed = timeElapsedMinutes || 
      Math.floor((Date.now() - new Date(caseData.created_at).getTime()) / (1000 * 60));
    
    // Get all zones
    const zonesResult = await query(`SELECT * FROM zones`);
    const allZones: Zone[] = zonesResult.rows;
    
    const predictions: ZonePrediction[] = [];
    
    for (const zone of allZones) {
      const probability = await this.calculateZoneProbability(
        caseData,
        zone,
        elapsed
      );
      
      if (probability > 0.3) {
        // Get CCTV cameras in zone
        const camerasResult = await query(`
          SELECT * FROM cctv_cameras 
          WHERE zone_id = $1 AND is_active = true
        `, [zone.zone_id]);
        
        // Get chokepoints in zone
        const chokepointsResult = await query(`
          SELECT * FROM chokepoints 
          WHERE zone_id = $1 
          ORDER BY CASE risk_level 
            WHEN 'very high' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            ELSE 4 
          END
          LIMIT 3
        `, [zone.zone_id]);
        
        predictions.push({
          zone_id: zone.zone_id,
          zone_name: zone.zone_name,
          confidence: probability,
          cctv_cameras: camerasResult.rows,
          nearby_chokepoints: chokepointsResult.rows,
          reasoning: this.generateReasoning(caseData, zone, probability, elapsed)
        });
      }
    }
    
    // Sort by confidence and return top 3
    const topPredictions = predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    
    // Save predictions to database
    await this.savePrediction(case_id, topPredictions, elapsed);
    
    return topPredictions;
  }
  
  /**
   * Calculate zone probability
   */
  private async calculateZoneProbability(
    caseData: Case,
    zone: Zone,
    timeElapsed: number
  ): Promise<number> {
    let probability = 0;
    
    // Factor 1: Distance from report location (decay over time)
    const distance = this.calculateDistance(
      { lat: caseData.report_gps_lat, lng: caseData.report_gps_lng },
      { lat: zone.center_lat, lng: zone.center_lng }
    );
    
    // Movement radius based on age and time
    const movementSpeed = this.estimateMovementSpeed(caseData.person_age);
    const hoursElapsed = timeElapsed / 60;
    const maxDistance = movementSpeed * hoursElapsed;
    
    if (distance <= maxDistance) {
      probability += 0.4 * (1 - distance / maxDistance);
    }
    
    // Factor 2: CCTV coverage
    const cctvScore = await this.getCCTVCoverageScore(zone.zone_id);
    probability += 0.2 * cctvScore;
    
    // Factor 3: Chokepoint proximity
    const chokepointScore = await this.getChokepointScore(
      zone.zone_id,
      { lat: caseData.report_gps_lat, lng: caseData.report_gps_lng }
    );
    probability += 0.15 * chokepointScore;
    
    // Factor 4: Last seen zone bonus
    if (caseData.last_seen_zone === zone.zone_id || caseData.report_zone_id === zone.zone_id) {
      probability += 0.25;
    }
    
    return Math.min(1, probability);
  }
  
  /**
   * Estimate movement speed based on age
   */
  private estimateMovementSpeed(age?: number): number {
    if (!age) return 2.5; // Default: 2.5 km/hr
    if (age < 12) return 1.5;  // Children
    if (age < 60) return 3.0;  // Adults
    return 1.0;  // Elderly
  }
  
  /**
   * Calculate distance between two GPS points (Haversine formula)
   */
  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLng = this.toRad(point2.lng - point1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(point1.lat)) * Math.cos(this.toRad(point2.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Get CCTV coverage score for zone
   */
  private async getCCTVCoverageScore(zone_id: string): Promise<number> {
    const result = await query(`
      SELECT COUNT(*) as count
      FROM cctv_cameras
      WHERE zone_id = $1 AND is_active = true
    `, [zone_id]);
    
    const count = parseInt(result.rows[0].count);
    return Math.min(1, count / 10); // Normalize by 10 cameras
  }
  
  /**
   * Get chokepoint proximity score
   */
  private async getChokepointScore(
    zone_id: string,
    reportGPS: { lat: number; lng: number }
  ): Promise<number> {
    const result = await query(`
      SELECT 
        gps_lat,
        gps_lng,
        CASE risk_level
          WHEN 'very high' THEN 1.0
          WHEN 'high' THEN 0.7
          WHEN 'medium' THEN 0.4
          ELSE 0.2
        END as risk_weight
      FROM chokepoints
      WHERE zone_id = $1
      ORDER BY risk_weight DESC
      LIMIT 5
    `, [zone_id]);
    
    if (result.rows.length === 0) return 0;
    
    let totalScore = 0;
    for (const cp of result.rows) {
      const distance = this.calculateDistance(
        reportGPS,
        { lat: cp.gps_lat, lng: cp.gps_lng }
      );
      
      // Closer chokepoints = higher influence (5km radius)
      const proximityScore = Math.max(0, 1 - distance / 5);
      totalScore += proximityScore * cp.risk_weight;
    }
    
    return Math.min(1, totalScore / result.rows.length);
  }
  
  /**
   * Generate reasoning text
   */
  private generateReasoning(
    caseData: Case,
    zone: Zone,
    probability: number,
    timeElapsed: number
  ): string {
    const reasons: string[] = [];
    
    if (caseData.report_zone_id === zone.zone_id) {
      reasons.push('Person was last seen in this zone');
    }
    
    if (timeElapsed > 30) {
      reasons.push(`${Math.floor(timeElapsed / 60)} hours have passed, likely moved to adjacent zones`);
    }
    
    if (probability > 0.7) {
      reasons.push('High CCTV coverage in this area');
    }
    
    return reasons.join('. ') || `${Math.round(probability * 100)}% confidence based on movement patterns`;
  }
  
  /**
   * Save prediction to database
   */
  private async savePrediction(
    case_id: string,
    predictions: ZonePrediction[],
    timeElapsed: number
  ): Promise<void> {
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
    
    await query(`
      INSERT INTO ml_predictions (
        case_id, predicted_zones, input_factors, model_version, confidence_avg
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      case_id,
      JSON.stringify(predictions),
      JSON.stringify({ time_elapsed_minutes: timeElapsed }),
      config.ml.modelVersion,
      avgConfidence
    ]);
  }
  
  /**
   * Run batch predictions for all active cases
   */
  async runBatchPredictions(): Promise<number> {
    const result = await query(`
      SELECT case_id FROM cases WHERE status = 'active'
    `);
    
    let count = 0;
    for (const row of result.rows) {
      try {
        await this.predictZones(row.case_id);
        count++;
      } catch (error) {
        console.error(`Error predicting zones for case ${row.case_id}:`, error);
      }
    }
    
    return count;
  }
}

export default new MLService();
