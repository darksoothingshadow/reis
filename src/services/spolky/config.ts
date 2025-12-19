import type { AssociationProfile, FacultyId } from './types';

/**
 * Mapping of faculty IDs to their corresponding student associations
 */
export const FACULTY_TO_ASSOCIATION: Record<FacultyId, string> = {
  PEF: 'supef',
  FRRMS: 'au_frrms',
  AGRO: 'agro',
  LDF: 'ldf',
  AF: 'af',
  ZF: 'zf',
};

/**
 * Association profiles (logos will be replaced when provided by user)
 */
export const ASSOCIATION_PROFILES: Record<string, AssociationProfile> = {
  supef: {
    id: 'supef',
    name: 'SUPEF',
    websiteUrl: 'https://supef.cz',
    facultyIds: ['PEF'],
  },
  au_frrms: {
    id: 'au_frrms',
    name: 'AU FRRMS',
    websiteUrl: 'https://au.mendelu.cz',
    facultyIds: ['FRRMS'],
  },
  agro: {
    id: 'agro',
    name: 'AGRO Spolek',
    websiteUrl: 'https://agro.mendelu.cz', // Placeholder URL
    facultyIds: ['AGRO'],
  },
  ldf: {
    id: 'ldf',
    name: 'LDF Spolek',
    websiteUrl: 'https://ldf.mendelu.cz', // Placeholder URL
    facultyIds: ['LDF'],
  },
  af: {
    id: 'af',
    name: 'AF Spolek',
    websiteUrl: 'https://af.mendelu.cz', // Placeholder URL
    facultyIds: ['AF'],
  },
  zf: {
    id: 'zf',
    name: 'ZF Spolek',
    websiteUrl: 'https://zf.mendelu.cz', // Placeholder URL
    facultyIds: ['ZF'],
  },
};

/**
 * API endpoint (will be replaced with actual droplet URL)
 */
export const API_BASE_URL = 'http://YOUR_DROPLET_IP:3001';
