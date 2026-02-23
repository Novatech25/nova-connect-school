import { describe, test, expect, beforeEach } from 'bun:test';
import Database from 'better-sqlite3';
import { rmSync } from 'fs';
import { LicenseService } from '../src/services/license.js';

describe('LicenseService', () => {
  let db: Database.Database;
  let licenseService: LicenseService;
  const testDbPath = './test-license.db';

  beforeEach(() => {
    // Clean up test database
    try {
      rmSync(testDbPath);
    } catch (e) {
      // Ignore if file doesn't exist
    }

    // Create fresh database
    db = new Database(testDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Initialize schema
    const schema = `
      CREATE TABLE IF NOT EXISTS gateway_license (
        id INTEGER PRIMARY KEY,
        license_key TEXT NOT NULL,
        school_id TEXT NOT NULL,
        hardware_fingerprint TEXT NOT NULL,
        activated_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_validated_at TEXT,
        status TEXT DEFAULT 'active',
        metadata TEXT
      );
    `;
    db.exec(schema);

    licenseService = new LicenseService(db);
  });

  test('génère hardware fingerprint unique', () => {
    const fp1 = licenseService.generateHardwareFingerprint();
    const fp2 = licenseService.generateHardwareFingerprint();

    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(64); // SHA-256 = 64 hex chars
    expect(fp1).toMatch(/^[a-f0-9]{64}$/);
  });

  test('génère hardware fingerprint avec machine ID et MAC addresses', () => {
    const fp = licenseService.generateHardwareFingerprint();

    // Fingerprint should be deterministic for the same machine
    expect(fp).toBeDefined();
    expect(typeof fp).toBe('string');
    expect(fp.length).toBe(64);
  });

  test('active une licence', async () => {
    // Mock Supabase client for testing
    (licenseService as any).supabaseClient = {
      functions: {
        invoke: async (name: string, options: any) => {
          return {
            data: {
              valid: true,
              expiresAt: '2099-12-31T23:59:59.999Z'
            },
            error: null
          };
        }
      }
    };

    await licenseService.activateLicense('TEST-LICENSE-KEY', 'test-school-123');

    const license = db.prepare('SELECT * FROM gateway_license WHERE id = 1').get();

    expect(license).toBeDefined();
    expect(license?.license_key).toBe('TEST-LICENSE-KEY');
    expect(license?.school_id).toBe('test-school-123');
    expect(license?.status).toBe('active');
  });

  test('valide une licence active', async () => {
    // Insert test license
    const fingerprint = licenseService.generateHardwareFingerprint();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // Expires in 1 year

    db.prepare(`
      INSERT INTO gateway_license (license_key, school_id, hardware_fingerprint, activated_at, expires_at, last_validated_at, status)
      VALUES (?, ?, ?, datetime('now'), ?, datetime('now'), ?)
    `).run('TEST-LICENSE', 'test-school', fingerprint, expiresAt.toISOString(), 'active');

    // Mock Supabase client
    (licenseService as any).supabaseClient = {
      functions: {
        invoke: async (name: string, options: any) => {
          return {
            data: { valid: true },
            error: null
          };
        }
      }
    };

    const isValid = await licenseService.validateLicense();
    expect(isValid).toBe(true);
  });

  test('détecte hardware fingerprint différent', async () => {
    // Insert license with different hardware fingerprint
    db.prepare(`
      INSERT INTO gateway_license (license_key, school_id, hardware_fingerprint, activated_at, expires_at, last_validated_at, status)
      VALUES (?, ?, ?, datetime('now'), ?, datetime('now'), ?)
    `).run(
      'TEST-LICENSE',
      'test-school',
      'different-fingerprint-000000000000000000000000',
      '2099-12-31T23:59:59.999Z',
      'active'
    );

    await expect(licenseService.validateLicense()).rejects.toThrow('matériel différent détecté');
  });

  test('détecte licence expirée', async () => {
    // Insert expired license
    const fingerprint = licenseService.generateHardwareFingerprint();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() - 1); // Expired 1 year ago

    db.prepare(`
      INSERT INTO gateway_license (license_key, school_id, hardware_fingerprint, activated_at, expires_at, last_validated_at, status)
      VALUES (?, ?, ?, datetime('now'), ?, datetime('now'), ?)
    `).run('TEST-LICENSE', 'test-school', fingerprint, expiresAt.toISOString(), 'active');

    await expect(licenseService.validateLicense()).rejects.toThrow('Licence expirée');

    // Verify license status was updated
    const license = db.prepare('SELECT status FROM gateway_license WHERE id = 1').get();
    expect(license?.status).toBe('expired');
  });

  test('retourne info licence', async () => {
    const fingerprint = licenseService.generateHardwareFingerprint();
    const expiresAt = '2099-12-31T23:59:59.999Z';

    db.prepare(`
      INSERT INTO gateway_license (license_key, school_id, hardware_fingerprint, activated_at, expires_at, last_validated_at, status)
      VALUES (?, ?, ?, datetime('now'), ?, datetime('now'), ?)
    `).run('TEST-LICENSE', 'test-school', fingerprint, expiresAt, 'active');

    const license = licenseService.getLicenseInfo();

    expect(license).toBeDefined();
    expect(license?.license_key).toBe('TEST-LICENSE');
    expect(license?.school_id).toBe('test-school');
    expect(license?.expires_at).toBe(expiresAt);
    expect(license?.status).toBe('active');
  });

  test('vérifie isLicenseActive', async () => {
    const fingerprint = licenseService.generateHardwareFingerprint();

    db.prepare(`
      INSERT INTO gateway_license (license_key, school_id, hardware_fingerprint, activated_at, expires_at, last_validated_at, status)
      VALUES (?, ?, ?, datetime('now'), ?, datetime('now'), ?)
    `).run('TEST-LICENSE', 'test-school', fingerprint, '2099-12-31T23:59:59.999Z', 'active');

    expect(licenseService.isLicenseActive()).toBe(true);

    // Update status to inactive
    db.prepare('UPDATE gateway_license SET status = ? WHERE id = 1').run('inactive');

    expect(licenseService.isLicenseActive()).toBe(false);
  });

  test('gère licence inexistante', () => {
    const license = licenseService.getLicenseInfo();
    expect(license).toBeUndefined();

    expect(licenseService.isLicenseActive()).toBe(false);
  });

  test('mode offline avec dernière validation < 7 jours', async () => {
    const fingerprint = licenseService.generateHardwareFingerprint();
    const lastValidated = new Date();
    lastValidated.setDate(lastValidated.getDate() - 3); // 3 days ago

    db.prepare(`
      INSERT INTO gateway_license (license_key, school_id, hardware_fingerprint, activated_at, expires_at, last_validated_at, status)
      VALUES (?, ?, ?, datetime('now'), ?, ?, ?)
    `).run(
      'TEST-LICENSE',
      'test-school',
      fingerprint,
      '2099-12-31T23:59:59.999Z',
      lastValidated.toISOString(),
      'active'
    );

    // Mock Supabase to throw error (simulating offline)
    (licenseService as any).supabaseClient = {
      functions: {
        invoke: async () => {
          throw new Error('Network error');
        }
      }
    };

    const isValid = await licenseService.validateLicense();
    expect(isValid).toBe(true);
  });

  test('mode offline rejette si dernière validation > 7 jours', async () => {
    const fingerprint = licenseService.generateHardwareFingerprint();
    const lastValidated = new Date();
    lastValidated.setDate(lastValidated.getDate() - 10); // 10 days ago

    db.prepare(`
      INSERT INTO gateway_license (license_key, school_id, hardware_fingerprint, activated_at, expires_at, last_validated_at, status)
      VALUES (?, ?, ?, datetime('now'), ?, ?, ?)
    `).run(
      'TEST-LICENSE',
      'test-school',
      fingerprint,
      '2099-12-31T23:59:59.999Z',
      lastValidated.toISOString(),
      'active'
    );

    // Mock Supabase to throw error (simulating offline)
    (licenseService as any).supabaseClient = {
      functions: {
        invoke: async () => {
          throw new Error('Network error');
        }
      }
    };

    await expect(licenseService.validateLicense()).rejects.toThrow('Veuillez vous connecter à Internet');
  });

  test('révoque licence si Supabase retourne invalid', async () => {
    const fingerprint = licenseService.generateHardwareFingerprint();

    db.prepare(`
      INSERT INTO gateway_license (license_key, school_id, hardware_fingerprint, activated_at, expires_at, last_validated_at, status)
      VALUES (?, ?, ?, datetime('now'), ?, datetime('now'), ?)
    `).run('TEST-LICENSE', 'test-school', fingerprint, '2099-12-31T23:59:59.999Z', 'active');

    // Mock Supabase to return invalid
    (licenseService as any).supabaseClient = {
      functions: {
        invoke: async () => {
          return {
            data: { valid: false },
            error: null
          };
        }
      }
    };

    await expect(licenseService.validateLicense()).rejects.toThrow('révoquée ou invalide');

    // Verify license status was updated
    const license = db.prepare('SELECT status FROM gateway_license WHERE id = 1').get();
    expect(license?.status).toBe('revoked');
  });
});
