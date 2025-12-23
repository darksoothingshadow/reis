/**
 * Tests for PKCE (Proof Key for Code Exchange) utilities.
 * 
 * These tests verify the OAuth2 PKCE implementation used for
 * secure token exchange in the Chrome extension.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCodeVerifier, generateCodeChallenge, base64UrlEncode } from './pkce';

// Mock crypto for consistent testing (available for future use)
/*
const mockGetRandomValues = vi.fn((array: Uint8Array) => {
    // Fill with predictable values for testing
    for (let i = 0; i < array.length; i++) {
        array[i] = i % 256;
    }
    return array;
});
*/

describe('PKCE Utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateCodeVerifier', () => {
        it('should generate a string of expected length', () => {
            const verifier = generateCodeVerifier(64);
            // Base64 encoding of 64 bytes = ~86 chars (minus padding removal)
            expect(verifier.length).toBeGreaterThan(40);
            expect(verifier.length).toBeLessThanOrEqual(128);
        });

        it('should generate different values on each call (randomness)', () => {
            const verifier1 = generateCodeVerifier();
            const verifier2 = generateCodeVerifier();
            expect(verifier1).not.toBe(verifier2);
        });

        it('should only contain URL-safe characters', () => {
            const verifier = generateCodeVerifier();
            // PKCE verifiers should only contain: A-Z, a-z, 0-9, -, _, ~, .
            // Our base64url encoding uses: A-Z, a-z, 0-9, -, _
            expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
        });

        it('should respect custom length parameter', () => {
            const shortVerifier = generateCodeVerifier(32);
            const longVerifier = generateCodeVerifier(128);
            expect(shortVerifier.length).toBeLessThan(longVerifier.length);
        });

        it('should use default length of 64 when no argument provided', () => {
            const verifier = generateCodeVerifier();
            // 64 bytes -> ~86 base64 chars
            expect(verifier.length).toBeGreaterThanOrEqual(40);
        });
    });

    describe('generateCodeChallenge', () => {
        it('should generate a consistent hash for the same input', async () => {
            const verifier = 'test-verifier-string';
            const challenge1 = await generateCodeChallenge(verifier);
            const challenge2 = await generateCodeChallenge(verifier);
            expect(challenge1).toBe(challenge2);
        });

        it('should generate different hashes for different inputs', async () => {
            const challenge1 = await generateCodeChallenge('verifier-1');
            const challenge2 = await generateCodeChallenge('verifier-2');
            expect(challenge1).not.toBe(challenge2);
        });

        it('should only contain URL-safe base64 characters', async () => {
            const challenge = await generateCodeChallenge('any-verifier');
            expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
        });

        it('should generate a 43-character challenge (256-bit SHA-256 base64)', async () => {
            const challenge = await generateCodeChallenge('test');
            // SHA-256 = 32 bytes = 43 base64 chars (without padding)
            expect(challenge.length).toBe(43);
        });

        it('should handle empty string input', async () => {
            const challenge = await generateCodeChallenge('');
            expect(challenge).toBeDefined();
            expect(challenge.length).toBe(43);
        });

        it('should handle unicode input', async () => {
            const challenge = await generateCodeChallenge('тест-верификатор-🔐');
            expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
            expect(challenge.length).toBe(43);
        });
    });

    describe('base64UrlEncode', () => {
        it('should encode bytes to URL-safe base64', () => {
            const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
            const encoded = base64UrlEncode(bytes);
            expect(encoded).toBe('SGVsbG8');
        });

        it('should replace + with -', () => {
            // Bytes that would produce + in standard base64
            const bytes = new Uint8Array([251, 239]); // produces "++" in base64
            const encoded = base64UrlEncode(bytes);
            expect(encoded).not.toContain('+');
        });

        it('should replace / with _', () => {
            // Bytes that would produce / in standard base64
            const bytes = new Uint8Array([255, 255]); // produces "//" in base64
            const encoded = base64UrlEncode(bytes);
            expect(encoded).not.toContain('/');
        });

        it('should remove padding characters', () => {
            const bytes = new Uint8Array([65]); // "A" - would have == padding
            const encoded = base64UrlEncode(bytes);
            expect(encoded).not.toContain('=');
        });

        it('should handle empty input', () => {
            const bytes = new Uint8Array([]);
            const encoded = base64UrlEncode(bytes);
            expect(encoded).toBe('');
        });
    });
});

describe('PKCE Integration', () => {
    it('should generate valid verifier-challenge pair', async () => {
        const verifier = generateCodeVerifier();
        const challenge = await generateCodeChallenge(verifier);

        // Both should be valid
        expect(verifier.length).toBeGreaterThan(40);
        expect(challenge.length).toBe(43);
        
        // Both should be URL-safe
        expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should work with minimum recommended verifier length (43 chars)', async () => {
        // RFC 7636 recommends minimum 43 characters for the verifier
        const verifier = generateCodeVerifier(32); // 32 bytes -> 43 base64 chars
        const challenge = await generateCodeChallenge(verifier);
        
        expect(verifier.length).toBeGreaterThanOrEqual(40);
        expect(challenge).toBeDefined();
    });
});
