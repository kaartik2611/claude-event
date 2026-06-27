import { query } from '../db';
import { Case, Match } from '../types';

class MatchService {
  /**
   * Find potential matches for a case
   */
  async findMatches(case_id: string): Promise<Match[]> {
    const caseResult = await query(`SELECT * FROM cases WHERE case_id = $1`, [case_id]);
    const currentCase: Case = caseResult.rows[0];
    
    if (!currentCase) {
      throw new Error('Case not found');
    }
    
    const matches: Match[] = [];
    
    // Find matches based on different criteria
    
    // 1. Bilateral match (Case 1 "lost" + Case 2 "searching")
    if (currentCase.case_type === 'lost' || currentCase.case_type === 'searching') {
      const bilateralMatches = await this.findBilateralMatches(currentCase);
      matches.push(...bilateralMatches);
    }
    
    // 2. Feature-based matching
    const featureMatches = await this.findFeatureMatches(currentCase);
    matches.push(...featureMatches);
    
    // 3. Text-based matching (fuzzy name search)
    if (currentCase.person_name) {
      const textMatches = await this.findTextMatches(currentCase);
      matches.push(...textMatches);
    }
    
    // Save matches to database
    for (const match of matches) {
      await this.saveMatch(match);
    }
    
    return matches;
  }
  
  /**
   * Find bilateral matches (lost + searching)
   */
  private async findBilateralMatches(currentCase: Case): Promise<Match[]> {
    const oppositeType = currentCase.case_type === 'lost' ? 'searching' : 'lost';
    
    const result = await query(`
      SELECT * FROM cases 
      WHERE case_type = $1 
        AND status = 'active'
        AND case_id != $2
        AND person_age BETWEEN $3 AND $4
        AND person_gender = $5
    `, [
      oppositeType,
      currentCase.case_id,
      (currentCase.person_age || 0) - 5,
      (currentCase.person_age || 100) + 5,
      currentCase.person_gender
    ]);
    
    const matches: Match[] = [];
    
    for (const otherCase of result.rows) {
      const score = this.calculateMatchScore(currentCase, otherCase);
      
      if (score > 0.6) {
        matches.push({
          match_id: 0, // Will be set by DB
          case1_id: currentCase.case_id,
          case2_id: otherCase.case_id,
          match_score: score,
          match_type: 'bilateral',
          match_details: {
            age_diff: Math.abs((currentCase.person_age || 0) - (otherCase.person_age || 0)),
            gender_match: currentCase.person_gender === otherCase.person_gender,
            zone_proximity: this.calculateZoneProximity(currentCase.report_zone_id, otherCase.report_zone_id)
          },
          status: 'potential'
        } as Match);
      }
    }
    
    return matches;
  }
  
  /**
   * Find feature-based matches
   */
  private async findFeatureMatches(currentCase: Case): Promise<Match[]> {
    if (!currentCase.person_clothing && !currentCase.person_physical_features) {
      return [];
    }
    
    const result = await query(`
      SELECT * FROM cases 
      WHERE status = 'active'
        AND case_id != $1
        AND (
          person_clothing ILIKE $2
          OR person_physical_features ILIKE $3
        )
    `, [
      currentCase.case_id,
      `%${currentCase.person_clothing || ''}%`,
      `%${currentCase.person_physical_features || ''}%`
    ]);
    
    const matches: Match[] = [];
    
    for (const otherCase of result.rows) {
      const score = this.calculateFeatureScore(currentCase, otherCase);
      
      if (score > 0.5) {
        matches.push({
          match_id: 0,
          case1_id: currentCase.case_id,
          case2_id: otherCase.case_id,
          match_score: score,
          match_type: 'features',
          match_details: {
            clothing_match: this.calculateTextSimilarity(
              currentCase.person_clothing || '',
              otherCase.person_clothing || ''
            ),
            features_match: this.calculateTextSimilarity(
              currentCase.person_physical_features || '',
              otherCase.person_physical_features || ''
            )
          },
          status: 'potential'
        } as Match);
      }
    }
    
    return matches;
  }
  
  /**
   * Find text-based matches (fuzzy name search)
   */
  private async findTextMatches(currentCase: Case): Promise<Match[]> {
    const result = await query(`
      SELECT *, similarity(person_name, $1) as name_similarity
      FROM cases 
      WHERE status = 'active'
        AND case_id != $2
        AND person_name IS NOT NULL
        AND similarity(person_name, $1) > 0.4
      ORDER BY name_similarity DESC
      LIMIT 5
    `, [currentCase.person_name, currentCase.case_id]);
    
    const matches: Match[] = [];
    
    for (const otherCase of result.rows) {
      matches.push({
        match_id: 0,
        case1_id: currentCase.case_id,
        case2_id: otherCase.case_id,
        match_score: otherCase.name_similarity,
        match_type: 'text',
        match_details: {
          name_similarity: otherCase.name_similarity,
          original_name: currentCase.person_name,
          matched_name: otherCase.person_name
        },
        status: 'potential'
      } as Match);
    }
    
    return matches;
  }
  
  /**
   * Calculate overall match score
   */
  private calculateMatchScore(case1: Case, case2: Case): number {
    let score = 0;
    let factors = 0;
    
    // Age similarity
    if (case1.person_age && case2.person_age) {
      const ageDiff = Math.abs(case1.person_age - case2.person_age);
      score += Math.max(0, 1 - ageDiff / 20);
      factors++;
    }
    
    // Gender match
    if (case1.person_gender && case2.person_gender) {
      score += case1.person_gender === case2.person_gender ? 1 : 0;
      factors++;
    }
    
    // Height similarity
    if (case1.person_height && case2.person_height) {
      const heightDiff = Math.abs(case1.person_height - case2.person_height);
      score += Math.max(0, 1 - heightDiff / 30);
      factors++;
    }
    
    return factors > 0 ? score / factors : 0;
  }
  
  /**
   * Calculate feature-based score
   */
  private calculateFeatureScore(case1: Case, case2: Case): number {
    let score = 0;
    let factors = 0;
    
    if (case1.person_clothing && case2.person_clothing) {
      score += this.calculateTextSimilarity(case1.person_clothing, case2.person_clothing);
      factors++;
    }
    
    if (case1.person_physical_features && case2.person_physical_features) {
      score += this.calculateTextSimilarity(case1.person_physical_features, case2.person_physical_features);
      factors++;
    }
    
    return factors > 0 ? score / factors : 0;
  }
  
  /**
   * Calculate text similarity (simple Jaccard similarity)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Calculate zone proximity (simple: same zone = 1, different = 0)
   */
  private calculateZoneProximity(zone1: string, zone2: string): number {
    return zone1 === zone2 ? 1 : 0;
  }
  
  /**
   * Save match to database
   */
  private async saveMatch(match: Match): Promise<void> {
    await query(`
      INSERT INTO matches (
        case1_id, case2_id, match_score, match_type, match_details, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
    `, [
      match.case1_id,
      match.case2_id,
      match.match_score,
      match.match_type,
      JSON.stringify(match.match_details),
      match.status
    ]);
  }
  
  /**
   * Get matches for a case
   */
  async getMatchesForCase(case_id: string): Promise<Match[]> {
    const result = await query(`
      SELECT m.*, 
        c1.person_name as case1_person_name,
        c2.person_name as case2_person_name
      FROM matches m
      JOIN cases c1 ON m.case1_id = c1.case_id
      JOIN cases c2 ON m.case2_id = c2.case_id
      WHERE (m.case1_id = $1 OR m.case2_id = $1)
        AND m.status = 'potential'
      ORDER BY m.match_score DESC
    `, [case_id]);
    
    return result.rows;
  }
}

export default new MatchService();
