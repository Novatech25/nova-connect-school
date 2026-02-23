// Compatibility layer for better-sqlite3 API using bun:sqlite
import { Database as BunDatabase } from 'bun:sqlite';

export class Database {
  readonly db: BunDatabase;

  constructor(path: string, options?: { readonly?: boolean; verbose?: any }) {
    // Bun SQLite only supports readonly option, ignore verbose
    const opts = options?.readonly ? { readonly: true } : undefined;
    this.db = new BunDatabase(path, opts);
  }

  prepare(sql: string) {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params: any[]) => {
        stmt.run(...params);
        return { changes: this.db.changes, lastInsertRowid: this.db.lastInsertRowid };
      },
      get: (...params: any[]) => stmt.get(...params),
      all: (...params: any[]) => stmt.all(...params),
      // For prepared statement reuse
      finalize: () => {},
    };
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  pragma(pragma: string): any {
    // Bun doesn't have a pragma method, so we need to execute it as SQL
    const stmt = this.db.prepare(`PRAGMA ${pragma}`);
    const result = stmt.get();
    return result;
  }

  close(): void {
    this.db.close();
  }

  // Helper for transaction support (if needed)
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // Expose raw database if needed
  get raw(): BunDatabase {
    return this.db;
  }
}

export default Database;
