import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { GatewayApp } from '../../src/index';

describe('License Integration Tests', () => {
  let app: GatewayApp;
  let authToken: string;

  beforeAll(async () => {
    app = new GatewayApp();
    await app.start();

    // Login as super admin
    const response = await fetch('http://localhost:8080/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'superadmin@novaconnect.app',
        password: 'password123',
      }),
    });

    const data = await response.json();
    authToken = data.token;
  });

  afterAll(async () => {
    await app.stop();
  });

  describe('POST /api/licenses/activate', () => {
    it('should activate Gateway license', async () => {
      const response = await fetch('http://localhost:8080/api/licenses/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          license_key: 'NOVA-1234-5678-ABCD-EFGH',
          school_id: 'school-1',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('active');
      expect(data.activated_at).toBeDefined();
    });

    it('should validate hardware fingerprint', async () => {
      const response = await fetch('http://localhost:8080/api/licenses/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          license_key: 'NOVA-1234-5678-ABCD-EFGH',
          school_id: 'school-1',
          hardware_fingerprint: 'invalid-fingerprint',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('hardware fingerprint');
    });
  });

  describe('GET /api/licenses/validate', () => {
    it('should validate active license', async () => {
      const response = await fetch('http://localhost:8080/api/licenses/validate', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.valid).toBe(true);
      expect(data.expires_at).toBeDefined();
    });

    it('should reject expired license', async () => {
      // Mock expired license
      const response = await fetch('http://localhost:8080/api/licenses/validate?license=EXPIRED-KEY', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.valid).toBe(false);
      expect(data.error).toContain('expired');
    });
  });

  describe('POST /api/licenses/revoke', () => {
    it('should revoke active license', async () => {
      const response = await fetch('http://localhost:8080/api/licenses/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          license_key: 'NOVA-1234-5678-ABCD-EFGH',
          reason: 'Hardware changed',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('revoked');
    });

    it('should create audit log on revocation', async () => {
      // Revoke license
      await fetch('http://localhost:8080/api/licenses/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          license_key: 'NOVA-1234-5678-ABCD-EFGH',
          reason: 'Security reason',
        }),
      });

      // Check audit log
      const auditResponse = await fetch('http://localhost:8080/api/audit/logs?action=license_revoked', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      const logs = await auditResponse.json();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('license_revoked');
    });
  });

  describe('POST /api/licenses/check', () => {
    it('should check license status periodically', async () => {
      const response = await fetch('http://localhost:8080/api/licenses/check', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('active');
    });

    it('should block premium features if license expired', async () => {
      // Mock expired license check
      const response = await fetch('http://localhost:8080/api/licenses/check?license=EXPIRED', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.premium_enabled).toBe(false);
    });
  });

  describe('GET /api/licenses/features', () => {
    it('should return enabled features for license', async () => {
      const response = await fetch('http://localhost:8080/api/licenses/features', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.features).toBeInstanceOf(Array);
      expect(data.features).toContain('attendance'); // Basic feature
    });

    it('should include premium features if license allows', async () => {
      const response = await fetch('http://localhost:8080/api/licenses/features', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      // Premium features may include: qr_advanced, mobile_money, exams, etc.
      if (data.premium_enabled) {
        expect(data.features.length).toBeGreaterThan(5);
      }
    });
  });
});
