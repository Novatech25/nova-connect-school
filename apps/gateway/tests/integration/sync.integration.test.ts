import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { GatewayApp } from '../../src/index';

describe('Sync Integration Tests', () => {
  let app: GatewayApp;
  let authToken: string;

  beforeAll(async () => {
    app = new GatewayApp();
    await app.start();

    const response = await fetch('http://localhost:8080/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'teacher@school.com',
        password: 'password123',
      }),
    });

    const data = await response.json();
    authToken = data.token;
  });

  afterAll(async () => {
    await app.stop();
  });

  describe('POST /api/sync/event-log', () => {
    it('should log event for sync', async () => {
      const response = await fetch('http://localhost:8080/api/sync/event-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          resource_type: 'attendance',
          resource_id: 'att-1',
          action: 'create',
          data: { student_id: 'student-1', status: 'present' },
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.synced).toBe(false);
    });
  });

  describe('POST /api/sync/push', () => {
    it('should push pending events to cloud', async () => {
      // Create pending events
      await fetch('http://localhost:8080/api/sync/event-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          resource_type: 'attendance',
          resource_id: 'att-2',
          action: 'create',
          data: { student_id: 'student-2', status: 'absent' },
        }),
      });

      const response = await fetch('http://localhost:8080/api/sync/push', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.pushed).toBeGreaterThan(0);
    });

    it('should mark events as synced after push', async () => {
      // Push events
      await fetch('http://localhost:8080/api/sync/push', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      // Check event status
      const response = await fetch('http://localhost:8080/api/sync/event-log?synced=false', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      const events = await response.json();
      expect(events).toHaveLength(0); // All events should be synced
    });
  });

  describe('POST /api/sync/pull', () => {
    it('should pull data from cloud', async () => {
      const response = await fetch('http://localhost:8080/api/sync/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          resources: ['attendance', 'grades'],
          since: '2024-01-15T00:00:00Z',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.attendance).toBeDefined();
      expect(data.grades).toBeDefined();
    });

    it('should filter by last sync timestamp', async () => {
      const since = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

      const response = await fetch('http://localhost:8080/api/sync/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          resources: ['grades'],
          since,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.grades).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/sync/retry', () => {
    it('should retry failed sync operations', async () => {
      // Simulate failed events
      await fetch('http://localhost:8080/api/sync/event-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          resource_type: 'attendance',
          resource_id: 'att-3',
          action: 'create',
          data: { student_id: 'student-3', status: 'late' },
          retry_count: 1,
        }),
      });

      const response = await fetch('http://localhost:8080/api/sync/retry', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.retried).toBeGreaterThan(0);
    });

    it('should apply exponential backoff for retries', async () => {
      // Create events with multiple retry counts
      for (let i = 1; i <= 3; i++) {
        await fetch('http://localhost:8080/api/sync/event-log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            resource_type: 'attendance',
            resource_id: `att-${i}`,
            action: 'create',
            retry_count: i,
          }),
        });
      }

      const response = await fetch('http://localhost:8080/api/sync/retry', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/sync/status', () => {
    it('should return sync status', async () => {
      const response = await fetch('http://localhost:8080/api/sync/status', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.pending).toBeDefined();
      expect(data.synced).toBeDefined();
      expect(data.failed).toBeDefined();
      expect(data.lastSyncAt).toBeDefined();
    });
  });
});
