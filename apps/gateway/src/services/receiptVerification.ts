import { createHmac } from 'node:crypto';
import QRCode from 'qrcode';

const HMAC_SECRET = process.env.RECEIPT_VERIFICATION_SECRET || 'default-secret-change-me';

export function generateVerificationToken(
  receiptId: string,
  receiptType: string,
  schoolId: string
): string {
  const timestamp = Date.now();
  const payload = `${receiptId}:${receiptType}:${schoolId}:${timestamp}`;
  const hmac = createHmac('sha256', HMAC_SECRET);
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
    const hmac = createHmac('sha256', HMAC_SECRET);
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

export async function generateQRCodeDataUrl(data: string): Promise<string> {
  return await QRCode.toDataURL(data, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 200,
  });
}
