/**
 * Scraper Data Integrity Tests
 * 
 * These tests verify the database coverage and data integrity
 * after running the scraper. They should be run AFTER a full scrape.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'db', 'success-rates.db');

// All MENDELU Faculty IDs (correct, non-sequential, no clear pattern)
const FACULTY_IDS = [2, 14, 23, 38, 60, 220, 631, 79];
const FACULTY_NAMES: Record<number, string> = {
    2: 'PEF (Provozně ekonomická)',
    14: 'Agronomická',
    23: 'FRRMS (Regionální rozvoj)',
    38: 'LDF (Lesnická a dřevařská)',
    60: 'Zahradnická',
    220: 'ICV (Celoživotní vzdělávání)',
    631: 'CSA',
    79: 'Rektorát'
};

const CHECK_FACULTY = process.env.CHECK_FACULTY ? parseInt(process.env.CHECK_FACULTY, 10) : null;

let db: Database.Database;

beforeAll(() => {
    db = new Database(DB_PATH);
    if (CHECK_FACULTY) {
        console.log(`🔍 Testing integrity for Faculty: ${FACULTY_NAMES[CHECK_FACULTY]} (ID: ${CHECK_FACULTY})`);
    } else {
        console.log('🔍 Testing global database integrity (All Faculties)');
    }
});

afterAll(() => {
    db.close();
});

describe('Faculty Coverage', () => {
    it('checked faculty should exist in the database', () => {
        const faculties = db.prepare('SELECT id FROM faculties').all() as { id: number }[];
        const facultyIds = faculties.map(f => f.id);
        
        const idsToTest = CHECK_FACULTY ? [CHECK_FACULTY] : FACULTY_IDS;
        for (const id of idsToTest) {
            expect(facultyIds, `Missing faculty ${FACULTY_NAMES[id]}`).toContain(id);
        }
    });

    it('checked faculty should have at least one semester', () => {
        const idsToTest = CHECK_FACULTY ? [CHECK_FACULTY] : FACULTY_IDS;
        for (const facultyId of idsToTest) {
            const result = db.prepare('SELECT COUNT(*) as count FROM semesters WHERE faculty_id = ?').get(facultyId) as { count: number };
            expect(result.count, `Faculty ${FACULTY_NAMES[facultyId]} has no semesters`).toBeGreaterThan(0);
        }
    });
});

describe('Semester Coverage', () => {
    it('recent semesters should have at least one success rate entry', () => {
        const query = CHECK_FACULTY 
            ? 'SELECT id, name FROM semesters WHERE faculty_id = ? AND last_scraped > date(\'now\')'
            : 'SELECT id, name FROM semesters WHERE last_scraped > date(\'now\')';
        
        const semesters = CHECK_FACULTY 
            ? db.prepare(query).all(CHECK_FACULTY) as { id: number, name: string }[]
            : db.prepare(query).all() as { id: number, name: string }[];
        
        if (semesters.length === 0 && CHECK_FACULTY) {
            throw new Error(`No recently scraped semesters found for Faculty ${CHECK_FACULTY}. Did the scraper run?`);
        }

        for (const semester of semesters) {
            const result = db.prepare('SELECT COUNT(*) as count FROM success_rates WHERE semester_id = ?').get(semester.id) as { count: number };
            expect(result.count, `Recent semester "${semester.name}" (ID ${semester.id}) has no success rate entries`).toBeGreaterThan(0);
        }
    });
});

describe('Data Quality', () => {
    it('all success_rates entries should have valid grades (>= 0)', () => {
        const invalidGrades = db.prepare(`
            SELECT id, course_id, semester_id 
            FROM success_rates 
            WHERE grade_a < 0 OR grade_b < 0 OR grade_c < 0 
               OR grade_d < 0 OR grade_e < 0 OR grade_f < 0 OR grade_fn < 0
        `).all();
        
        expect(invalidGrades, 'Found entries with negative grade counts').toHaveLength(0);
    });

    it('checked success_rates entries should have a source_url', () => {
        const totalQuery = CHECK_FACULTY
            ? `SELECT COUNT(*) as count FROM success_rates sr 
               JOIN semesters s ON sr.semester_id = s.id 
               WHERE s.faculty_id = ? AND s.last_scraped > date('now')`
            : `SELECT COUNT(*) as count FROM success_rates sr
               JOIN semesters s ON sr.semester_id = s.id
               WHERE s.last_scraped > date('now')`;
        
        const missingQuery = CHECK_FACULTY
            ? `SELECT COUNT(*) as count FROM success_rates sr 
               JOIN semesters s ON sr.semester_id = s.id 
               WHERE s.faculty_id = ? AND s.last_scraped > date('now') 
               AND (sr.source_url IS NULL OR sr.source_url = '')`
            : `SELECT COUNT(*) as count FROM success_rates sr
               JOIN semesters s ON sr.semester_id = s.id
               WHERE s.last_scraped > date('now')
               AND (sr.source_url IS NULL OR sr.source_url = '')`;

        const totalRows = (CHECK_FACULTY 
            ? db.prepare(totalQuery).get(CHECK_FACULTY) 
            : db.prepare(totalQuery).get()) as { count: number };
            
        const missingRows = (CHECK_FACULTY 
            ? db.prepare(missingQuery).get(CHECK_FACULTY) 
            : db.prepare(missingQuery).get()) as { count: number };

        if (totalRows.count === 0) return;

        const missingPercentage = (missingRows.count / totalRows.count) * 100;
        const threshold = CHECK_FACULTY ? 5 : 50; // New scrapes must be >95% accurate. Global can be messy.
        
        if (missingPercentage > threshold) {
            throw new Error(`${missingPercentage.toFixed(1)}% of entries (${missingRows.count}/${totalRows.count}) are missing source_url for ${CHECK_FACULTY ? 'this faculty' : 'all faculties'}. Max allowed: ${threshold}%`);
        }
    });

    it('source_urls should be valid MENDELU URLs', () => {
        const urls = db.prepare(`
            SELECT DISTINCT source_url 
            FROM success_rates 
            WHERE source_url IS NOT NULL AND source_url != ''
            LIMIT 100
        `).all() as { source_url: string }[];
        
        for (const { source_url } of urls) {
            expect(source_url, 'source_url should be a MENDELU URL').toMatch(/^https:\/\/is\.mendelu\.cz/);
        }
    });
});

describe('Summary', () => {
    it('should print a coverage summary', () => {
        const totalCourses = (db.prepare('SELECT COUNT(DISTINCT course_id) as count FROM success_rates').get() as { count: number }).count;
        const totalStats = (db.prepare('SELECT COUNT(*) as count FROM success_rates').get() as { count: number }).count;
        const totalSemesters = (db.prepare('SELECT COUNT(*) as count FROM semesters').get() as { count: number }).count;
        
        console.log('\n--- SCRAPER DATA INTEGRITY SUMMARY ---');
        console.log(`  Semesters: ${totalSemesters}`);
        console.log(`  Unique Courses: ${totalCourses}`);
        console.log(`  Total Stats Rows: ${totalStats}`);
        console.log('--------------------------------------\n');
        
        expect(totalStats).toBeGreaterThan(0);
    });
});
