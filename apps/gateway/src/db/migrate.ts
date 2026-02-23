import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Database } from './bun-sqlite.js';

const MIGRATIONS_TABLE = 'schema_migrations';

const splitStatements = (sql: string): string[] => {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
};

const ensureMigrationsTable = (db: Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
};

const getAppliedMigrations = (db: Database): Set<string> => {
  const rows = db.prepare(`SELECT version FROM ${MIGRATIONS_TABLE}`).all() as Array<{ version: string }>;
  return new Set(rows.map((row) => row.version));
};

export const runMigrations = (db: Database, migrationsDir = join(import.meta.dir, './migrations')): void => {
  if (!existsSync(migrationsDir)) {
    return;
  }

  ensureMigrationsTable(db);

  const applied = getAppliedMigrations(db);
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');
    const statements = splitStatements(sql);

    db.transaction(() => {
      for (const statement of statements) {
        db.exec(statement);
      }
      db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES (?)`).run(file);
    });

    console.log(`Applied migration ${file}`);
  }
};
