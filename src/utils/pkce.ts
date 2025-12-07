/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth2 flow.
 * 
 * Used to secure the authorization code flow in public clients
 * like Chrome extensions where client secrets cannot be kept confidential.
 */

/**
 * Generate a cryptographically secure random string for PKCE code verifier.
 * @param length Length of the verifier (default 64, recommended for security)
 */
export function generateCodeVerifier(length = 64): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
}

/**
 * Generate SHA-256 hash of code verifier for the code challenge.
 * @param verifier The code verifier string
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64 URL encode a Uint8Array (no padding, URL-safe characters).
 */
function base64UrlEncode(buffer: Uint8Array): string {
    return btoa(String.fromCharCode(...buffer))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
