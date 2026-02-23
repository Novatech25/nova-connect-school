import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { Database } from '../src/db/bun-sqlite.js';
import { runMigrations } from '../src/db/migrate.js';

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
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');

  runMigrations(db);
  db.close();

  console.log(`Migrations complete for ${dbPath}`);
}
