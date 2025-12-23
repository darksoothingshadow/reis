import Database from 'better-sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'db', 'success-rates.db');

console.log('Diagnostic Script');
console.log('Expected DB Path:', DB_PATH);
console.log('File exists?', fs.existsSync(DB_PATH));
if (fs.existsSync(DB_PATH)) {
    const stats = fs.statSync(DB_PATH);
    console.log('File modified time:', stats.mtime);
    console.log('File size:', stats.size);
}

try {
    const db = new Database(DB_PATH);
    console.log('Opened database successfully');
    
    // Check journal mode
    const pragma = db.pragma('journal_mode');
    console.log('Journal mode:', pragma);

    // Try to write a dummy record to course table
    const testCode = 'TEST-' + Date.now();
    console.log('Attempting to insert test course:', testCode);
    db.prepare('INSERT INTO courses (code, name, predmet_id) VALUES (?, ?, ?)').run(testCode, 'Test Course', '999999');
    
    console.log('Insert successful');
    
    // Verify it's there
    const row = db.prepare('SELECT * FROM courses WHERE code = ?').get(testCode);
    console.log('Retrieved row:', row);
    
    db.close();
    console.log('Database closed');
    
    const statsAfter = fs.statSync(DB_PATH);
    console.log('File modified time after close:', statsAfter.mtime);
    console.log('File size after close:', statsAfter.size);
    
} catch (e) {
    console.error('Error:', e);
}
