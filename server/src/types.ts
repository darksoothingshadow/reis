/**
 * Shared types for reIS server
 */

export interface Admin {
  id: string;
  username: string;
  passwordHash: string;
  associationId: string;
  lastNotificationAt: string | null;
  isSuperadmin: boolean;
}

export interface Notification {
  id: string;
  associationId: string;
  title: string;
  body: string;
  link: string | null;
  priority: 'normal' | 'high';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  expiresAt: string;
  approvedAt: string | null;
  viewCount: number;
  clickCount: number;
}

export interface CreateNotificationInput {
  title: string;
  body: string;
  link?: string;
  priority?: 'normal' | 'high';
  expiresAt: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface JwtPayload {
  adminId: string;
  associationId: string;
  isSuperadmin: boolean;
}
