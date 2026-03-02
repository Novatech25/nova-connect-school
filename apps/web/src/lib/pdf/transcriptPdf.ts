import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface TranscriptData {
  student: any;
  school: any;
  grades: any[];
  period: any;
  academicYear: any;
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

export async function generateTranscriptPdf(data: TranscriptData): Promise<void> {
  const { student, school, grades, period, academicYear } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const c = {
    headerBg: '#2a4eaa',       
    textDark: '#111827',       
    textGray: '#4b5563',       
    infoBg: '#f3f4f6',         
    blockHeaderBlue: '#2a4eaa',
    white: '#ffffff',
  };

  const marginX = 15;
  const contentW = 180;
  let y = 0;

  // 1. HEADER (Blue Background)
  const headerHeight = 35;
  doc.setFillColor(c.headerBg);
  doc.rect(0, 0, 210, headerHeight, 'F');
  
  if (school?.logo_url || school?.logoUrl) {
    const logoUrl = school.logo_url || school.logoUrl;
    const base64Logo = await loadImageAsBase64(logoUrl);
    if (base64Logo) {
      try {
        doc.addImage(base64Logo, 'PNG', marginX, 8, 20, 20);
      } catch (e) {
        // Fallback or ignore if image format issue
      }
    }
  } else {
    // Letter avatar if no logo
    doc.setFillColor(c.white);
    doc.circle(marginX + 10, 18, 10, 'F');
    doc.setTextColor(c.headerBg);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    const initial = school?.name ? school.name.charAt(0).toUpperCase() : 'S';
    doc.text(initial, marginX + 10, 20, { align: 'center', baseline: 'middle' });
  }

  const textX = marginX + 25;
  const logoY = 8;
  doc.setTextColor(c.white);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const schoolName = school?.name || 'École';
  doc.text(schoolName.toUpperCase(), textX, logoY + 6);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#cbd5e1');
  
  const addressText = school?.address || '123 Rue de l\'École, Nouakchott, Mauritanie';
  doc.text(addressText, textX, logoY + 11);
  
  let contactLine = '';
  if (school?.phone) contactLine += `Tel: ${school.phone}   `;
  if (school?.email) contactLine += `Email: ${school.email}`;
  if (!contactLine.trim()) {
    contactLine = 'Tel: +222 45 24 12 34   Email: contact@testschool.mr';
  }
  doc.text(contactLine.trim(), textX, logoY + 16);

  // Title on the right
  doc.setTextColor(c.white);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RELEVÉ DE NOTES', 195, 18, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(period?.name || 'Période indéfinie', 195, 24, { align: 'right' });

  y = headerHeight + 10;

  // 2. STUDENT INFO
  doc.setFillColor(c.infoBg);
  doc.roundedRect(marginX, y, contentW, 25, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(c.textDark);
  
  const studentName = `${student.firstName || student.first_name || ''} ${student.lastName || student.last_name || ''}`;
  doc.text('ÉLÈVE:', marginX + 5, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(studentName, marginX + 25, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('MATRICULE:', marginX + 5, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(student.matricule || 'N/A', marginX + 32, y + 15);

  const enrollment = student.enrollments?.[0];
  const className = enrollment?.class?.name || enrollment?.class_id || '--';

  doc.setFont('helvetica', 'bold');
  doc.text('CLASSE:', marginX + 100, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(className, marginX + 120, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('ANNÉE SCOLAIRE:', marginX + 100, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(academicYear?.name || '--', marginX + 138, y + 15);

  y += 32;

  // 3. GRADES TABLE
  const tableData = grades.map(g => [
    g.subject?.name || 'Matière inconnue',
    format(new Date(g.createdAt || g.created_at), 'dd MMM yyyy', { locale: fr }),
    g.title || g.gradeType,
    g.score != null ? `${g.score} / ${g.maxScore}` : 'N/A'
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Matière', 'Date', 'Évaluation', 'Note']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: c.headerBg,
      textColor: c.white,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 60 },
      3: { cellWidth: 40, halign: 'center', fontStyle: 'bold' },
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: c.textDark,
    },
    alternateRowStyles: {
      fillColor: '#f9fafb',
    },
    margin: { left: marginX, right: marginX },
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // 4. FOOTER & SIGNATURES
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('La Direction', marginX + 20, y);
  doc.text('Visa des Parents', 195 - 40, y, { align: 'center' });

  // Generate Filename
  const safeName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const safePeriod = (period?.name || 'periode').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `releve_notes_${safeName}_${safePeriod}.pdf`;

  doc.save(filename);
}
