import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../db';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: 'sherlock' | 'police' | 'admin';
    zone_id?: string;
  };
}

/**
 * Verify JWT token middleware
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      role: string;
      zone_id?: string;
    };
    
    req.user = {
      id: decoded.id,
      role: decoded.role as any,
      zone_id: decoded.zone_id
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Require specific role
 */
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

/**
 * Check zone access (for police)
 */
export const checkZoneAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role === 'police') {
    const zone_id = req.params.zone_id || req.query.zone_id || req.body.zone_id;
    
    if (zone_id && zone_id !== req.user.zone_id) {
      return res.status(403).json({ error: 'Access denied to this zone' });
    }
  }
  
  next();
};
