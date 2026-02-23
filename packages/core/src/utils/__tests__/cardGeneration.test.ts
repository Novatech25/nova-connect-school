import {
  generateCardQrData,
  validateCardQrSignature,
  isCardQrExpired,
  formatCardNumber,
  isCardExpired,
  parseQrData,
  generateCardFilePath,
  calculatePaymentStatus,
  getCardStatusDisplayText,
  getPaymentStatusDisplayText,
} from '../cardGeneration';

describe('Card Generation Utilities', () => {
  const mockStudentId = 'student-uuid';
  const mockSchoolId = 'school-uuid';
  const mockCardId = 'card-uuid';
  const mockSecret = 'test-secret-key';

  describe('generateCardQrData', () => {
    it('should generate QR data and signature', () => {
      const result = generateCardQrData(
        mockStudentId,
        mockSchoolId,
        mockCardId,
        mockSecret
      );

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('signature');
      expect(typeof result.data).toBe('string');
      expect(typeof result.signature).toBe('string');

      // Verify data structure
      const parsedData = JSON.parse(result.data);
      expect(parsedData).toHaveProperty('studentId', mockStudentId);
      expect(parsedData).toHaveProperty('schoolId', mockSchoolId);
      expect(parsedData).toHaveProperty('cardId', mockCardId);
      expect(parsedData).toHaveProperty('timestamp');
      expect(typeof parsedData.timestamp).toBe('number');
    });

    it('should generate different signatures for different data', () => {
      const result1 = generateCardQrData(
        mockStudentId,
        mockSchoolId,
        mockCardId,
        mockSecret
      );

      const result2 = generateCardQrData(
        'different-student',
        mockSchoolId,
        mockCardId,
        mockSecret
      );

      expect(result1.signature).not.toBe(result2.signature);
    });
  });

  describe('validateCardQrSignature', () => {
    it('should validate correct signature', () => {
      const { data, signature } = generateCardQrData(
        mockStudentId,
        mockSchoolId,
        mockCardId,
        mockSecret
      );

      const isValid = validateCardQrSignature(data, signature, mockSecret);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect signature', () => {
      const { data } = generateCardQrData(
        mockStudentId,
        mockSchoolId,
        mockCardId,
        mockSecret
      );

      const isValid = validateCardQrSignature(data, 'wrong-signature', mockSecret);
      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const { data, signature } = generateCardQrData(
        mockStudentId,
        mockSchoolId,
        mockCardId,
        mockSecret
      );

      const isValid = validateCardQrSignature(data, signature, 'wrong-secret');
      expect(isValid).toBe(false);
    });
  });

  describe('isCardQrExpired', () => {
    it('should not expire recent QR codes', () => {
      const recentTimestamp = Date.now() - 30 * 60 * 1000; // 30 minutes ago
      const isExpired = isCardQrExpired(recentTimestamp, 60);
      expect(isExpired).toBe(false);
    });

    it('should expire old QR codes', () => {
      const oldTimestamp = Date.now() - 90 * 60 * 1000; // 90 minutes ago
      const isExpired = isCardQrExpired(oldTimestamp, 60);
      expect(isExpired).toBe(true);
    });

    it('should use custom validity minutes', () => {
      const timestamp = Date.now() - 45 * 60 * 1000; // 45 minutes ago
      expect(isCardQrExpired(timestamp, 30)).toBe(true);
      expect(isCardQrExpired(timestamp, 60)).toBe(false);
    });
  });

  describe('formatCardNumber', () => {
    it('should return card number as is', () => {
      const cardNumber = 'SCH-2025-000001';
      expect(formatCardNumber(cardNumber)).toBe(cardNumber);
    });
  });

  describe('isCardExpired', () => {
    it('should return false for null expiry date', () => {
      expect(isCardExpired(null)).toBe(false);
      expect(isCardExpired(undefined)).toBe(false);
    });

    it('should return false for future expiry date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      expect(isCardExpired(futureDate)).toBe(false);
    });

    it('should return true for past expiry date', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      expect(isCardExpired(pastDate)).toBe(true);
    });
  });

  describe('parseQrData', () => {
    it('should parse valid QR data', () => {
      const validData = JSON.stringify({
        studentId: mockStudentId,
        schoolId: mockSchoolId,
        cardId: mockCardId,
        timestamp: Date.now(),
      });

      const parsed = parseQrData(validData);
      expect(parsed).toEqual({
        studentId: mockStudentId,
        schoolId: mockSchoolId,
        cardId: mockCardId,
        timestamp: expect.any(Number),
      });
    });

    it('should return null for invalid JSON', () => {
      expect(parseQrData('invalid-json')).toBeNull();
    });

    it('should return null for malformed data', () => {
      expect(parseQrData('not-json')).toBeNull();
    });
  });

  describe('generateCardFilePath', () => {
    it('should generate correct file path', () => {
      const path = generateCardFilePath(mockSchoolId, mockStudentId, mockCardId);
      expect(path).toBe(`${mockSchoolId}/${mockStudentId}/cards/${mockCardId}.pdf`);
    });
  });

  describe('calculatePaymentStatus', () => {
    it('should return ok for zero or negative balance', () => {
      expect(calculatePaymentStatus(0)).toBe('ok');
      expect(calculatePaymentStatus(-100)).toBe('ok');
    });

    it('should return warning for moderate balance', () => {
      const status = calculatePaymentStatus(150000, {
        warningThreshold: 100000,
        blockingThreshold: 500000,
      });
      expect(status).toBe('warning');
    });

    it('should return blocked for high balance', () => {
      const status = calculatePaymentStatus(600000, {
        warningThreshold: 100000,
        blockingThreshold: 500000,
      });
      expect(status).toBe('blocked');
    });

    it('should return ok for balance below warning threshold', () => {
      const status = calculatePaymentStatus(50000, {
        warningThreshold: 100000,
        blockingThreshold: 500000,
      });
      expect(status).toBe('ok');
    });

    it('should use default thresholds when not provided', () => {
      expect(calculatePaymentStatus(100000)).toBe('ok');
    });
  });

  describe('getCardStatusDisplayText', () => {
    it('should return correct display text for each status', () => {
      expect(getCardStatusDisplayText('active')).toBe('Active');
      expect(getCardStatusDisplayText('expired')).toBe('Expirée');
      expect(getCardStatusDisplayText('revoked')).toBe('Révoquée');
      expect(getCardStatusDisplayText('lost')).toBe('Perdue');
    });

    it('should return original status for unknown status', () => {
      expect(getCardStatusDisplayText('unknown' as any)).toBe('unknown');
    });
  });

  describe('getPaymentStatusDisplayText', () => {
    it('should return correct display text for each status', () => {
      expect(getPaymentStatusDisplayText('ok')).toBe('OK');
      expect(getPaymentStatusDisplayText('warning')).toBe('Attention');
      expect(getPaymentStatusDisplayText('blocked')).toBe('Bloqué');
    });

    it('should return original status for unknown status', () => {
      expect(getPaymentStatusDisplayText('unknown' as any)).toBe('unknown');
    });
  });
});
