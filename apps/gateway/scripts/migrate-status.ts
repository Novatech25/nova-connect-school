import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { Database } from '../src/db/bun-sqlite.js';

const dataPath = process.env.DATABASE_PATH || './data';
const schoolId = process.env.SCHOOL_ID;
const migrationsDir = join(import.meta.dir, '../src/db/migrations');

if (!existsSync(dataPath)) {
  mkdirSync(dataPath, { recursive: true });
}

const dbPaths: string[] = [];

if (schoolId) {
  dbPaths.push(join(dataPath, `${schoolId}.db`));
} else {
  const files = readdirSync(dataPath).filter((file) => file.endsWith('.db'));
  dbPaths.push(...files.map((file) => join(dataPath, file)));
}

if (dbPaths.length === 0) {
  console.log('No SQLite databases found. Set SCHOOL_ID or add .db files to the data directory.');
  process.exit(0);
}

if (!existsSync(migrationsDir)) {
  console.log('No migrations directory found.');
  process.exit(1);
}

const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b));

for (const dbPath of dbPaths) {
  const db = new Database(dbPath);
  const hasTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
    .get();

  const applied = hasTable
    ? (db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{ version: string }>)
        .map((row) => row.version)
    : [];

  const appliedSet = new Set(applied);
  const fileSet = new Set(migrationFiles);
  const pending = migrationFiles.filter((file) => !appliedSet.has(file));
  const orphaned = applied.filter((file) => !fileSet.has(file));

  console.log(`\nMigration status for ${dbPath}`);
  console.log(`  Applied: ${applied.length}`);
  console.log(`  Pending: ${pending.length}`);
  console.log(`  Orphaned: ${orphaned.length}`);

  if (pending.length) {
    console.log('  Pending migrations:');
    for (const file of pending) {
      console.log(`    ${file}`);
    }
  }

  if (orphaned.length) {
    console.log('  Orphaned migrations (applied but missing in folder):');
    for (const file of orphaned) {
      console.log(`    ${file}`);
    }
  }

  db.close();
}
