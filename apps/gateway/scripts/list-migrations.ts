import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { Database } from '../src/db/bun-sqlite.js';

const dataPath = process.env.DATABASE_PATH || './data';
const schoolId = process.env.SCHOOL_ID;

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

for (const dbPath of dbPaths) {
  const db = new Database(dbPath);
  const hasTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
    .get();

  console.log(`\nMigrations for ${dbPath}`);

  if (!hasTable) {
    console.log('  (no schema_migrations table found)');
    db.close();
    continue;
  }

  const rows = db
    .prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version')
    .all() as Array<{ version: string; applied_at: string }>;

  if (rows.length === 0) {
    console.log('  (no migrations applied)');
  } else {
    for (const row of rows) {
      console.log(`  ${row.version}  ${row.applied_at}`);
    }
  }

  db.close();
}
