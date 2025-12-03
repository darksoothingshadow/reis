/**
 * Input Validation and Sanitization Utilities
 * 
 * Defense-in-depth security layer to protect against:
 * - XSS attacks via malicious data injection
 * - SQL injection payloads leaking through IS Mendelu
 * - Malformed data causing extension crashes
 * - Phishing via crafted URLs
 */

/**
 * Sanitize string input by removing HTML and dangerous characters
 * @param input - Raw string from untrusted source
 * @param maxLength - Maximum allowed length (default 500)
 * @returns Sanitized string safe for display/storage
 */
export function sanitizeString(input: unknown, maxLength = 500): string {
    // Type guard: ensure input is string
    if (typeof input !== 'string') {
        console.warn('sanitizeString: non-string input', typeof input);
        return '';
    }

    // Strip all HTML tags (prevents XSS via <script>, <img onerror>, etc.)
    const stripped = input.replace(/<[^>]*>/g, '');

    // Remove potentially dangerous characters
    // Keep: letters, numbers, spaces, Czech characters, common punctuation
    // Remove: <, >, ", ', \, null bytes
    const safe = stripped
        .replace(/[<>"'\\]/g, '')  // Remove quote chars and backslashes
        .replace(/\x00/g, '');      // Remove null bytes

    // Normalize whitespace (collapse multiple spaces, trim)
    const normalized = safe.replace(/\s+/g, ' ').trim();

    // Limit length to prevent DoS via extremely long strings
    return normalized.slice(0, maxLength);
}

/**
 * Validate Mendelu course code format
 * Expected format: PEF-DP-PEF1-1234 (faculty-program-department-number)
 * @param code - Course code to validate
 * @returns true if code matches expected format
 */
export function validateCourseCode(code: string): boolean {
    if (!code || typeof code !== 'string') return false;

    // Mendelu course codes pattern: 
    // Letters-Letters-Letters+Numbers-Numbers
    // Example: PEF-DP-PEF1-2025
    const pattern = /^[A-Z]{2,4}-[A-Z]{2,4}-[A-Z]{3,5}\d+-\d{4}$/;

    return pattern.test(code.trim());
}

/**
 * Validate URL against allowed domains
 * @param url - URL to validate
 * @param allowedDomain - Domain that must be present (e.g., 'is.mendelu.cz')
 * @returns Validated URL or empty string if invalid
 */
export function validateUrl(url: string, allowedDomain: string = 'is.mendelu.cz'): string {
    if (!url || typeof url !== 'string') return '';

    try {
        // Handle relative URLs (convert to absolute)
        let absoluteUrl = url;
        if (url.startsWith('/')) {
            absoluteUrl = `https://${allowedDomain}${url}`;
        } else if (!url.startsWith('http')) {
            absoluteUrl = `https://${allowedDomain}/${url}`;
        }

        const parsed = new URL(absoluteUrl);

        // Ensure protocol is HTTPS (no HTTP, no file://, no javascript:)
        if (parsed.protocol !== 'https:') {
            console.warn('validateUrl: non-HTTPS URL rejected', parsed.protocol);
            return '';
        }

        // Ensure hostname ends with allowed domain
        if (!parsed.hostname.endsWith(allowedDomain)) {
            console.warn('validateUrl: untrusted domain', parsed.hostname);
            return '';
        }

        return absoluteUrl;
    } catch (error) {
        console.warn('validateUrl: invalid URL', url, error);
        return '';
    }
}

/**
 * Validate date string and ensure it's within reasonable range
 * @param dateStr - ISO date string or D.M.YYYY format
 * @returns Valid Date object or null if invalid
 */
export function validateDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;

    let date: Date;

    // Try parsing as ISO string first
    date = new Date(dateStr);

    // If invalid, try Czech format (D.M.YYYY or DD.MM.YYYY)
    if (isNaN(date.getTime())) {
        const czechMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (czechMatch) {
            const [, day, month, year] = czechMatch;
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
    }

    // Validate date is valid
    if (isNaN(date.getTime())) {
        console.warn('validateDate: invalid date', dateStr);
        return null;
    }

    // Ensure date is within reasonable range
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, 0, 1);
    const twoYearsFromNow = new Date(now.getFullYear() + 2, 11, 31);

    if (date < twoYearsAgo || date > twoYearsFromNow) {
        console.warn('validateDate: date out of range', dateStr, date);
        return null;
    }

    return date;
}

/**
 * Validate and sanitize file name
 * @param filename - File name to validate
 * @returns Sanitized filename or empty string
 */
export function validateFileName(filename: string): string {
    if (!filename || typeof filename !== 'string') return '';

    // Remove path traversal attempts
    const safe = filename.replace(/\.\./g, '').replace(/[\/\\]/g, '');

    // Sanitize (allow letters, numbers, spaces, dots, dashes, underscores)
    const sanitized = safe.replace(/[^a-zA-Z0-9\s.\-_áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g, '');

    // Limit length
    return sanitized.slice(0, 300).trim();
}

/**
 * Validate room code (Mendelu format: Q01, Q02, etc.)
 * @param room - Room code to validate
 * @returns true if valid room code
 */
export function validateRoomCode(room: string): boolean {
    if (!room || typeof room !== 'string') return false;

    // Mendelu room codes: Letter(s) followed by numbers
    // Examples: Q01, Q02, A301, B412
    const pattern = /^[A-Z]{1,2}\d{1,4}[a-z]?$/;

    return pattern.test(room.trim());
}

/**
 * Sanitize teacher name
 * @param name - Teacher name to sanitize
 * @returns Sanitized name
 */
export function sanitizeTeacherName(name: string): string {
    // Teachers format: "Title FirstName LastName" or "Prof. FirstName LastName, Ph.D."
    const sanitized = sanitizeString(name, 200);

    // Additional validation: must contain at least one letter
    if (!/[a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(sanitized)) {
        console.warn('sanitizeTeacherName: no letters in name', name);
        return '';
    }

    return sanitized;
}
