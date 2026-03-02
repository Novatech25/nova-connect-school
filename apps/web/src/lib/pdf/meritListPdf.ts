import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface MeritListPdfData {
  school: any;
  academicYear: any;
  periodName?: string;
  levelName?: string;
  className?: string;
  students: any[]; // The ranking data from get_class_report_cards_stats
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

export async function generateMeritListPdf(data: MeritListPdfData): Promise<void> {
  const { school, academicYear, periodName, levelName, className, students } = data;

  const doc = new jsPDF({
    orientation: 'portrait', // Portrait is fine for this table size
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

  const pageW = 210; // Portrait width
  const pageH = 297; // Portrait height
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
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PALMARÈS DE CLASSE', pageW - marginX, logoY + 5, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#cbd5e1');
  const sessionText = `Année Scolaire : ${academicYear?.name || 'En cours'} / ${periodName || 'Période'}`;
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
  doc.text('Niveau :', marginX + 3, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.text(levelName || '-', marginX + 22, y + 9);

  // Center col
  doc.setFont('helvetica', 'bold');
  doc.text('Classe :', marginX + 60, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.text(className || 'Aucune', marginX + 78, y + 9);

  // Right col
  doc.setFont('helvetica', 'bold');
  doc.text('Effectif Total :', marginX + 130, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${students.length} Élèves classés`, marginX + 155, y + 9);

  y += 22;

  // ===========================
  // 3. STUDENTS TABLE 
  // ===========================
  if (students.length > 0) {
    const fixEncoding = (str: string) => {
      if (!str) return '';
      try {
        // Simple trick to fix double-encoded UTF-8 strings common when passing through RPCs
        return decodeURIComponent(escape(str));
      } catch (e) {
        return str;
      }
    };

    const tableData = students.map((student, index) => {
      const rank = student.rank_in_class || student.rankInClass || index + 1;
      const avg = student.overall_average !== undefined ? student.overall_average : student.overallAverage;
      const averageText = avg !== null && avg !== undefined ? Number(avg).toFixed(2) : '-';
      
      let mentionObj = student.mention || student.mention_label || student.mentionLabel || '-';
      mentionObj = fixEncoding(mentionObj);

      return [
        rank.toString(),
        `${student.student_first_name || student.studentFirstName || ''} ${student.student_last_name || student.studentLastName || ''}`.trim(),
        averageText,
        mentionObj
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Rang', 'Nom & Prénoms', 'Moyenne /20', 'Mention']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: c.headerBg, textColor: c.white, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3, textColor: c.textDark },
      alternateRowStyles: { fillColor: '#f9fafb' }, // very light gray
      margin: { left: marginX, right: marginX },
      didParseCell: function(data) {
        // Formating rank 1st bold
        if (data.section === 'body' && data.column.index === 0) { 
           if (data.cell.raw === '1') {
             data.cell.text[0] += 'er';
             data.cell.styles.fontStyle = 'bold';
           }
           else if (data.cell.raw === '2') {
             data.cell.text[0] += 'ème';
           }
           else if (data.cell.raw === '3') {
             data.cell.text[0] += 'ème';
           }
           else {
             data.cell.text[0] += 'e';
           }
        }
        // Bold average
        if (data.section === 'body' && data.column.index === 2) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text("Aucune moyenne n'est disponible pour cette période.", marginX, y);
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
  const safePeriodName = (periodName || 'periode').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `palmares_${safeClassName}_${safePeriodName}.pdf`;

  doc.save(filename);
}
