/**
 * Helper functions to get data from Hono context
 */

export function getSchoolId(c: any): string {
  const schoolId = c.get('schoolId');
  if (!schoolId) {
    throw new Error('School ID not found in context');
  }
  return schoolId;
}

export function getDb(c: any): any {
  const db = c.get('db');
  if (!db) {
    throw new Error('Database not found in context');
  }
  return db;
}

export function getEventLog(c: any): any {
  const eventLog = c.get('eventLog');
  if (!eventLog) {
    throw new Error('EventLog not found in context');
  }
  return eventLog;
}
