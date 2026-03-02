import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function downloadLessonLogsPdf(logs: any[], school: any = {}) {
  // Mode paysage pour plus de place (contenu très large)
  const doc = new jsPDF('l', 'mm', 'a4'); 
  
  // En-tête coloré
  const primaryColor: [number, number, number] = [30, 58, 138]; // blue-900 (Très pro)
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 297, 35, 'F');
  
  // Informations de l'école (à gauche)
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255); // Blanc
  doc.setFont('helvetica', 'bold');
  doc.text((school?.name || 'Établissement').toUpperCase(), 14, 12);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240); // slate-200
  let yContact = 18;
  if (school?.address) {
    doc.text(school.address, 14, yContact);
    yContact += 5;
  }
  if (school?.phone || school?.email) {
    const contactStr = [school?.phone ? `Tél: ${school.phone}` : '', school?.email ? `Email: ${school.email}` : ''].filter(Boolean).join('  |  ');
    doc.text(contactStr, 14, yContact);
  }

  // Titre principal du document centralisé plus bas ou au milieu
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPORT DES CAHIERS DE TEXTES', 148.5, 20, { align: 'center' });
  
  // Date d'édition (à droite)
  const today = format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Édité le ${today}`, 283, 12, { align: 'right' });

  // Formatage des données
  const tableData = logs.map(log => {
      const dateStr = log.sessionDate || log.session_date;
      const formattedDate = dateStr ? format(new Date(dateStr), 'dd/MM/yyyy') : '--';
      
      const teacherName = `${log.teacher?.firstName || log.teacher?.first_name || ''} ${log.teacher?.lastName || log.teacher?.last_name || ''}`.trim();
      const className = log.class?.name || '--';
      const subjectName = log.subject?.name || '--';
      
      const duration = log.durationMinutes || log.duration_minutes || 0;
      const h = Math.floor(duration / 60);
      const m = duration % 60;
      const durationStr = h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}` : `${m}min`;

      // Status translation
      let statusStr = log.status;
      if (statusStr === 'validated') statusStr = 'Validé';
      else if (statusStr === 'pending_validation') statusStr = 'En attente';
      else if (statusStr === 'rejected') statusStr = 'Rejeté';
      else if (statusStr === 'draft') statusStr = 'Brouillon';

      return [
        formattedDate,
        teacherName,
        className,
        subjectName,
        log.theme || '--',
        log.content || '--',
        statusStr,
        durationStr
      ];
  });
  
  // Calcul du volume horaire total
  const totalMinutes = logs.reduce((acc, log) => acc + (log.durationMinutes || log.duration_minutes || 0), 0);
  const totalH = Math.floor(totalMinutes / 60);
  const totalM = totalMinutes % 60;
  const totalDurationStr = totalH > 0 ? `${totalH}h${totalM > 0 ? totalM.toString().padStart(2, '0') : ''}` : `${totalM}min`;

  autoTable(doc, {
    startY: 45,
    head: [['Date', 'Enseignant', 'Classe', 'Matière', 'Thème/Titre', 'Contenu détaillé', 'Statut', 'Durée']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255 }, // Même couleur que l'en-tête
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 30 },
      4: { cellWidth: 40 },
      5: { cellWidth: 'auto' }, // Prendra l'espace restant
      6: { cellWidth: 20 },
      7: { cellWidth: 15, halign: 'center' }
    },
    didDrawPage: (data) => {
        // Footer (numéro de page)
        const str = 'Page ' + doc.getCurrentPageInfo().pageNumber;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
            str,
            data.settings.margin.left,
            doc.internal.pageSize.height - 10
        );
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 45;
  
  // Boîte de résumé
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(14, finalY + 10, 100, 25, 'FD'); // Fill and Draw outline
  
  doc.setFontSize(10);
  doc.setTextColor(33, 37, 41);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre de séances : ${logs.length}`, 20, finalY + 18);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Volume horaire cumulé : ${totalDurationStr}`, 20, finalY + 28);

  doc.save('Export_Cahiers_de_textes.pdf');
}
