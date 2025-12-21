/**
 * Seed Script - Creates initial admin accounts
 * Run with: npm run seed
 */

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import db from './db.js';

const SALT_ROUNDS = 12;

// Default password for initial accounts (CHANGE IMMEDIATELY)
const DEFAULT_PASSWORD = 'changeme123';

const SPOLKY_ACCOUNTS = [
  { username: 'admin_supef', associationId: 'supef', isSuperadmin: false },
  { username: 'admin_au_frrms', associationId: 'au_frrms', isSuperadmin: false },
  { username: 'admin_af', associationId: 'af', isSuperadmin: false },
  { username: 'admin_zf', associationId: 'zf', isSuperadmin: false },
  { username: 'admin_ldf', associationId: 'ldf', isSuperadmin: false },
  { username: 'admin_agro', associationId: 'agro', isSuperadmin: false },
  { username: 'dominik', associationId: 'superadmin', isSuperadmin: true },
];

async function seed() {
  console.log('🌱 Seeding database...\n');

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO admins (id, username, password_hash, association_id, is_superadmin)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const account of SPOLKY_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    const id = uuidv4();

    try {
      const result = insertStmt.run(
        id,
        account.username,
        passwordHash,
        account.associationId,
        account.isSuperadmin ? 1 : 0
      );

      if (result.changes > 0) {
        console.log(`✅ Created: ${account.username} (${account.associationId})`);
      } else {
        console.log(`⏭️  Skipped: ${account.username} (already exists)`);
      }
    } catch (error) {
      console.error(`❌ Error creating ${account.username}:`, error);
    }
  }

  console.log('\n📋 Admin accounts:');
  const allAdmins = db.prepare('SELECT username, association_id, is_superadmin FROM admins').all();
  console.table(allAdmins);

  console.log('\n⚠️  Default password for all accounts: changeme123');
  console.log('   CHANGE THESE PASSWORDS IMMEDIATELY!\n');
}

seed().catch(console.error);
