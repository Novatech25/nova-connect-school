import { getBlockedDocumentMessage } from '../documentAccess';

describe('documentAccess', () => {
  it('should return correct message for report_card', () => {
    const message = getBlockedDocumentMessage('report_card');
    expect(message).toContain('bulletin');
    expect(message).toContain('arriérés de paiement');
  });

  it('should return correct message for certificate', () => {
    const message = getBlockedDocumentMessage('certificate');
    expect(message).toContain('certificat');
  });

  it('should return correct message for student_card', () => {
    const message = getBlockedDocumentMessage('student_card');
    expect(message).toContain('carte scolaire');
  });

  it('should return correct message for exam_authorization', () => {
    const message = getBlockedDocumentMessage('exam_authorization');
    expect(message).toContain('autorisation');
  });
});
