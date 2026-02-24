/**
 * Générateur de reçu de paiement PDF professionnel
 * Utilise jsPDF pour créer un reçu formaté A4
 */

import { jsPDF } from 'jspdf';

export interface ReceiptData {
  payment: {
    id: string;
    receipt_number?: string;
    amount: number;
    payment_date?: string;
    created_at: string;
    payment_method?: string;
    notes?: string;
    fee_schedule?: {
      fee_type?: { name: string };
      due_date?: string;
      amount?: number;
    };
  };
  student: {
    first_name: string;
    last_name: string;
    matricule?: string;
    enrollments?: Array<{
      class?: { name: string };
      academic_year?: { name: string };
    }>;
  };
  school?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
  };
  allPayments?: any[]; // Pour le récapitulatif global
  totalDue?: number;
  totalPaid?: number;
}

/**
 * Charge une image depuis une URL et la convertit en base64
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatCurrency(amount: number): string {
  return Math.round(amount).toLocaleString('fr-FR') + ' FCFA';
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatPaymentMethod(method?: string): string {
  const methods: Record<string, string> = {
    CASH: 'Espèces',
    MOBILE_MONEY: 'Mobile Money',
    BANK_TRANSFER: 'Virement bancaire',
    CHECK: 'Chèque',
    CARD: 'Carte bancaire',
  };
  return method ? (methods[method] || method) : 'Non précisé';
}

/**
 * Génère et télécharge un reçu PDF professionnel pour un paiement
 */
export async function generatePaymentReceiptPDF(data: ReceiptData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const { payment, student, school } = data;

  // Couleurs
  const colors = {
    primary: '#1e3a5f',
    secondary: '#3b82f6',
    accent: '#10b981',
    text: '#1f2937',
    textLight: '#6b7280',
    border: '#e5e7eb',
    lightBg: '#f8fafc',
    success: '#065f46',
    successBg: '#d1fae5',
    warning: '#92400e',
  };

  const pageW = 210;
  const marginX = 15;
  const contentW = pageW - marginX * 2;
  let y = 0;

  // ===========================
  // EN-TÊTE
  // ===========================
  // Bannière bleue
  doc.setFillColor(colors.primary);
  doc.rect(0, 0, pageW, 42, 'F');

  // Ligne d'accent verte
  doc.setFillColor(colors.accent);
  doc.rect(0, 42, pageW, 2.5, 'F');

  // Logo école (optionnel)
  let logoLoaded = false;
  if (school?.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(school.logo_url);
      if (logoBase64) {
        doc.addImage(logoBase64, 'JPEG', marginX, 7, 20, 20);
        logoLoaded = true;
      }
    } catch { /* ignore */ }
  }

  const textStartX = logoLoaded ? marginX + 25 : marginX;

  // Nom de l'école
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text((school?.name || 'NovaConnect School').toUpperCase(), textStartX, 16);

  // Infos contact école
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#cbd5e1');
  let contactLine = '';
  if (school?.address) contactLine += school.address + '  ';
  if (school?.phone) contactLine += '• Tél: ' + school.phone + '  ';
  if (school?.email) contactLine += '• ' + school.email;
  if (contactLine) doc.text(contactLine.trim(), textStartX, 24);

  // Badge REÇU DE PAIEMENT (coin droit en-tête)
  doc.setFillColor(colors.accent);
  doc.roundedRect(pageW - marginX - 55, 10, 55, 20, 3, 3, 'F');
  doc.setTextColor('#ffffff');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('REÇU DE', pageW - marginX - 27.5, 19, { align: 'center' });
  doc.text('PAIEMENT', pageW - marginX - 27.5, 26, { align: 'center' });

  y = 52;

  // ===========================
  // NUMÉRO DE REÇU ET DATE
  // ===========================
  const receiptNum = payment.receipt_number || `REC-${payment.id.slice(0, 8).toUpperCase()}`;
  const paymentDate = payment.payment_date || payment.created_at;

  doc.setFillColor(colors.lightBg);
  doc.rect(marginX, y, contentW, 14, 'F');
  doc.setDrawColor(colors.border);
  doc.setLineWidth(0.3);
  doc.rect(marginX, y, contentW, 14, 'S');

  doc.setTextColor(colors.primary);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Numéro de reçu :', marginX + 5, y + 6);
  doc.setTextColor(colors.secondary);
  doc.setFontSize(11);
  doc.text(receiptNum, marginX + 55, y + 6);

  doc.setTextColor(colors.textLight);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date d'émission : ${formatDate(paymentDate)}`, marginX + 5, y + 11.5);

  doc.setTextColor(colors.textLight);
  doc.setFontSize(9);
  doc.text(`Généré le : ${formatDate(new Date().toISOString())}`, pageW - marginX - 5, y + 11.5, { align: 'right' });

  y += 22;

  // ===========================
  // DEUX COLONNES : ÉTUDIANT + PAIEMENT
  // ===========================
  const col1X = marginX;
  const col2X = marginX + contentW / 2 + 5;
  const colW = contentW / 2 - 5;
  const sectionH = 50;

  // Encadrés
  doc.setFillColor('#ffffff');
  doc.setDrawColor(colors.border);
  doc.setLineWidth(0.3);
  doc.rect(col1X, y, colW, sectionH, 'FD');
  doc.rect(col2X, y, colW, sectionH, 'FD');

  // Titres colonnes
  doc.setFillColor(colors.primary);
  doc.rect(col1X, y, colW, 7, 'F');
  doc.rect(col2X, y, colW, 7, 'F');

  doc.setTextColor('#ffffff');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMATIONS ÉTUDIANT', col1X + colW / 2, y + 5, { align: 'center' });
  doc.text('DÉTAILS DU PAIEMENT', col2X + colW / 2, y + 5, { align: 'center' });

  // Infos étudiant
  const enrollment = student.enrollments?.[0];
  const studentRows = [
    ['Nom complet', `${student.first_name} ${student.last_name}`],
    ['Matricule', student.matricule || 'N/A'],
    ['Classe', enrollment?.class?.name || 'N/A'],
    ['Année scolaire', enrollment?.academic_year?.name || 'N/A'],
  ];

  let rowY = y + 12;
  for (const [label, val] of studentRows) {
    doc.setTextColor(colors.textLight);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(label + ' :', col1X + 4, rowY);
    doc.setTextColor(colors.text);
    doc.setFont('helvetica', 'bold');
    doc.text(String(val), col1X + 4, rowY + 4);
    rowY += 10;
  }

  // Infos paiement
  const paymentRows = [
    ['Montant payé', formatCurrency(payment.amount)],
    ['Mode de paiement', formatPaymentMethod(payment.payment_method)],
    ['Type de frais', payment.fee_schedule?.fee_type?.name || 'Scolarité'],
    ['Référence', payment.id.slice(0, 12).toUpperCase()],
  ];

  rowY = y + 12;
  for (const [label, val] of paymentRows) {
    doc.setTextColor(colors.textLight);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(label + ' :', col2X + 4, rowY);
    doc.setTextColor(colors.text);
    doc.setFont('helvetica', 'bold');
    doc.text(String(val), col2X + 4, rowY + 4);
    rowY += 10;
  }

  y += sectionH + 10;

  // ===========================
  // MONTANT PRINCIPAL (mise en valeur)
  // ===========================
  doc.setFillColor(colors.accent);
  doc.rect(marginX, y, contentW, 20, 'F');
  doc.setTextColor('#ffffff');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('MONTANT REÇU', marginX + contentW / 2, y + 7, { align: 'center' });
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(payment.amount), marginX + contentW / 2, y + 16, { align: 'center' });

  y += 28;

  // ===========================
  // RÉCAPITULATIF FINANCIER
  // ===========================
  if (data.totalDue !== undefined && data.totalPaid !== undefined) {
    doc.setFillColor(colors.lightBg);
    doc.setDrawColor(colors.border);
    doc.rect(marginX, y, contentW, 30, 'FD');

    doc.setTextColor(colors.primary);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('RÉCAPITULATIF DE L\'ANNÉE', marginX + 5, y + 7);

    const recapRows = [
      ['Total des frais de l\'année :', formatCurrency(data.totalDue), '#1e3a5f'],
      ['Total des paiements effectués :', formatCurrency(data.totalPaid), '#065f46'],
      ['Solde restant :', formatCurrency(Math.max(0, data.totalDue - data.totalPaid)),
        data.totalDue - data.totalPaid > 0 ? '#b91c1c' : '#065f46'],
    ] as [string, string, string][];

    let rY = y + 14;
    for (const [label, val, color] of recapRows) {
      doc.setTextColor(colors.textLight);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(label, marginX + 5, rY);
      doc.setTextColor(color);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(val, pageW - marginX - 5, rY, { align: 'right' });
      rY += 7;
    }

    y += 38;
  }

  // ===========================
  // NOTES (si présentes)
  // ===========================
  if (payment.notes) {
    doc.setFillColor('#fefce8');
    doc.setDrawColor('#fbbf24');
    doc.setLineWidth(0.5);
    doc.rect(marginX, y, contentW, 16, 'FD');
    doc.setTextColor(colors.warning);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Note :', marginX + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text);
    doc.text(payment.notes, marginX + 18, y + 6);
    y += 22;
  }

  // ===========================
  // PIED DE PAGE OFFICIEL
  // ===========================
  const footerY = 260;

  // Ligne séparatrice
  doc.setDrawColor(colors.border);
  doc.setLineWidth(0.5);
  doc.line(marginX, footerY, pageW - marginX, footerY);

  // Cachet / Signature (placeholder)
  doc.setFillColor(colors.lightBg);
  doc.setDrawColor(colors.border);
  doc.rect(marginX, footerY + 5, 70, 25, 'FD');
  doc.setTextColor(colors.textLight);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Cachet et signature', marginX + 35, footerY + 13, { align: 'center' });
  doc.text('du responsable financier', marginX + 35, footerY + 18, { align: 'center' });

  // Texte légal
  doc.setTextColor(colors.textLight);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text('Ce reçu constitue une preuve officielle de paiement.', pageW / 2, footerY + 12, { align: 'center' });
  doc.text('Conservez ce document pour vos dossiers.', pageW / 2, footerY + 17, { align: 'center' });

  // Ligne du bas colorée
  doc.setFillColor(colors.primary);
  doc.rect(0, 287, pageW, 10, 'F');
  doc.setFillColor(colors.accent);
  doc.rect(0, 287, pageW, 2, 'F');
  doc.setTextColor('#ffffff');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(school?.name || 'NovaConnect School', pageW / 2, 293, { align: 'center' });

  // Téléchargement
  const filename = `recu_${receiptNum}_${student.last_name.toLowerCase()}.pdf`;
  doc.save(filename);
}
