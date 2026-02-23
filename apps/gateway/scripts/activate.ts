#!/usr/bin/env bun
import { LicenseService } from '../src/services/license.js';
import { saveLicenseToFile } from '../src/config/license.js';
import { Database } from '../src/db/bun-sqlite.js';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const licenseKey = args.find(a => a.startsWith('--license='))?.split('=')[1];
const schoolId = args.find(a => a.startsWith('--school='))?.split('=')[1];

if (!licenseKey || !schoolId) {
  console.error('❌ Usage: bun run activate --license=XXXX-XXXX-XXXX-XXXX --school=school-uuid');
  process.exit(1);
}

const DATA_PATH = process.env.DATABASE_PATH || './data';

// Ensure data directory exists
if (!existsSync(DATA_PATH)) {
  mkdirSync(DATA_PATH, { recursive: true });
}

console.log('🔐 Activating NovaConnect Gateway license...');
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

  // Activate license
  const licenseService = new LicenseService(db);

  await licenseService.activateLicense(licenseKey, schoolId);

  const license = licenseService.getLicenseInfo();
  const fingerprint = licenseService.generateHardwareFingerprint();

  // Write license file for startup
  const licenseFilePath = join(process.cwd(), 'license.json');
  saveLicenseToFile(licenseFilePath, {
    licenseKey: license.license_key,
    schoolId: license.school_id,
    hardwareFingerprint: license.hardware_fingerprint,
    activatedAt: license.activated_at,
    expiresAt: license.expires_at
  });

  console.log(`✅ License file saved: ${licenseFilePath}`);

  console.log('\n✅ License activated successfully!');
  console.log(`\n📋 License Information:`);
  console.log(`   School ID: ${license.school_id}`);
  console.log(`   Status: ${license.status}`);
  console.log(`   Expires: ${license.expires_at}`);
  console.log(`   Hardware Fingerprint: ${fingerprint.substring(0, 16)}...`);

  console.log(`\n⚠️  Important:`);
  console.log(`   This license is tied to this machine's hardware.`);
  console.log(`   Do not move the database or license to another machine.`);
  console.log(`   The database is located at: ${dbPath}`);

  console.log(`\n🚀 You can now start the Gateway with: bun run start\n`);

  db.close();

} catch (error: any) {
  console.error('\n❌ License activation failed!');
  console.error(`   ${error.message}\n`);
  process.exit(1);
}
