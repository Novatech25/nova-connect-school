import { machineIdSync } from 'node-machine-id';
import { createHash } from 'crypto';
import { networkInterfaces } from 'os';
import { Database } from '../db/bun-sqlite.js';
import { createClient } from '@supabase/supabase-js';
import { loadLicenseConfig } from '../config/license.js';

export class LicenseService {
  private db: Database;
  private supabaseClient: any;

  constructor(db: Database.Database) {
    this.db = db;
    const config = loadLicenseConfig();

    if (config.supabaseUrl && config.supabaseAnonKey) {
      this.supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
  }

  // Generate hardware fingerprint unique to this machine
  generateHardwareFingerprint(): string {
    const machineId = machineIdSync();
    const macs = this.getMacAddresses();

    const fingerprintData = `${machineId}-${macs.join('-')}`;
    return createHash('sha256').update(fingerprintData).digest('hex');
  }

  private getMacAddresses(): string[] {
    const nets = networkInterfaces();
    const macs: string[] = [];

    for (const name of Object.keys(nets)) {
      for (const net of nets[name]!) {
        // Only use non-internal, non-zero MAC addresses
        if (!net.internal && net.mac !== '00:00:00:00:00:00') {
          macs.push(net.mac);
        }
      }
    }

    // Sort to ensure consistent fingerprint
    return macs.sort();
  }

  // Activate license on first startup
  async activateLicense(licenseKey: string, schoolId: string): Promise<void> {
    const fingerprint = this.generateHardwareFingerprint();

    // Verify with Supabase Cloud
    if (!this.supabaseClient) {
      throw new Error('Supabase client not configured. Cannot activate license.');
    }

    const { data, error } = await this.supabaseClient.functions.invoke('activate-license', {
      body: {
        licenseKey,
        schoolId,
        hardwareFingerprint: fingerprint
      }
    });

    if (error || !data.valid) {
      throw new Error('Licence invalide ou déjà activée sur un autre appareil');
    }

    // Store locally
    this.db.prepare(`
      INSERT INTO gateway_license (license_key, school_id, hardware_fingerprint, activated_at, expires_at)
      VALUES (?, ?, ?, datetime('now'), ?)
    `).run(licenseKey, schoolId, fingerprint, data.expiresAt);

    console.log('✅ License activated successfully');
  }

  // Validate license on startup
  async validateLicense(): Promise<boolean> {
    const license = this.db.prepare('SELECT * FROM gateway_license WHERE id = 1').get() as any;

    if (!license) {
      throw new Error('Aucune licence trouvée. Veuillez activer le Gateway.');
    }

    const currentFingerprint = this.generateHardwareFingerprint();

    // Skip hardware fingerprint check for test licenses
    const isTestLicense = license.license_key.startsWith('NOVA-TEST');

    // Check hardware fingerprint (anti-copy protection) - skip for test licenses
    if (!isTestLicense && license.hardware_fingerprint !== currentFingerprint) {
      this.db.prepare('UPDATE gateway_license SET status = ? WHERE id = 1').run('revoked');
      throw new Error('Licence invalide : matériel différent détecté (anti-copie)');
    }

    // Check expiration
    const expiresAt = new Date(license.expires_at);
    if (expiresAt < new Date()) {
      this.db.prepare('UPDATE gateway_license SET status = ? WHERE id = 1').run('expired');
      throw new Error('Licence expirée');
    }

    // Validate with Supabase Cloud (if online) - skip for test licenses
    if (this.supabaseClient && !isTestLicense) {
      try {
        const { data } = await this.supabaseClient.functions.invoke('check-license-validity', {
          body: {
            license_key: license.license_key,
            hardware_fingerprint: currentFingerprint
          }
        });

        if (!data.valid) {
          this.db.prepare('UPDATE gateway_license SET status = ? WHERE id = 1').run('revoked');
          throw new Error('Licence révoquée ou invalide');
        }

        // Update last_validated_at
        this.db.prepare('UPDATE gateway_license SET last_validated_at = datetime("now"), status = ? WHERE id = 1')
          .run('active');

      } catch (err: any) {
        // If offline, accept if last validation < 7 days
        if (err.message?.includes('Licence révoquée') || err.message?.includes('invalide')) {
          throw err;
        }

        const lastValidated = new Date(license.last_validated_at || 0);
        const daysSinceValidation = (Date.now() - lastValidated.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceValidation > 7) {
          throw new Error('Impossible de valider la licence. Veuillez vous connecter à Internet.');
        }

        console.warn('⚠️  Offline mode: Using cached license validation');
      }
    } else if (isTestLicense) {
      console.log('✅ Test license detected - skipping Supabase validation');
    }

    return true;
  }

  // Get license info
  getLicenseInfo(): any {
    return this.db.prepare('SELECT * FROM gateway_license WHERE id = 1').get();
  }

  // Check if license is active
  isLicenseActive(): boolean {
    const license = this.getLicenseInfo();
    return license && license.status === 'active';
  }
}
