/**
 * Notifications Routes
 * GET /api/notifications - Public, returns approved non-expired notifications
 * POST /api/notifications - Auth required, creates pending notification
 * GET /api/notifications/pending - Superadmin only, lists pending approvals
 * POST /api/notifications/:id/approve - Superadmin only
 * POST /api/notifications/:id/reject - Superadmin only
 * DELETE /api/notifications/:id - Auth required, delete own or any (superadmin)
 * POST /api/notifications/:id/view - Public, tracks view
 * POST /api/notifications/:id/click - Public, tracks click
 * GET /api/stats/:associationId - Auth required, own stats
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { requireAuth, requireSuperadmin } from '../middleware/auth.js';
import type { CreateNotificationInput, Notification } from '../types.js';

const router = Router();

// Rate limit: 1 notification per 7 days
const RATE_LIMIT_DAYS = 7;

/**
 * GET /api/notifications
 * Public - Returns approved, non-expired notifications
 */
router.get('/', (req, res) => {
  try {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      SELECT id, association_id, title, body, link, priority, created_at, expires_at
      FROM notifications
      WHERE status = 'approved' AND expires_at > ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(now);

    // Transform to camelCase for frontend
    const notifications = rows.map((row: any) => ({
      id: row.id,
      associationId: row.association_id,
      title: row.title,
      body: row.body,
      link: row.link,
      priority: row.priority,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));

    res.json(notifications);
  } catch (error) {
    console.error('[Notifications] GET error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications
 * Auth required - Creates notification with pending status
 * Rate limited: 1 per 14 days
 */
router.post('/', requireAuth, (req, res) => {
  try {
    const admin = req.admin!;
    const input = req.body as CreateNotificationInput;

    // Validate input
    if (!input.title || !input.body || !input.expiresAt) {
      res.status(400).json({ error: 'Title, body, and expiresAt are required' });
      return;
    }

    if (input.title.length > 100) {
      res.status(400).json({ error: 'Title must be 100 characters or less' });
      return;
    }

    if (input.body.length > 500) {
      res.status(400).json({ error: 'Body must be 500 characters or less' });
      return;
    }

    // Check rate limit (skip for superadmin)
    if (!admin.isSuperadmin) {
      const adminStmt = db.prepare('SELECT last_notification_at FROM admins WHERE id = ?');
      const adminRow = adminStmt.get(admin.adminId) as { last_notification_at: string | null };

      if (adminRow?.last_notification_at) {
        const lastDate = new Date(adminRow.last_notification_at);
        const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSince < RATE_LIMIT_DAYS) {
          const daysRemaining = Math.ceil(RATE_LIMIT_DAYS - daysSince);
          res.status(429).json({
            error: `Rate limit: You can post again in ${daysRemaining} days`,
            nextAllowedAt: new Date(lastDate.getTime() + RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          });
          return;
        }
      }
    }

    // Create notification
    const id = uuidv4();
    const now = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO notifications (id, association_id, title, body, link, priority, status, created_at, expires_at, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)
    `);
    insertStmt.run(
      id,
      admin.associationId,
      input.title,
      input.body,
      input.link || null,
      input.priority || 'normal',
      now,
      input.expiresAt,
      now // approved_at = now (auto-approved)
    );

    // Update last notification timestamp
    const updateAdminStmt = db.prepare('UPDATE admins SET last_notification_at = ? WHERE id = ?');
    updateAdminStmt.run(now, admin.adminId);

    console.log(`[Notifications] Published notification ${id} by ${admin.associationId}`);

    res.status(201).json({
      id,
      status: 'approved',
      message: 'Notifikace byla publikována!',
    });
  } catch (error) {
    console.error('[Notifications] POST error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/notifications/pending
 * Superadmin only - Lists all pending notifications
 */
router.get('/pending', requireAuth, requireSuperadmin, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM notifications WHERE status = 'pending' ORDER BY created_at DESC
    `);
    const rows = stmt.all();

    const notifications = rows.map((row: any) => ({
      id: row.id,
      associationId: row.association_id,
      title: row.title,
      body: row.body,
      link: row.link,
      priority: row.priority,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));

    res.json(notifications);
  } catch (error) {
    console.error('[Notifications] GET pending error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/:id/approve
 * Superadmin only - Approves a pending notification
 */
router.post('/:id/approve', requireAuth, requireSuperadmin, (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE notifications SET status = 'approved', approved_at = ? WHERE id = ? AND status = 'pending'
    `);
    const result = stmt.run(now, id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Notification not found or already processed' });
      return;
    }

    console.log(`[Notifications] Approved notification ${id}`);
    res.json({ success: true, status: 'approved' });
  } catch (error) {
    console.error('[Notifications] Approve error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/:id/reject
 * Superadmin only - Rejects a pending notification
 */
router.post('/:id/reject', requireAuth, requireSuperadmin, (req, res) => {
  try {
    const { id } = req.params;

    const stmt = db.prepare(`
      UPDATE notifications SET status = 'rejected' WHERE id = ? AND status = 'pending'
    `);
    const result = stmt.run(id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Notification not found or already processed' });
      return;
    }

    console.log(`[Notifications] Rejected notification ${id}`);
    res.json({ success: true, status: 'rejected' });
  } catch (error) {
    console.error('[Notifications] Reject error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Auth required - Superadmin can delete any, others can delete only their own
 */
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const admin = req.admin!;

    // First check if notification exists
    const checkStmt = db.prepare('SELECT association_id FROM notifications WHERE id = ?');
    const notification = checkStmt.get(id) as { association_id: string } | undefined;

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    // Check permission: superadmin can delete any, others only their own
    if (!admin.isSuperadmin && notification.association_id !== admin.associationId) {
      res.status(403).json({ error: 'Cannot delete notifications from other associations' });
      return;
    }

    const deleteStmt = db.prepare('DELETE FROM notifications WHERE id = ?');
    deleteStmt.run(id);

    console.log(`[Notifications] Deleted notification ${id} by ${admin.associationId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications] Delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/:id/view
 * Public - Increments view count
 */
router.post('/:id/view', (req, res) => {
  try {
    const { id } = req.params;

    const stmt = db.prepare('UPDATE notifications SET view_count = view_count + 1 WHERE id = ?');
    stmt.run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications] View tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/:id/click
 * Public - Increments click count
 */
router.post('/:id/click', (req, res) => {
  try {
    const { id } = req.params;

    const stmt = db.prepare('UPDATE notifications SET click_count = click_count + 1 WHERE id = ?');
    stmt.run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications] Click tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/stats/:associationId
 * Auth required - Get stats for own association
 */
router.get('/stats/:associationId', requireAuth, (req, res) => {
  try {
    const { associationId } = req.params;
    const admin = req.admin!;

    // Only allow viewing own stats (or superadmin can view all)
    if (admin.associationId !== associationId && !admin.isSuperadmin) {
      res.status(403).json({ error: 'Cannot view stats for other associations' });
      return;
    }

    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(view_count) as total_views,
        SUM(click_count) as total_clicks
      FROM notifications
      WHERE association_id = ?
    `);
    const stats = stmt.get(associationId) as any;

    res.json({
      associationId,
      total: stats.total || 0,
      approved: stats.approved || 0,
      pending: stats.pending || 0,
      rejected: stats.rejected || 0,
      totalViews: stats.total_views || 0,
      totalClicks: stats.total_clicks || 0,
    });
  } catch (error) {
    console.error('[Notifications] Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
