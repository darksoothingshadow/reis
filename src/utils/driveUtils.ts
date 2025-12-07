/**
 * Google Drive utilities for folder naming and validation.
 */

/**
 * Remove subject code prefix from folder names.
 * 
 * Examples:
 * - "EBC-UICT Úvod do ICT" → "Úvod do ICT"
 * - "EBC-ALG Algoritmizace" → "Algoritmizace"
 * - "EBC-TZI Materiály z přednášek" → "Materiály z přednášek"
 * 
 * @param fullName Full subject name with code prefix
 * @returns Cleaned name without subject code
 */
export function cleanSubjectFolderName(fullName: string): string {
    // Pattern: 2-4 uppercase letters, hyphen, 2-6 alphanumeric, space, then the real name
    return fullName.replace(/^[A-Z]{2,4}-[A-Z0-9]{2,6}\s+/, '');
}

/**
 * Check if a subject has any files to sync.
 * @param fileGroups Groups of files from IS Mendelu
 * @returns true if there are files to sync
 */
export function hasFilesToSync(fileGroups: { files: unknown[] }[] | null): boolean {
    if (!fileGroups) return false;
    return fileGroups.some(group => group.files.length > 0);
}
