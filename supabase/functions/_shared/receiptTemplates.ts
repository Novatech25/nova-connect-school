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
    marginTop: 12,
    marginBottom: 12,
    marginLeft: 18,
    marginRight: 18,
    fontSizeHeader: 14,
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

// Couleurs
const COLORS = {
  primary: [41, 98, 255],
  primaryDark: [13, 71, 161],
  secondary: [76, 175, 80],
  accent: [255, 152, 0],
  dark: [33, 37, 41],
  medium: [108, 117, 125],
  light: [248, 249, 250],
  white: [255, 255, 255],
  border: [222, 226, 230],
  gold: [255, 193, 7],
};

// Helpers
const sanitizeText = (value: any): string => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
};

const safeText = (value?: any) => sanitizeText(value ?? '');

const toNumber = (value?: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatAmount = (value?: any): string => {
  const num = toNumber(value);
  const numStr = num.toFixed(0);
  let formatted = '';
  for (let i = 0; i < numStr.length; i++) {
    if (i > 0 && (numStr.length - i) % 3 === 0) {
      formatted += ' ';
    }
    formatted += numStr[i];
  }
  return `${formatted} FCFA`;
};

const formatDateLong = (value?: any): string => {
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
  const left = config.marginLeft;
  const right = pageWidth - config.marginRight;
  const centerX = pageWidth / 2;
  const contentWidth = right - left;
  let yPos = config.marginTop;

  // ── Couleurs identiques au rapport PDF ─────────────────────────────
  const BLUE   = [30, 64, 175]  as [number, number, number]; // Bleu principal (rapport)
  const ACCENT = [99, 145, 255] as [number, number, number]; // Liseré / logo
  const GREEN  = [22, 163, 74]  as [number, number, number]; // Sections secondaires
  const WHITE  = [255, 255, 255] as [number, number, number];
  const DARK   = [33, 37, 41]   as [number, number, number];
  const MEDIUM = [100, 116, 139] as [number, number, number];
  const LIGHT  = [248, 249, 250] as [number, number, number];
  const BORDER = [222, 226, 230] as [number, number, number];

  // === EN-TÊTE : même fond bleu que le rapport ===
  const HEADER_H = 36;
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.rect(0, 0, pageWidth, HEADER_H, 'F');
  // Liseré bleu vif en bas (identique au rapport)
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, HEADER_H, pageWidth, 1.5, 'F');

  const LOGO_MARGIN = 12;
  let logoEndX = LOGO_MARGIN;

  // Carré initiales (le logo n'est pas disponible côté Edge Function sans fetch async)
  const schoolName = safeText(data.school?.name || 'Etablissement');
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.roundedRect(LOGO_MARGIN, 7, 20, 20, 3, 3, 'F');
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const ini = schoolName.charAt(0).toUpperCase();
  doc.text(ini, LOGO_MARGIN + 10, 20, { align: 'center' });
  logoEndX = LOGO_MARGIN + 24;

  // Nom de l'école
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(schoolName.toUpperCase(), logoEndX, 14);

  // Adresse
  const addrParts = [data.school?.address, data.school?.city, data.school?.country].filter(Boolean).map(safeText);
  if (addrParts.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 200, 240);
    doc.text(addrParts.join(', '), logoEndX, 21);
  }

  // Contact (tél / email)
  const contacts: string[] = [];
  if (data.school?.phone) contacts.push(`Tel: ${safeText(data.school.phone)}`);
  if (data.school?.email) contacts.push(`Email: ${safeText(data.school.email)}`);
  if (contacts.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 185, 230);
    doc.text(contacts.join('   '), logoEndX, 28);
  }

  // Titre REÇU à droite
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('RECU DE PAIEMENT', pageWidth - LOGO_MARGIN, 14, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 220, 255);
  doc.text('NovaConnect - Gestion Scolaire', pageWidth - LOGO_MARGIN, 22, { align: 'right' });

  yPos = HEADER_H + 8;

  // === BADGE N° REÇU + DATE ===
  doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(left, yPos, contentWidth, 18, 3, 3, 'FD');

  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('N Recu:', left + 5, yPos + 7);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.setFontSize(10);
  doc.text(safeText(data.receiptNumber), left + 24, yPos + 7);

  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Date:', right - 65, yPos + 7);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.setFontSize(10);
  doc.text(formatDateLong(data.date), right - 48, yPos + 7);

  doc.setTextColor(MEDIUM[0], MEDIUM[1], MEDIUM[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const refText = data.paymentReference ? `Ref: ${safeText(data.paymentReference)}` : 'Ref: --';
  doc.text(refText, left + 5, yPos + 14);

  yPos += 24;

  // === SECTIONS EN 2 COLONNES ===
  const colWidth = (contentWidth - 6) / 2;
  const col1X = left;
  const col2X = left + colWidth + 6;
  const startY = yPos;

  // Colonne 1: ÉLÈVE
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.roundedRect(col1X, yPos, colWidth, 8, 2, 2, 'F');
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('INFORMATIONS ELEVE', col1X + 4, yPos + 5.5);

  yPos += 11;
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFontSize(9);

  const studentRows: [string, string][] = [
    ['Nom:', `${data.student?.first_name || ''} ${data.student?.last_name || ''}`.trim() || '--'],
    ['Matricule:', safeText(data.student?.matricule || 'N/A')],
    ['Classe:', safeText(data.student?.class_name || 'N/A')],
  ];
  studentRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(safeText(label), col1X + 4, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(safeText(value), col1X + 24, yPos);
    yPos += 6.5;
  });

  // Colonne 2: PAIEMENT
  yPos = startY;
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.roundedRect(col2X, yPos, colWidth, 8, 2, 2, 'F');
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DETAILS PAIEMENT', col2X + 4, yPos + 5.5);

  yPos += 11;
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFontSize(9);

  const paymentRows: [string, string | undefined][] = [
    ['Type:', data.feeType?.name],
    ['Mode:', safeText(data.paymentMethod)],
    ['Caissier:', data.cashier ? `${data.cashier.first_name || ''} ${data.cashier.last_name || ''}`.trim() : undefined],
  ];
  paymentRows.forEach(([label, value]) => {
    if (value) {
      doc.setFont('helvetica', 'bold');
      doc.text(safeText(label), col2X + 4, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(safeText(value), col2X + 24, yPos);
      yPos += 6.5;
    }
  });

  yPos = Math.max(yPos, startY + 34) + 6;

  // === TABLEAU MONTANTS ===
  doc.setFillColor(255, 152, 0);
  doc.roundedRect(left, yPos, contentWidth, 8, 2, 2, 'F');
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DETAIL DES MONTANTS', left + 4, yPos + 5.5);

  yPos += 11;

  const colDesc = left + 4;
  const colAmt  = right - 4;
  const rowH = 6.5;

  doc.setFillColor(240, 240, 240);
  doc.rect(left + 1, yPos - 3.5, contentWidth - 2, rowH - 0.5, 'F');
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Description', colDesc, yPos);
  doc.text('Montant', colAmt, yPos, { align: 'right' });
  yPos += rowH;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const amountRows: [string, any][] = [
    ['Montant paye', data.amount],
    ['Montant total du', data.feeSchedule?.amount],
    ['Deja paye (cumule)', data.feeSchedule?.paid_amount],
    ['Remise accordee', data.feeSchedule?.discount_amount],
    ['Reste a payer', data.feeSchedule?.remaining_amount],
  ];
  amountRows.forEach(([desc, amount], idx) => {
    if (amount !== undefined && amount !== null) {
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(left + 1, yPos - 3.5, contentWidth - 2, rowH - 0.5, 'F');
      }
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.text(safeText(desc), colDesc, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(formatAmount(amount), colAmt, yPos, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      yPos += rowH;
    }
  });

  // Ligne total bleue (identique au rapport)
  yPos += 2;
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.roundedRect(left + 1, yPos - 3.5, contentWidth - 2, rowH + 1, 2, 2, 'F');
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL REGLE CETTE FOIS', colDesc, yPos + 0.5);
  doc.text(formatAmount(data.amount), colAmt, yPos + 0.5, { align: 'right' });

  yPos += rowH + 10;

  // === QR ET SIGNATURES ===
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

  if (config.showQR && qrCode) {
    const qrSize = 25;
    doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.roundedRect(left, yPos - 3, 88, qrSize + 9, 2, 2, 'FD');

    if (qrCode.dataUrl) {
      doc.addImage(qrCode.dataUrl, 'PNG', left + 3, yPos, qrSize, qrSize);
    } else if (qrCode.modules) {
      drawQrMatrix(qrCode.modules, left + 3, yPos, qrSize);
    }
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Verifier authenticite', left + qrSize + 8, yPos + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MEDIUM[0], MEDIUM[1], MEDIUM[2]);
    doc.text('Scannez ce QR code', left + qrSize + 8, yPos + 13);
  }

  // Signatures
  if (config.showSignature) {
    const sigX = right - 82;
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Signature caissier', sigX, yPos + 5);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(sigX, yPos + 13, sigX + 36, yPos + 13);

    doc.text('Signature parent / tuteur', sigX + 42, yPos + 5);
    doc.line(sigX + 42, yPos + 13, sigX + 82, yPos + 13);
  }

  // === PIED DE PAGE : même bleu que le rapport ========================
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `Document electronique authentifie - N ${safeText(data.receiptNumber)} - NovaConnect Gestion Scolaire`,
    centerX, pageHeight - 3, { align: 'center' }
  );

  return new Uint8Array(doc.output('arraybuffer'));
}


export function generateTeacherSalaryReceipt(
  data: ReceiptData,
  config: PrinterConfig,
  qrCode?: QrCodePayload
): Uint8Array {
  return generateStudentPaymentReceipt(data, config, qrCode);
}
