import { Database } from '../db/bun-sqlite.js';
import { join } from 'path';
import { runMigrations } from '../db/migrate.js';

export interface DatabaseConfig {
  dataPath: string;
  schoolId: string;
}

export class DatabaseManager {
  private db: Database;
  private schoolId: string;

  constructor(config: DatabaseConfig) {
    this.schoolId = config.schoolId;
    const dbPath = join(config.dataPath, `${this.schoolId}.db`);

    this.db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
    });

    this.configure();
  }

  private configure(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Set synchronous mode to NORMAL for performance
    this.db.pragma('synchronous = NORMAL');

    // Set busy timeout to 5 seconds
    this.db.pragma('busy_timeout = 5000');
  }

  initializeSchema(): void {
    runMigrations(this.db, join(import.meta.dir, '../db/migrations'));
  }

  getDatabase(): Database {
    return this.db;
  }

  getSchoolId(): string {
    return this.schoolId;
  }

  close(): void {
    this.db.close();
  }

  // Helper method to check if database is initialized
  isInitialized(): boolean {
    const result = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schools'")
      .get();

    return !!result;
  }
}
