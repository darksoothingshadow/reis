
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = './server/db/success-rates.db';
const db = new Database(dbPath);

console.log('--- DATABASE CHECK ---');
console.log('DB Path:', path.resolve(dbPath));

const course = db.prepare(`SELECT id FROM courses WHERE code = 'EBC-ALG'`).get() as { id: number };
if (!course) {
    console.log('Course EBC-ALG not found');
} else {
    console.log('Course ID:', course.id);
    const semesters = db.prepare(`SELECT * FROM semesters WHERE name LIKE '%2024/2025%'`).all() as { id: number; name: string }[];
    console.log('Semesters found:', semesters.length);
    for (const sem of semesters) {
        console.log(`\nSemester: ${sem.name} (ID: ${sem.id})`);
        const stats = db.prepare(`SELECT term_name, grade_f, grade_fn, source_url FROM success_rates WHERE course_id = ? AND semester_id = ?`).all(course.id, sem.id);
        if (stats.length === 0) {
            console.log('  No stats found for this semester');
        } else {
            console.table(stats);
        }
    }
}

db.close();
