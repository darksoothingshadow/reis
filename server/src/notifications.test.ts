/**
 * Notifications API Tests
 * 
 * Tests for the spolky notifications API endpoints
 * Run: cd server && npm test
 */

import { describe, it, expect } from 'vitest';

const API_BASE = 'https://reismendelu.app/api';

describe('Notifications API', () => {
  describe('GET /api/notifications', () => {
    it('should return approved notifications without auth', async () => {
      const response = await fetch(`${API_BASE}/notifications`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      
      // All returned notifications should have required fields
      for (const notif of data) {
        expect(notif).toHaveProperty('id');
        expect(notif).toHaveProperty('title');
        expect(notif).toHaveProperty('body');
        expect(notif).toHaveProperty('associationId');
      }
    });

    it('should include all required fields', async () => {
      const response = await fetch(`${API_BASE}/notifications`);
      const data = await response.json();
      
      if (data.length > 0) {
        const notif = data[0];
        expect(notif).toHaveProperty('id');
        expect(notif).toHaveProperty('associationId');
        expect(notif).toHaveProperty('title');
        expect(notif).toHaveProperty('body');
        expect(notif).toHaveProperty('createdAt');
        expect(notif).toHaveProperty('expiresAt');
      }
    });
  });

  describe('GET /api/health', () => {
    it('should return OK status', async () => {
      const response = await fetch(`${API_BASE}/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('version');
    });
  });

  describe('POST /api/notifications', () => {
    it('should reject without auth', async () => {
      const response = await fetch(`${API_BASE}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test',
          body: 'Test body',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    it('should reject without auth', async () => {
      const response = await fetch(`${API_BASE}/notifications/fake-id`, {
        method: 'DELETE',
      });
      expect(response.status).toBe(401);
    });
  });
});
