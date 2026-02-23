import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { GatewayApp } from '../../src/index';

describe('Grades Integration Tests', () => {
  let app: GatewayApp;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = new GatewayApp();
    await app.start();

    // Setup teacher auth
    const teacherResponse = await fetch('http://localhost:8080/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'teacher@school.com',
        password: 'password123',
      }),
    });

    const teacherData = await teacherResponse.json();
    authToken = teacherData.token;

    // Setup admin auth
    const adminResponse = await fetch('http://localhost:8080/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@school.com',
        password: 'password123',
      }),
    });

    const adminData = await adminResponse.json();
    adminToken = adminData.token;
  });

  afterAll(async () => {
    await app.stop();
  });

  describe('POST /api/grades', () => {
    it('should create single grade', async () => {
      const response = await fetch('http://localhost:8080/api/grades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          student_id: 'student-1',
          subject_id: 'subject-1',
          score: 15,
          coefficient: 1,
          trimester: 1,
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.score).toBe(15);
      expect(data.status).toBe('draft');
    });

    it('should validate score range', async () => {
      const response = await fetch('http://localhost:8080/api/grades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          student_id: 'student-1',
          subject_id: 'subject-1',
          score: 25, // Invalid: > 20
          coefficient: 1,
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/grades/bulk', () => {
    it('should bulk insert grades for class', async () => {
      const response = await fetch('http://localhost:8080/api/grades/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          grades: [
            { student_id: 'student-1', subject_id: 'subject-1', score: 15, coefficient: 1 },
            { student_id: 'student-2', subject_id: 'subject-1', score: 16, coefficient: 1 },
            { student_id: 'student-3', subject_id: 'subject-1', score: 14, coefficient: 1 },
          ],
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.inserted).toBe(3);
    });

    it('should validate all grades before insertion', async () => {
      const response = await fetch('http://localhost:8080/api/grades/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          grades: [
            { student_id: 'student-1', subject_id: 'subject-1', score: 15, coefficient: 1 },
            { student_id: 'student-2', subject_id: 'subject-1', score: -5, coefficient: 1 }, // Invalid
          ],
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/grades/publish', () => {
    it('should publish approved grades', async () => {
      // First, approve grades
      await fetch('http://localhost:8080/api/grades/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          grade_ids: ['grade-1', 'grade-2'],
        }),
      });

      // Then publish
      const response = await fetch('http://localhost:8080/api/grades/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          grade_ids: ['grade-1', 'grade-2'],
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.published).toBe(2);
    });

    it('should create version for corrected grades', async () => {
      // Create initial grade
      await fetch('http://localhost:8080/api/grades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          student_id: 'student-1',
          subject_id: 'subject-1',
          score: 15,
          coefficient: 1,
        }),
      });

      // Approve and publish
      await fetch('http://localhost:8080/api/grades/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ grade_ids: ['grade-1'] }),
      });

      await fetch('http://localhost:8080/api/grades/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ grade_ids: ['grade-1'] }),
      });

      // Correct grade
      const response = await fetch('http://localhost:8080/api/grades/grade-1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ score: 16 }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.version).toBe(2);
    });
  });

  describe('GET /api/grades/:id', () => {
    it('should retrieve grade by id', async () => {
      const response = await fetch('http://localhost:8080/api/grades/grade-1', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe('grade-1');
    });

    it('should only return published grades to students', async () => {
      // Login as student
      const studentResponse = await fetch('http://localhost:8080/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'student@school.com',
          password: 'password123',
        }),
      });

      const studentData = await studentResponse.json();
      const studentToken = studentData.token;

      const response = await fetch('http://localhost:8080/api/grades/grade-draft', {
        headers: { 'Authorization': `Bearer ${studentToken}` },
      });

      expect(response.status).toBe(403); // Cannot see draft grades
    });
  });
});
