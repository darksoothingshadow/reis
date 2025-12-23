import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SubjectSuccessRate, SemesterStats } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'success-rates.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    
    // Initialize schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);
    
    console.log('📦 Database initialized at', DB_PATH);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Helper functions for common operations
export function upsertFaculty(id: number, name: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO faculties (id, name) VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name
  `).run(id, name);
}

export function upsertSemester(id: number, facultyId: number, name: string, year: number): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO semesters (id, faculty_id, name, year) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, year = excluded.year
  `).run(id, facultyId, name, year);
}

export function upsertCourse(code: string, name: string, predmetId: string): number {
  const db = getDb();
  db.prepare(`
    INSERT INTO courses (code, name, predmet_id) VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET name = excluded.name, predmet_id = excluded.predmet_id
  `).run(code, name, predmetId);
  
  const row = db.prepare('SELECT id FROM courses WHERE code = ?').get(code) as { id: number };
  return row.id;
}

export function insertSuccessRate(
  courseId: number,
  semesterId: number,
  termName: string,
  grades: { A: number; B: number; C: number; D: number; E: number; F: number; FN: number },
  sourceUrl?: string
): void {
  const db = getDb();
  
  // Delete existing entry for this course-semester-term to avoid duplicates
  db.prepare(`
    DELETE FROM success_rates 
    WHERE course_id = ? AND semester_id = ? AND term_name = ?
  `).run(courseId, semesterId, termName);
  
  db.prepare(`
    INSERT INTO success_rates (course_id, semester_id, term_name, grade_a, grade_b, grade_c, grade_d, grade_e, grade_f, grade_fn, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(courseId, semesterId, termName, grades.A, grades.B, grades.C, grades.D, grades.E, grades.F, grades.FN, sourceUrl || null);
}

export function markCourseScraped(code: string): void {
  const db = getDb();
  db.prepare(`UPDATE courses SET last_scraped = datetime('now') WHERE code = ?`).run(code);
}

export function markSemesterScraped(id: number): void {
  const db = getDb();
  db.prepare(`UPDATE semesters SET last_scraped = datetime('now') WHERE id = ?`).run(id);
}

export function clearIncompleteSuccessRates(semesterId: number): void {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM success_rates 
    WHERE semester_id = ? AND (source_url IS NULL OR source_url = '')
  `).run(semesterId);
  if (result.changes > 0) {
    console.log(`      🧹 Cleared ${result.changes} incomplete success_rates entries for semester ${semesterId}`);
  }
}

export function getUnscrapedCourses(semesterId: number): Array<{ id: number; code: string; predmetId: string }> {
  const db = getDb();
  return db.prepare(`
    SELECT c.id, c.code, c.predmet_id as predmetId
    FROM courses c
    WHERE c.last_scraped IS NULL
    OR c.id NOT IN (SELECT DISTINCT course_id FROM success_rates WHERE semester_id = ?)
  `).all(semesterId) as Array<{ id: number; code: string; predmetId: string }>;
}

interface SuccessRateRow {
  term_name: string;
  grade_a: number;
  grade_b: number;
  grade_c: number;
  grade_d: number;
  grade_e: number;
  grade_f: number;
  grade_fn: number;
  source_url: string | null;
  semester_name: string;
  year: number;
  course_code: string;
}

export function getSuccessRatesByCourse(courseCode: string): SubjectSuccessRate | null {
  const db = getDb();
  
  const rates = db.prepare(`
    SELECT 
      sr.term_name,
      sr.grade_a, sr.grade_b, sr.grade_c, sr.grade_d, sr.grade_e, sr.grade_f, sr.grade_fn,
      sr.source_url,
      s.name as semester_name, s.year,
      c.code as course_code
    FROM success_rates sr
    JOIN courses c ON sr.course_id = c.id
    JOIN semesters s ON sr.semester_id = s.id
    WHERE c.code = ?
    ORDER BY s.year DESC, sr.term_name
  `).all(courseCode);
  
  if (rates.length === 0) return null;
  
  // Group by semester
  const grouped: Record<string, SemesterStats & { hasAggregate?: boolean }> = {};
  for (const r of rates as unknown as SuccessRateRow[]) {
    const key = r.semester_name;
    const isAggregate = r.term_name === 'Všechny termíny';
    
    if (!grouped[key]) {
      grouped[key] = {
        semesterName: r.semester_name,
        semesterId: key,
        year: r.year,
        sourceUrl: null,
        totalPass: 0,
        totalFail: 0,
        terms: [],
        hasAggregate: false
      };
    }
    
    // Always take sourceUrl if available in any row
    if (r.source_url && !grouped[key].sourceUrl) {
      grouped[key].sourceUrl = r.source_url;
    }
    
    const pass = r.grade_a + r.grade_b + r.grade_c + r.grade_d + r.grade_e;
    const fail = r.grade_f + r.grade_fn;
    
    if (isAggregate) {
      // Aggregate row sets the exact counts, overriding any partial sums
      grouped[key].totalPass = pass;
      grouped[key].totalFail = fail;
      grouped[key].hasAggregate = true;
      // Aggregate row definitely has the correct URL
      if (r.source_url) grouped[key].sourceUrl = r.source_url;
    } else if (!grouped[key].hasAggregate) {
      // Only sum if we haven't encountered the aggregate "Final Outcome" yet
      grouped[key].totalPass += pass;
      grouped[key].totalFail += fail;
    }

    grouped[key].terms.push({
      term: r.term_name,
      grades: { A: r.grade_a, B: r.grade_b, C: r.grade_c, D: r.grade_d, E: r.grade_e, F: r.grade_f, FN: r.grade_fn },
      pass,
      fail
    });
  }
  
  // Clean up internal flags before returning
  const resultStats = Object.values(grouped).map((s) => {
    delete s.hasAggregate;
    return s as SemesterStats;
  });
  
  return {
    courseCode,
    stats: resultStats,
    lastUpdated: new Date().toISOString()
  };
}
