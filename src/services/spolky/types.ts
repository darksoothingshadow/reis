/**
 * Student Association (Spolek) integration types
 */

export interface SpolekNotification {
  id: string;
  associationId: string; // 'supef' | 'au_frrms' | 'agro' | ...
  title: string;
  body: string;
  link?: string;
  createdAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
  priority: 'normal' | 'high';
}

export interface AssociationProfile {
  id: string; // 'supef'
  name: string; // 'SUPEF'
  websiteUrl: string; // 'https://supef.cz'
  facultyIds: string[]; // ['PEF']
}

export type FacultyId = 'PEF' | 'FRRMS' | 'AGRO' | 'LDF' | 'AF' | 'ZF';
