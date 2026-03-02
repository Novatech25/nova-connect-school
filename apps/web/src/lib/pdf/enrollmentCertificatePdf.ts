import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface EnrollmentCertificateData {
  student: any;
  school: any;
  academicYear: any;
  enrollment: any;
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

export async function generateEnrollmentCertificatePdf(data: EnrollmentCertificateData): Promise<void> {
  const { student, school, academicYear, enrollment } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const c = {
    headerBg: '#2a4eaa',       // Header blue background
    headerLight: '#6d9df1',    // Tbox light blue
    textDark: '#111827',
    textBlue: '#2a4eaa',       // Value blue text
    textGray: '#4b5563',
    textLightGray: '#9ca3af',
    infoBg: '#f3f4f6',         // Gray blocks
    blockHeaderBlue: '#2a4eaa',
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

  // Left: Logo box
  const logoSize = 18;
  const logoX = marginX;
  const logoY = 10;
  
  doc.setFillColor(c.headerLight);
  doc.roundedRect(logoX, logoY, logoSize, logoSize, 3, 3, 'F');
  
  // If no real logo URL, draw the first letter of school
  const schoolName = school?.name || 'NOM DE L\'ÉTABLISSEMENT';
  const firstLetter = schoolName.charAt(0).toUpperCase();
  
  doc.setTextColor(c.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(firstLetter, logoX + logoSize/2, logoY + 12, { align: 'center' });

  // Load real logo if exists
  if (school?.logo_url || school?.logoUrl) {
    try {
      const logoUrl = school.logo_url || school.logoUrl;
      const logoBase64 = await loadImageAsBase64(logoUrl);
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', logoX, logoY, logoSize, logoSize);
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
  
  const addressText = school?.address || 'Adresse de l\'établissement non renseignée';
  doc.text(addressText, textX, logoY + 11);
  
  let contactLine = '';
  if (school?.phone) contactLine += `Tel: ${school.phone}   `;
  if (school?.email) contactLine += `Email: ${school.email}`;
  if (!contactLine.trim()) contactLine = 'Contact non renseigné';
  doc.text(contactLine.trim(), textX, logoY + 16);

  // Right side: Titre Document
  doc.setTextColor(c.white);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICAT DE SCOLARITÉ', pageW - marginX, logoY + 5, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#cbd5e1');
  doc.text('Document Administratif Officiel', pageW - marginX, logoY + 11, { align: 'right' });

  y = 48;

  // ===========================
  // 2. DOCUMENT INFO BLOCK (Rounded Gray Background)
  // ===========================
  doc.setFillColor(c.infoBg);
  doc.roundedRect(marginX, y, contentW, 18, 3, 3, 'F');

  const currentDate = format(new Date(), 'dd MMMM yyyy', { locale: fr });
  const yearName = academicYear?.name || '[Année en cours]';

  doc.setFontSize(10);
  // Année
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(c.textDark);
  doc.text('Année Académique:', marginX + 5, y + 7);
  doc.setTextColor(c.textBlue);
  doc.text(yearName, marginX + 40, y + 7);
  
  // Date
  doc.setTextColor(c.textDark);
  doc.text('Date de délivrance:', marginX + contentW/2 + 5, y + 7);
  doc.setTextColor(c.textBlue);
  doc.text(currentDate, marginX + contentW/2 + 40, y + 7);

  // Ref
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(c.textLightGray);
  doc.text('Réf:', marginX + 5, y + 14);
  doc.setTextColor(c.textDark);
  const refId = student?.matricule ? `CS-${student.matricule}-${new Date().getFullYear()}` : `CS-${new Date().getTime().toString().slice(-6)}`;
  doc.text(refId, marginX + 15, y + 14);

  y += 28;

  // ===========================
  // 3. STUDENT INFO BLOCK 
  // ===========================
  doc.setFillColor(c.blockHeaderBlue);
  doc.roundedRect(marginX, y, contentW, 8, 2, 2, 'F');
  doc.setTextColor(c.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMATIONS ÉLÈVE', marginX + 5, y + 5.5);

  y += 12;

  const studentName = `${student.firstName || student.first_name || ''} ${student.lastName || student.last_name || ''}`;
  const birthDate = student.dateOfBirth || student.date_of_birth ? format(new Date(student.dateOfBirth || student.date_of_birth), 'dd MMMM yyyy', { locale: fr }) : '[Date]';
  const birthPlace = student.placeOfBirth || student.place_of_birth || '[Lieu]';
  const className = enrollment?.class?.name || enrollment?.class_id || '[Non assignée]';

  doc.setFontSize(9);
  doc.setTextColor(c.textDark);
  
  // Left col
  doc.setFont('helvetica', 'bold');
  doc.text('Nom et Prénoms:', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(studentName, marginX + 35, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Matricule:', marginX, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(student.matricule || 'Non défini', marginX + 35, y + 7);

  // Right col
  const rightColX = marginX + contentW / 2;
  doc.setFont('helvetica', 'bold');
  doc.text('Né(e) le:', rightColX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${birthDate} à ${birthPlace}`, rightColX + 25, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Classe:', rightColX, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(className, rightColX + 25, y + 7);

  y += 25;

  // ===========================
  // 4. ATTESTATION TEXT
  // ===========================
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(c.textDark);

  const gender = student.gender === 'female' ? 'l\'élève identifiée' : 'l\'élève identifié';

  const declarationLines = [
    `Je soussigné, Directeur(trice) de l'établissement ${schoolName},`,
    `certifie par la présente que ${gender} ci-dessus est régulièrement inscrit(e)`,
    `et poursuit ses études dans notre établissement en classe de ${className}`,
    `pour l'année scolaire ${yearName}.`
  ];

  doc.text(declarationLines, marginX, y, { lineHeightFactor: 1.5 });

  y += 35;
  doc.text('En foi de quoi, ce certificat est délivré pour servir et valoir ce que de droit.', marginX, y);

  y += 25;

  // ===========================
  // 5. SIGNATURE BLOCK
  // ===========================
  doc.setFillColor(c.infoBg);
  doc.roundedRect(pageW - marginX - 70, y, 70, 35, 3, 3, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(c.textDark);
  doc.text('Le Directeur / La Directrice', pageW - marginX - 35, y + 6, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(c.textLightGray);
  doc.text('(Signature et cachet)', pageW - marginX - 35, y + 11, { align: 'center' });

  // ===========================
  // 6. BOTTOM FOOTER
  // ===========================
  doc.setFillColor(c.headerBg);
  doc.rect(0, pageH - 10, pageW, 10, 'F');
  
  doc.setTextColor(c.white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Document électronique généré par NovaConnect Gestion Scolaire - ${refId}`,
    pageW / 2,
    pageH - 4,
    { align: 'center' }
  );

  // Generate Filename
  const safeName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `certificat_scolarite_${safeName}_${yearName.replace(/[^a-z0-9]/gi, '_')}.pdf`;

  doc.save(filename);
}
