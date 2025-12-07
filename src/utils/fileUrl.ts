/**
 * URL utilities for file handling.
 */

/**
 * Normalize IS Mendelu URLs - convert semicolons to ampersands.
 */
export function normalizeFileUrl(link: string): string {
    const normalized = link.replace(/;/g, '&').replace(/\?&/g, '?');

    if (link.startsWith('http')) {
        return normalized;
    } else if (link.startsWith('/')) {
        return `https://is.mendelu.cz${link.replace(/;/g, '&')}`;
    } else {
        return `https://is.mendelu.cz/auth/dok_server/${link.replace(/;/g, '&')}`;
    }
}

/**
 * Clean folder name by removing course code prefix.
 */
export function cleanFolderName(name: string, courseCode?: string): string {
    let cleaned = name;

    // Remove default "Folder/Subfolder" prefix if present
    if (cleaned.includes('/')) {
        cleaned = cleaned.split('/')[1];
    }

    cleaned = cleaned.trim();

    // Remove course code prefix if present 
    if (courseCode) {
        const codePrefix = courseCode.split(' ')[0];
        if (cleaned.toLowerCase().startsWith(codePrefix.toLowerCase())) {
            cleaned = cleaned.substring(codePrefix.length).trim();
        }
    }

    return cleaned || name;
}
