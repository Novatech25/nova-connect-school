import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface PassListPdfData {
  school: any;
  academicYear: any;
  nextAcademicYear?: any;
  levelName?: string;
  className?: string;
  students: any[]; // The filtered data from the table
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

export async function generatePassListPdf(data: PassListPdfData): Promise<void> {
  const { school, academicYear, nextAcademicYear, levelName, className, students } = data;

  const doc = new jsPDF({
    orientation: 'landscape', // Better for tables with many columns
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
    border: '#d1d5db',
  };

  const pageW = 297; // Landscape width
  const pageH = 210; // Landscape height
  const marginX = 15;
  const contentW = pageW - marginX * 2;
  let y = 0;

  // ===========================
  // 1. TOP HEADER (Blue Banner)
  // ===========================
  doc.setFillColor(c.headerBg);
  doc.rect(0, 0, pageW, 35, 'F');

  const logoSize = 16;
  const logoX = marginX;
  const logoY = 9.5;
  
  doc.setFillColor(c.headerLight);
  doc.roundedRect(logoX, logoY, logoSize, logoSize, 3, 3, 'F');
  
  const schoolName = school?.name || 'ÉTABLISSEMENT SANS NOM';
  const firstLetter = schoolName.charAt(0).toUpperCase();

  doc.setTextColor(c.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(firstLetter, logoX + logoSize/2, logoY + 11, { align: 'center' });

  if (school?.logo_url || school?.logoUrl) {
    try {
      const logoUrl = school.logo_url || school.logoUrl;
      const logoBase64 = await loadImageAsBase64(logoUrl);
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', logoX, logoY, logoSize, logoSize);
      }
    } catch { /* ignore */ }
  }

  const textX = logoX + logoSize + 6;
  doc.setTextColor(c.white);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName.toUpperCase(), textX, logoY + 5);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#cbd5e1');
  
  const addressText = school?.address || 'Adresse non renseignée';
  doc.text(addressText, textX, logoY + 10);
  
  let contactLine = '';
  if (school?.phone) contactLine += `Tel: ${school.phone}   `;
  if (school?.email) contactLine += `Email: ${school.email}`;
  doc.text(contactLine.trim(), textX, logoY + 15);

  // Right side: Document Title
  doc.setTextColor(c.white);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LISTE DE PASSATION', pageW - marginX, logoY + 5, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#cbd5e1');
  const sessionText = `Année de source : ${academicYear?.name || 'En cours'} / Année cible : ${nextAcademicYear?.name || 'A venir'}`;
  doc.text(sessionText, pageW - marginX, logoY + 11, { align: 'right' });

  y = 42;

  // ===========================
  // 2. CONTEXT INFO BLOCK
  // ===========================
  doc.setFillColor(c.infoBg);
  doc.roundedRect(marginX, y, contentW, 14, 2, 2, 'F');

  doc.setTextColor(c.textDark);
  doc.setFontSize(10);
  
  // Left col
  doc.setFont('helvetica', 'bold');
  doc.text('Niveau Filtré :', marginX + 3, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.text(levelName || 'Tous les niveaux', marginX + 33, y + 9);

  // Center col
  doc.setFont('helvetica', 'bold');
  doc.text('Classe d\'origine :', marginX + 90, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.text(className || 'Toutes les classes', marginX + 125, y + 9);

  // Right col
  doc.setFont('helvetica', 'bold');
  doc.text('Effectif Total :', marginX + 210, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${students.length} Élèves`, marginX + 240, y + 9);

  y += 22;

  // ===========================
  // 3. STUDENTS TABLE 
  // ===========================
  if (students.length > 0) {
    const tableData = students.map((student, index) => {
      const formatNumber = (num: any) => (num !== null && num !== undefined ? Number(num).toFixed(2) : '-');
      const rank = student.rankInClass || '-';
      const decision = student.isEligibleForPromotion ? 'Admis(e)' : (student.finalAverage ? 'Ajourné(e)' : 'En attente');
      
      return [
        (index + 1).toString(),
        student.studentMatricule || 'N/A',
        `${student.studentFirstName || ''} ${student.studentLastName || ''}`.trim(),
        student.currentClassName || student.currentLevelName || '-',
        formatNumber(student.finalAverage),
        rank.toString(),
        decision,
        student.suggestion || '-',
        student.nextLevelName || (decision === 'Ajourné(e)' ? student.currentLevelName : 'Terminé')
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['N°', 'Matricule', 'Nom & Prénoms', 'Classe Source', 'Moyenne /20', 'Rang', 'Décision', 'Suggestion', 'Classe Future']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: c.headerBg, textColor: c.white, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3, textColor: c.textDark },
      alternateRowStyles: { fillColor: '#f9fafb' }, // very light gray
      margin: { left: marginX, right: marginX },
      didParseCell: function(data) {
        // Highlight Decision column text based on pass/fail
        if (data.section === 'body' && data.column.index === 6) { 
          const decision = data.cell.raw;
          if (decision === 'Admis(e)') {
             data.cell.styles.textColor = '#16a34a'; // green-600
             data.cell.styles.fontStyle = 'bold';
          } else if (decision === 'Ajourné(e)') {
             data.cell.styles.textColor = '#dc2626'; // red-600
             data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text("Aucun élève à afficher avec les filtres actuels.", marginX, y);
    y += 15;
  }

  // Handle page breaks
  if (y > pageH - 40) {
    doc.addPage();
    y = 20;
  }

  // ===========================
  // 4. CLOSING & SIGNATURE
  // ===========================
  doc.setTextColor(c.textDark);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const currentDate = format(new Date(), 'dd MMMM yyyy', { locale: fr });
  const city = school?.city || school?.address?.split(',')[0] || 'la direction';
  doc.text(`Fait à ${city}, le ${currentDate}.`, marginX, y);

  y += 10;

  doc.setFillColor(c.infoBg);
  doc.roundedRect(pageW - marginX - 70, y, 70, 30, 2, 2, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(c.textDark);
  doc.text('La Direction', pageW - marginX - 35, y + 6, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(c.textLightGray);
  doc.text('(Signature et Cachet)', pageW - marginX - 35, y + 11, { align: 'center' });
  
  // ===========================
  // 5. BOTTOM FOOTER
  // ===========================
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(c.headerBg);
    doc.rect(0, pageH - 8, pageW, 8, 'F');
    
    doc.setTextColor(c.white);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Document généré par NovaConnect le ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Page ${i} sur ${totalPages}`,
      pageW / 2,
      pageH - 3,
      { align: 'center' }
    );
  }

  const safeClassName = (className || 'Toutes').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `liste_passation_${safeClassName}_${academicYear?.name?.replace(/[^a-z0-9]/gi, '_') || 'an'}.pdf`;

  doc.save(filename);
}
