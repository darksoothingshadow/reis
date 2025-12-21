/**
 * Authentication Routes
 * POST /api/auth/login
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../db.js';
import { generateToken } from '../middleware/auth.js';
import type { Admin, LoginInput } from '../types.js';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticates admin and returns JWT
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body as LoginInput;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    // Find admin by username
    const stmt = db.prepare('SELECT * FROM admins WHERE username = ?');
    const row = stmt.get(username) as {
      id: string;
      username: string;
      password_hash: string;
      association_id: string;
      is_superadmin: number;
    } | undefined;

    if (!row) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, row.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate token
    const token = generateToken({
      adminId: row.id,
      associationId: row.association_id,
      isSuperadmin: row.is_superadmin === 1,
    });

    console.log(`[Auth] Admin ${username} logged in`);

    res.json({
      token,
      admin: {
        id: row.id,
        username: row.username,
        associationId: row.association_id,
        isSuperadmin: row.is_superadmin === 1,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
