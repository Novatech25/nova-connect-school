import { Database } from '../db/bun-sqlite.js';
import { randomUUID } from 'crypto';

export class EventLogService {
  private db: Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // Add event to log
  addEvent(
    schoolId: string,
    eventType: 'create' | 'update' | 'delete',
    tableName: string,
    recordId: string,
    data: any,
    userId?: string
  ): string {
    const id = randomUUID();

    this.db.prepare(`
      INSERT INTO event_log (id, school_id, event_type, table_name, record_id, data, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, schoolId, eventType, tableName, recordId, JSON.stringify(data), userId || null);

    return id;
  }

  // Get unsynced events
  getUnsyncedEvents(limit = 100): any[] {
    return this.db.prepare(`
      SELECT * FROM event_log
      WHERE sync_status = 'pending' AND retry_count < 3
      ORDER BY created_at ASC
      LIMIT ?
    `).all(limit);
  }

  // Get events by school
  getEventsBySchool(schoolId: string, limit = 100, offset = 0): any[] {
    return this.db.prepare(`
      SELECT * FROM event_log
      WHERE school_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(schoolId, limit, offset);
  }

  // Mark as synced
  markAsSynced(eventId: string): void {
    this.db.prepare(`
      UPDATE event_log
      SET sync_status = 'synced', synced_at = datetime('now')
      WHERE id = ?
    `).run(eventId);
  }

  // Mark as failed
  markAsFailed(eventId: string, error: string): void {
    this.db.prepare(`
      UPDATE event_log
      SET sync_status = 'failed', sync_error = ?, retry_count = retry_count + 1
      WHERE id = ?
    `).run(error, eventId);
  }

  // Get statistics
  getStats(): any {
    const stats = this.db.prepare(`
      SELECT
        sync_status,
        COUNT(*) as count
      FROM event_log
      GROUP BY sync_status
    `).all();

    const result: any = {
      pending: 0,
      synced: 0,
      failed: 0,
      total: 0
    };

    for (const stat of stats) {
      result[stat.sync_status] = stat.count;
      result.total += stat.count;
    }

    return result;
  }

  // Get recent events
  getRecentEvents(limit = 50): any[] {
    return this.db.prepare(`
      SELECT * FROM event_log
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);
  }

  // Cleanup old synced events
  cleanup(daysToKeep = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = this.db.prepare(`
      DELETE FROM event_log
      WHERE sync_status = 'synced' AND synced_at < ?
    `).run(cutoffDate.toISOString());

    return result.changes;
  }

  // Retry failed events
  retryFailedEvents(): number {
    const result = this.db.prepare(`
      UPDATE event_log
      SET sync_status = 'pending', retry_count = 0, sync_error = NULL
      WHERE sync_status = 'failed' AND retry_count < 3
    `).run();

    return result.changes;
  }
}
