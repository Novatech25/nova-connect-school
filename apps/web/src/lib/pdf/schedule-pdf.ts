import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ScheduleSlot {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subject?: { name: string };
  teacher?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    raw_user_meta_data?: any;
    metadata?: any;
  };
  room?: { name: string };
  class?: { name: string };
}

interface ScheduleData {
  name: string;
  description?: string;
  slots: ScheduleSlot[];
}

export interface SchoolInfo {
  name: string;
  logo_url?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

type ColorTuple = [number, number, number];

// ─── Constantes ─────────────────────────────────────────────────────────────

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAYS_LABEL: Record<string, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
};

const FULL_TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00',
];

// ─── Thème de couleur personnalisable ──────────────────────────────────────

export interface PdfColorTheme {
  headerBg:     [number, number, number]; // Fond bandeau en-tête
  headerAccent: [number, number, number]; // Liseré / accent en-tête
  slotBg:       [number, number, number]; // Fond créneau (début)
  slotText:     [number, number, number]; // Texte créneau (début)
  slotContBg:   [number, number, number]; // Fond créneau (continuation)
  slotContText: [number, number, number]; // Texte créneau (continuation)
}

// Thème bleu par défaut
export const DEFAULT_PDF_THEME: PdfColorTheme = {
  headerBg:     [15,  40,  90],
  headerAccent: [37,  99, 235],
  slotBg:       [219, 234, 254],
  slotText:     [30,  64, 175],
  slotContBg:   [239, 246, 255],
  slotContText: [96, 130, 200],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const loadImage = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Failed to load school logo', e);
    return null;
  }
};

const getTeacherName = (t: any): string => {
  if (!t) return '';
  const meta = t.raw_user_meta_data || (t as any).metadata || {};
  const firstName = t.first_name || meta.first_name || meta.firstName || t.firstName || '';
  const lastName = t.last_name || meta.last_name || meta.lastName || t.lastName || '';
  const displayName = meta.display_name || meta.displayName || meta['Display Name'] || meta.full_name || meta.fullName;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (displayName) return displayName;
  return firstName || lastName || t.email || '';
};

// Associe chaque matière à un index de couleur (conservé pour la légende)
const buildSubjectColorMap = (slots: ScheduleSlot[]): Map<string, number> => {
  const map = new Map<string, number>();
  let idx = 0;
  for (const slot of slots) {
    const name = slot.subject?.name || 'Cours';
    if (!map.has(name)) {
      map.set(name, idx);
      idx++;
    }
  }
  return map;
};

// ─── Générateur principal ─────────────────────────────────────────────────────

export const generateSchedulePdf = async (
  schedule: ScheduleData,
  schoolData?: SchoolInfo,
  academicYearName?: string,
  teachers: any[] = [],
  colorTheme: PdfColorTheme = DEFAULT_PDF_THEME
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const PAGE_W = 297;
  const PAGE_H = 210;
  const MARGIN = 10;

  // Couleurs thème (depuis colorTheme) + neutres
  const NAVY:       ColorTuple = colorTheme.headerBg     as ColorTuple;
  const BLUE:       ColorTuple = colorTheme.headerAccent as ColorTuple;
  const SLOT_BG:      ColorTuple = colorTheme.slotBg       as ColorTuple;
  const SLOT_TEXT:    ColorTuple = colorTheme.slotText     as ColorTuple;
  const SLOT_CONT_BG: ColorTuple = colorTheme.slotContBg  as ColorTuple;
  const SLOT_CONT_TEXT: ColorTuple = colorTheme.slotContText as ColorTuple;
  const GRAY_BG: ColorTuple = [248, 250, 252];
  const GRAY_LINE: ColorTuple = [203, 213, 225];
  const WHITE: ColorTuple = [255, 255, 255];
  const TEXT_LIGHT: ColorTuple = [100, 116, 139];
  const TEXT_MID: ColorTuple = [51, 65, 85];

  // ── Map couleurs par matière ──
  const subjectColorMap = buildSubjectColorMap(schedule.slots);

  // ── Chargement du logo ──
  let logoBase64: string | null = null;
  if (schoolData?.logo_url) {
    logoBase64 = await loadImage(schoolData.logo_url);
  }

  // ── Filtrer les créneaux horaires actifs ──
  const activeTimeSlots = FULL_TIME_SLOTS.filter(time => {
    const tHour = parseInt(time.split(':')[0]);
    return schedule.slots.some(slot => {
      const sStart = parseInt(slot.startTime.split(':')[0]);
      const sEnd = parseInt(slot.endTime.split(':')[0]);
      return sStart <= tHour && sEnd > tHour;
    });
  });
  const displayedSlots = activeTimeSlots.length > 0 ? activeTimeSlots : ['08:00', '09:00', '10:00', '11:00', '12:00'];

  // ────────────────────────────────────────────────────────────────────────────
  // EN-TÊTE
  // ────────────────────────────────────────────────────────────────────────────

  // Bandeau de fond bleu marine (haut)
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, PAGE_W, 34, 'F');

  // Liseré bleu vif (séparateur bas de l'en-tête)
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.rect(0, 34, PAGE_W, 1.5, 'F');

  // ── Logo ──
  let logoEndX = MARGIN;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', MARGIN, 5, 22, 22);
      logoEndX = MARGIN + 26;
    } catch (e) {
      console.warn('Logo non ajouté', e);
    }
  } else {
    // Carré placeholder avec initiales
    doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.roundedRect(MARGIN, 5, 22, 22, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const initial = (schoolData?.name || 'N').charAt(0).toUpperCase();
    doc.text(initial, MARGIN + 11, 19, { align: 'center' });
    logoEndX = MARGIN + 26;
  }

  // ── Nom de l'établissement ──
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  const schoolName = schoolData?.name || 'NovaConnect';
  doc.text(schoolName.toUpperCase(), logoEndX, 14);

  // ── Adresse sous le nom ──
  if (schoolData?.address || schoolData?.city) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 200, 240);
    const addressParts = [schoolData?.address, schoolData?.city, schoolData?.country].filter(Boolean);
    doc.text(addressParts.join(', '), logoEndX, 21);
  }

  // ── Contact (email / tél) ──
  const contacts: string[] = [];
  if (schoolData?.phone) contacts.push(`Tel: ${schoolData.phone}`);
  if (schoolData?.email) contacts.push(`Email: ${schoolData.email}`);
  if (contacts.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 185, 230);
    doc.text(contacts.join('   '), logoEndX, 27.5);
  }

  // ── Bloc droite : Titre emploi du temps + Année scolaire ──
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('EMPLOI DU TEMPS', PAGE_W - MARGIN, 11, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 220, 255);
  doc.text(schedule.name, PAGE_W - MARGIN, 18, { align: 'right' });

  if (academicYearName) {
    doc.setFontSize(8);
    doc.text(`Année scolaire : ${academicYearName}`, PAGE_W - MARGIN, 25, { align: 'right' });
  }

  // ── Ligne date de génération ──
  const dateStr = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(180, 195, 220);
  doc.text(`Généré le ${dateStr}`, PAGE_W - MARGIN, 31, { align: 'right' });

  // ── Description (si présente) sous le bandeau ──
  let tableStartY = 40;
  if (schedule.description) {
    doc.setTextColor(TEXT_MID[0], TEXT_MID[1], TEXT_MID[2]);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text(`${schedule.description}`, MARGIN, tableStartY);
    tableStartY += 5;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CONSTRUCTION DU TABLEAU
  // ────────────────────────────────────────────────────────────────────────────

  const head = [['Horaires', ...DAYS.map(d => DAYS_LABEL[d])]];

  const body = displayedSlots.map((time) => {
    const hour = parseInt(time.split(':')[0]);
    const isLunchBreak = hour === 12; // Pause méridienne

    // Colonne Heure
    const timeCell: any = {
      content: `${time}`,
      styles: {
        halign: 'center',
        valign: 'middle',
        fontStyle: 'bold',
        fillColor: isLunchBreak ? [255, 247, 205] as ColorTuple : GRAY_BG,
        textColor: isLunchBreak ? [133, 77, 14] as ColorTuple : TEXT_LIGHT,
        fontSize: 8,
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
        minCellHeight: 14,
      },
    };

    const row: any[] = [timeCell];

    DAYS.forEach(day => {
      // Créneau occupé ?
      const coveringSlot = schedule.slots.find(s => {
        if (s.dayOfWeek !== day) return false;
        const sStart = parseInt(s.startTime.split(':')[0]);
        const sEnd = parseInt(s.endTime.split(':')[0]);
        return sStart <= hour && sEnd > hour;
      });

      if (coveringSlot) {
        const teacher = (coveringSlot as any).teacherId && teachers.length > 0
          ? teachers.find(t => t.id === (coveringSlot as any).teacherId)
          : coveringSlot.teacher;

        const teacherName = getTeacherName(teacher);
        const subjectName = coveringSlot.subject?.name || 'Cours';
        const roomName = coveringSlot.room?.name || '';
        const className = coveringSlot.class?.name || '';
        const isStart = coveringSlot.startTime.startsWith(time);


        // Construction du contenu de la cellule
        let content = '';
        if (isStart) {
          content = subjectName.toUpperCase();
          if (teacherName) content += `\nProf. ${teacherName}`;
          if (className) content += `\nClasse : ${className}`;
          if (roomName) content += `\nSalle : ${roomName}`;
        } else {
          content = `[ ${subjectName} ]`;
        }

        row.push({
          content,
          styles: {
            fillColor: isStart ? SLOT_BG : SLOT_CONT_BG,
            textColor: isStart ? SLOT_TEXT : SLOT_CONT_TEXT,
            fontStyle: isStart ? 'bold' : 'italic',
            halign: 'center',
            valign: 'middle',
            fontSize: isStart ? 8 : 7,
            cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
            lineWidth: 0.2,
            lineColor: GRAY_LINE,
            minCellHeight: 14,
          },
        });
      } else if (isLunchBreak) {
        // Pause déjeuner
        row.push({
          content: 'PAUSE DEJEUNER',
          styles: {
            fillColor: [255, 251, 235] as ColorTuple,
            textColor: [161, 111, 30] as ColorTuple,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            fontSize: 7,
            lineWidth: 0.2,
            lineColor: [253, 211, 77] as ColorTuple,
            minCellHeight: 14,
          },
        });
      } else {
        row.push({
          content: '',
          styles: {
            fillColor: WHITE,
            lineWidth: 0.1,
            lineColor: GRAY_LINE,
            minCellHeight: 14,
          },
        });
      }
    });

    return row;
  });

  // ────────────────────────────────────────────────────────────────────────────
  // RENDU AUTOTABLE
  // ────────────────────────────────────────────────────────────────────────────

  autoTable(doc, {
    startY: tableStartY,
    head: head,
    body: body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      overflow: 'linebreak',
      lineColor: GRAY_LINE,
      lineWidth: 0.2,
      valign: 'middle',
      minCellHeight: 14,
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255] as ColorTuple,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 9,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      lineWidth: 0,
      minCellHeight: 12,
    },
    columnStyles: {
      0: {
        cellWidth: 18,
        halign: 'center',
        valign: 'middle',
        fontStyle: 'bold',
        fillColor: GRAY_BG,
        textColor: TEXT_LIGHT,
        fontSize: 8,
      },
    },
    didParseCell: (data: any) => {
      // Alternance légère des lignes vides
      if (data.section === 'body' && data.column.index > 0 && data.cell.text.join('') === '') {
        const isEvenRow = data.row.index % 2 === 0;
        if (isEvenRow) {
          data.cell.styles.fillColor = [252, 254, 255] as ColorTuple;
        }
      }
    },
    didDrawPage: (_data: unknown) => {
      // ── Pied de page ──
      const pageHeight = PAGE_H;

      // Ligne séparatrice pied de page
      doc.setDrawColor(GRAY_LINE[0], GRAY_LINE[1], GRAY_LINE[2]);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, pageHeight - 12, PAGE_W - MARGIN, pageHeight - 12);

      // Texte gauche : pagination
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2]);
      doc.text(
        `Page ${(doc.internal as unknown as { pages: unknown[] }).pages.length - 1}`,
        MARGIN,
        pageHeight - 7
      );

      // Texte centre : nom de l'emploi du temps
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(
        schedule.name,
        PAGE_W / 2,
        pageHeight - 7,
        { align: 'center' }
      );

      // Texte droit : branding
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2]);
      doc.text('NovaConnect - Systeme de gestion scolaire', PAGE_W - MARGIN, pageHeight - 7, { align: 'right' });
    },
    margin: { top: tableStartY + 2, bottom: 16, left: MARGIN, right: MARGIN },
    showHead: 'everyPage',
  });

  // ────────────────────────────────────────────────────────────────────────────
  // LÉGENDE DES MATIÈRES (si plusieurs pages ou espace)
  // ────────────────────────────────────────────────────────────────────────────

  // Liste des matieres uniques pour la legende
  const subjectNames = Array.from(subjectColorMap.keys());
  if (subjectNames.length > 0) {
    const finalY = (doc as any).lastAutoTable?.finalY as number || tableStartY + 40;
    const legendY = finalY + 5;

    if (legendY < PAGE_H - 20) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_MID[0], TEXT_MID[1], TEXT_MID[2]);
      doc.text('Matieres :', MARGIN, legendY);

      let lx = MARGIN + 20;
      const ly = legendY;
      for (const subj of subjectNames) {
        const boxW = Math.min(doc.getTextWidth(subj) + 8, 45);
        if (lx + boxW > PAGE_W - MARGIN - 5) break;

        doc.setFillColor(SLOT_BG[0], SLOT_BG[1], SLOT_BG[2]);
        doc.roundedRect(lx, ly - 3.5, boxW, 5, 1, 1, 'F');
        doc.setDrawColor(SLOT_TEXT[0], SLOT_TEXT[1], SLOT_TEXT[2]);
        doc.setLineWidth(0.3);
        doc.roundedRect(lx, ly - 3.5, boxW, 5, 1, 1, 'S');

        doc.setTextColor(SLOT_TEXT[0], SLOT_TEXT[1], SLOT_TEXT[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.text(subj, lx + boxW / 2, ly, { align: 'center' });

        lx += boxW + 3;
      }
    }
  }

  // ── Sauvegarde ──
  const filename = `Emploi_du_temps_${schedule.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
};
