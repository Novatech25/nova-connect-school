import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';
import qrcode from 'https://esm.sh/qrcode-generator@1.4.4';

const DEFAULT_SECRET = 'default-secret-change-me';
const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const getVerificationSecret = (): string => {
  const secret = Deno.env.get('RECEIPT_VERIFICATION_SECRET');
  if (!secret || secret.trim().length < 32 || secret === DEFAULT_SECRET) {
    throw new Error('RECEIPT_VERIFICATION_SECRET is missing or too weak');
  }
  return secret;
};

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return toHex(digest);
};

export const generateShortCode = (length = 12): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join('');
};

export function generateVerificationToken(
  receiptId: string,
  receiptType: string,
  schoolId: string
): string {
  const timestamp = Date.now();
  const payload = `${receiptId}:${receiptType}:${schoolId}:${timestamp}`;
  const hmac = createHmac('sha256', getVerificationSecret());
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return `${payload}:${signature}`;
}

export function verifyToken(token: string): {
  valid: boolean;
  receiptId?: string;
  receiptType?: string;
  schoolId?: string;
  timestamp?: number;
} {
  try {
    const parts = token.split(':');
    if (parts.length !== 5) return { valid: false };

    const [receiptId, receiptType, schoolId, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr);

    // Check expiration (30 days)
    if (Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000) {
      return { valid: false };
    }

    const payload = `${receiptId}:${receiptType}:${schoolId}:${timestampStr}`;
    const hmac = createHmac('sha256', getVerificationSecret());
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false };
    }

    return {
      valid: true,
      receiptId,
      receiptType,
      schoolId,
      timestamp,
    };
  } catch {
    return { valid: false };
  }
}

export async function generateQRCodeDataUrl(data: string): Promise<string | undefined> {
  try {
    const qr = qrcode(0, 'H');
    qr.addData(data);
    qr.make();
    const svg = qr.createSvgTag(2, 0);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch (error) {
    console.warn('QR code generation failed, continuing without QR:', error);
    return undefined;
  }
}

export function generateQRCodeMatrix(data: string): boolean[][] | undefined {
  try {
    const qr = qrcode(0, 'H');
    qr.addData(data);
    qr.make();
    const size = qr.getModuleCount();
    const modules: boolean[][] = [];
    for (let row = 0; row < size; row += 1) {
      const rowModules: boolean[] = [];
      for (let col = 0; col < size; col += 1) {
        rowModules.push(qr.isDark(row, col));
      }
      modules.push(rowModules);
    }
    return modules;
  } catch (error) {
    console.warn('QR code matrix generation failed, continuing without QR:', error);
    return undefined;
  }
}
