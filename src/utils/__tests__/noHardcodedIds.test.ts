/**
 * Tests to ensure no hardcoded user-specific values are used in API calls.
 * These tests prevent regression of the issue where only one user's data worked.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// The specific hardcoded student ID that should NOT appear in API code
const HARDCODED_STUDIUM = '149707';
const HARDCODED_OBDOBI = 'obdobi=801';

// Files that should be checked for hardcoded values
const API_FILES = [
    'src/api/exams.ts',
    'src/api/schedule.ts',
];

describe('No Hardcoded User IDs', () => {
    it('should not have hardcoded studium in exams.ts', () => {
        const content = fs.readFileSync(path.resolve(__dirname, '../../api/exams.ts'), 'utf-8');
        expect(content).not.toContain(`studium=${HARDCODED_STUDIUM}`);
        expect(content).not.toContain(`studium=${HARDCODED_STUDIUM}`);
    });

    it('should not have hardcoded obdobi in exams.ts', () => {
        const content = fs.readFileSync(path.resolve(__dirname, '../../api/exams.ts'), 'utf-8');
        expect(content).not.toContain(HARDCODED_OBDOBI);
    });

    it('should use dynamic studium extraction in exams.ts', () => {
        const content = fs.readFileSync(path.resolve(__dirname, '../../api/exams.ts'), 'utf-8');
        // Should import getUserParams
        expect(content).toContain('getUserParams');
        // Should not have hardcoded URL constant with studium
        expect(content).not.toMatch(/const.*URL.*studium=\d+/);
    });
});

describe('injectUserParams', () => {
    it('should be used when navigating to pages', () => {
        const content = fs.readFileSync(path.resolve(__dirname, '../../components/SearchBar.tsx'), 'utf-8');
        // Should import injectUserParams
        expect(content).toContain('injectUserParams');
        // Should use it when opening links
        expect(content).toContain('injectUserParams(result.link)');
    });
});
