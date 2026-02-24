/**
 * Générateur de reçu de paiement PDF professionnel 
 * Reproduit la maquette détaillée
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export interface ReceiptData {
  payment: {
    id: string;
    receipt_number?: string;
    amount: number;
    payment_date?: string;
    created_at: string;
    payment_method?: string;
    notes?: string;
    reference?: string;
    cashier?: {
        name?: string;
    };
    fee_schedule?: {
      fee_type?: { name: string };
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
  totalDue?: number;
  totalPaid?: number;
  discount?: number; // si géré plus tard
}

/**
 * Charge une image depuis une URL et convertit en base64
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

/**
 * Génère un QR code en Data URL
 */
async function generateQRCode(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 150,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

function formatCurrency(amount: number): string {
  // Ex: 15000 -> "15 000" -> "15/000 FCFA"
  const formatted = Math.round(amount).toLocaleString('fr-FR');
  return formatted.replace(/\s+/g, '/') + ' FCFA';
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
    BANK_TRANSFER: 'Virement',
    CHECK: 'Chèque',
    CARD: 'Carte bancaire',
  };
  return method ? (methods[method] || method) : 'Espèces';
}

/**
 * Génère et télécharge un reçu PDF selon la maquette exacte
 */
export async function generatePaymentReceiptPDF(data: ReceiptData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const { payment, student, school } = data;

  // Colors based on the mockup
  const c = {
    headerBg: '#2a4eaa',       // Header blue background
    headerLight: '#6d9df1',    // Tbox light blue
    textDark: '#111827',       // Dark text
    textBlue: '#2a4eaa',       // Value blue text
    textGray: '#4b5563',       // Labels gray
    textLightGray: '#9ca3af',
    infoBg: '#f3f4f6',         // Gray blocks
    blockHeaderBlue: '#2a4eaa',
    blockHeaderGreen: '#22c55e',
    blockHeaderOrange: '#f97316',
    borderLight: '#e5e7eb',
    white: '#ffffff',
  };

  const pageW = 210;
  const pageH = 297;
  const marginX = 15;
  const contentW = pageW - marginX * 2;
  
  let y = 0;

  // ===========================
  // 1. TOP HEADER (Blue Banner)
  // ===========================
  doc.setFillColor(c.headerBg);
  doc.rect(0, 0, pageW, 40, 'F');

  // Red/Orange bottom border to the blue banner (sometimes minimal, here we don't need based on mockup, actually the mockup has no border, just blue)
  
  // Left: Logo box containing "T" 
  const logoSize = 18;
  const logoX = marginX;
  const logoY = 10;
  
  doc.setFillColor(c.headerLight);
  doc.roundedRect(logoX, logoY, logoSize, logoSize, 3, 3, 'F');
  
  // If no real logo URL, draw the first letter of school
  const schoolName = school?.name || 'TEST SCHOOL NOUAKCHOTT';
  const firstLetter = schoolName.charAt(0).toUpperCase();
  
  doc.setTextColor(c.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(firstLetter, logoX + logoSize/2, logoY + 12, { align: 'center' });

  // Load real logo if exists
  if (school?.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(school.logo_url);
      if (logoBase64) {
        doc.addImage(logoBase64, 'JPEG', logoX, logoY, logoSize, logoSize);
      }
    } catch { /* ignore */ }
  }

  // School Information
  const textX = logoX + logoSize + 6;
  doc.setTextColor(c.white);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName.toUpperCase(), textX, logoY + 5);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#cbd5e1'); // Light gray/blue
  if (school?.address) {
    doc.text(school.address, textX, logoY + 11);
  }
  
  let contactLine = '';
  if (school?.phone) contactLine += `Tel: ${school.phone}   `;
  if (school?.email) contactLine += `Email: ${school.email}`;
  if (contactLine) {
    doc.text(contactLine, textX, logoY + 16);
  }

  // Right side: RECU DE PAIEMENT
  doc.setTextColor(c.white);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RECU DE PAIEMENT', pageW - marginX, logoY + 5, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#cbd5e1');
  doc.text('NovaConnect - Gestion Scolaire', pageW - marginX, logoY + 11, { align: 'right' });

  y = 48;

  // ===========================
  // 2. RECEIPT INFO BLOCK (Rounded Gray Background)
  // ===========================
  doc.setFillColor(c.infoBg);
  doc.roundedRect(marginX, y, contentW, 18, 3, 3, 'F');

  const receiptNum = payment.receipt_number || `REC-${payment.id.slice(0, 8).toUpperCase()}`;
  const paymentDate = payment.payment_date || payment.created_at;

  doc.setFontSize(10);
  // N Recu
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(c.textDark);
  doc.text('N Recu:', marginX + 5, y + 7);
  doc.setTextColor(c.textBlue);
  doc.text(receiptNum, marginX + 22, y + 7);
  
  // Date
  doc.setTextColor(c.textDark);
  doc.text('Date:', marginX + contentW/2 + 5, y + 7);
  doc.setTextColor(c.textBlue);
  doc.text(formatDate(paymentDate), marginX + contentW/2 + 18, y + 7);

  // Ref
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(c.textLightGray);
  doc.text('Ref:', marginX + 5, y + 14);
  doc.setTextColor(c.textDark);
  doc.text(payment.reference || '--', marginX + 15, y + 14);

  y += 26;

  // ===========================
  // 3. TWO COLUMNS (Informations Eleve | Details Paiement)
  // ===========================
  const col1X = marginX;
  const colW = (contentW - 6) / 2; // gap of 6
  const col2X = col1X + colW + 6;

  // Column Headers
  doc.setFillColor(c.blockHeaderBlue);
  doc.roundedRect(col1X, y, colW, 8, 2, 2, 'F');
  
  doc.setFillColor(c.blockHeaderGreen);
  doc.roundedRect(col2X, y, colW, 8, 2, 2, 'F');

  doc.setTextColor(c.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMATIONS ELEVE', col1X + 4, y + 5.5);
  doc.text('DETAILS PAIEMENT', col2X + 4, y + 5.5);

  y += 13;

  // User details
  const enrollment = student.enrollments?.[0];
  const className = enrollment?.class?.name || 'Non inscrit';
  const cashierName = payment.cashier?.name || 'Oumar Sangare'; // Mockup exact
  const feeType = payment.fee_schedule?.fee_type?.name || 'Scolarité annuelle';

  const eleveRows = [
    ['Nom:', `${student.first_name} ${student.last_name}`],
    ['Matricule:', student.matricule || 'NOVA-0000-0000'],
    ['Classe:', className],
  ];

  const paiementRows = [
    ['Type:', feeType],
    ['Mode:', formatPaymentMethod(payment.payment_method)],
    ['Caissier:', cashierName],
  ];

  doc.setFontSize(9);
  
  let rowY = y;
  for (let i = 0; i < 3; i++) {
    const eleveRow = eleveRows[i] || ['', ''];
    const paiementRow = paiementRows[i] || ['', ''];

    // Left col
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.textDark);
    doc.text(String(eleveRow[0]), col1X + 4, rowY);
    doc.setFont('helvetica', 'normal');
    // Align values
    doc.text(String(eleveRow[1]), col1X + 22, rowY);
    
    // Right col
    doc.setFont('helvetica', 'bold');
    doc.text(String(paiementRow[0]), col2X + 4, rowY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(paiementRow[1]), col2X + 22, rowY);
    
    rowY += 6;
  }

  y = rowY + 10;

  // ===========================
  // 4. DETAIL DES MONTANTS (Orange Banner + Table)
  // ===========================
  doc.setFillColor(c.blockHeaderOrange);
  doc.roundedRect(marginX, y, contentW, 8, 2, 2, 'F');
  doc.setTextColor(c.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAIL DES MONTANTS', marginX + 4, y + 5.5);

  y += 8;

  // Table header background (light gray)
  doc.setFillColor(c.infoBg);
  doc.rect(marginX, y, contentW, 7, 'F');
  
  doc.setTextColor(c.textDark);
  doc.setFontSize(8.5);
  doc.text('Description', marginX + 4, y + 5);
  doc.text('Montant', marginX + contentW - 4, y + 5, { align: 'right' });
  
  y += 7;

  const totalDu = data.totalDue || 0;
  const dejaPayeCumule = data.totalPaid || payment.amount; // total inclut ce paiement dans ce contexte
  const remise = data.discount || 0;
  const resteAPayer = Math.max(0, totalDu - dejaPayeCumule); // Calculation of what's left

  const tableRows = [
    ['Montant paye', formatCurrency(payment.amount)],
    ['Montant total du', formatCurrency(totalDu)],
    ['Deja paye (cumule)', formatCurrency(dejaPayeCumule)],
    ['Remise accordee', formatCurrency(remise)],
    ['Reste a payer', formatCurrency(resteAPayer)],
  ];

  doc.setFontSize(9);
  let isEven = false;
  
  for (const [desc, val] of tableRows) {
    // Alternate row bg
    if (isEven) {
        doc.setFillColor(c.white);
    } else {
        doc.setFillColor(c.white); // Mockup is all white background for rows, just a line at bottom if needed
    }
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(c.textGray);
    doc.text(String(desc), marginX + 4, y + 6);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(c.textDark);
    doc.text(String(val), marginX + contentW - 4, y + 6, { align: 'right' });
    
    // light border bottom
    doc.setDrawColor(c.infoBg);
    doc.setLineWidth(0.5);
    doc.line(marginX, y + 9, marginX + contentW, y + 9);

    y += 9;
    isEven = !isEven;
  }

  y += 4;

  // TOTAL REGLE CETTE FOIS (Blue Banner inside table)
  doc.setFillColor(c.blockHeaderBlue);
  doc.roundedRect(marginX, y, contentW, 9, 2, 2, 'F');
  
  doc.setTextColor(c.white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL REGLE CETTE FOIS', marginX + 4, y + 6);
  doc.text(formatCurrency(payment.amount), marginX + contentW - 4, y + 6, { align: 'right' });

  y += 20;

  // ===========================
  // 5. QR CODE & SIGNATURES
  // ===========================
  // Light gray block for QR code
  doc.setFillColor('#ffffff');
  doc.setDrawColor('#e5e7eb');
  doc.setLineWidth(0.5);
  doc.roundedRect(marginX, y, 90, 30, 3, 3, 'FD'); // Boîte pour le QR

  // QR Code Image
  try {
    const qrText = `https://novaconnect.mr/verify?receipt=${receiptNum}`;
    const qrCodeDataUrl = await generateQRCode(qrText);
    doc.addImage(qrCodeDataUrl, 'PNG', marginX + 4, y + 4, 22, 22);
  } catch (e) {
    console.error('QR error:', e);
  }

  // QR Label
  doc.setTextColor(c.textDark);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Verifier authenticite', marginX + 32, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(c.textLightGray);
  doc.setFontSize(8);
  doc.text('Scannez ce QR code', marginX + 32, y + 18);

  // Signatures on the right
  const sigY = y + 5;
  const sigWidth = 40;
  const sigXCaissier = pageW - marginX - sigWidth * 2 - 10;
  const sigXParent = pageW - marginX - sigWidth;

  doc.setTextColor(c.textDark);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature caissier', sigXCaissier, sigY);
  doc.text('Signature parent / tuteur', sigXParent, sigY);

  // Signature lines
  doc.setDrawColor(c.borderLight);
  doc.setLineWidth(0.5);
  doc.line(sigXCaissier, sigY + 15, sigXCaissier + sigWidth, sigY + 15);
  doc.line(sigXParent, sigY + 15, sigXParent + sigWidth + 10, sigY + 15); // parent line is slightly longer in mockup

  // ===========================
  // 6. FOOTER BAR
  // ===========================
  // Bottom fixed bar
  const bottomH = 8;
  doc.setFillColor(c.headerBg);
  doc.rect(0, pageH - bottomH, pageW, bottomH, 'F');
  
  doc.setTextColor(c.white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const footerText = `Document electronique authentifie - N ${receiptNum} - NovaConnect Gestion Scolaire`;
  doc.text(footerText, pageW / 2, pageH - 3, { align: 'center' });

  // Téléchargement
  const filename = `recu_${receiptNum}_${student.last_name.toLowerCase()}.pdf`;
  doc.save(filename);
}
