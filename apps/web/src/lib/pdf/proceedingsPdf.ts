import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface ProceedingsData {
  student: any;
  school: any;
  academicYear: any;
  enrollment: any;
  allReportCards: any[]; // Bulletins of the year to calculate average
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

export async function generateProceedingsPdf(data: ProceedingsData): Promise<void> {
  const { student, school, academicYear, enrollment, allReportCards } = data;

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
    border: '#d1d5db',
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

  const logoSize = 18;
  const logoX = marginX;
  const logoY = 10;
  
  doc.setFillColor(c.headerLight);
  doc.roundedRect(logoX, logoY, logoSize, logoSize, 3, 3, 'F');
  
  const schoolName = school?.name || 'NOM DE L\'ÉTABLISSEMENT';
  const firstLetter = schoolName.charAt(0).toUpperCase();

  doc.setTextColor(c.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(firstLetter, logoX + logoSize/2, logoY + 12, { align: 'center' });

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
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#cbd5e1');
  
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
  doc.text('PROCÈS VERBAL', pageW - marginX, logoY + 5, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#cbd5e1');
  doc.text('Année : ' + (academicYear?.name || '[Année en cours]'), pageW - marginX, logoY + 11, { align: 'right' });

  y = 48;

  // 2. ADAPT THE TITLE BASED ON SCHOOL LEVEL
  const levelType = enrollment?.class?.level?.levelType || enrollment?.class?.level_type || 'primary';
  
  let mainTitle = 'PROCÈS VERBAL DE DÉLIBÉRATION';
  let subtitle = 'Décision du Conseil de Classe';
  let vocabulary = {
    term: 'Trimestre/Semestre',
    passAction: 'Passe en classe supérieure',
    failAction: 'Redouble la classe',
  };

  switch(levelType) {
    case 'primary':
      mainTitle = 'DÉCISION DE FIN D\'ANNÉE';
      subtitle = 'Conseil des Maîtres';
      vocabulary.term = 'Trimestre';
      break;
    case 'middle_school':
       mainTitle = 'PROCÈS VERBAL DE CONSEIL DE CLASSE';
       subtitle = 'Passage au Cycle Supérieur';
       vocabulary.term = 'Trimestre';
       break;
    case 'high_school':
       mainTitle = 'PROCÈS VERBAL DE DÉLIBÉRATION';
       subtitle = 'Conseil de Classe / Orientation';
       vocabulary.term = 'Semestre';
       break;
    case 'university':
       mainTitle = 'RELEVÉ DE DÉCISION DU JURY';
       subtitle = 'Validation des Unités d\'Enseignement (Semestre/Année)';
       vocabulary.term = 'Semestre universitaire';
       vocabulary.passAction = 'Admis(e) à l\'étape supérieure';
       vocabulary.failAction = 'Ajourné(e)';
       break;
  }

  // ===========================
  // 2. DOCUMENT TITLE ADAPTATION
  // ===========================
  doc.setFillColor(c.infoBg);
  doc.roundedRect(marginX, y, contentW, 20, 3, 3, 'F');

  doc.setTextColor(c.textBlue);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(mainTitle, marginX + contentW / 2, y + 8, { align: 'center' });
  
  doc.setTextColor(c.textGray);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text(subtitle, marginX + contentW / 2, y + 15, { align: 'center' });

  y += 28;

  // ===========================
  // 3. STUDENT INFO BLOCK
  // ===========================
  doc.setFillColor(c.blockHeaderBlue);
  doc.roundedRect(marginX, y, contentW, 8, 2, 2, 'F');
  doc.setTextColor(c.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('IDENTITÉ DU CANDIDAT / ÉLÈVE', marginX + 5, y + 5.5);

  y += 12;

  const studentName = `${student.firstName || student.first_name || ''} ${student.lastName || student.last_name || ''}`;
  const className = enrollment?.class?.name || enrollment?.class_id || '[Classe non assignée]';
  const matricule = student.matricule || 'Sans';

  doc.setTextColor(c.textDark);
  
  // Left col
  doc.setFont('helvetica', 'bold');
  doc.text('Nom et Prénoms:', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(studentName.toUpperCase(), marginX + 35, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Matricule:', marginX, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(matricule, marginX + 35, y + 7);

  // Right col
  doc.setFont('helvetica', 'bold');
  doc.text('Classe:', marginX + 110, y);
  doc.setFont('helvetica', 'normal');
  doc.text(className, marginX + 135, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Cycle:', marginX + 110, y + 7);
  doc.setFont('helvetica', 'normal');
  const typeDisplay: Record<string, string> = { 'primary': 'Primaire', 'middle_school': 'Collège', 'high_school': 'Lycée', 'university': 'Université' };
  doc.text(typeDisplay[levelType] || 'Standard', marginX + 135, y + 7);

  y += 18;

  // ===========================
  // 4. SYNTHESIS TABLE
  // ===========================
  // Check if we have published report cards to calculate an annual average
  let sumAvg = 0;
  let countAvg = 0;
  let hasDrafts = false;

  const validCards = allReportCards.filter(rc => rc.overallAverage != null);
  validCards.forEach(rc => {
    sumAvg += Number(rc.overallAverage);
    countAvg++;
    if (rc.status !== 'published') hasDrafts = true;
  });

  const annualAvg = countAvg > 0 ? (sumAvg / countAvg).toFixed(2) : null;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SYNTHÈSE ACADÉMIQUE', marginX, y);
  
  y += 5;

  if (countAvg > 0) {
    const tableData = validCards.map((rc, idx) => [
      rc.period?.name || `Examen ${idx+1}`,
      rc.status === 'published' ? 'Validé' : 'Provisoire',
      Number(rc.overallAverage).toFixed(2) + ' / 20'
    ]);

    // Append Annual
    tableData.push(['MOYENNE GÉNÉRALE (ANNUELLE)', 'Calculée', `${annualAvg} / 20`]);

    autoTable(doc, {
      startY: y,
      head: [[vocabulary.term, 'Statut de l\'évaluation', 'Moyenne Obtenue']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: '#f3f4f6', textColor: c.textDark, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4, textColor: c.textDark },
      margin: { left: marginX, right: marginX },
      willDrawCell: function(data) {
        // Highlight the last row (Annual average)
        if (data.row.index === tableData.length - 1) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor('#1e3a8a'); // Blue for final result
        }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text("Aucun bulletin ou évaluation n'est disponible pour constituer le calcul de passage.", marginX, y + 5);
    y += 15;
  }

  // 5. DECISION BOX
  // Determine Pass / Fail if we have an average > 10
  let decisionTitle = "ATTENTE DE DÉLIBÉRATION";
  let decisionBg = '#f3f4f6';
  let decisionColor = '#4b5563';

  if (annualAvg) {
    if (Number(annualAvg) >= 10) {
      decisionTitle = vocabulary.passAction.toUpperCase();
      decisionBg = '#dcfce7'; // green-100
      decisionColor = '#166534'; // green-800
    } else {
      decisionTitle = vocabulary.failAction.toUpperCase();
      decisionBg = '#fee2e2'; // red-100
      decisionColor = '#991b1b'; // red-800
    }
  }

  doc.setFillColor(decisionBg);
  doc.setDrawColor(decisionColor);
  doc.setLineWidth(0.5);
  doc.rect(marginX, y, contentW, 15, 'FD');

  doc.setTextColor(decisionColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`DÉCISION DU JURY : ${decisionTitle}`, 105, y + 9, { align: 'center' });

  y += 30;

  // Generate Filename
  const safeName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const refId = `PV-${(student.matricule || 'STD').toUpperCase()}-${new Date().getFullYear()}`;

  // ===========================
  // 6. CLOSING & SIGNATURE
  // ===========================
  doc.setTextColor(c.textDark);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const currentDate = format(new Date(), 'dd MMMM yyyy', { locale: fr });
  const city = school?.city || school?.address?.split(',')[0] || 'la ville';
  doc.text(`Fait et validé en séance publique à ${city}, le ${currentDate}.`, marginX, y);

  y += 15;

  doc.setFillColor(c.infoBg);
  doc.roundedRect(pageW - marginX - 70, y, 70, 35, 3, 3, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(c.textDark);
  doc.text('Le Président du Jury', pageW - marginX - 35, y + 6, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(c.textLightGray);
  doc.text('(Signature et cachet)', pageW - marginX - 35, y + 11, { align: 'center' });
  
  // Provisoire watermark if uncompleted
  if (hasDrafts || countAvg === 0) {
    doc.setTextColor('#ff0000');
    doc.setFontSize(80);
    doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
    doc.text('PROVISOIRE', pageW / 2, pageH / 2, { align: 'center', angle: -45 });
    doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
  }

  // ===========================
  // 7. BOTTOM FOOTER
  // ===========================
  doc.setFillColor(c.headerBg);
  doc.rect(0, pageH - 10, pageW, 10, 'F');
  
  doc.setTextColor(c.white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Document électronique de l'administration -  ${refId}`,
    pageW / 2,
    pageH - 4,
    { align: 'center' }
  );

  const filename = `proces_verbal_${safeName}_${academicYear?.name?.replace(/[^a-z0-9]/gi, '_') || 'an'}.pdf`;

  doc.save(filename);
}
