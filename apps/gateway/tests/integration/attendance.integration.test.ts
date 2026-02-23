import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { GatewayApp } from '../../src/index';

describe('Attendance Integration Tests', () => {
  let app: GatewayApp;
  let authToken: string;

  beforeAll(async () => {
    app = new GatewayApp();
    await app.start();

    // Setup auth token
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

  describe('POST /api/attendance/sessions', () => {
    it('should create attendance session', async () => {
      const response = await fetch('http://localhost:8080/api/attendance/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          class_id: 'class-1',
          session_id: 'session-1',
          date: '2024-01-15',
          subject_id: 'subject-1',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.status).toBe('draft');
    });

    it('should require authentication', async () => {
      const response = await fetch('http://localhost:8080/api/attendance/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: 'class-1',
          session_id: 'session-1',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/attendance/mark', () => {
    it('should mark student attendance', async () => {
      const response = await fetch('http://localhost:8080/api/attendance/mark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          session_id: 'session-1',
          student_id: 'student-1',
          status: 'present',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('present');
    });

    it('should validate status values', async () => {
      const response = await fetch('http://localhost:8080/api/attendance/mark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          session_id: 'session-1',
          student_id: 'student-1',
          status: 'invalid',
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/attendance/submit', () => {
    it('should submit attendance for validation', async () => {
      const response = await fetch('http://localhost:8080/api/attendance/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          session_id: 'session-1',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('submitted');
    });

    it('should create audit log on submit', async () => {
      // Submit attendance
      await fetch('http://localhost:8080/api/attendance/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ session_id: 'session-2' }),
      });

      // Check audit log
      const auditResponse = await fetch('http://localhost:8080/api/audit/logs', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      const logs = await auditResponse.json();
      const submitLog = logs.find((log: any) => log.action === 'attendance_submitted');
      expect(submitLog).toBeDefined();
    });
  });

  describe('POST /api/attendance/validate', () => {
    it('should validate submitted attendance (admin only)', async () => {
      // Login as admin
      const adminResponse = await fetch('http://localhost:8080/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@school.com',
          password: 'password123',
        }),
      });

      const adminData = await adminResponse.json();
      const adminToken = adminData.token;

      const response = await fetch('http://localhost:8080/api/attendance/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          session_id: 'session-1',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('validated');
    });

    it('should reject validation by non-admin', async () => {
      const response = await fetch('http://localhost:8080/api/attendance/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`, // Teacher token
        },
        body: JSON.stringify({
          session_id: 'session-1',
        }),
      });

      expect(response.status).toBe(403);
    });
  });
});
