/**
 * JWT Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-me';

// Extend Express Request to include admin info
declare global {
  namespace Express {
    interface Request {
      admin?: JwtPayload;
    }
  }
}

/**
 * Middleware to verify JWT token
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.admin = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware to require superadmin access
 */
export function requireSuperadmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.admin?.isSuperadmin) {
    res.status(403).json({ error: 'Superadmin access required' });
    return;
  }
  next();
}

/**
 * Generate JWT token for admin
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
