import crypto from 'crypto';

export interface QrCardData {
  studentId: string;
  schoolId: string;
  cardId: string;
  timestamp: number;
}

export function generateCardQrData(
  studentId: string,
  schoolId: string,
  cardId: string,
  secret: string
): { data: string; signature: string } {
  const timestamp = Date.now();
  const payload: QrCardData = { studentId, schoolId, cardId, timestamp };
  const dataString = JSON.stringify(payload);

  const signature = crypto
    .createHmac('sha256', secret)
    .update(dataString)
    .digest('hex');

  return {
    data: dataString,
    signature,
  };
}

export function validateCardQrSignature(
  data: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

export function isCardQrExpired(
  timestamp: number,
  validityMinutes: number = 60
): boolean {
  const now = Date.now();
  const expiryTime = timestamp + validityMinutes * 60 * 1000;
  return now > expiryTime;
}

export function formatCardNumber(cardNumber: string): string {
  // Format: ABC-2025-000001 → ABC-2025-000001
  return cardNumber;
}

export function isCardExpired(expiryDate: Date | null | undefined): boolean {
  if (!expiryDate) return false;
  return new Date() > new Date(expiryDate);
}

export function parseQrData(qrDataString: string): QrCardData | null {
  try {
    return JSON.parse(qrDataString) as QrCardData;
  } catch {
    return null;
  }
}

export function generateCardFilePath(
  schoolId: string,
  studentId: string,
  cardId: string
): string {
  return `${schoolId}/${studentId}/cards/${cardId}.pdf`;
}

export function calculatePaymentStatus(
  balance: number,
  config: {
    warningThreshold?: number;
    blockingThreshold?: number;
  } = {}
): 'ok' | 'warning' | 'blocked' {
  const { warningThreshold = 0, blockingThreshold = 0 } = config;

  if (balance <= 0) return 'ok';
  if (balance >= blockingThreshold) return 'blocked';
  if (balance >= warningThreshold) return 'warning';
  return 'ok';
}

export function getCardStatusDisplayText(status: string): string {
  const statusMap: Record<string, string> = {
    active: 'Active',
    expired: 'Expirée',
    revoked: 'Révoquée',
    lost: 'Perdue',
  };
  return statusMap[status] || status;
}

export function getPaymentStatusDisplayText(status: string): string {
  const statusMap: Record<string, string> = {
    ok: 'OK',
    warning: 'Attention',
    blocked: 'Bloqué',
  };
  return statusMap[status] || status;
}
