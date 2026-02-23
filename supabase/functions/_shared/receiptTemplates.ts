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
    fontSizeHeader: 18,
    fontSizeBody: 11,
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

// Couleurs professionnelles
const COLORS = {
  primary: [41, 98, 255],      // Bleu professionnel
  primaryDark: [13, 71, 161],   // Bleu foncé
  secondary: [76, 175, 80],     // Vert succès
  accent: [255, 152, 0],        // Orange accent
  dark: [33, 37, 41],           // Gris foncé texte
  medium: [108, 117, 125],      // Gris moyen
  light: [248, 249, 250],       // Gris très clair
  white: [255, 255, 255],
  border: [222, 226, 230],      // Bordure grise
  gold: [255, 193, 7],          // Or pour badge
};

const numberFormatter = new Intl.NumberFormat('fr-FR');

const normalizeSpacing = (value: string) => value.replace(/\u202F|\u00A0/g, ' ');

const stripAmpersandArtifacts = (value: string) => {
  const ampCount = (value.match(/&/g) || []).length;
  if (ampCount === 0) return value;
  const ampRatio = ampCount / Math.max(value.length, 1);
  if (ampRatio > 0.2) {
    return value.replace(/&(?=[A-Za-z0-9])/g, '');
  }
  return value;
};

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

const sanitizeText = (value: string) => {
  const decoded = decodeHtmlEntities(value);
  const normalized = stripAmpersandArtifacts(normalizeSpacing(decoded));
  return normalized.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '');
};

const safeText = (value?: string | number | null) => sanitizeText(String(value ?? ''));

const toNumber = (value?: number | string | null) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatAmount = (value?: number | string | null) =>
  `${sanitizeText(numberFormatter.format(toNumber(value)))} FCFA`;

const formatDate = (value?: Date | string | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);
  return sanitizeText(date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }));
};

const formatDateLong = (value?: Date | string | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);
  return sanitizeText(date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }));
};

export function generateStudentPaymentReceipt(
  data: ReceiptData,
  config: PrinterConfig,
  qrCode?: QrCodePayload
): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: config.type === 'A4_STANDARD' ? 'a4' : [config.width, 200],
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = config.marginLeft;
  const right = pageWidth - config.marginRight;
  const centerX = pageWidth / 2;
  const contentWidth = right - left;

  let yPos = config.marginTop;

  // === EN-TÊTE PROFESSIONNEL AVEC DÉGRADÉ ===
  const headerHeight = 45;
  
  // Fond dégradé bleu
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(left - 3, yPos - 6, contentWidth + 6, headerHeight, 'F');
  
  // Ligne dorée décorative en haut
  doc.setFillColor(COLORS.gold[0], COLORS.gold[1], COLORS.gold[2]);
  doc.rect(left - 3, yPos - 6, contentWidth + 6, 3, 'F');

  // Nom de l'école en blanc et gras
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(config.fontSizeHeader + 4);
  const schoolName = safeText(data.school.name || 'ECOLE').toUpperCase();
  doc.text(schoolName, centerX, yPos + 12, { align: 'center' });

  // Informations de contact
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(config.fontSizeBody - 1);
  
  const contactInfo = [];
  if (data.school.address) contactInfo.push(safeText(data.school.address));
  if (data.school.phone) contactInfo.push(`Tél: ${safeText(data.school.phone)}`);
  if (data.school.email) contactInfo.push(`Email: ${safeText(data.school.email)}`);
  
  let contactY = yPos + 20;
  contactInfo.forEach((info, idx) => {
    if (idx < 3) {
      doc.text(info, centerX, contactY, { align: 'center' });
      contactY += 5;
    }
  });

  yPos += headerHeight + 5;

  // === BADGE "REÇU DE PAIEMENT" ===
  const badgeWidth = 70;
  const badgeHeight = 12;
  const badgeX = centerX - badgeWidth / 2;
  
  // Fond du badge
  doc.setFillColor(COLORS.gold[0], COLORS.gold[1], COLORS.gold[2]);
  doc.roundedRect(badgeX, yPos, badgeWidth, badgeHeight, 2, 2, 'F');
  
  // Bordure du badge
  doc.setDrawColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(badgeX, yPos, badgeWidth, badgeHeight, 2, 2, 'S');
  
  // Texte du badge
  doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(config.fontSizeBody + 1);
  doc.text('REÇU DE PAIEMENT', centerX, yPos + 8, { align: 'center' });

  yPos += badgeHeight + 8;

  // === INFORMATIONS DU REÇU (Numéro et Date) ===
  const infoBoxHeight = 22;
  doc.setFillColor(COLORS.light[0], COLORS.light[1], COLORS.light[2]);
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.roundedRect(left, yPos, contentWidth, infoBoxHeight, 3, 3, 'FD');

  doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(config.fontSizeBody);
  
  doc.text(`N° Reçu:`, left + 5, yPos + 8);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text(safeText(data.receiptNumber), left + 30, yPos + 8);
  
  doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  doc.text(`Date:`, right - 60, yPos + 8);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text(formatDateLong(data.date), right - 45, yPos + 8);

  doc.setTextColor(COLORS.medium[0], COLORS.medium[1], COLORS.medium[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(config.fontSizeBody - 1);
  doc.text(`Référence: ${safeText(data.paymentReference || 'N/A')}`, left + 5, yPos + 16);

  yPos += infoBoxHeight + 10;

  // === SECTION ÉLÈVE ===
  const sectionTitle = (title: string, color: number[]) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.roundedRect(left, yPos, contentWidth, 10, 2, 2, 'F');
    doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(config.fontSizeBody);
    doc.text(safeText(title).toUpperCase(), left + 5, yPos + 7);
    yPos += 14;
  };

  sectionTitle('👤 Informations de l\'élève', COLORS.primary);

  // Détails de l'élève en grille
  const studentInfo = [
    ['Nom complet:', `${data.student?.first_name || ''} ${data.student?.last_name || ''}`.trim()],
    ['Matricule:', data.student?.matricule || 'N/A'],
    ['Classe:', data.student?.class_name || 'N/A'],
  ];

  doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  doc.setFontSize(config.fontSizeBody);
  
  studentInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(safeText(label), left + 5, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(safeText(value), left + 45, yPos);
    yPos += 7;
  });

  yPos += 5;

  // === SECTION DÉTAILS DU PAIEMENT ===
  sectionTitle('💳 Détails du paiement', COLORS.secondary);

  const paymentDetails = [
    ['Type de frais:', data.feeType?.name || 'N/A'],
    ['Nature:', data.paymentNature || 'Paiement normal'],
    ['Période couverte:', data.periodCoverage || 'N/A'],
    ['Mode de paiement:', data.paymentMethod || 'N/A'],
    ['Caissier:', data.cashier ? `${data.cashier.first_name} ${data.cashier.last_name}`.trim() : 'N/A'],
  ];

  paymentDetails.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(safeText(label), left + 5, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(safeText(value), left + 50, yPos);
    yPos += 7;
  });

  yPos += 5;

  // === TABLEAU DES MONTANTS ===
  sectionTitle('💰 Détail des montants', COLORS.accent);

  // En-têtes du tableau
  const col1Width = 80;
  const col2Width = contentWidth - col1Width - 10;
  const rowHeight = 8;

  doc.setFillColor(COLORS.light[0], COLORS.light[1], COLORS.light[2]);
  doc.rect(left + 5, yPos - 5, contentWidth - 10, rowHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(config.fontSizeBody);
  doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  doc.text('Description', left + 8, yPos);
  doc.text('Montant', left + col1Width + 10, yPos);
  yPos += rowHeight;

  // Lignes du tableau
  const tableRows = [
    ['Montant payé', formatAmount(data.amount)],
    ['Remise accordée', data.discount || data.feeSchedule?.discount_amount ? formatAmount(data.discount || data.feeSchedule?.discount_amount) : '-'],
    ['Arriérés', data.arrears ? formatAmount(data.arrears) : '-'],
    ['Montant total dû', formatAmount(data.feeSchedule?.amount)],
  ];

  doc.setFont('helvetica', 'normal');
  tableRows.forEach(([desc, amount], idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(left + 5, yPos - 5, contentWidth - 10, rowHeight, 'F');
    }
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.text(safeText(desc), left + 8, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(safeText(amount), right - 8, yPos, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    yPos += rowHeight;
  });

  // Total payé
  yPos += 3;
  doc.setFillColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
  doc.roundedRect(left + 5, yPos - 5, contentWidth - 10, rowHeight + 2, 2, 2, 'F');
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(config.fontSizeBody + 1);
  doc.text('TOTAL RÉGLÉ', left + 8, yPos + 1);
  doc.text(formatAmount(data.amount), right - 8, yPos + 1, { align: 'right' });

  yPos += rowHeight + 8;

  // Reste à payer
  const remaining = data.feeSchedule?.remaining_amount || 0;
  if (remaining > 0) {
    doc.setFillColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
    doc.roundedRect(left + 5, yPos - 5, contentWidth - 10, rowHeight, 2, 2, 'F');
    doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(config.fontSizeBody);
    doc.text('RESTE À PAYER', left + 8, yPos);
    doc.text(formatAmount(remaining), right - 8, yPos, { align: 'right' });
    yPos += rowHeight + 5;
  }

  // Notes
  if (data.paymentNotes || data.feeSchedule?.discount_reason) {
    yPos += 3;
    doc.setTextColor(COLORS.medium[0], COLORS.medium[1], COLORS.medium[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(config.fontSizeBody - 1);
    
    if (data.feeSchedule?.discount_reason) {
      const noteText = `Motif remise: ${safeText(data.feeSchedule.discount_reason)}`;
      const noteLines = doc.splitTextToSize(noteText, contentWidth - 10);
      doc.text(noteLines, left + 5, yPos);
      yPos += noteLines.length * 5;
    }
    
    if (data.paymentNotes) {
      const noteLines = doc.splitTextToSize(safeText(`Notes: ${data.paymentNotes}`), contentWidth - 10);
      doc.text(noteLines, left + 5, yPos);
      yPos += noteLines.length * 5;
    }
  }

  yPos += 10;

  // === SECTION SIGNATURES ===
  if (config.showSignature) {
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.setLineWidth(0.3);
    
    const sigY = yPos;
    const lineWidth = 60;
    
    // Signature caissier
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(config.fontSizeBody - 1);
    doc.text('Signature du caissier', left + 5, sigY);
    doc.line(left + 5, sigY + 8, left + 5 + lineWidth, sigY + 8);
    
    // Signature parent
    doc.text('Signature du parent / tuteur', right - lineWidth - 5, sigY, { align: 'left' });
    doc.line(right - lineWidth - 5, sigY + 8, right - 5, sigY + 8);
    
    yPos = sigY + 20;
  }

  // === SECTION QR CODE ET VÉRIFICATION ===
  const drawQrMatrix = (modules: boolean[][], x: number, y: number, size: number) => {
    const count = modules.length;
    if (count === 0) return;
    const marginModules = 4;
    const totalModules = count + marginModules * 2;
    const cell = size / totalModules;
    const qrSizeActual = cell * totalModules;
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, qrSizeActual, qrSizeActual, 'F');
    doc.setFillColor(0, 0, 0);
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (modules[row][col]) {
          doc.rect(
            x + (col + marginModules) * cell,
            y + (row + marginModules) * cell,
            cell,
            cell,
            'F'
          );
        }
      }
    }
  };

  if (config.showQR && qrCode) {
    const qrSize = 30;
    const qrY = Math.min(yPos, pageHeight - config.marginBottom - qrSize - 20);
    
    // Cadre de vérification
    doc.setFillColor(COLORS.light[0], COLORS.light[1], COLORS.light[2]);
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.roundedRect(left, qrY - 5, contentWidth, qrSize + 15, 3, 3, 'FD');
    
    // QR Code
    if (qrCode.dataUrl) {
      doc.addImage(qrCode.dataUrl, 'PNG', left + 5, qrY, qrSize, qrSize);
    } else if (qrCode.modules) {
      drawQrMatrix(qrCode.modules, left + 5, qrY, qrSize);
    }
    
    // Texte de vérification
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(config.fontSizeBody);
    doc.text('Vérification du reçu', left + qrSize + 10, qrY + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(config.fontSizeBody - 1);
    doc.setTextColor(COLORS.medium[0], COLORS.medium[1], COLORS.medium[2]);
    doc.text('Scannez ce QR code pour vérifier', left + qrSize + 10, qrY + 14);
    doc.text('l\'authenticité de ce document', left + qrSize + 10, qrY + 19);
    
    if (data.verificationUrl) {
      doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
      doc.setFontSize(config.fontSizeFooter);
      const urlText = safeText(data.verificationUrl.substring(0, 50) + '...');
      doc.text(urlText, left + qrSize + 10, qrY + 26);
    }
  }

  // === PIED DE PAGE ===
  const footerY = pageHeight - config.marginBottom + 5;
  
  // Ligne de séparation
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.5);
  doc.line(left, footerY - 5, right, footerY - 5);
  
  // Texte du footer
  doc.setTextColor(COLORS.medium[0], COLORS.medium[1], COLORS.medium[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(config.fontSizeFooter);
  doc.text('Reçu généré par NovaConnect School - Système de gestion scolaire', centerX, footerY, { align: 'center' });
  doc.text(`Document électronique authentifié - N° ${safeText(data.receiptNumber)}`, centerX, footerY + 4, { align: 'center' });

  // Watermark "ANNULE" si nécessaire
  const statusValue = safeText(data.status || '').toLowerCase();
  if (statusValue === 'cancelled' || statusValue === 'canceled' || statusValue === 'annule' || statusValue === 'annulée' || statusValue === 'annulee') {
    doc.setTextColor(220, 220, 220);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(60);
    doc.text('ANNULE', centerX, pageHeight / 2, { align: 'center', angle: 30 });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

export function generateTeacherSalaryReceipt(
  data: ReceiptData,
  config: PrinterConfig,
  qrCode?: QrCodePayload
): Uint8Array {
  // Pour l'instant, utiliser la même fonction avec des ajustements
  // ou créer une version améliorée similaire
  return generateStudentPaymentReceipt(data, config, qrCode);
}
