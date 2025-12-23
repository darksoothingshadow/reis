import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'db', 'success-rates.db');

const db = new Database(DB_PATH);

const faculties = [
    { id: 1, name: 'AF (Agronomická fakulta)' },
    { id: 2, name: 'PEF (Provozně ekonomická fakulta)' },
    { id: 3, name: 'ZF (Zahradnická fakulta)' },
    { id: 4, name: 'LDF (Lesnická a dřevařská fakulta)' },
    { id: 5, name: 'FRRMS (Fakulta regionálního rozvoje a mezinárodních studií)' },
    { id: 6, name: 'ICV (Institut celoživotního vzdělávání)' }
];

console.log('--- Database Coverage Report ---');

faculties.forEach(f => {
    const semesters = db.prepare('SELECT COUNT(*) as count FROM semesters WHERE faculty_id = ?').get(f.id);
    const rates = db.prepare(`
        SELECT COUNT(*) as count 
        FROM success_rates sr
        JOIN semesters s ON sr.semester_id = s.id
        WHERE s.faculty_id = ?
    `).get(f.id);
    const courses = db.prepare(`
        SELECT COUNT(DISTINCT course_id) as count 
        FROM success_rates sr
        JOIN semesters s ON sr.semester_id = s.id
        WHERE s.faculty_id = ?
    `).get(f.id);

    console.log(`Faculty ${f.name}:`);
    console.log(`  - Semesters: ${semesters.count}`);
    console.log(`  - Courses with data: ${courses.count}`);
    console.log(`  - Total stats rows: ${rates.count}`);
});

const totalStats = db.prepare('SELECT COUNT(*) as count FROM success_rates').get();
console.log('\nTotal stats rows in DB:', totalStats.count);

db.close();
