/**
 * Data Export Script
 * 
 * Exports SQLite success rate data to sharded JSON files
 * for hosting on a static GitHub repository.
 * 
 * Output structure:
 *   dist-data/
 *     meta.json           - Global metadata
 *     subjects/
 *       EBC-ALG.json      - Per-course data
 *       EBC-MAT.json
 *       ...
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { 
    SemesterStats, SubjectSuccessRate 
} from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'db', 'success-rates.db');
const OUTPUT_DIR = path.join(__dirname, '..', 'dist-data');


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
    semester_id: number;
    course_code: string;
}

function exportData() {
    const db = new Database(DB_PATH);
    
    // Ensure output directory exists
    fs.mkdirSync(path.join(OUTPUT_DIR, 'subjects'), { recursive: true });
    
    // Get all unique course codes
    const courses = db.prepare('SELECT DISTINCT code FROM courses ORDER BY code').all() as { code: string }[];
    console.log(`Found ${courses.length} courses to export.`);
    
    let exportedCount = 0;
    const meta = {
        lastUpdated: new Date().toISOString(),
        courseCount: 0,
        courses: [] as string[]
    };
    
    for (const { code } of courses) {
        const rates = db.prepare(`
            SELECT 
                sr.term_name,
                sr.grade_a, sr.grade_b, sr.grade_c, sr.grade_d, sr.grade_e, sr.grade_f, sr.grade_fn,
                sr.source_url,
                s.name as semester_name, s.year, s.id as semester_id,
                c.code as course_code
            FROM success_rates sr
            JOIN courses c ON sr.course_id = c.id
            JOIN semesters s ON sr.semester_id = s.id
            WHERE c.code = ?
            ORDER BY s.year DESC, sr.term_name
        `).all(code) as unknown as SuccessRateRow[];
        
        if (rates.length === 0) continue;
        
        // Group by semester
        const grouped: Record<string, SemesterStats> = {};
        for (const r of rates) {
            const key = `${r.semester_id}`;
            const isAggregate = r.term_name === 'Všechny termíny';
            
            if (!grouped[key]) {
                grouped[key] = {
                    semesterName: r.semester_name,
                    semesterId: key,
                    year: r.year,
                    sourceUrl: r.source_url || undefined,
                    totalPass: 0,
                    totalFail: 0,
                    terms: []
                };
            }
            
            if (r.source_url && !grouped[key].sourceUrl) {
                grouped[key].sourceUrl = r.source_url;
            }
            
            const pass = r.grade_a + r.grade_b + r.grade_c + r.grade_d + r.grade_e;
            const fail = r.grade_f + r.grade_fn;
            
            if (isAggregate) {
                grouped[key].totalPass = pass;
                grouped[key].totalFail = fail;
            }
            
            grouped[key].terms.push({
                term: r.term_name,
                grades: { 
                    A: r.grade_a, B: r.grade_b, C: r.grade_c, 
                    D: r.grade_d, E: r.grade_e, F: r.grade_f, FN: r.grade_fn 
                },
                pass,
                fail
            });
        }
        
        // Calculate totals if no aggregate row was found
        for (const semStats of Object.values(grouped)) {
            if (semStats.totalPass === 0 && semStats.totalFail === 0 && semStats.terms.length > 0) {
                // Sum all terms
                semStats.totalPass = semStats.terms.reduce((sum, t) => sum + t.pass, 0);
                semStats.totalFail = semStats.terms.reduce((sum, t) => sum + t.fail, 0);
            }
        }
        
        const subjectData: SubjectSuccessRate = {
            courseCode: code,
            stats: Object.values(grouped),
            lastUpdated: new Date().toISOString()
        };
        
        // Write per-course JSON
        const filePath = path.join(OUTPUT_DIR, 'subjects', `${code}.json`);
        fs.writeFileSync(filePath, JSON.stringify(subjectData, null, 2));
        
        meta.courses.push(code);
        exportedCount++;
    }
    
    // Write meta.json
    meta.courseCount = exportedCount;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));
    
    console.log(`\n✅ Exported ${exportedCount} courses to ${OUTPUT_DIR}`);
    console.log(`   - subjects/*.json (${exportedCount} files)`);
    console.log(`   - meta.json`);
    
    db.close();
}

exportData();
