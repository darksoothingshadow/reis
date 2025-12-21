export { 
  fetchNotifications, 
  getUserAssociation, 
  filterNotificationsByFaculty,
  trackNotificationsViewed,
  trackNotificationClick 
} from './spolkyService';
export { FACULTY_TO_ASSOCIATION, ASSOCIATION_PROFILES, API_BASE_URL } from './config';
export type { SpolekNotification, AssociationProfile, FacultyId } from './types';
