import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface LicenseData {
  licenseKey: string;
  schoolId: string;
  hardwareFingerprint: string;
  activatedAt: string;
  expiresAt: string;
}

export interface LicenseConfig {
  licenseFile?: string;
  licenseKey?: string;
  schoolId?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
}

export function loadLicenseConfig(): LicenseConfig {
  return {
    licenseFile: process.env.LICENSE_FILE || './license.json',
    licenseKey: process.env.LICENSE_KEY,
    schoolId: process.env.SCHOOL_ID,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

export function loadLicenseFromFile(filePath: string): LicenseData | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load license file:', error);
    return null;
  }
}

export function saveLicenseToFile(filePath: string, license: LicenseData): void {
  const content = JSON.stringify(license, null, 2);
  require('fs').writeFileSync(filePath, content, 'utf-8');
}
