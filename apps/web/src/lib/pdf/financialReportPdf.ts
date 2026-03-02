import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface StudentProfile {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string;
}

interface FeeSchedule {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  academic_year_id?: string;
  fee_type?: {
    name: string;
    category?: string;
  };
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  fee_schedule_id?: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

// Configuration visuelle stricte
const STYLE = {
  primary: [25, 118, 210] as [number, number, number], // Bleu foncé professionnel
  secondary: [240, 245, 250] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  lightText: [100, 116, 139] as [number, number, number],
  grid: [226, 232, 240] as [number, number, number],
  green: [16, 185, 129] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
};

const formatCurrency = (value: number) => {
  let formatted = new Intl.NumberFormat('fr-FR').format(Math.round(value));
  formatted = formatted.split(String.fromCharCode(8239)).join(' '); // espace insécable
  formatted = formatted.split(String.fromCharCode(160)).join(' ');  // espace insécable classique
  formatted = formatted.split(' ').join(' ');
  return `${formatted} FCFA`;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '--';
  return format(new Date(dateString), 'dd/MM/yyyy', { locale: fr });
};

export async function generateFinancialReportPdf(
  schoolInfo: any,
  student: StudentProfile,
  classInfo: any,
  allSchedules: FeeSchedule[],
  allPayments: Payment[],
  academicYears: AcademicYear[],
  generatedBy: string
) {
  // Option 'orientation' explicitement définie à 'p' pour Portrait
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  // --- CALCUL ROBUSTE DES TOTAUX GLOBAUX ---
  // On consolide les paiements liés aux échéances pour le calcul 'manuel'
  const validPayments = allPayments.filter(p => p.status === 'completed' || p.status === 'validated');
  const paymentsByScheduleId: Record<string, number> = {};
  validPayments.forEach(p => {
    if (p.fee_schedule_id) {
      paymentsByScheduleId[p.fee_schedule_id] = (paymentsByScheduleId[p.fee_schedule_id] || 0) + (Number(p.amount) || 0);
    }
  });

  let globalTotalDue = 0;
  let globalTotalPaid = 0;

  allSchedules.forEach(schedule => {
    const due = Number(schedule.amount) || 0;
    globalTotalDue += due;

    let paid = 0;
    if (schedule.status === 'paid') {
      paid = due;
    } else if ('paid_amount' in schedule && schedule['paid_amount'] !== undefined && schedule['paid_amount'] !== null) {
      paid = Number(schedule['paid_amount']) || 0;
    } else {
      paid = paymentsByScheduleId[schedule.id] || 0;
    }
    globalTotalPaid += paid;
  });

  const globalTotalArrears = Math.max(0, globalTotalDue - globalTotalPaid);

  // --- EN-TÊTE PROFESSIONNEL ---
  let logoBase64: string | null = null;
  if (schoolInfo?.logo_url) {
    try {
      const resp = await fetch(schoolInfo.logo_url);
      if (resp.ok) {
        const blob = await resp.blob();
        logoBase64 = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      console.warn('Logo ecole non charge pour le rapport global');
    }
  }

  // Bandeau bleu
  doc.setFillColor(...STYLE.primary);
  doc.rect(0, 0, pageWidth, 40, 'F');

  let textStartX = margin;

  if (logoBase64) {
    try {
      // Dimensions : X, Y, Largeur, Hauteur
      doc.addImage(logoBase64, 'JPEG', margin, 6, 28, 28);
      textStartX = margin + 35; // Décale le texte vers la droite
    } catch (e) {
      console.warn("Erreur ajout logo au PDF", e);
      // Fallback en cas d'erreur de rendu du logo
      doc.setFillColor(99, 145, 255);
      doc.roundedRect(margin, 6, 28, 28, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      const ini = (schoolInfo?.name || 'N').charAt(0).toUpperCase();
      doc.text(ini, margin + 14, 23, { align: 'center' });
      textStartX = margin + 35;
    }
  } else if (schoolInfo?.name) {
    // Fallback carré avec initiale si aucun logo n'a été fourni ou n'est disponible
    doc.setFillColor(99, 145, 255);
    doc.roundedRect(margin, 6, 28, 28, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const ini = (schoolInfo.name || 'N').charAt(0).toUpperCase();
    doc.text(ini, margin + 14, 23, { align: 'center' });
    textStartX = margin + 35;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(schoolInfo?.name || 'VOTRE ÉTABLISSEMENT', textStartX, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(schoolInfo?.address || 'Adresse non renseignée', textStartX, 28);
  if (schoolInfo?.phone) {
    doc.text(`Tél : ${schoolInfo.phone}`, textStartX, 34);
  }

  // --- TITRE DU DOCUMENT ---
  let y = 55;
  doc.setTextColor(...STYLE.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('BILAN FINANCIER GLOBAL', pageWidth / 2, y, { align: 'center' });
  
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...STYLE.lightText);
  // Date de génération
  doc.text(`Édité le ${format(new Date(), "dd MMMM yyyy à HH:mm", { locale: fr })}`, pageWidth / 2, y, { align: 'center' });

  // --- INFORMATIONS ÉTUDIANT ---
  y += 15;
  doc.setFillColor(...STYLE.secondary);
  doc.setDrawColor(...STYLE.primary);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 25, 3, 3, 'FD');

  doc.setTextColor(...STYLE.text);
  doc.setFontSize(10);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Nom / Prénom:', margin + 5, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${student.firstName} ${student.lastName}`, margin + 40, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('Matricule:', margin + 5, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(student.matricule || 'N/A', margin + 40, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.text('Classe actuelle:', margin + 100, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(classInfo?.name || 'N/A', margin + 130, y + 8);

  // --- RÉSUMÉ FINANCIER ---
  y += 35;
  
  // Blocs de résumé
  const blockWidth = (pageWidth - 2 * margin - 10) / 3;
  
  // Bloc 1: Total Exigé
  doc.setFillColor(...STYLE.secondary);
  doc.rect(margin, y, blockWidth, 20, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...STYLE.lightText);
  doc.text('TOTAL EXIGÉ', margin + blockWidth/2, y + 7, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(...STYLE.text);
  doc.text(formatCurrency(globalTotalDue), margin + blockWidth/2, y + 15, { align: 'center' });

  // Bloc 2: Total Payé
  doc.setFillColor(236, 253, 245); // Vert très clair
  doc.rect(margin + blockWidth + 5, y, blockWidth, 20, 'F');
  doc.setFontSize(9);
  doc.setTextColor(...STYLE.green);
  doc.text('TOTAL PAYÉ', margin + blockWidth + 5 + blockWidth/2, y + 7, { align: 'center' });
  doc.setFontSize(14);
  doc.text(formatCurrency(globalTotalPaid), margin + blockWidth + 5 + blockWidth/2, y + 15, { align: 'center' });

  // Bloc 3: Arriérés (Reste à payer)
  doc.setFillColor(254, 242, 242); // Rouge très clair
  doc.rect(margin + (blockWidth + 5)*2, y, blockWidth, 20, 'F');
  doc.setFontSize(9);
  doc.setTextColor(...STYLE.red);
  doc.text('RESTE À PAYER (ARRIÉRÉS)', margin + (blockWidth + 5)*2 + blockWidth/2, y + 7, { align: 'center' });
  doc.setFontSize(14);
  doc.text(formatCurrency(globalTotalArrears), margin + (blockWidth + 5)*2 + blockWidth/2, y + 15, { align: 'center' });

  y += 35;

  // --- DÉTAIL PAR ANNÉE ACADÉMIQUE ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...STYLE.text);
  doc.text('Détail des échéances (Historique complet)', margin, y);
  y += 5;

  // Grouper les échéances par année académique
  const mapYearNames: Record<string, string> = {};
  academicYears.forEach(y => { mapYearNames[y.id] = y.name; });

  const schedulesByYear: Record<string, FeeSchedule[]> = {};
  allSchedules.forEach(schedule => {
    const yearId = schedule.academic_year_id || 'unknown';
    if (!schedulesByYear[yearId]) {
      schedulesByYear[yearId] = [];
    }
    schedulesByYear[yearId].push(schedule);
  });

  // Pour chaque échéance, la logique de paiement (paymentsByScheduleId) a déjà été calculée plus haut 


  // Construire les lignes du tableau
  const tableData: any[] = [];

  // Trier les années (approche basique: par ID/clés existantes, on supposerait un tri sur name)
  const sortedYearIds = Object.keys(schedulesByYear).sort((a,b) => {
    const nameA = mapYearNames[a] || '';
    const nameB = mapYearNames[b] || '';
    // Trie descendant (2024-2025 puis 2023-2024)
    return nameB.localeCompare(nameA);
  });

  sortedYearIds.forEach(yearId => {
    const yearName = yearId === 'unknown' ? 'Année Non-Spécifiée' : (mapYearNames[yearId] || 'Année inconnue');
    
    // Ajouter une ligne d'en-tête pour l'année
    tableData.push([
      { content: `Année Scolaire : ${yearName}`, colSpan: 5, styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [15, 23, 42] } }
    ]);

    const yearSchedules = schedulesByYear[yearId] || [];
    // Trier les échéances par date
    yearSchedules.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    let yearTotalDue = 0;
    let yearTotalPaid = 0;

    yearSchedules.forEach(schedule => {
      const due = Number(schedule.amount) || 0;
      yearTotalDue += due;

      // Utiliser paid_amount depuis la base de données s'il existe (calculé par des triggers/vues ou l'API).
      // Sinon recalcul manuel via notre table de paiement.
      let paid = 0;
      if (schedule.status === 'paid') {
        paid = due; 
      } else if ('paid_amount' in schedule && schedule['paid_amount'] !== undefined && schedule['paid_amount'] !== null) {
        paid = Number(schedule['paid_amount']) || 0;
      } else {
        paid = paymentsByScheduleId[schedule.id] || 0;
      }
      
      yearTotalPaid += paid;
      
      const rest = Math.max(0, due - paid);

      tableData.push([
        schedule.fee_type?.name || 'Frais de scolarité',
        formatDate(schedule.due_date),
        formatCurrency(due),
        formatCurrency(paid),
        { 
          content: formatCurrency(rest), 
          styles: { textColor: rest > 0 ? [220, 38, 38] : [22, 163, 74], fontStyle: rest > 0 ? 'bold' : 'normal' }
        }
      ]);
    });

    // Ajouter ligne de sous-total de l'année
    const yearRest = Math.max(0, yearTotalDue - yearTotalPaid);
    tableData.push([
      { content: 'Sous-total', colSpan: 2, styles: { fontStyle: 'italic', halign: 'right' } },
      { content: formatCurrency(yearTotalDue), styles: { fontStyle: 'bold' } },
      { content: formatCurrency(yearTotalPaid), styles: { fontStyle: 'bold', textColor: [22, 163, 74] } },
      { content: formatCurrency(yearRest), styles: { fontStyle: 'bold', textColor: yearRest > 0 ? [220, 38, 38] : [22, 163, 74] } }
    ]);
  });

  autoTable(doc, {
    startY: y,
    head: [['Désignation', 'Échéance', 'Exigé', 'Payé', 'Reste à payer']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: STYLE.primary,
      textColor: 255,
      fontSize: 10,
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    margin: { left: margin, right: margin },
  });

  // --- SIGNATURES ---
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('L\'Administration / La Comptabilité', margin, finalY);
  
  // Espace pour signature
  doc.setDrawColor(...STYLE.lightText);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, finalY + 15, margin + 60, finalY + 15);
  doc.setLineDashPattern([], 0); // reset

  // Généré par
  if (generatedBy) {
    doc.setFontSize(8);
    doc.setTextColor(...STYLE.lightText);
    doc.text(`Document généré par l'utilisateur : ${generatedBy}`, pageWidth - margin, finalY + 15, { align: 'right' });
  }

  // --- PIED DE PAGE ---
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} sur ${pageCount} - NovaConnect`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Ouverture dans un nouvel onglet
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
}
