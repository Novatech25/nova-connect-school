import type { SupabaseClient } from '@supabase/supabase-js';

export type DocumentType = 'report_card' | 'certificate' | 'student_card' | 'exam_authorization';

export interface DocumentAccessResult {
  accessGranted: boolean;
  paymentStatus: 'ok' | 'warning' | 'blocked';
  paymentStatusOverride: boolean;
  denialReason?: string;
}

/**
 * Check if a user can access a document based on payment status
 */
export async function checkDocumentAccess(
  supabase: SupabaseClient,
  documentType: DocumentType,
  documentId: string,
  studentId: string
): Promise<DocumentAccessResult> {
  const { data, error } = await supabase.functions.invoke('check-document-access', {
    body: { documentType, documentId, studentId }
  });

  if (error) {
    console.error('Error checking document access:', error);
    // Fail open: allow access on error to prevent blocking legitimate users
    return {
      accessGranted: true,
      paymentStatus: 'ok',
      paymentStatusOverride: false,
    };
  }

  return {
    accessGranted: data.accessGranted,
    paymentStatus: data.paymentStatus,
    paymentStatusOverride: data.paymentStatusOverride,
    denialReason: data.denialReason,
  };
}

/**
 * Get a user-friendly message for blocked document access
 */
export function getBlockedDocumentMessage(documentType: DocumentType): string {
  const messages: Record<DocumentType, string> = {
    report_card: 'Ce bulletin n\'est pas accessible en raison d\'arriérés de paiement.',
    certificate: 'Ce certificat n\'est pas accessible en raison d\'arriérés de paiement.',
    student_card: 'Cette carte scolaire n\'est pas accessible en raison d\'arriérés de paiement.',
    exam_authorization: 'Cette autorisation d\'examen n\'est pas accessible en raison d\'arriérés de paiement.',
  };
  return messages[documentType] + ' Veuillez contacter l\'administration.';
}
