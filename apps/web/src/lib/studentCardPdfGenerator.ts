/**
 * Générateur de carte étudiant PDF professionnel
 * Crée une carte scolaire complète avec photo, QR code et informations
 * Supporte la génération individuelle et multi-cartes A4
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

interface StudentCardData {
  card: {
    id: string;
    qr_code_data: string;
    qr_code_signature: string;
    issue_date?: string;
    card_number?: string;
    [key: string]: any;
  };
  student: {
    first_name: string;
    last_name: string;
    matricule?: string;
    photo_url?: string;
    class_id?: string;
    date_of_birth?: string;
    gender?: string;
    address?: string;
    city?: string;
    [key: string]: any;
  };
  school: {
    name: string;
    logo_url?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    [key: string]: any;
  };
  template?: {
    layout_config?: {
      primaryColor?: string;
      secondaryColor?: string;
      textColor?: string;
      backgroundColor?: string;
      fontFamily?: string;
    };
    logo_url?: string;
    [key: string]: any;
  };
  qrData: string;
  signature: string;
}

interface ClassInfo {
  name: string;
  level?: string;
}

interface CardEntry {
  data: StudentCardData;
  classInfo?: ClassInfo;
}

// Dimensions carte CR80 standard (mm)
const CARD_WIDTH = 85.6;
const CARD_HEIGHT = 53.98;

/**
 * Génère un QR code en Data URL
 */
async function generateQRCode(data: string, signature: string): Promise<string> {
  const payload = JSON.stringify({ data, sig: signature });
  return QRCode.toDataURL(payload, {
    width: 140,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#1e3a5f',
      light: '#ffffff',
    },
  });
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
  } catch (e) {
    console.error('Error loading image:', e);
    return null;
  }
}

/**
 * Rend un placeholder photo avec un design moderne
 */
function renderPhotoPlaceholder(
  doc: jsPDF,
  photoX: number,
  photoY: number,
  photoSize: number,
  primaryColor: string
): void {
  // Fond avec couleur primaire très claire
  doc.setFillColor(240, 245, 250);
  doc.rect(photoX, photoY, photoSize, photoSize * 1.25, 'F');
  
  // Bordure
  doc.setDrawColor(primaryColor);
  doc.setLineWidth(0.5);
  doc.rect(photoX, photoY, photoSize, photoSize * 1.25, 'S');
  
  // Icône silhouette (représentée par un cercle et un rectangle)
  const centerX = photoX + photoSize / 2;
  const centerY = photoY + photoSize * 0.6;
  
  doc.setFillColor('#cbd5e1');
  // Tête (cercle)
  doc.circle(centerX, centerY - 3, 4, 'F');
  // Corps (rectangle arrondi)
  doc.rect(centerX - 6, centerY + 1, 12, 8, 'F');
  
  // Texte
  doc.setTextColor('#64748b');
  doc.setFontSize(4);
  doc.text('PHOTO', centerX, photoY + photoSize * 1.15, { align: 'center' });
}

/**
 * Rend une carte à une position donnée (offsetX, offsetY) dans un document jsPDF
 * Design moderne et professionnel
 */
async function renderCardAt(
  doc: jsPDF,
  data: StudentCardData,
  classInfo: ClassInfo | undefined,
  offsetX: number,
  offsetY: number
): Promise<void> {
  const { card, student, template, qrData, signature } = data;

  // Normaliser les données de l'école
  let school: any = data.school;
  if (Array.isArray(school)) {
    school = school[0];
  }

  // Configuration des couleurs - Palette moderne
  const colors = {
    primary: template?.layout_config?.primaryColor || '#1e3a5f',      // Bleu marine profond
    secondary: template?.layout_config?.secondaryColor || '#3b82f6',  // Bleu vif
    accent: '#f59e0b',                                                // Orange doré
    text: '#1f2937',                                                  // Gris foncé
    textLight: '#6b7280',                                             // Gris moyen
    background: '#ffffff',
    lightBg: '#f8fafc',                                               // Gris très clair
    border: '#e2e8f0',                                                // Gris bordure
  };

  const margin = 2.5;

  // === 1. FOND ET BORDURE ARRONDI ===
  doc.setFillColor(colors.background);
  doc.rect(offsetX, offsetY, CARD_WIDTH, CARD_HEIGHT, 'F');
  
  // Ombre subtile (simulée avec des rectangles gris clair)
  doc.setFillColor(240, 240, 240);
  doc.rect(offsetX + 0.5, offsetY + CARD_HEIGHT, CARD_WIDTH, 0.5, 'F');
  doc.rect(offsetX + CARD_WIDTH, offsetY + 0.5, 0.5, CARD_HEIGHT, 'F');

  // Bordure fine
  doc.setDrawColor(colors.border);
  doc.setLineWidth(0.3);
  doc.rect(offsetX, offsetY, CARD_WIDTH, CARD_HEIGHT, 'S');

  // === 2. EN-TÊTE AVEC DESIGN MODERNE ===
  // Hauteur de l'en-tête ajustée selon le contenu (compact)
  const hasLogo = !!(school.logo_url || template?.logo_url);
  const hasContact = !!(school.phone || school.email || school.address || school.website);
  const headerHeight = hasContact ? 13 : 10;
  
  // Bandeau supérieur
  doc.setFillColor(colors.primary);
  doc.rect(offsetX, offsetY, CARD_WIDTH, headerHeight, 'F');
  
  // Ligne d'accent colorée
  doc.setFillColor(colors.accent);
  doc.rect(offsetX, offsetY + headerHeight, CARD_WIDTH, 1.5, 'F');

  // Logo école (si disponible) - taille réduite
  let logoWidth = 0;
  let logoHeight = 0;
  if (hasLogo) {
    try {
      const logoUrl = school.logo_url || template?.logo_url;
      if (logoUrl) {
        const logoBase64 = await loadImageAsBase64(logoUrl);
        if (logoBase64) {
          logoWidth = 7;
          logoHeight = 7;
          doc.addImage(logoBase64, 'JPEG', offsetX + margin + 1, offsetY + 1.5, logoWidth, logoHeight);
        }
      }
    } catch (e) {
      console.error('Error loading logo:', e);
    }
  }

  // Nom de l'école
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  const schoolName = school.name.length > 38 ? school.name.substring(0, 36) + '...' : school.name;
  const textX = logoWidth > 0 ? offsetX + logoWidth + margin + 2 : offsetX + margin + 2;
  const nameY = hasContact ? offsetY + 4 : offsetY + headerHeight / 2 + 1;
  doc.text(schoolName.toUpperCase(), textX, nameY, { 
    align: 'left',
    maxWidth: CARD_WIDTH - textX - margin - 2
  });

  // Contact de l'école (si disponible) - plus compact
  if (hasContact) {
    doc.setTextColor('#cbd5e1'); // Blanc cassé pour meilleure lisibilité
    doc.setFontSize(3.5);
    doc.setFont('helvetica', 'normal');
    
    let contactY = nameY + 3.5;
    let contactParts: string[] = [];
    
    if (school.address) {
      const shortAddr = school.address.length > 35 ? school.address.substring(0, 33) + '...' : school.address;
      contactParts.push(shortAddr);
    }
    
    if (school.phone) {
      contactParts.push(`Tél: ${school.phone}`);
    }
    
    if (school.email) {
      contactParts.push(school.email);
    }
    
    if (school.website) {
      const web = school.website.replace(/^https?:\/\//, '');
      contactParts.push(web);
    }
    
    // Afficher les contacts sur une ou deux lignes
    if (contactParts.length > 0) {
      const line1 = contactParts.slice(0, 2).join(' • ');
      doc.text(line1, textX, contactY);
      
      if (contactParts.length > 2) {
        const line2 = contactParts.slice(2).join(' • ');
        doc.text(line2, textX, contactY + 3);
      }
    }
  }

  // === 3. SECTION PRINCIPALE ===
  // La position dépend de la hauteur de l'en-tête
  const contentY = offsetY + headerHeight + 3;
  
  // PHOTO - Encadré moderne avec ombre
  const photoSize = 19;
  const photoX = offsetX + margin + 1;
  const photoY = contentY;

  // Ombre de la photo
  doc.setFillColor(200, 200, 200);
  doc.rect(photoX + 0.8, photoY + 0.8, photoSize, photoSize * 1.25, 'F');
  
  // Cadre photo avec bordure colorée
  doc.setFillColor('#ffffff');
  doc.rect(photoX, photoY, photoSize, photoSize * 1.25, 'F');
  doc.setDrawColor(colors.primary);
  doc.setLineWidth(1);
  doc.rect(photoX, photoY, photoSize, photoSize * 1.25, 'S');
  
  // Contenu de la photo
  if (student.photo_url) {
    try {
      const photoBase64 = await loadImageAsBase64(student.photo_url);
      if (photoBase64) {
        doc.addImage(photoBase64, 'JPEG', photoX + 1, photoY + 1, photoSize - 2, photoSize * 1.25 - 2);
      } else {
        renderPhotoPlaceholder(doc, photoX, photoY, photoSize, colors.primary);
      }
    } catch (e) {
      renderPhotoPlaceholder(doc, photoX, photoY, photoSize, colors.primary);
    }
  } else {
    renderPhotoPlaceholder(doc, photoX, photoY, photoSize, colors.primary);
  }

  // === 4. INFORMATIONS ÉTUDIANT ===
  const infoX = photoX + photoSize + 3.5;
  let infoY = contentY + 1;
  const labelWidth = 18;
  const valueX = infoX + labelWidth;

  // Helper pour afficher une ligne label/valeur
  const drawInfoLine = (label: string, value: string, y: number, isBold = false) => {
    // Label
    doc.setTextColor(colors.primary);
    doc.setFontSize(4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(label, infoX, y);
    
    // Valeur
    doc.setTextColor(colors.text);
    doc.setFontSize(isBold ? 5.5 : 5);
    doc.setFont(isBold ? 'helvetica' : 'helvetica', isBold ? 'bold' : 'normal');
    doc.text(value.substring(0, 22), valueX, y);
  };

  // NOM (en gras et plus grand)
  doc.setTextColor(colors.primary);
  doc.setFontSize(4.5);
  doc.setFont('helvetica', 'bold');
  doc.text('NOM', infoX, infoY);
  doc.setTextColor(colors.text);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text(student.last_name.toUpperCase(), valueX, infoY);

  // PRÉNOM
  infoY += 5;
  doc.setTextColor(colors.primary);
  doc.setFontSize(4.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PRÉNOM', infoX, infoY);
  doc.setTextColor(colors.text);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text(student.first_name, valueX, infoY);

  // MATRICULE avec fond coloré
  infoY += 5;
  doc.setTextColor(colors.primary);
  doc.setFontSize(4.5);
  doc.setFont('helvetica', 'bold');
  doc.text('MATRICULE', infoX, infoY);
  
  // Badge matricule
  const matriculeText = student.matricule || 'N/A';
  doc.setFillColor(colors.lightBg);
  doc.roundedRect(valueX - 1, infoY - 3, matriculeText.length * 2.2 + 4, 4.5, 1, 1, 'F');
  doc.setTextColor(colors.secondary);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text(matriculeText, valueX + 1, infoY);

  // CLASSE - Affichage complet sur plusieurs lignes si nécessaire
  if (classInfo) {
    infoY += 5;
    doc.setTextColor(colors.primary);
    doc.setFontSize(4.5);
    doc.setFont('helvetica', 'bold');
    doc.text('CLASSE', infoX, infoY);
    
    const classText = classInfo.level ? `${classInfo.level} ${classInfo.name}` : classInfo.name;
    const maxWidth = CARD_WIDTH - valueX - margin - 20; // Espace disponible avant le QR code
    
    doc.setTextColor(colors.text);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    
    // Si le texte est court, l'afficher sur une ligne
    if (classText.length <= 25) {
      doc.text(classText, valueX, infoY);
    } else {
      // Sinon, couper intelligemment sur 2 lignes
      const words = classText.split(' ');
      let line1 = '';
      let line2 = '';
      let currentLine = 1;
      
      for (const word of words) {
        if (currentLine === 1 && (line1 + word).length <= 25) {
          line1 += (line1 ? ' ' : '') + word;
        } else {
          currentLine = 2;
          line2 += (line2 ? ' ' : '') + word;
        }
      }
      
      doc.text(line1 || classText.substring(0, 25), valueX, infoY);
      if (line2) {
        infoY += 3.5;
        doc.text(line2.substring(0, 30), valueX, infoY);
      }
    }
  }

  // DATE DE NAISSANCE
  if (student.date_of_birth) {
    infoY += 4.5;
    doc.setTextColor(colors.textLight);
    doc.setFontSize(4);
    doc.setFont('helvetica', 'normal');
    const birthDate = new Date(student.date_of_birth).toLocaleDateString('fr-FR');
    doc.text(`Né(e) le: ${birthDate}`, infoX, infoY);
  }

  // === 5. QR CODE - Design amélioré ===
  const qrSize = 16;
  const qrX = offsetX + CARD_WIDTH - qrSize - margin - 1;
  const qrY = contentY + 1;

  // Fond blanc pour le QR
  doc.setFillColor('#ffffff');
  doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 1, 1, 'F');
  doc.setDrawColor(colors.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 1, 1, 'S');

  try {
    const qrCodeDataUrl = await generateQRCode(qrData, signature);
    doc.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  } catch (e) {
    console.error('QR error:', e);
  }

  // === 6. PIED DE PAGE ===
  const footerY = offsetY + CARD_HEIGHT - 5.5;

  // Ligne séparatrice
  doc.setDrawColor(colors.border);
  doc.setLineWidth(0.3);
  doc.line(offsetX + margin, footerY - 2, offsetX + CARD_WIDTH - margin, footerY - 2);

  // Section gauche: Date d'émission
  doc.setTextColor(colors.textLight);
  doc.setFontSize(3.8);
  doc.setFont('helvetica', 'normal');
  const issueDate = card.issue_date
    ? new Date(card.issue_date).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');
  doc.text(`Émise le ${issueDate}`, offsetX + margin, footerY + 1);

  // Section centre: Numéro de carte
  const cardNum = card.card_number || `CARTE-${card.id.substring(0, 6).toUpperCase()}`;
  doc.setTextColor(colors.primary);
  doc.setFontSize(4);
  doc.setFont('helvetica', 'bold');
  doc.text(cardNum, offsetX + CARD_WIDTH / 2, footerY + 1, { align: 'center' });

  // Section droite: Validité (optionnel)
  doc.setTextColor(colors.textLight);
  doc.setFontSize(3.8);
  doc.setFont('helvetica', 'normal');
  doc.text('Année scolaire 2024-2025', offsetX + CARD_WIDTH - margin, footerY + 1, { align: 'right' });

  // === 7. BADGE CARTE ÉTUDIANT ===
  // Positionné dans l'en-tête, à droite (compact)
  const badgeWidth = 20;
  const badgeHeight = 4;
  const badgeX = offsetX + CARD_WIDTH - badgeWidth - margin - 1;
  const badgeY = offsetY + (hasContact ? 6.5 : 5);
  
  doc.setFillColor(colors.accent);
  doc.roundedRect(badgeX, badgeY - badgeHeight/2, badgeWidth, badgeHeight, 0.8, 0.8, 'F');
  doc.setTextColor('#ffffff');
  doc.setFontSize(3.8);
  doc.setFont('helvetica', 'bold');
  doc.text('CARTE ÉTUDIANT', badgeX + badgeWidth/2, badgeY + 0.7, { align: 'center' });
}

/**
 * Génère une carte étudiant PDF individuelle (format CR80)
 */
export async function generateStudentCardPDF(
  data: StudentCardData,
  classInfo?: ClassInfo
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [CARD_WIDTH, CARD_HEIGHT],
  });

  await renderCardAt(doc, data, classInfo, 0, 0);

  const pdfArrayBuffer = doc.output('arraybuffer');
  return new Blob([pdfArrayBuffer], { type: 'application/pdf' });
}

/**
 * Génère un PDF A4 avec plusieurs cartes étudiantes disposées en grille
 * Layout: 2 colonnes × 5 rangées = 10 cartes par page
 */
export async function generateMultipleStudentCardsPDF(
  cards: CardEntry[]
): Promise<Blob> {
  // Dimensions A4 en mm
  const A4_WIDTH = 210;
  const A4_HEIGHT = 297;

  // Grille: 2 colonnes × 5 rangées
  const COLS = 2;
  const ROWS = 5;
  const CARDS_PER_PAGE = COLS * ROWS;

  // Marges et espacement
  const marginX = (A4_WIDTH - COLS * CARD_WIDTH) / (COLS + 1);
  const marginY = (A4_HEIGHT - ROWS * CARD_HEIGHT) / (ROWS + 1);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  for (let i = 0; i < cards.length; i++) {
    const indexOnPage = i % CARDS_PER_PAGE;

    // Ajouter une nouvelle page si nécessaire (sauf pour la première carte)
    if (i > 0 && indexOnPage === 0) {
      doc.addPage('a4', 'portrait');
    }

    // Calculer la position dans la grille
    const col = indexOnPage % COLS;
    const row = Math.floor(indexOnPage / COLS);

    const offsetX = marginX + col * (CARD_WIDTH + marginX);
    const offsetY = marginY + row * (CARD_HEIGHT + marginY);

    // Rendre la carte à la position calculée
    const entry = cards[i];
    if (entry) {
      await renderCardAt(doc, entry.data, entry.classInfo, offsetX, offsetY);
    }
  }

  // Ajouter le numéro de page en bas de chaque page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setTextColor('#9ca3af');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Page ${p}/${totalPages} — ${cards.length} carte(s)`,
      A4_WIDTH / 2,
      A4_HEIGHT - 5,
      { align: 'center' }
    );
  }

  const pdfArrayBuffer = doc.output('arraybuffer');
  return new Blob([pdfArrayBuffer], { type: 'application/pdf' });
}

/**
 * Télécharge le PDF généré
 */
export function downloadStudentCardPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
