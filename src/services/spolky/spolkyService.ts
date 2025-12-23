import type { SpolekNotification, AssociationProfile } from './types';
import { FACULTY_TO_ASSOCIATION, ASSOCIATION_PROFILES, API_BASE_URL } from './config';

/**
 * Fetch all active notifications from the backend
 */
export async function fetchNotifications(): Promise<SpolekNotification[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications`);
    if (!response.ok) {
      throw new Error(`Failed to fetch notifications: ${response.statusText}`);
    }
    const notifications: SpolekNotification[] = await response.json();
    
    // Filter out expired notifications (client-side failsafe)
    const now = new Date();
    return notifications.filter((n) => new Date(n.expiresAt) > now);
  } catch (error) {
    console.error('[SpolkyService] Failed to fetch notifications:', error);
    return []; // Graceful degradation
  }
}

/**
 * Determine user's association based on their faculty
 * @param facultyId - User's faculty ID (e.g., 'PEF')
 * @returns AssociationProfile or null if not found
 */
export function getUserAssociation(facultyId: string | null): AssociationProfile | null {
  if (!facultyId) return null;
  
  const associationId = FACULTY_TO_ASSOCIATION[facultyId as keyof typeof FACULTY_TO_ASSOCIATION];
  if (!associationId) return null;
  
  return ASSOCIATION_PROFILES[associationId] || null;
}

/**
 * Filter notifications relevant to user's faculty
 * @param notifications - All notifications
 * @param facultyId - User's faculty ID
 * @returns Filtered notifications
 */
export function filterNotificationsByFaculty(
  notifications: SpolekNotification[],
  facultyId: string | null
): SpolekNotification[] {
  if (!facultyId) return [];
  
  const associationId = FACULTY_TO_ASSOCIATION[facultyId];
  if (!associationId) return [];
  
  return notifications.filter((n) => n.associationId === associationId);
}

/**
 * Track that notifications were viewed (when bell icon opened)
 * @param notificationIds - IDs of notifications that were viewed
 */
export async function trackNotificationsViewed(notificationIds: string[]): Promise<void> {
  try {
    await Promise.all(
      notificationIds.map((id) =>
        fetch(`${API_BASE_URL}/api/notifications/${id}/view`, { method: 'POST' })
      )
    );
  } catch (error) {
    console.error('[SpolkyService] Failed to track views:', error);
  }
}

/**
 * Track that a notification was clicked
 * @param notificationId - ID of the notification that was clicked
 */
export async function trackNotificationClick(notificationId: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/click`, { method: 'POST' });
  } catch (error) {
    console.error('[SpolkyService] Failed to track click:', error);
  }
}
