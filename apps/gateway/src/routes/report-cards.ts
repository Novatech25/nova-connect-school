import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { loadLicenseConfig } from '../config/license.js';
import { getUserId, getUserRole } from '../middleware/rls.js';

type GeneratePayload = {
  studentId: string;
  periodId: string;
  regenerate?: boolean;
};

type BatchPayload = {
  classId: string;
  periodId: string;
  regenerate?: boolean;
};

const app = new Hono();

const config = loadLicenseConfig();
const supabaseAdmin =
  config.supabaseUrl && config.supabaseServiceRoleKey
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

function ensureAdminClient() {
  if (!supabaseAdmin) {
    throw new Error('Supabase service role not configured in gateway');
  }
  return supabaseAdmin;
}

function ensureRole(role?: string) {
  const allowed = new Set(['school_admin', 'accountant', 'super_admin']);
  if (!role || !allowed.has(role)) {
    throw new Error('Unauthorized');
  }
}

const FALLBACK_APP_URL = 'http://localhost:3001';
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  FALLBACK_APP_URL;

function inferImageFormat(mimeType?: string, path?: string) {
  if (mimeType?.includes('png') || path?.toLowerCase().endsWith('.png')) {
    return 'PNG';
  }
  return 'JPEG';
}

async function fetchImageDataUrl(url: string, pathHint?: string) {
  const response = await fetch(url);
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type') || '';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = contentType || (pathHint?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    format: inferImageFormat(mimeType, pathHint),
  };
}

async function getSchoolLogoData(supabase: ReturnType<typeof createClient>, logoPath?: string | null) {
  if (!logoPath) return null;
  try {
    const { data: logoData } = await supabase.storage
      .from('school-logos')
      .createSignedUrl(logoPath, 60);
    if (!logoData?.signedUrl) return null;
    return await fetchImageDataUrl(logoData.signedUrl, logoPath);
  } catch (error) {
    console.warn('Failed to load school logo:', error);
    return null;
  }
}

async function generateQrDataUrl(value: string) {
  try {
    return await QRCode.toDataURL(value, {
      margin: 1,
      width: 180,
    });
  } catch (error) {
    console.warn('Failed to generate QR code:', error);
    return null;
  }
}

// Couleurs professionnelles
const COLORS = {
  primary: [30, 58, 138],      // Bleu foncé
  secondary: [59, 130, 246],   // Bleu moyen
  accent: [16, 185, 129],      // Vert succès
  warning: [245, 158, 11],     // Orange
  danger: [239, 68, 68],       // Rouge
  text: {
    dark: [15, 23, 42],        // Presque noir
    medium: [71, 85, 105],     // Gris foncé
    light: [148, 163, 184],    // Gris clair
  },
  background: {
    header: [248, 250, 252],   // Gris très clair
    rowEven: [241, 245, 249],  // Gris bleuté
    rowOdd: [255, 255, 255],   // Blanc
    highlight: [224, 242, 254], // Bleu très clair
  }
};

function getMentionColor(mention?: string): number[] {
  if (!mention) return COLORS.text.medium;
  const m = mention.toLowerCase();
  if (m.includes('excellent') || m.includes('très bien') || m.includes('tres bien')) return COLORS.accent;
  if (m.includes('bien')) return [59, 130, 246];
  if (m.includes('assez bien')) return [245, 158, 11];
  if (m.includes('passable')) return [249, 115, 22];
  return COLORS.danger;
}

function drawRoundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, style: 'F' | 'S' | 'DF' = 'DF') {
  const radius = Math.min(r, w / 2, h / 2);
  doc.roundedRect(x, y, w, h, radius, radius, style);
}

async function generateReportCardPdf(params: {
  studentId: string;
  periodId: string;
  regenerate?: boolean;
  userId?: string;
  schoolId?: string;
}) {
  const supabase = ensureAdminClient();

  const { studentId, periodId, regenerate, userId } = params;

  const { data: existingCard } = await supabase
    .from('report_cards')
    .select('*')
    .eq('student_id', studentId)
    .eq('period_id', periodId)
    .single();

  if (existingCard && !regenerate) {
    const { data: signedUrlData } = await supabase.storage
      .from('report-cards')
      .createSignedUrl(existingCard.pdf_url, 3600);

    const existingSubjectAverages = Array.isArray(existingCard.subject_averages)
      ? existingCard.subject_averages
      : typeof existingCard.subject_averages === 'string'
        ? JSON.parse(existingCard.subject_averages || '[]')
        : [];

    return {
      reportCard: existingCard,
      signedUrl: signedUrlData?.signedUrl || null,
      message: 'Report card already exists',
      hasPublishedGrades: existingSubjectAverages.length > 0,
    };
  }

  const { data: reportData, error: dataError } = await supabase.rpc(
    'generate_report_card_data',
    {
      p_student_id: studentId,
      p_period_id: periodId,
    }
  );

  if (dataError) {
    throw new Error(dataError.message || 'Failed to generate report card data');
  }

  if (!reportData || reportData.length === 0) {
    throw new Error('No report card data returned for this student/period');
  }

  const cardData = reportData[0];

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, first_name, last_name, matricule, school_id, date_of_birth, place_of_birth')
    .eq('id', studentId)
    .single();

  if (studentError || !student) {
    throw new Error('Failed to fetch student data');
  }

  const { data: studentClass } = await supabase
    .from('classes')
    .select('id, name, level_id')
    .eq('id', cardData.class_id)
    .single();

  const { data: period } = await supabase
    .from('periods')
    .select('id, name, academic_year_id, start_date, end_date')
    .eq('id', periodId)
    .single();

  if (!period) {
    throw new Error('Failed to fetch period data');
  }

  const { data: school } = await supabase
    .from('schools')
    .select('id, name, logo_url, address, city, country, phone, email, website')
    .eq('id', student.school_id)
    .single();

  const subjectAverages = Array.isArray(cardData.subject_averages)
    ? cardData.subject_averages
    : typeof cardData.subject_averages === 'string'
      ? JSON.parse(cardData.subject_averages || '[]')
      : [];
  const hasPublishedGrades = subjectAverages.length > 0;

  const { data: academicYear } = await supabase
    .from('academic_years')
    .select('id, name')
    .eq('id', cardData.academic_year_id)
    .single();

  const { data: level } = await supabase
    .from('levels')
    .select('name')
    .eq('id', studentClass?.level_id)
    .single();

  // Récupérer l'effectif total de la classe
  const { data: classStats } = await supabase
    .from('enrollments')
    .select('student_id')
    .eq('class_id', cardData.class_id)
    .eq('academic_year_id', cardData.academic_year_id);

  const logoData = await getSchoolLogoData(supabase, school?.logo_url);

  // Création du PDF avec marges professionnelles
  const doc = new jsPDF({ 
    unit: 'mm', 
    format: 'a4',
    orientation: 'portrait'
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // ========== EN-TÊTE PROFESSIONNEL ==========
  let yPos = margin;
  
  // Bandeau supérieur coloré
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  // Logo (si disponible)
  if (logoData?.dataUrl) {
    try {
      doc.addImage(logoData.dataUrl, logoData.format, margin, 5, 25, 25);
    } catch (e) {
      console.warn('Failed to add logo:', e);
    }
  }
  
  // Nom de l'école
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(school?.name?.toUpperCase() || 'ECOLE', pageWidth / 2, 15, { align: 'center' });
  
  // Type de document
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('BULLETIN DE NOTES', pageWidth / 2, 24, { align: 'center' });
  
  // Année scolaire
  doc.setFontSize(10);
  doc.text(`Année Scolaire: ${academicYear?.name || '-'}`, pageWidth / 2, 31, { align: 'center' });
  
  // Contact en petit
  const contactParts = [];
  if (school?.address) contactParts.push(school.address);
  if (school?.city) contactParts.push(school.city);
  if (school?.phone) contactParts.push(`Tél: ${school.phone}`);
  if (school?.email) contactParts.push(school.email);
  
  if (contactParts.length > 0) {
    doc.setFontSize(7);
    doc.text(contactParts.join(' • '), pageWidth / 2, 39, { align: 'center' });
  }
  
  // Ligne de séparation
  doc.setDrawColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, 44, pageWidth - margin, 44);
  
  yPos = 50;

  // ========== INFORMATIONS ÉLÈVE (Carte d'identité) ==========
  doc.setFillColor(COLORS.background.header[0], COLORS.background.header[1], COLORS.background.header[2]);
  drawRoundedRect(doc, margin, yPos, contentWidth, 40, 3, 'F');
  
  // Bordure subtile
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  drawRoundedRect(doc, margin, yPos, contentWidth, 40, 3, 'S');
  
  doc.setTextColor(COLORS.text.dark[0], COLORS.text.dark[1], COLORS.text.dark[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('IDENTITÉ DE L\'ÉLÈVE', margin + 5, yPos + 8);
  
  // Informations en grille
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  const col1 = margin + 5;
  const col2 = margin + 65;
  const col3 = margin + 125;
  const rowHeight = 8;
  let infoY = yPos + 16;
  
  // Labels et valeurs
  const infos = [
    { label: 'Nom:', value: student.last_name?.toUpperCase(), x: col1 },
    { label: 'Prénom:', value: student.first_name, x: col1 },
    { label: 'Matricule:', value: student.matricule, x: col2 },
    { label: 'Classe:', value: studentClass?.name, x: col2 },
    { label: 'Niveau:', value: level?.name, x: col3 },
    { label: 'Période:', value: period.name, x: col3 },
  ];
  
  // Réorganiser en 3 colonnes
  doc.setFont('helvetica', 'bold');
  doc.text('Nom:', col1, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(student.last_name?.toUpperCase() || '-', col1 + 18, infoY);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Matricule:', col2, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(student.matricule || '-', col2 + 22, infoY);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Niveau:', col3, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(level?.name || '-', col3 + 18, infoY);
  
  infoY += rowHeight;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Prénom:', col1, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(student.first_name || '-', col1 + 18, infoY);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Classe:', col2, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(studentClass?.name || '-', col2 + 18, infoY);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Période:', col3, infoY);
  doc.setFont('helvetica', 'normal');
  doc.text(period.name, col3 + 18, infoY);
  
  // Date de naissance si disponible
  if (student.date_of_birth) {
    infoY += rowHeight;
    doc.setFont('helvetica', 'bold');
    doc.text('Né(e) le:', col1, infoY);
    doc.setFont('helvetica', 'normal');
    const birthDate = new Date(student.date_of_birth).toLocaleDateString('fr-FR');
    const birthPlace = student.place_of_birth ? ` à ${student.place_of_birth}` : '';
    doc.text(`${birthDate}${birthPlace}`, col1 + 18, infoY);
  }
  
  yPos += 48;

  // ========== TABLEAU DES NOTES ==========
  // En-tête du tableau
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(margin, yPos, contentWidth, 10, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('MATIÈRE', margin + 5, yPos + 6.5);
  doc.text('COEF.', pageWidth - margin - 50, yPos + 6.5, { align: 'center' });
  doc.text('MOYENNE', pageWidth - margin - 20, yPos + 6.5, { align: 'center' });
  
  yPos += 10;
  
  if (!hasPublishedGrades) {
    // Message si aucune note
    doc.setFillColor(254, 252, 232);
    doc.rect(margin, yPos, contentWidth, 20, 'F');
    doc.setDrawColor(251, 191, 36);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPos, contentWidth, 20, 'S');
    
    doc.setTextColor(161, 98, 7);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('Aucune note publiée pour cette période.', pageWidth / 2, yPos + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    yPos += 25;
  } else {
    // Lignes du tableau avec alternance
    const rowHeight = 8;
    
    subjectAverages.forEach((subject: any, index: number) => {
      const isEven = index % 2 === 0;
      
      // Fond alterné
      if (isEven) {
        doc.setFillColor(COLORS.background.rowEven[0], COLORS.background.rowEven[1], COLORS.background.rowEven[2]);
      } else {
        doc.setFillColor(COLORS.background.rowOdd[0], COLORS.background.rowOdd[1], COLORS.background.rowOdd[2]);
      }
      doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
      
      // Ligne de séparation subtile
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, yPos + rowHeight, pageWidth - margin, yPos + rowHeight);
      
      // Contenu
      doc.setTextColor(COLORS.text.dark[0], COLORS.text.dark[1], COLORS.text.dark[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(subject.subjectName || '-', margin + 5, yPos + 5.5);
      
      // Coefficient centré
      doc.text(String(subject.coefficient || 1), pageWidth - margin - 50, yPos + 5.5, { align: 'center' });
      
      // Moyenne avec couleur selon la valeur
      const avg = Number(subject.average || 0);
      if (avg >= 10) {
        doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
      } else if (avg >= 8) {
        doc.setTextColor(COLORS.warning[0], COLORS.warning[1], COLORS.warning[2]);
      } else {
        doc.setTextColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
      }
      doc.setFont('helvetica', 'bold');
      doc.text(avg.toFixed(2), pageWidth - margin - 20, yPos + 5.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(COLORS.text.dark[0], COLORS.text.dark[1], COLORS.text.dark[2]);
      
      yPos += rowHeight;
    });
    
    yPos += 3;
  }

  // ========== RÉCAPITULATIF (Encadré coloré) ==========
  const recapHeight = 45;
  
  // Fond dégradé subtil
  doc.setFillColor(COLORS.background.highlight[0], COLORS.background.highlight[1], COLORS.background.highlight[2]);
  drawRoundedRect(doc, margin, yPos, contentWidth, recapHeight, 5, 'F');
  
  // Bordure
  doc.setDrawColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
  doc.setLineWidth(1);
  drawRoundedRect(doc, margin, yPos, contentWidth, recapHeight, 5, 'S');
  
  const recapY = yPos + 10;
  const colWidth = contentWidth / 3;
  
  // Moyenne Générale
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('MOYENNE GÉNÉRALE', margin + colWidth * 0.5, recapY, { align: 'center' });
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const overallAvg = Number(cardData.overall_average || 0);
  doc.text(`${overallAvg.toFixed(2)}`, margin + colWidth * 0.5, recapY + 12, { align: 'center' });
  doc.setFontSize(10);
  doc.text('/20', margin + colWidth * 0.5 + 18, recapY + 12);
  
  // Barre de progression visuelle
  const barWidth = colWidth - 20;
  const barHeight = 6;
  const barX = margin + 10;
  const barY = recapY + 18;
  
  // Fond de la barre
  doc.setFillColor(220, 220, 220);
  doc.roundedRect(barX, barY, barWidth, barHeight, 3, 3, 'F');
  
  // Progression (max 20)
  const progressWidth = (overallAvg / 20) * barWidth;
  if (progressWidth > 0) {
    const progressColor = overallAvg >= 10 ? COLORS.accent : overallAvg >= 8 ? COLORS.warning : COLORS.danger;
    doc.setFillColor(progressColor[0], progressColor[1], progressColor[2]);
    doc.roundedRect(barX, barY, progressWidth, barHeight, 3, 3, 'F');
  }
  
  // Classement
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('CLASSEMENT', margin + colWidth * 1.5, recapY, { align: 'center' });
  
  doc.setTextColor(COLORS.text.dark[0], COLORS.text.dark[1], COLORS.text.dark[2]);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const rank = cardData.rank_in_class || '-';
  const classSize = cardData.class_size || (classStats?.length || 0);
  doc.text(`${rank}`, margin + colWidth * 1.5 - 8, recapY + 12, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`/${classSize}`, margin + colWidth * 1.5 + 8, recapY + 12);
  
  // Mention
  if (cardData.mention) {
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setFontSize(9);
    doc.text('MENTION', margin + colWidth * 2.5, recapY, { align: 'center' });
    
    const mentionColor = getMentionColor(cardData.mention);
    doc.setTextColor(mentionColor[0], mentionColor[1], mentionColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(cardData.mention.toUpperCase(), margin + colWidth * 2.5, recapY + 12, { align: 'center' });
  }
  
  yPos += recapHeight + 10;

  // ========== OBSERVATIONS ==========
  if (yPos + 30 < pageHeight - 50) {
    doc.setFillColor(250, 250, 250);
    drawRoundedRect(doc, margin, yPos, contentWidth, 30, 3, 'F');
    doc.setDrawColor(200, 200, 200);
    drawRoundedRect(doc, margin, yPos, contentWidth, 30, 3, 'S');
    
    doc.setTextColor(COLORS.text.medium[0], COLORS.text.medium[1], COLORS.text.medium[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVATIONS:', margin + 5, yPos + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text.light[0], COLORS.text.light[1], COLORS.text.light[2]);
    doc.text('_____________________________________________________________________________', margin + 5, yPos + 16);
    doc.text('_____________________________________________________________________________', margin + 5, yPos + 24);
    
    yPos += 35;
  }

  // ========== SIGNATURES ET QR CODE ==========
  const signatureY = pageHeight - 45;
  
  // Ligne de séparation
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(margin, signatureY - 5, pageWidth - margin, signatureY - 5);
  
  // Date et lieu
  doc.setTextColor(COLORS.text.medium[0], COLORS.text.medium[1], COLORS.text.medium[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const today = new Date().toLocaleDateString('fr-FR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  doc.text(`Fait à ${school?.city || '_______________'}, le ${today}`, margin, signatureY + 2);
  
  // Signature du Directeur
  doc.setFont('helvetica', 'bold');
  doc.text('LE DIRECTEUR', margin, signatureY + 15);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.text.light[0], COLORS.text.light[1], COLORS.text.light[2]);
  doc.setFontSize(7);
  doc.text('(Signature et cachet)', margin, signatureY + 22);
  
  // Ligne pour signature
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.5);
  doc.line(margin, signatureY + 28, margin + 50, signatureY + 28);
  
  // Signature du Parent
  doc.setTextColor(COLORS.text.medium[0], COLORS.text.medium[1], COLORS.text.medium[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('LES PARENTS', margin + 70, signatureY + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('(Signature)', margin + 70, signatureY + 22);
  doc.line(margin + 70, signatureY + 28, margin + 120, signatureY + 28);
  
  // QR Code et tampon
  const verificationUrl = existingCard?.id
    ? `${APP_URL}/verify-report-card?id=${encodeURIComponent(existingCard.id)}`
    : `${APP_URL}/verify-report-card?studentId=${encodeURIComponent(studentId)}&periodId=${encodeURIComponent(periodId)}`;
  const qrDataUrl = await generateQrDataUrl(verificationUrl);
  
  if (qrDataUrl) {
    const qrSize = 22;
    const qrX = pageWidth - margin - qrSize - 5;
    const qrY = signatureY - 2;
    
    // Cadre autour du QR
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 12, 2, 2, 'S');
    
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    
    doc.setFontSize(6);
    doc.setTextColor(COLORS.text.light[0], COLORS.text.light[1], COLORS.text.light[2]);
    doc.text('Vérifier l\'authenticité', qrX + qrSize / 2, qrY + qrSize + 6, { align: 'center' });
  }
  
  // Tampon de statut
  const stampStatus = (existingCard?.status || "generated") === "published" ? "PUBLIÉ" : "BROUILLON";
  const stampColor = stampStatus === 'PUBLIÉ' ? COLORS.accent : COLORS.warning;
  
  doc.setDrawColor(stampColor[0], stampColor[1], stampColor[2]);
  doc.setLineWidth(1.5);
  doc.roundedRect(pageWidth - margin - 45, signatureY - 35, 40, 18, 3, 3, 'S');
  
  doc.setTextColor(stampColor[0], stampColor[1], stampColor[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(stampStatus, pageWidth - margin - 25, signatureY - 24, { align: 'center' });

  // ========== PIED DE PAGE ==========
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
  
  doc.setTextColor(COLORS.text.light[0], COLORS.text.light[1], COLORS.text.light[2]);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Document généré le ${new Date().toLocaleString('fr-FR')} - Réf: ${student.matricule || studentId.substring(0, 8)}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  // ========== SAUVEGARDE ==========
  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBuffer = Buffer.from(pdfArrayBuffer);

  const schoolId = school?.id || cardData.school_id || student.school_id;
  const fileName = `${schoolId}/${studentId}/${periodId}_${Date.now()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('report-cards')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    const errorMessage = uploadError.message?.includes('Bucket')
      ? 'Storage bucket "report-cards" introuvable. Créez-le dans Supabase Storage.'
      : uploadError.message || 'Failed to upload report card PDF';
    throw new Error(errorMessage);
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('report-cards')
    .createSignedUrl(fileName, 3600);

  if (signedUrlError || !signedUrlData) {
    throw new Error(signedUrlError?.message || 'Failed to generate signed URL');
  }

  const { data: paymentBalance } = await supabase.rpc('calculate_student_balance', {
    p_student_id: studentId,
    p_academic_year_id: cardData.academic_year_id,
  });

  const reportCardData = {
    school_id: schoolId,
    student_id: studentId,
    class_id: cardData.class_id,
    period_id: periodId,
    academic_year_id: cardData.academic_year_id,
    grading_scale_id: cardData.grading_scale_id,
    overall_average: cardData.overall_average,
    rank_in_class: cardData.rank_in_class,
    class_size: cardData.class_size,
    mention: cardData.mention,
    mention_color: cardData.mention_color,
    subject_averages: cardData.subject_averages,
    status: existingCard?.status || 'generated',
    generated_at: new Date().toISOString(),
    generated_by: userId || null,
    pdf_url: fileName,
    pdf_size_bytes: pdfBuffer.length,
    payment_status: paymentBalance?.payment_status || 'ok',
    payment_status_override: false,
  };

  const { data: reportCard, error: insertError } = existingCard
    ? await supabase
        .from('report_cards')
        .update(reportCardData)
        .eq('id', existingCard.id)
        .select()
        .single()
    : await supabase
        .from('report_cards')
        .insert(reportCardData)
        .select()
        .single();

  if (insertError) {
    throw new Error(insertError.message || 'Failed to save report card');
  }

  return {
    reportCard,
    signedUrl: signedUrlData.signedUrl,
    message: 'Report card generated successfully',
    hasPublishedGrades,
  };
}

app.post('/report-cards/generate', async (c) => {
  try {
    const userRole = getUserRole(c);
    ensureRole(userRole);

    const userId = getUserId(c);
    const payload = (await c.req.json()) as GeneratePayload;
    if (!payload?.studentId || !payload?.periodId) {
      return c.json({ error: 'Missing studentId or periodId' }, 400);
    }

    const result = await generateReportCardPdf({
      studentId: payload.studentId,
      periodId: payload.periodId,
      regenerate: payload.regenerate,
      userId,
    });

    return c.json({ success: true, ...result });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error?.message || 'Report card generation failed',
      },
      500
    );
  }
});

app.post('/report-cards/generate-batch', async (c) => {
  try {
    const userRole = getUserRole(c);
    ensureRole(userRole);

    const userId = getUserId(c);
    const payload = (await c.req.json()) as BatchPayload;
    if (!payload?.classId || !payload?.periodId) {
      return c.json({ error: 'Missing classId or periodId' }, 400);
    }

    const supabase = ensureAdminClient();
    const { data: period } = await supabase
      .from('periods')
      .select('academic_year_id')
      .eq('id', payload.periodId)
      .single();

    const periodYearId = period?.academic_year_id || null;

    let enrollQuery = supabase
      .from('enrollments')
      .select('student_id')
      .eq('class_id', payload.classId);

    if (periodYearId) {
      enrollQuery = enrollQuery.eq('academic_year_id', periodYearId);
    }

    const { data: enrollments, error: enrollError } = await enrollQuery;
    if (enrollError || !enrollments) {
      throw new Error(enrollError?.message || 'Failed to fetch enrollments');
    }

    const results = await Promise.allSettled(
      enrollments.map((enrollment) =>
        generateReportCardPdf({
          studentId: enrollment.student_id,
          periodId: payload.periodId,
          regenerate: payload.regenerate,
          userId,
        })
      )
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return c.json({
      success: true,
      successful,
      failed,
      total: enrollments.length,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error?.message || 'Report card batch generation failed',
      },
      500
    );
  }
});

export default app;
