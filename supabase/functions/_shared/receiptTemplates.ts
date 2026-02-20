import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';

export interface ReceiptData {
  school: any;
  receiptNumber: string;
  date: Date;
  amount: number;
  paymentMethod: string;
  paymentId?: string;
  paymentReference?: string;
  paymentNotes?: string;
  status?: string;
  verificationUrl?: string;
  cashier?: any;
  student?: any;
  feeType?: any;
  feeSchedule?: any;
  paymentNature?: string;
  periodCoverage?: string;
  discount?: number;
  arrears?: number;
  teacher?: any;
  payrollEntry?: any;
  salaryComponents?: any[];
  hoursWorked?: number;
  hourlyRate?: number;
  grossAmount?: number;
  primesAmount?: number;
  retenuesAmount?: number;
  avancesAmount?: number;
}

export interface QrCodePayload {
  dataUrl?: string;
  modules?: boolean[][];
}

export interface PrinterConfig {
  type: 'A4_STANDARD' | 'THERMAL_80' | 'THERMAL_58';
  width: number;
  height: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  fontSizeHeader: number;
  fontSizeBody: number;
  fontSizeFooter: number;
  showLogo: boolean;
  showQR: boolean;
  showSignature: boolean;
}

export const DEFAULT_CONFIGS: Record<string, PrinterConfig> = {
  A4_STANDARD: {
    type: 'A4_STANDARD',
    width: 210,
    height: 297,
    marginTop: 15,
    marginBottom: 15,
    marginLeft: 20,
    marginRight: 20,
    fontSizeHeader: 16,
    fontSizeBody: 10,
    fontSizeFooter: 8,
    showLogo: true,
    showQR: true,
    showSignature: true,
  },
  THERMAL_80: {
    type: 'THERMAL_80',
    width: 80,
    height: 0,
    marginTop: 5,
    marginBottom: 5,
    marginLeft: 5,
    marginRight: 5,
    fontSizeHeader: 12,
    fontSizeBody: 9,
    fontSizeFooter: 7,
    showLogo: false,
    showQR: true,
    showSignature: false,
  },
  THERMAL_58: {
    type: 'THERMAL_58',
    width: 58,
    height: 0,
    marginTop: 3,
    marginBottom: 3,
    marginLeft: 3,
    marginRight: 3,
    fontSizeHeader: 10,
    fontSizeBody: 8,
    fontSizeFooter: 6,
    showLogo: false,
    showQR: false,
    showSignature: false,
  },
};

// Helper functions
const numberFormatter = new Intl.NumberFormat('fr-FR');

const sanitizeText = (value: any): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
};

const formatAmount = (value: any): string => {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  return `${numberFormatter.format(num)} FCFA`;
};

const formatDate = (value: any): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatDateLong = (value: any): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

export function generateStudentPaymentReceipt(
  data: ReceiptData,
  config: PrinterConfig,
  qrCode?: QrCodePayload
): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let y = 15;

  // ===== EN-TÊTE AVEC FOND BLEU =====
  doc.setFillColor(41, 98, 255);
  doc.rect(margin - 5, y - 5, contentWidth + 10, 40, 'F');
  
  // Ligne dorée
  doc.setFillColor(255, 193, 7);
  doc.rect(margin - 5, y - 5, contentWidth + 10, 3, 'F');

  // Nom de l'école
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const schoolName = sanitizeText(data.school?.name || 'ÉCOLE').toUpperCase();
  doc.text(schoolName, pageWidth / 2, y + 12, { align: 'center' });

  // Adresse et contact
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const address = [data.school?.address, data.school?.city, data.school?.country]
    .filter(Boolean)
    .join(', ');
  if (address) {
    doc.text(sanitizeText(address), pageWidth / 2, y + 20, { align: 'center' });
  }
  
  const contacts = [];
  if (data.school?.phone) contacts.push(`Tél: ${sanitizeText(data.school.phone)}`);
  if (data.school?.email) contacts.push(`Email: ${sanitizeText(data.school.email)}`);
  if (contacts.length > 0) {
    doc.text(contacts.join(' | '), pageWidth / 2, y + 27, { align: 'center' });
  }

  y += 45;

  // ===== BADGE REÇU DE PAIEMENT =====
  const badgeWidth = 75;
  const badgeHeight = 12;
  const badgeX = (pageWidth - badgeWidth) / 2;
  
  doc.setFillColor(255, 193, 7);
  doc.setDrawColor(255, 152, 0);
  doc.setLineWidth(0.5);
  doc.roundedRect(badgeX, y, badgeWidth, badgeHeight, 3, 3, 'FD');
  
  doc.setTextColor(33, 37, 41);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('REÇU DE PAIEMENT', pageWidth / 2, y + 8, { align: 'center' });

  y += 20;

  // ===== INFORMATIONS DU REÇU =====
  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(222, 226, 230);
  doc.roundedRect(margin, y, contentWidth, 25, 3, 3, 'FD');

  doc.setTextColor(33, 37, 41);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('N° Reçu:', margin + 5, y + 8);
  doc.setTextColor(41, 98, 255);
  doc.text(sanitizeText(data.receiptNumber), margin + 30, y + 8);

  doc.setTextColor(33, 37, 41);
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin + contentWidth - 80, y + 8);
  doc.setTextColor(41, 98, 255);
  doc.text(formatDateLong(data.date), margin + contentWidth - 60, y + 8);

  doc.setTextColor(108, 117, 125);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Référence: ${sanitizeText(data.paymentReference || 'N/A')}`, margin + 5, y + 18);

  y += 32;

  // ===== SECTION ÉLÈVE =====
  doc.setFillColor(41, 98, 255);
  doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('INFORMATIONS DE L\'ÉLÈVE', margin + 5, y + 7);

  y += 15;

  // Données élève
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(10);
  
  const studentInfo = [
    ['Nom complet:', `${data.student?.first_name || ''} ${data.student?.last_name || ''}`.trim()],
    ['Matricule:', data.student?.matricule || 'N/A'],
    ['Classe:', data.student?.class_name || 'N/A'],
  ];

  studentInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(sanitizeText(label), margin + 5, y);
    doc.setFont('helvetica', 'normal');
    doc.text(sanitizeText(value) || 'N/A', margin + 45, y);
    y += 7;
  });

  y += 5;

  // ===== SECTION DÉTAILS DU PAIEMENT =====
  doc.setFillColor(76, 175, 80);
  doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DÉTAILS DU PAIEMENT', margin + 5, y + 7);

  y += 15;

  // Données paiement
  doc.setTextColor(33, 37, 41);
  
  const paymentDetails = [
    ['Type de frais:', data.feeType?.name],
    ['Nature:', data.paymentNature],
    ['Période couverte:', data.periodCoverage],
    ['Mode de paiement:', data.paymentMethod],
    ['Caissier:', data.cashier ? `${data.cashier.first_name} ${data.cashier.last_name}`.trim() : null],
  ];

  paymentDetails.forEach(([label, value]) => {
    if (value) {
      doc.setFont('helvetica', 'bold');
      doc.text(sanitizeText(label), margin + 5, y);
      doc.setFont('helvetica', 'normal');
      doc.text(sanitizeText(value), margin + 50, y);
      y += 7;
    }
  });

  y += 5;

  // ===== SECTION MONTANTS =====
  doc.setFillColor(255, 152, 0);
  doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DÉTAIL DES MONTANTS', margin + 5, y + 7);

  y += 15;

  // Tableau des montants
  const colDesc = margin + 5;
  const colAmount = margin + contentWidth - 5;
  const rowHeight = 8;

  // En-tête tableau
  doc.setFillColor(240, 240, 240);
  doc.rect(margin + 2, y - 5, contentWidth - 4, rowHeight, 'F');
  doc.setTextColor(33, 37, 41);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Description', colDesc, y);
  doc.text('Montant', colAmount, y, { align: 'right' });

  y += rowHeight;

  // Lignes du tableau
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const amountRows = [
    ['Montant payé', data.amount],
    ['Montant total dû', data.feeSchedule?.amount],
    ['Déjà payé (cumulé)', data.feeSchedule?.paid_amount],
    ['Remise accordée', data.discount || data.feeSchedule?.discount_amount],
    ['Arriérés', data.arrears],
  ];

  amountRows.forEach(([desc, amount], idx) => {
    if (amount !== undefined && amount !== null) {
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin + 2, y - 5, contentWidth - 4, rowHeight, 'F');
      }
      doc.setTextColor(33, 37, 41);
      doc.text(sanitizeText(desc), colDesc, y);
      doc.setFont('helvetica', 'bold');
      doc.text(formatAmount(amount), colAmount, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += rowHeight;
    }
  });

  // Reste à payer
  const remaining = data.feeSchedule?.remaining_amount || 0;
  if (remaining > 0) {
    y += 3;
    doc.setFillColor(255, 152, 0);
    doc.roundedRect(margin + 2, y - 5, contentWidth - 4, rowHeight, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('RESTE À PAYER', colDesc, y);
    doc.text(formatAmount(remaining), colAmount, y, { align: 'right' });
    y += rowHeight + 5;
  }

  // Total réglé (mis en évidence)
  y += 3;
  doc.setFillColor(76, 175, 80);
  doc.roundedRect(margin + 2, y - 5, contentWidth - 4, rowHeight + 2, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL RÉGLÉ CETTE FOIS', colDesc, y + 1);
  doc.text(formatAmount(data.amount), colAmount, y + 1, { align: 'right' });

  y += rowHeight + 10;

  // Notes
  if (data.paymentNotes || data.feeSchedule?.discount_reason) {
    doc.setTextColor(108, 117, 125);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    if (data.feeSchedule?.discount_reason) {
      doc.text(`Motif de la remise: ${sanitizeText(data.feeSchedule.discount_reason)}`, margin + 5, y);
      y += 5;
    }
    
    if (data.paymentNotes) {
      const noteLines = doc.splitTextToSize(sanitizeText(`Notes: ${data.paymentNotes}`), contentWidth - 10);
      doc.text(noteLines, margin + 5, y);
      y += noteLines.length * 5;
    }
    y += 5;
  }

  // ===== SIGNATURES =====
  if (config.showSignature && y < pageHeight - 60) {
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    
    const sigY = y;
    const lineWidth = 60;
    
    doc.setTextColor(33, 37, 41);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Signature du caissier', margin + 5, sigY);
    doc.line(margin + 5, sigY + 10, margin + 5 + lineWidth, sigY + 10);
    
    doc.text('Signature du parent/tuteur', margin + contentWidth - lineWidth - 5, sigY, { align: 'left' });
    doc.line(margin + contentWidth - lineWidth - 5, sigY + 10, margin + contentWidth - 5, sigY + 10);
    
    y = sigY + 20;
  }

  // ===== QR CODE =====
  const drawQrMatrix = (modules: boolean[][], x: number, y: number, size: number) => {
    const count = modules.length;
    if (count === 0) return;
    const marginModules = 4;
    const totalModules = count + marginModules * 2;
    const cell = size / totalModules;
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, cell * totalModules, cell * totalModules, 'F');
    doc.setFillColor(0, 0, 0);
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (modules[row][col]) {
          doc.rect(x + (col + marginModules) * cell, y + (row + marginModules) * cell, cell, cell, 'F');
        }
      }
    }
  };

  if (config.showQR && qrCode && y < pageHeight - 50) {
    const qrSize = 28;
    const qrY = Math.min(y, pageHeight - 50);
    
    // Cadre
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(222, 226, 230);
    doc.roundedRect(margin, qrY - 3, contentWidth, qrSize + 16, 3, 3, 'FD');
    
    // QR
    if (qrCode.dataUrl) {
      doc.addImage(qrCode.dataUrl, 'PNG', margin + 5, qrY, qrSize, qrSize);
    } else if (qrCode.modules) {
      drawQrMatrix(qrCode.modules, margin + 5, qrY, qrSize);
    }
    
    // Texte
    doc.setTextColor(33, 37, 41);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Vérification du reçu', margin + qrSize + 12, qrY + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(108, 117, 125);
    doc.text('Scannez ce QR code pour vérifier', margin + qrSize + 12, qrY + 15);
    doc.text('l\'authenticité de ce document', margin + qrSize + 12, qrY + 21);
    
    if (data.verificationUrl) {
      doc.setTextColor(41, 98, 255);
      doc.setFontSize(7);
      const url = sanitizeText(data.verificationUrl);
      doc.text(url.length > 60 ? url.substring(0, 60) + '...' : url, margin + qrSize + 12, qrY + 28);
    }
  }

  // ===== PIED DE PAGE =====
  const footerY = pageHeight - 12;
  
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 5, margin + contentWidth, footerY - 5);
  
  doc.setTextColor(108, 117, 125);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Reçu généré par NovaConnect School - Système de gestion scolaire', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Document électronique authentifié - N° ${sanitizeText(data.receiptNumber)}`, pageWidth / 2, footerY + 4, { align: 'center' });

  return new Uint8Array(doc.output('arraybuffer'));
}

export function generateTeacherSalaryReceipt(
  data: ReceiptData,
  config: PrinterConfig,
  qrCode?: QrCodePayload
): Uint8Array {
  // Pour l'instant, utiliser la même fonction
  return generateStudentPaymentReceipt(data, config, qrCode);
}
