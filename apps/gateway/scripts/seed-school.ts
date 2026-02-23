#!/usr/bin/env bun
/**
 * Seed script to create a test school in the Gateway database
 */

import { Database } from '../src/db/bun-sqlite.js';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'fs';
import { join } from 'path';

const DATA_PATH = process.env.DATABASE_PATH || join(process.cwd(), 'data');

async function seedSchool() {
  const schoolId = 'test-school-001';
  const dbPath = join(DATA_PATH, `${schoolId}.db`);

  console.log('📂 Database path:', dbPath);

  if (!existsSync(dbPath)) {
    console.error('❌ Database file not found:', dbPath);
    console.log('Please start the Gateway first to create the database.');
    process.exit(1);
  }

  const db = new Database(dbPath);

  try {
    // Check if school already exists
    const existing = db.prepare('SELECT * FROM schools WHERE code = ?').get('TEST-SCHOOL');
    if (existing) {
      console.log('✅ School already exists:', existing);
      process.exit(0);
    }

    // Create the school
    const schoolUuid = randomUUID();
    const result = db.prepare('INSERT INTO schools (id, name, code) VALUES (?, ?, ?)').run(
      schoolUuid,
      'Test School',
      'TEST-SCHOOL'
    );

    console.log('✅ School created successfully!');
    console.log('   ID:', schoolUuid);
    console.log('   Code: TEST-SCHOOL');
    console.log('   Name: Test School');

    // Verify
    const verify = db.prepare('SELECT * FROM schools WHERE code = ?').get('TEST-SCHOOL');
    console.log('✅ Verification:', verify);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

seedSchool();
