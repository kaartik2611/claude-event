import { Router } from 'express';
import { query } from '../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { LoginRequest, LoginResponse } from '../types';

const router = Router();

/**
 * POST /api/auth/login
 * Login for Sherlock, Police, or Admin
 */
router.post('/login', async (req, res) => {
  try {
    const { login_id, password, role }: LoginRequest = req.body;
    
    // Sherlock doesn't require password (phone-only login)
    if (!login_id || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (role !== 'sherlock' && !password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    let user: any = null;
    let userId: string;
    let userName: string;
    let zoneId: string | undefined;
    
    // Authenticate based on role
    if (role === 'sherlock') {
      // Sherlock login by phone
      const result = await query(`
        SELECT * FROM sherlocks WHERE phone = $1 AND status = 'active'
      `, [login_id]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      user = result.rows[0];
      userId = user.sherlock_id;
      userName = user.name;
      zoneId = user.assigned_zone;
      
      // Sherlocks don't have password - simple phone verification
      // In production, use OTP
    } 
    else if (role === 'police') {
      // Police login
      const result = await query(`
        SELECT * FROM police_stations WHERE login_id = $1 AND is_active = true
      `, [login_id]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      user = result.rows[0];
      
      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      userId = user.station_id;
      userName = user.station_name;
      zoneId = user.zone_id;
    } 
    else if (role === 'admin') {
      // Admin login
      const result = await query(`
        SELECT * FROM admin_users WHERE username = $1 AND is_active = true
      `, [login_id]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      user = result.rows[0];
      
      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      userId = user.admin_id;
      userName = user.full_name || user.username;
    } 
    else {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Generate JWT
    const token = jwt.sign(
      { id: userId, role, zone_id: zoneId },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    const response: LoginResponse = {
      token,
      user: {
        id: userId,
        name: userName,
        role,
        zone_id: zoneId
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
