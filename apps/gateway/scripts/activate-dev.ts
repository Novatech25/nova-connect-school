#!/usr/bin/env bun
/**
 * Development-only license activation
 * Bypasses Supabase Cloud validation for local development
 */
import { Database } from '../src/db/bun-sqlite.js';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const licenseKey = args.find(a => a.startsWith('--license='))?.split('=')[1];
const schoolId = args.find(a => a.startsWith('--school='))?.split('=')[1];

if (!licenseKey || !schoolId) {
  console.error('❌ Usage: bun run activate-dev --license=NOVA-TEST-DEV --school=TEST-SCHOOL');
  process.exit(1);
}

// Use absolute path based on script directory (scripts/ -> gateway root)
const SCRIPT_DIR = import.meta.dir;
const DATA_PATH = process.env.DATABASE_PATH || join(SCRIPT_DIR, '..', 'data');

// Ensure data directory exists
if (!existsSync(DATA_PATH)) {
  mkdirSync(DATA_PATH, { recursive: true });
}

console.log('🔐 Activating DEVELOPMENT license (no cloud validation)...');
console.log(`   School ID: ${schoolId}`);
console.log(`   License Key: ${licenseKey.substring(0, 4)}-****-****-****`);

try {
  // Initialize database
  const dbPath = join(DATA_PATH, `${schoolId}.db`);

  if (!existsSync(dbPath)) {
    console.log('📦 Creating new database...');
  }

  const db = new Database(dbPath);

  // Configure database
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');

  // Initialize schema if needed
  const schemaPath = join(import.meta.dir, '../src/db/schema.sql');

  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf-8');
    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        db.exec(statement);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }
    console.log('✅ Database schema initialized');
  }

  // Generate fake hardware fingerprint for development
  const fingerprint = 'dev-' + Math.random().toString(36).substring(2, 18);

  // Calculate expiration (1 year from now for dev)
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  // Insert or update license directly (bypassing cloud validation)
  const existingLicense = db.prepare('SELECT * FROM gateway_license WHERE id = 1').get() as any;

  if (existingLicense) {
    db.prepare(`
      UPDATE gateway_license
      SET license_key = ?, school_id = ?, hardware_fingerprint = ?, expires_at = ?, status = 'active', activated_at = datetime('now')
      WHERE id = 1
    `).run(licenseKey, schoolId, fingerprint, expiresAt.toISOString());
  } else {
    db.prepare(`
      INSERT INTO gateway_license (id, license_key, school_id, hardware_fingerprint, activated_at, expires_at, status)
      VALUES (1, ?, ?, ?, datetime('now'), ?, 'active')
    `).run(licenseKey, schoolId, fingerprint, expiresAt.toISOString());
  }

  const license = db.prepare('SELECT * FROM gateway_license WHERE id = 1').get() as any;

  console.log('\n✅ Development license activated successfully!');
  console.log(`\n📋 License Information:`);
  console.log(`   School ID: ${license.school_id}`);
  console.log(`   License Key: ${license.license_key.substring(0, 4)}-****-****-****`);
  console.log(`   Status: ${license.status}`);
  console.log(`   Expires: ${license.expires_at}`);
  console.log(`   Hardware Fingerprint: ${fingerprint.substring(0, 16)}...`);

  console.log(`\n⚠️  Development Mode:`);
  console.log(`   - No cloud validation`);
  console.log(`   - License valid for 1 year`);
  console.log(`   - Database: ${dbPath}`);

  console.log(`\n🚀 You can now start the Gateway with: bun run dev\n`);

  db.close();

} catch (error: any) {
  console.error('\n❌ License activation failed!');
  console.error(`   ${error.message}\n`);
  console.error(error.stack);
  process.exit(1);
}
