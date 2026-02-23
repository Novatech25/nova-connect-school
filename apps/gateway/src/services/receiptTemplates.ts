import { jsPDF } from 'jspdf';

export interface ReceiptData {
  school: any;
  receiptNumber: string;
  date: Date;
  amount: number;
  paymentMethod: string;
  cashier?: any; // Person who recorded the payment
  // Student payment specific
  student?: any;
  feeType?: any;
  feeSchedule?: any;
  paymentNature?: string; // "Avance", "Solde", "Acompte", etc.
  periodCoverage?: string; // "Janvier 2026", "1er Trimestre 2025-2026", etc.
  discount?: number;
  arrears?: number;
  // Teacher salary specific
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
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 20,
    marginRight: 20,
    fontSizeHeader: 16,
    fontSizeBody: 11,
    fontSizeFooter: 8,
    showLogo: true,
    showQR: true,
    showSignature: true,
  },
  THERMAL_80: {
    type: 'THERMAL_80',
    width: 80,
    height: 0, // Auto height
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

// Formateur montant ASCII-safe (pas de toLocaleString pour éviter les espaces insécables)
const formatAmount = (value?: number | null): string => {
  const v = typeof value === 'number' ? value : 0;
  const parts = Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${parts} FCFA`;
};

const safeText = (value?: any): string => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
};

export function generateStudentPaymentReceipt(
  data: ReceiptData,
  config: PrinterConfig,
  qrDataUrl?: string
): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: config.type === 'A4_STANDARD' ? 'a4' : [config.width, 200],
  });

  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left    = config.marginLeft;
  const right   = pageWidth - config.marginRight;
  const centerX = pageWidth / 2;
  const contentWidth = right - left;
  let yPos = 0;

  // ── Couleurs identiques au rapport PDF ─────────────────────────
  const BLUE   : [number,number,number] = [30,  64, 175]; // Bleu principal (rapport)
  const ACCENT : [number,number,number] = [99, 145, 255]; // Liseré / logo
  const GREEN  : [number,number,number] = [22, 163, 74];  // Colonnes secondaires
  const WHITE  : [number,number,number] = [255, 255, 255];
  const DARK   : [number,number,number] = [33,  37,  41];
  const MEDIUM : [number,number,number] = [100, 116, 139];
  const LIGHT  : [number,number,number] = [248, 249, 250];
  const BORDER : [number,number,number] = [222, 226, 230];

  // === EN-TÊTE : même fond bleu que le rapport ============================
  const HEADER_H = 36;
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.rect(0, 0, pageWidth, HEADER_H, 'F');
  // Liseré bleu vif en bas (identique au rapport)
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, HEADER_H, pageWidth, 1.5, 'F');

  const LM = 12; // logo margin
  const schoolName = safeText(data.school?.name || 'Etablissement');

  // Carré initiales
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.roundedRect(LM, 7, 20, 20, 3, 3, 'F');
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(schoolName.charAt(0).toUpperCase(), LM + 10, 20, { align: 'center' });
  const logoEndX = LM + 24;

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

  // Contact
  const contacts: string[] = [];
  if (data.school?.phone) contacts.push(`Tel: ${safeText(data.school.phone)}`);
  if (data.school?.email) contacts.push(`Email: ${safeText(data.school.email)}`);
  if (contacts.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 185, 230);
    doc.text(contacts.join('   '), logoEndX, 28);
  }

  // Titre à droite
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('RECU DE PAIEMENT', pageWidth - LM, 14, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 220, 255);
  doc.text('NovaConnect - Gestion Scolaire', pageWidth - LM, 22, { align: 'right' });

  yPos = HEADER_H + 8;

  // === BADGE N° + DATE =================================================
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
  doc.text('Date:', right - 55, yPos + 7);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.setFontSize(9);
  doc.text(data.date.toLocaleDateString('fr-FR'), right - 38, yPos + 7);

  doc.setTextColor(MEDIUM[0], MEDIUM[1], MEDIUM[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Mode: ${safeText(data.paymentMethod)}`, left + 5, yPos + 14);

  yPos += 24;

  // === 2 COLONNES : ÉLÈVE / PAIEMENT ====================================
  const colW  = (contentWidth - 6) / 2;
  const col1X = left;
  const col2X = left + colW + 6;
  const startY = yPos;

  // Colonne 1 : Élève
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.roundedRect(col1X, yPos, colW, 8, 2, 2, 'F');
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('INFORMATIONS ELEVE', col1X + 4, yPos + 5.5);
  yPos += 11;
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFontSize(9);

  if (data.student) {
    const rows1: [string, string][] = [
      ['Nom:', `${data.student.first_name || ''} ${data.student.last_name || ''}`.trim()],
      ['Matricule:', safeText(data.student.matricule || 'N/A')],
      ['Classe:', safeText(data.student.class_name || 'N/A')],
    ];
    rows1.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(safeText(label), col1X + 4, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(safeText(value), col1X + 24, yPos);
      yPos += 6.5;
    });
  }

  // Colonne 2 : Paiement
  yPos = startY;
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.roundedRect(col2X, yPos, colW, 8, 2, 2, 'F');
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DETAILS PAIEMENT', col2X + 4, yPos + 5.5);
  yPos += 11;
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.setFontSize(9);

  const rows2: [string, string | undefined][] = [
    ['Type:', data.feeType?.name],
    ['Nature:', data.paymentNature],
    ['Caissier:', data.cashier ? `${data.cashier.first_name || ''} ${data.cashier.last_name || ''}`.trim() : undefined],
  ];
  rows2.forEach(([label, value]) => {
    if (value) {
      doc.setFont('helvetica', 'bold');
      doc.text(safeText(label), col2X + 4, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(safeText(value), col2X + 24, yPos);
      yPos += 6.5;
    }
  });

  yPos = Math.max(yPos, startY + 34) + 6;

  // === TABLEAU MONTANTS =================================================
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

  const amountItems: [string, number | null | undefined][] = [
    ['Montant paye', data.amount],
    data.feeSchedule ? ['Montant total du', data.feeSchedule.amount] : null,
    data.feeSchedule ? ['Deja paye (cumule)', data.feeSchedule.paid_amount] : null,
    data.discount && data.discount > 0 ? ['Remise accordee', data.discount] : null,
    data.feeSchedule ? ['Reste a payer', data.feeSchedule.remaining_amount] : null,
  ].filter(Boolean) as [string, number | null | undefined][];

  amountItems.forEach(([desc, amount], idx) => {
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

  // === SITUATION (solde échéance) =======================================
  if (data.feeSchedule) {
    doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.roundedRect(left, yPos, contentWidth, 8, 2, 2, 'FD');
    doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('SITUATION ECHEANCE', left + 4, yPos + 5.5);
    yPos += 11;
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total du: ${formatAmount(data.feeSchedule.amount)}`, left + 4, yPos);
    doc.text(`Total paye: ${formatAmount(data.feeSchedule.paid_amount)}`, left + 4, yPos + 7);
    doc.text(`Reste: ${formatAmount(data.feeSchedule.remaining_amount)}`, left + 4, yPos + 14);
    yPos += 22;
  }

  // === QR CODE =========================================================
  if (config.showQR && qrDataUrl) {
    const qrSize = config.type === 'A4_STANDARD' ? 28 : 20;
    doc.setFillColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.roundedRect(left, yPos - 3, qrSize + 50, qrSize + 9, 2, 2, 'FD');
    doc.addImage(qrDataUrl, 'PNG', left + 3, yPos, qrSize, qrSize);
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Verifier authenticite', left + qrSize + 8, yPos + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MEDIUM[0], MEDIUM[1], MEDIUM[2]);
    doc.text('Scannez ce QR code', left + qrSize + 8, yPos + 13);
    yPos += qrSize + 10;
  }

  // === SIGNATURES =======================================================
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
    `Document electronique - N ${safeText(data.receiptNumber)} - NovaConnect Gestion Scolaire`,
    centerX, pageHeight - 3, { align: 'center' }
  );

  return new Uint8Array(doc.output('arraybuffer'));
}


export function generateTeacherSalaryReceipt(
  data: ReceiptData,
  config: PrinterConfig,
  qrDataUrl?: string
): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: config.type === 'A4_STANDARD' ? 'a4' : [config.width, 200],
  });

  let yPos = config.marginTop;
  const centerX = config.width / 2;

  // Header
  doc.setFontSize(config.fontSizeHeader);
  doc.text(data.school.name || 'École', centerX, yPos, { align: 'center' });
  yPos += 5;

  if (data.school.address && config.type === 'A4_STANDARD') {
    doc.setFontSize(config.fontSizeBody - 1);
    doc.text(data.school.address, centerX, yPos, { align: 'center' });
    yPos += 4;
  }

  if (data.school.phone) {
    doc.setFontSize(config.fontSizeBody - 1);
    doc.text(`Tél: ${data.school.phone}`, centerX, yPos, { align: 'center' });
    yPos += 6;
  }

  // Title
  doc.setFontSize(config.fontSizeHeader - 2);
  doc.setFont(undefined, 'bold');
  doc.text('FICHE DE PAIE', centerX, yPos, { align: 'center' });
  doc.setFont(undefined, 'normal');
  yPos += 6;

  // Receipt number and date
  doc.setFontSize(config.fontSizeBody);
  doc.text(`N° ${data.receiptNumber}`, config.marginLeft, yPos);
  doc.text(`Date: ${data.date.toLocaleDateString('fr-FR')}`, config.width - config.marginRight, yPos, { align: 'right' });
  yPos += 8;

  // Teacher info
  if (data.teacher) {
    doc.setFont(undefined, 'bold');
    doc.text('ENSEIGNANT', config.marginLeft, yPos);
    doc.setFont(undefined, 'normal');
    yPos += 5;
    doc.text(`Nom: ${data.teacher.first_name} ${data.teacher.last_name}`, config.marginLeft, yPos);
    yPos += 4;
    if (data.teacher.employee_id) {
      doc.text(`Matricule: ${data.teacher.employee_id}`, config.marginLeft, yPos);
      yPos += 6;
    }
  }

  // Period
  if (data.payrollEntry && data.payrollEntry.period_name) {
    doc.setFont(undefined, 'bold');
    doc.text('PÉRIODE', config.marginLeft, yPos);
    doc.setFont(undefined, 'normal');
    yPos += 5;
    doc.text(data.payrollEntry.period_name, config.marginLeft, yPos);
    yPos += 6;
  }

  // Hours and rate
  if (data.hoursWorked !== undefined || data.hourlyRate !== undefined) {
    doc.setFont(undefined, 'bold');
    doc.text('HEURES ET TAUX', config.marginLeft, yPos);
    doc.setFont(undefined, 'normal');
    yPos += 5;

    if (data.hoursWorked !== undefined) {
      doc.text(`Heures travaillées: ${data.hoursWorked.toFixed(2)}h`, config.marginLeft, yPos);
      yPos += 4;
    }

    if (data.hourlyRate !== undefined) {
      doc.text(`Taux horaire: ${data.hourlyRate.toLocaleString('fr-FR')} FCFA/h`, config.marginLeft, yPos);
      yPos += 4;
    }

    if (data.grossAmount !== undefined) {
      doc.text(`Montant de base: ${data.grossAmount.toLocaleString('fr-FR')} FCFA`, config.marginLeft, yPos);
      yPos += 6;
    } else {
      yPos += 2;
    }
  }

  // Salary breakdown
  if (data.salaryComponents && data.salaryComponents.length > 0) {
    doc.setFont(undefined, 'bold');
    doc.text('DÉTAILS', config.marginLeft, yPos);
    doc.setFont(undefined, 'normal');
    yPos += 5;

    // Group components by type
    const primes = data.salaryComponents.filter(c => c.component_type === 'prime');
    const retenues = data.salaryComponents.filter(c => c.component_type === 'retenue');
    const avances = data.salaryComponents.filter(c => c.component_type === 'avance');

    if (primes.length > 0) {
      doc.setFont(undefined, 'bold');
      doc.text('Primes et avantages:', config.marginLeft, yPos);
      doc.setFont(undefined, 'normal');
      yPos += 4;
      primes.forEach((component) => {
        const label = component.label || component.component_type;
        const amount = component.amount?.toLocaleString('fr-FR') || '0';
        doc.text(`  ${label}: ${amount} FCFA`, config.marginLeft, yPos);
        yPos += 4;
      });
      yPos += 2;
    }

    if (retenues.length > 0) {
      doc.setFont(undefined, 'bold');
      doc.text('Retenues:', config.marginLeft, yPos);
      doc.setFont(undefined, 'normal');
      yPos += 4;
      retenues.forEach((component) => {
        const label = component.label || component.component_type;
        const amount = component.amount?.toLocaleString('fr-FR') || '0';
        doc.text(`  ${label}: ${amount} FCFA`, config.marginLeft, yPos);
        yPos += 4;
      });
      yPos += 2;
    }

    if (avances.length > 0) {
      doc.setFont(undefined, 'bold');
      doc.text('Avances:', config.marginLeft, yPos);
      doc.setFont(undefined, 'normal');
      yPos += 4;
      avances.forEach((component) => {
        const label = component.label || component.component_type;
        const amount = component.amount?.toLocaleString('fr-FR') || '0';
        doc.text(`  ${label}: ${amount} FCFA`, config.marginLeft, yPos);
        yPos += 4;
      });
      yPos += 2;
    }
  }

  // Summary
  doc.setFont(undefined, 'bold');
  doc.text('RÉCAPITULATIF', config.marginLeft, yPos);
  doc.setFont(undefined, 'normal');
  yPos += 5;

  if (data.grossAmount !== undefined) {
    doc.text(`Montant brut: ${data.grossAmount.toLocaleString('fr-FR')} FCFA`, config.marginLeft, yPos);
    yPos += 4;
  }

  if (data.primesAmount !== undefined && data.primesAmount > 0) {
    doc.text(`Primes: +${data.primesAmount.toLocaleString('fr-FR')} FCFA`, config.marginLeft, yPos);
    yPos += 4;
  }

  if (data.retenuesAmount !== undefined && data.retenuesAmount > 0) {
    doc.text(`Retenues: -${data.retenuesAmount.toLocaleString('fr-FR')} FCFA`, config.marginLeft, yPos);
    yPos += 4;
  }

  if (data.avancesAmount !== undefined && data.avancesAmount > 0) {
    doc.text(`Avances: -${data.avancesAmount.toLocaleString('fr-FR')} FCFA`, config.marginLeft, yPos);
    yPos += 4;
  }

  yPos += 2;
  doc.setFont(undefined, 'bold');
  doc.setFontSize(config.fontSizeBody + 1);
  doc.text(`NET À PAYER: ${data.amount.toLocaleString('fr-FR')} FCFA`, config.marginLeft, yPos);
  doc.setFontSize(config.fontSizeBody);
  doc.setFont(undefined, 'normal');
  yPos += 6;

  // Cashier
  if (data.cashier) {
    doc.text(`Caissier: ${data.cashier.first_name} ${data.cashier.last_name}`, config.marginLeft, yPos);
    yPos += 6;
  }

  // QR Code
  if (config.showQR && qrDataUrl) {
    const qrSize = config.type === 'A4_STANDARD' ? 30 : 20;
    doc.addImage(qrDataUrl, 'PNG', centerX - qrSize / 2, yPos, qrSize, qrSize);
    yPos += qrSize + 3;
    doc.setFontSize(config.fontSizeFooter);
    doc.text('Scannez pour vérifier', centerX, yPos, { align: 'center' });
    yPos += 5;
  }

  // Signature
  if (config.showSignature) {
    doc.setFontSize(config.fontSizeBody);
    doc.text('Signature et cachet', config.width - config.marginRight - 30, yPos);
    yPos += 10;
  }

  // Footer
  doc.setFontSize(config.fontSizeFooter);
  doc.text('Fiche générée par NovaConnectSchool', centerX, yPos, { align: 'center' });

  return new Uint8Array(doc.output('arraybuffer'));
}
