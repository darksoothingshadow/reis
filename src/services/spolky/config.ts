import type { AssociationProfile } from './types';

/**
 * Mapping of faculty IDs to their corresponding student associations
 */
export const FACULTY_TO_ASSOCIATION: Record<string, string> = {
  '2': 'supef',     // PEF
  '3': 'au_frrms',  // FRRMS
  '1': 'af',        // AF (Agronomická fakulta)
  '4': 'zf',        // ZF (Zahradnická fakulta)
  '5': 'ldf',       // LDF (Lesnická a dřevařská fakulta)
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
  af: {
    id: 'af',
    name: 'AF Spolek',
    websiteUrl: 'https://af.mendelu.cz',
    facultyIds: ['AF'],
  },
  zf: {
    id: 'zf',
    name: 'ZF Spolek',
    websiteUrl: 'https://zf.mendelu.cz',
    facultyIds: ['ZF'],
  },
  ldf: {
    id: 'ldf',
    name: 'LDF Spolek',
    websiteUrl: 'https://ldf.mendelu.cz',
    facultyIds: ['LDF'],
  },
  icv: {
    id: 'icv',
    name: 'ICV',
    websiteUrl: 'https://icv.mendelu.cz',
    facultyIds: ['ICV'],
  },
};

/**
 * API endpoint for spolky notifications
 */
export const API_BASE_URL = 'https://reismendelu.app';
