'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, FileText, Receipt, Eye, X, Users, Download, Bell, Send } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useAuthContext } from '@novaconnect/data/providers';
import {
  useClasses,
  useEnrollments,
  useFeeSchedules,
  useFeeTypes,
  useLevels,
  usePaymentExemptions,
  usePayments,
  usePaymentStats,
  useRecordPayment,
  useStudents,
  useGenerateReceipt,
  useSchool,
  useSendReminders,
} from '@novaconnect/data';
import { getAcademicYearsSecure } from '@/actions/payment-actions';

const cycleLabels: Record<string, string> = {
  primary: 'Primaire',
  middle_school: 'College',
  high_school: 'Lycee',
  university: 'Universite',
};

const paymentMethodLabels: Record<string, string> = {
  cash: 'Especes',
  bank_transfer: 'Virement bancaire',
  check: 'Cheque',
  mobile_money: 'Mobile Money',
  card: 'Carte',
  other: 'Autre',
};

const scheduleStatusLabels: Record<string, string> = {
  pending: 'En attente',
  paid: 'Paye',
  partial: 'Partiel',
  overdue: 'En retard',
  cancelled: 'Annule',
};

const reminderTypeLabels: Record<string, string> = {
  first: 'Premier rappel',
  second: 'Deuxième rappel',
  final: 'Dernier avis',
};

const scheduleStatusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-blue-100 text-blue-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-700',
};

const formatCurrency = (value?: number | null) => {
  const safeValue = typeof value === 'number' ? value : 0;
  return `${Math.round(safeValue).toLocaleString('fr-FR')} FCFA`;
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return '--';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('fr-FR');
};

export default function AccountantPaymentsPage() {
  const { user, profile } = useAuthContext();

  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    (user?.user_metadata as any)?.schoolId ||
    (user?.user_metadata as any)?.school_id ||
    (user as any)?.schoolId ||
    (user as any)?.school_id;

  const [activeTab, setActiveTab] = useState<'students' | 'payments' | 'schedules' | 'exemptions'>('students');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
  const [cycleFilter, setCycleFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [feeTypeFilter, setFeeTypeFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [recordForm, setRecordForm] = useState({
    amount: 0,
    paymentMethod: 'cash',
    referenceNumber: '',
    notes: '',
    paymentDate: new Date().toISOString().split('T')[0], // Date du jour par défaut
  });

  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderConfig, setReminderConfig] = useState<{
    type: 'first' | 'second' | 'final';
    studentIds: string[];
    isGlobal: boolean;
  }>({
    type: 'first',
    studentIds: [],
    isGlobal: false,
  });

  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);
  const [generatingPaymentId, setGeneratingPaymentId] = useState<string | null>(null);

  const [academicYears, setAcademicYears] = useState<any[]>([]);

  useEffect(() => {
    async function loadYears() {
      if (schoolId) {
        const { data } = await getAcademicYearsSecure(schoolId);
        if (data) setAcademicYears(data);
      }
    }
    loadYears();
  }, [schoolId]);

  const defaultAcademicYearId = useMemo(() => {
    const current = academicYears.find((year: any) => year.isCurrent || year.is_current || year.current);
    return current?.id || academicYears[0]?.id || '';
  }, [academicYears]);

  const activeAcademicYearId = selectedAcademicYearId || defaultAcademicYearId;

  const { data: levels = [] } = useLevels(schoolId || '');
  const { data: classes = [] } = useClasses(schoolId || '', activeAcademicYearId || undefined);
  const { data: enrollments = [] } = useEnrollments(schoolId || '', activeAcademicYearId || undefined);
  const { data: feeTypes = [] } = useFeeTypes(schoolId || '');
  const { data: students = [] } = useStudents(schoolId || '');

  const paymentFilters = useMemo(() => {
    return {
      schoolId: schoolId || undefined,
      studentId: studentFilter !== 'all' ? studentFilter : undefined,
      paymentMethod: paymentMethodFilter !== 'all' ? (paymentMethodFilter as any) : undefined,
      // Envoi des dates en ISO string (YYYY-MM-DD) pour compatibilité Supabase
      dateFrom: dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined,
      dateTo: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
    };
  }, [schoolId, studentFilter, paymentMethodFilter, dateFrom, dateTo]);

  const scheduleFilters = useMemo(() => {
    return {
      schoolId: schoolId || undefined,
      studentId: studentFilter !== 'all' ? studentFilter : undefined,
      academicYearId: activeAcademicYearId || undefined,
      feeTypeId: feeTypeFilter !== 'all' ? feeTypeFilter : undefined,
      status: scheduleStatusFilter !== 'all' ? (scheduleStatusFilter as any) : undefined,
    };
  }, [schoolId, studentFilter, activeAcademicYearId, feeTypeFilter, scheduleStatusFilter]);

  const { data: payments = [], isLoading: paymentsLoading } = usePayments(paymentFilters as any);
  const { data: feeSchedules = [], isLoading: schedulesLoading } = useFeeSchedules(scheduleFilters as any);

  // Debug: Log fee schedules when they change
  useMemo(() => {
    console.log('🔍 useFeeSchedules updated - schedulesLoading:', schedulesLoading, 'feeSchedules.length:', feeSchedules.length);
    if (feeSchedules.length > 0) {
      console.log('📊 Raw feeSchedules data:', feeSchedules);
    } else {
      console.log('⚠️ No fee schedules found with filters:', scheduleFilters);
    }
  }, [feeSchedules, schedulesLoading]);
  const { data: paymentStats } = usePaymentStats(schoolId || '', activeAcademicYearId || '');
  const { school: schoolInfo } = useSchool(schoolId || '');
  const { data: paymentExemptions = [], isLoading: exemptionsLoading } = usePaymentExemptions(
    schoolId || '',
    studentFilter !== 'all' ? studentFilter : undefined
  );

  const recordPayment = useRecordPayment();
  const generateReceipt = useGenerateReceipt();
  const sendReminders = useSendReminders();

  const levelIdsByType = useMemo(() => {
    const map: Record<string, string[]> = {};
    levels.forEach((level: any) => {
      const type = level.levelType || 'other';
      if (!map[type]) {
        map[type] = [];
      }
      map[type].push(level.id);
    });
    return map;
  }, [levels]);

  const classById = useMemo(() => {
    const map = new Map<string, any>();
    classes.forEach((item: any) => map.set(item.id, item));
    return map;
  }, [classes]);

  const studentClassMap = useMemo(() => {
    const map = new Map<string, string>();
    enrollments.forEach((enrollment: any) => {
      if (!map.has(enrollment.studentId)) {
        map.set(enrollment.studentId, enrollment.classId);
      }
    });
    return map;
  }, [enrollments]);

  const classesForCycle = useMemo(() => {
    if (cycleFilter === 'all') return classes;
    return classes.filter((item: any) => item.level?.levelType === cycleFilter);
  }, [classes, cycleFilter]);

  const levelsForCycle = useMemo(() => {
    if (cycleFilter === 'all') return levels;
    return levels.filter((lvl: any) => lvl.levelType === cycleFilter);
  }, [levels, cycleFilter]);

  const classesForLevel = useMemo(() => {
    const base = cycleFilter === 'all' ? classes : classesForCycle;
    if (levelFilter === 'all') return base;
    return base.filter((item: any) => item.level?.id === levelFilter);
  }, [classes, classesForCycle, cycleFilter, levelFilter]);

  const feeTypesForCycle = useMemo(() => {
    if (cycleFilter === 'all') return feeTypes;
    const allowedLevels = new Set(levelIdsByType[cycleFilter] || []);
    return feeTypes.filter((feeType: any) =>
      feeType.appliesToLevels?.some((levelId: string) => allowedLevels.has(levelId))
    );
  }, [feeTypes, cycleFilter, levelIdsByType]);

  const studentBalances = useMemo(() => {
    const map = new Map<string, { total: number; paid: number; remaining: number }>();
    feeSchedules.forEach((schedule: any) => {
      if (!map.has(schedule.studentId)) {
        map.set(schedule.studentId, { total: 0, paid: 0, remaining: 0 });
      }
      const bal = map.get(schedule.studentId)!;
      bal.total += schedule.amount || 0;
      bal.paid += schedule.paidAmount || 0;
      bal.remaining += schedule.remainingAmount || 0;
    });
    return map;
  }, [feeSchedules]);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return enrollments.filter((enrollment: any) => {
      const student = enrollment.student;
      const classId = enrollment.classId;
      const classInfo = classId ? classById.get(classId) : null;
      const levelType = classInfo?.level?.levelType;

      if (cycleFilter !== 'all' && levelType !== cycleFilter) return false;
      if (levelFilter !== 'all' && classInfo?.level?.id !== levelFilter) return false;
      if (classFilter !== 'all' && classId !== classFilter) return false;

      if (query) {
        const haystack = [
          student?.firstName,
          student?.lastName,
          student?.matricule,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [enrollments, searchQuery, cycleFilter, levelFilter, classFilter, classById]);

  const filteredPayments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    // Convertir les filtres de date en objets Date pour la comparaison côté client
    const fromDate = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
    const toDate = dateTo ? new Date(dateTo + 'T23:59:59.999') : null;

    return payments.filter((payment: any) => {
      const student = payment.student;
      const feeType = payment.feeSchedule?.feeType;
      const classId = studentClassMap.get(payment.studentId);
      const classInfo = classId ? classById.get(classId) : null;
      const levelType = classInfo?.level?.levelType;

      if (cycleFilter !== 'all' && levelType !== cycleFilter) return false;
      if (levelFilter !== 'all' && classInfo?.level?.id !== levelFilter) return false;
      if (classFilter !== 'all' && classId !== classFilter) return false;
      if (feeTypeFilter !== 'all' && feeType?.id !== feeTypeFilter) return false;
      if (activeAcademicYearId && payment.feeSchedule?.academicYearId !== activeAcademicYearId) return false;

      // Filtrage client-side par date de paiement (double sécurité)
      if (fromDate || toDate) {
        const rawDate = payment.paymentDate || payment.payment_date || payment.createdAt;
        if (rawDate) {
          const payDate = new Date(rawDate);
          if (fromDate && payDate < fromDate) return false;
          if (toDate && payDate > toDate) return false;
        } else {
          // Pas de date : exclure si un filtre de date est actif
          if (fromDate || toDate) return false;
        }
      }

      if (query) {
        const haystack = [
          student?.firstName,
          student?.lastName,
          student?.matricule,
          payment.referenceNumber,
          feeType?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [
    payments,
    searchQuery,
    cycleFilter,
    levelFilter,
    classFilter,
    feeTypeFilter,
    activeAcademicYearId,
    studentClassMap,
    classById,
    dateFrom,
    dateTo,
  ]);

  const filteredSchedules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return feeSchedules.filter((schedule: any) => {
      const student = schedule.student;
      const feeType = schedule.feeType;
      const classId = studentClassMap.get(schedule.studentId);
      const classInfo = classId ? classById.get(classId) : null;
      const levelType = classInfo?.level?.levelType;

      if (cycleFilter !== 'all' && levelType !== cycleFilter) return false;
      if (levelFilter !== 'all' && classInfo?.level?.id !== levelFilter) return false;
      if (classFilter !== 'all' && classId !== classFilter) return false;

      if (query) {
        const haystack = [
          student?.firstName,
          student?.lastName,
          student?.matricule,
          feeType?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [feeSchedules, searchQuery, cycleFilter, levelFilter, classFilter, studentClassMap, classById]);

  const filteredExemptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return paymentExemptions.filter((exemption: any) => {
      const student = exemption.student;
      const classId = studentClassMap.get(exemption.studentId);
      const classInfo = classId ? classById.get(classId) : null;
      const levelType = classInfo?.level?.levelType;

      if (cycleFilter !== 'all' && levelType !== cycleFilter) return false;
      if (levelFilter !== 'all' && classInfo?.level?.id !== levelFilter) return false;
      if (classFilter !== 'all' && classId !== classFilter) return false;

      if (query) {
        const haystack = [
          student?.firstName,
          student?.lastName,
          student?.matricule,
          exemption.reason,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [paymentExemptions, searchQuery, cycleFilter, levelFilter, classFilter, studentClassMap, classById]);

  const displayStats = useMemo(() => {
    const totalCollected = filteredPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const paymentCount = filteredPayments.length;

    let totalDue = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    filteredSchedules.forEach((s: any) => {
      totalDue += s.amount || 0;
      totalPaid += s.paidAmount || 0;
      totalPending += s.remainingAmount || 0;
      if (s.status === 'overdue') {
        totalOverdue += s.remainingAmount || 0;
      }
    });

    const collectionRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

    return {
      totalCollected,
      paymentCount,
      totalPending,
      totalOverdue,
      collectionRate,
    };
  }, [filteredPayments, filteredSchedules]);

  const handleGeneratePDFReport = async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const now = new Date();

    // Formateur monétaire ASCII-safe pour jsPDF
    const fmtCurrency = (value?: number | null): string => {
      const v = typeof value === 'number' ? value : 0;
      const parts = Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return `${parts} FCFA`;
    };

    // Formateur de date simple pour le PDF
    const fmtDate = (val?: string | Date | null): string => {
      if (!val) return '--';
      const d = typeof val === 'string' ? new Date(val) : val;
      if (Number.isNaN(d.getTime())) return '--';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const dateStr = fmtDate(now);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // ── Chargement du logo école (async) ───────────────────────────────
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
        console.warn('Logo ecole non charge');
      }
    }

    // ── Bande de titre (fond bleu) ─────────────────────────────────────
    const HEADER_H = 36;
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, HEADER_H, 'F');
    // Liseré bleu vif en bas de l'entête
    doc.setFillColor(99, 145, 255);
    doc.rect(0, HEADER_H, pageWidth, 1.5, 'F');

    const MARGIN = 12;
    let logoEndX = MARGIN;

    // ── Logo ou carré initiales ────────────────────────────────────────
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'JPEG', MARGIN, 6, 22, 22);
        logoEndX = MARGIN + 26;
      } catch {
        // Fallback : carré initiales
        doc.setFillColor(99, 145, 255);
        doc.roundedRect(MARGIN, 6, 22, 22, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        const ini = (schoolInfo?.name || 'N').charAt(0).toUpperCase();
        doc.text(ini, MARGIN + 11, 20, { align: 'center' });
        logoEndX = MARGIN + 26;
      }
    } else if (schoolInfo?.name) {
      // Carré initiales si pas de logo
      doc.setFillColor(99, 145, 255);
      doc.roundedRect(MARGIN, 6, 22, 22, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      const ini = (schoolInfo.name || 'N').charAt(0).toUpperCase();
      doc.text(ini, MARGIN + 11, 20, { align: 'center' });
      logoEndX = MARGIN + 26;
    }

    // ── Nom de l'établissement ─────────────────────────────────────────
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    const schoolName = (schoolInfo as any)?.name || 'Etablissement';
    doc.text(schoolName.toUpperCase(), logoEndX, 14);

    // ── Adresse ────────────────────────────────────────────────────────
    const addrParts = [
      (schoolInfo as any)?.address,
      (schoolInfo as any)?.city,
      (schoolInfo as any)?.country,
    ].filter(Boolean);
    if (addrParts.length > 0) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 200, 240);
      doc.text(addrParts.join(', '), logoEndX, 21);
    }

    // ── Contact (tel / email) ──────────────────────────────────────────
    const contacts: string[] = [];
    if ((schoolInfo as any)?.phone) contacts.push(`Tel: ${(schoolInfo as any).phone}`);
    if ((schoolInfo as any)?.email) contacts.push(`Email: ${(schoolInfo as any).email}`);
    if (contacts.length > 0) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 185, 230);
      doc.text(contacts.join('   '), logoEndX, 28);
    }

    // ── Bloc droite : titre rapport + date de génération + comptable ───
    const meta = (user as any)?.user_metadata || {};
    const accountantName = [meta.first_name, meta.last_name].filter(Boolean).join(' ')
      || profile?.fullName || profile?.full_name
      || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()
      || user?.email || 'Comptable';

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('RAPPORT DES PAIEMENTS', pageWidth - MARGIN, 10, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text(`Genere le ${dateStr} a ${timeStr}`, pageWidth - MARGIN, 18, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 200);
    doc.text(`Comptable : ${accountantName}`, pageWidth - MARGIN, 26, { align: 'right' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 185, 230);
    doc.text('NovaConnect - Gestion Scolaire', pageWidth - MARGIN, 33, { align: 'right' });

    const bodyStartY = HEADER_H + 10;

    // ── Période ─────────────────────────────────────────────────────────
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Periode :', 14, bodyStartY);
    doc.setFont('helvetica', 'normal');
    const periodeText = (dateFrom || dateTo)
      ? `Du ${dateFrom ? fmtDate(dateFrom) : '(debut)'} au ${dateTo ? fmtDate(dateTo) : '(fin)'}`
      : 'Toute la periode (aucun filtre de date applique)';
    doc.text(periodeText, 38, bodyStartY);

    // Ligne de séparation
    doc.setDrawColor(200, 200, 200);
    doc.line(14, bodyStartY + 4, pageWidth - 14, bodyStartY + 4);

    // ── Tableau résumé ──────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 64, 175);
    doc.text('Resume', 14, bodyStartY + 11);

    autoTable(doc, {
      startY: bodyStartY + 14,
      head: [['Total encaisse', 'Nb paiements', 'En attente', 'En retard', 'Taux recouvrement']],
      body: [
        [
          fmtCurrency(displayStats.totalCollected),
          `${displayStats.paymentCount} paiement(s)`,
          fmtCurrency(displayStats.totalPending),
          fmtCurrency(displayStats.totalOverdue),
          `${displayStats.collectionRate.toFixed(1)} %`,
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });

    // ── Tableau détail ──────────────────────────────────────────────────
    const yAfterSummary = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 64, 175);
    doc.text(`Detail des paiements (${filteredPayments.length})`, 14, yAfterSummary);

    // Calcul du total global
    const totalGlobal = filteredPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    const tableData = filteredPayments.map((p: any) => [
      fmtDate(p.paymentDate || p.payment_date || p.createdAt),
      [`${p.student?.firstName || ''} ${p.student?.lastName || ''}`.trim() || 'Inconnu',
       p.student?.matricule ? `Mat: ${p.student.matricule}` : ''].filter(Boolean).join('\n'),
      p.feeSchedule?.feeType?.name || 'Frais divers',
      paymentMethodLabels[p.paymentMethod] || p.paymentMethod || '--',
      p.referenceNumber || '--',
      fmtCurrency(p.amount),
    ]);

    // Ligne de total global en bas du tableau
    const totalRow = ['', '', '', '', 'TOTAL GLOBAL :', fmtCurrency(totalGlobal)];

    autoTable(doc, {
      startY: yAfterSummary + 3,
      head: [['Date', 'Eleve / Matricule', 'Type de frais', 'Methode', 'Reference', 'Montant']],
      body: [...tableData, totalRow],
      theme: 'striped',
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [237, 242, 255] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 45 },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
      },
      // Style spécial pour la ligne de total (dernière ligne)
      didParseCell: (data: any) => {
        if (data.row.index === filteredPayments.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [30, 64, 175];
          data.cell.styles.textColor = 255;
        }
      },
      didDrawPage: (data: any) => {
        // Numéro de page en bas
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${data.pageNumber}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      },
    });

    const filename = `rapport-paiements${dateFrom ? `-${dateFrom}` : ''}${dateTo ? `-au-${dateTo}` : ''}-${now.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };


  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedAcademicYearId('');
    setCycleFilter('all');
    setLevelFilter('all');
    setClassFilter('all');
    setStudentFilter('all');
    setFeeTypeFilter('all');
    setPaymentMethodFilter('all');
    setScheduleStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const openRecordDialog = (schedule: any) => {
    setSelectedSchedule(schedule);
    setRecordForm({
      amount: schedule?.remainingAmount || schedule?.amount || 0,
      paymentMethod: 'cash',
      referenceNumber: '',
      notes: '',
      paymentDate: new Date().toISOString().split('T')[0], // Date du jour par défaut
    });
    setRecordDialogOpen(true);
  };

  const openReminderDialog = (studentId?: string) => {
    if (studentId) {
      setReminderConfig({ type: 'first', studentIds: [studentId], isGlobal: false });
    } else {
      // Relance globale : on sélectionne tous les élèves avec des échéances en retard
      const overdueStudents = Array.from(new Set(
        filteredSchedules
          .filter((s: any) => s.status === 'overdue' && s.remainingAmount > 0)
          .map((s: any) => s.studentId)
      ));
      setReminderConfig({ type: 'first', studentIds: overdueStudents, isGlobal: true });
    }
    setReminderDialogOpen(true);
  };

  const handleSendReminders = async () => {
    if (!schoolId) return;

    if (reminderConfig.studentIds.length === 0 && reminderConfig.isGlobal) {
      alert("Aucune échéance en retard n'a été trouvée avec les filtres actuels.");
      setReminderDialogOpen(false);
      return;
    }

    try {
      const response = await sendReminders.mutateAsync({
        schoolId,
        studentIds: reminderConfig.isGlobal ? undefined : reminderConfig.studentIds,
        reminderType: reminderConfig.type,
      });

      if (response?.success) {
        alert(
          `Relance(s) envoyée(s) avec succès.\n` +
          `${response.stats?.remindersSent || 0} envoyée(s)\n` +
          `${response.stats?.skipped || 0} ignorée(s) (déjà envoyée récemment)\n` +
          `${response.stats?.remindersFailed || 0} échec(s)`
        );
      } else {
        alert('Erreur lors de l\'envoi de la relance : ' + (response?.message || 'Erreur API'));
      }
    } catch (error: any) {
      console.error('Error sending reminders:', error);
      alert(error?.message || "Erreur inattendue lors de l'envoi.");
    } finally {
      setReminderDialogOpen(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedSchedule || !schoolId || !user?.id) return;
    if (!recordForm.amount || recordForm.amount <= 0) {
      alert('Veuillez saisir un montant valide.');
      return;
    }

    const popup = window.open('about:blank', '_blank');
    if (popup) {
      popup.opener = null;
      popup.document.write('<p>Generation du recu en cours...</p>');
    } else {
      alert('Veuillez autoriser les pop-ups pour ouvrir le recu dans un nouvel onglet.');
    }

    try {
      const payment = await recordPayment.mutateAsync({
        schoolId,
        receivedBy: user.id,
        studentId: selectedSchedule.studentId,
        feeScheduleId: selectedSchedule.id,
        amount: recordForm.amount,
        paymentMethod: recordForm.paymentMethod as any,
        paymentDate: recordForm.paymentDate, // Date ajustable
        referenceNumber: recordForm.referenceNumber || undefined,
        notes: recordForm.notes || undefined,
        autoGenerateReceipt: false,
      } as any);
      setRecordDialogOpen(false);
      setSelectedSchedule(null);
      setRecordForm({ amount: 0, paymentMethod: 'cash', referenceNumber: '', notes: '', paymentDate: new Date().toISOString().split('T')[0] });

      try {
        const receiptResult = await generateReceipt.mutateAsync(payment.id);
        if (receiptResult?.signedUrl) {
          if (popup) {
            popup.location.href = receiptResult.signedUrl;
            popup.focus();
          } else {
            window.open(receiptResult.signedUrl, '_blank', 'noopener,noreferrer');
          }
        } else {
          if (popup) popup.close();
          alert('Recu genere, mais URL de telechargement indisponible.');
        }
      } catch (error: any) {
        if (popup) popup.close();
        console.error('Generate receipt error:', error);
        alert(error?.message || 'Erreur lors de la generation du recu.');
      }
    } catch (error: any) {
      if (popup) popup.close();
      console.error('Record payment error:', error);
      alert(error?.message || 'Erreur lors de l enregistrement.');
    }
  };

  const handleGenerateReceipt = async (paymentId: string) => {
    setGeneratingPaymentId(paymentId);
    const popup = window.open('about:blank', '_blank');
    if (popup) {
      popup.opener = null;
      popup.document.write('<p>Generation du recu en cours...</p>');
    } else {
      alert('Veuillez autoriser les pop-ups pour ouvrir le recu dans un nouvel onglet.');
    }
    try {
      const result = await generateReceipt.mutateAsync(paymentId);
      if (result?.signedUrl) {
        if (popup) {
          popup.location.href = result.signedUrl;
          popup.focus();
        } else {
          window.open(result.signedUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        if (popup) popup.close();
        alert('Recu genere.');
      }
    } catch (error: any) {
      if (popup) popup.close();
      console.error('Generate receipt error:', error);
      alert(error?.message || 'Erreur lors de la generation du recu.');
    } finally {
      setGeneratingPaymentId(null);
    }
  };

  const handleViewPayment = (payment: any) => {
    setSelectedPayment(payment);
    setPaymentDetailsOpen(true);
  };



  if (!schoolId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Impossible de charger les informations de l ecole.
        </div>
      </div>
    );
  }

  // Debug logs
  console.log('=== Payment Page Debug ===');
  console.log('Fee schedules loaded:', feeSchedules.length);
  console.log('Student balances map size:', studentBalances.size);
  if (feeSchedules.length > 0) {
    console.log('Sample fee schedule:', feeSchedules[0]);
  }
  studentBalances.forEach((balance, studentId) => {
    console.log(`Student ${studentId} balance:`, balance);
  });
  console.log('Payments loaded:', payments.length);
  console.log('Filtered payments:', filteredPayments.length);
  if (filteredPayments.length > 0) {
    console.log('Sample payment:', filteredPayments[0]);
  }
  console.log('========================');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Paiements</h1>
          <p className="mt-1 text-gray-600">
            Suivi des paiements, echeances et exemptions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/accountant/mobile-money"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            Mobile Money
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-sm text-gray-500">Encaissements</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {formatCurrency(displayStats.totalCollected)}
          </div>
          <div className="text-xs text-gray-400">
            {displayStats.paymentCount} paiements
          </div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-sm text-gray-500">En attente</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {formatCurrency(displayStats.totalPending)}
          </div>
          <div className="text-xs text-gray-400">Echeances non reglees</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-sm text-gray-500">En retard</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {formatCurrency(displayStats.totalOverdue)}
          </div>
          <div className="text-xs text-gray-400">Montant en retard</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="text-sm text-gray-500">Taux de recouvrement</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {displayStats.collectionRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-400">Selon les filtres appliqués</div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechercher un eleve, matricule, reference"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <SearchableSelect
            options={academicYears.map((y: any) => ({ value: y.id, label: y.name }))}
            value={selectedAcademicYearId || defaultAcademicYearId || ''}
            onValueChange={setSelectedAcademicYearId}
            placeholder="Sélectionner une année"
            searchPlaceholder="Rechercher une année..."
          />

          <SearchableSelect
            options={Object.entries(cycleLabels).map(([value, label]) => ({ value, label }))}
            value={cycleFilter}
            onValueChange={(v) => { setCycleFilter(v); setLevelFilter('all'); setClassFilter('all'); }}
            placeholder="Cycle"
            searchPlaceholder="Rechercher un cycle..."
            allLabel="Tous cycles"
          />

          <SearchableSelect
            options={levelsForCycle.map((lvl: any) => ({ value: lvl.id, label: lvl.name }))}
            value={levelFilter}
            onValueChange={(v) => { setLevelFilter(v); setClassFilter('all'); }}
            placeholder="Niveau"
            searchPlaceholder="Rechercher un niveau..."
            allLabel="Tous niveaux"
          />

          <SearchableSelect
            options={classesForLevel.map((c: any) => ({ value: c.id, label: c.name }))}
            value={classFilter}
            onValueChange={setClassFilter}
            placeholder="Classe"
            searchPlaceholder="Rechercher une classe..."
            allLabel="Toutes classes"
          />

          <SearchableSelect
            options={(students as any[]).map((s: any) => ({ value: s.id, label: `${s.firstName} ${s.lastName}${s.matricule ? ` (${s.matricule})` : ''}` }))}
            value={studentFilter}
            onValueChange={setStudentFilter}
            placeholder="Élève"
            searchPlaceholder="Rechercher un élève..."
            allLabel="Tous élèves"
          />

          <SearchableSelect
            options={feeTypesForCycle.map((f: any) => ({ value: f.id, label: f.name }))}
            value={feeTypeFilter}
            onValueChange={setFeeTypeFilter}
            placeholder="Type de frais"
            searchPlaceholder="Rechercher un type..."
            allLabel="Tous types de frais"
          />

          <SearchableSelect
            options={Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label }))}
            value={paymentMethodFilter}
            onValueChange={setPaymentMethodFilter}
            placeholder="Méthode"
            searchPlaceholder="Rechercher une méthode..."
            allLabel="Toutes méthodes"
          />

          <SearchableSelect
            options={Object.entries(scheduleStatusLabels).map(([value, label]) => ({ value, label }))}
            value={scheduleStatusFilter}
            onValueChange={setScheduleStatusFilter}
            placeholder="Statut"
            searchPlaceholder="Rechercher un statut..."
            allLabel="Tous statuts"
          />

          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleResetFilters}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reinitialiser
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('students')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${activeTab === 'students'
            ? 'bg-blue-600 text-white'
            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
        >
          Eleves ({filteredStudents.length})
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${activeTab === 'payments'
            ? 'bg-blue-600 text-white'
            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
        >
          Paiements ({filteredPayments.length})
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${activeTab === 'schedules'
            ? 'bg-blue-600 text-white'
            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
        >
          Echeances ({filteredSchedules.length})
        </button>
        <button
          onClick={() => setActiveTab('exemptions')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${activeTab === 'exemptions'
            ? 'bg-blue-600 text-white'
            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
        >
          Exemptions ({filteredExemptions.length})
        </button>
      </div>

      {activeTab === 'students' && (
        <div className="rounded-lg bg-white shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Eleve</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Classe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Total a payer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Paye</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reste</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((enrollment: any) => {
                    const student = enrollment.student;
                    const classId = enrollment.classId;
                    const classInfo = classId ? classById.get(classId) : null;
                    const balance = studentBalances.get(student.id) || { total: 0, paid: 0, remaining: 0 };

                    let status = 'none';
                    let statusLabel = 'Aucun frais';
                    let statusColor = 'bg-gray-100 text-gray-700';

                    if (balance.total > 0) {
                      if (balance.remaining <= 0) {
                        status = 'paid';
                        statusLabel = 'A jour';
                        statusColor = 'bg-green-100 text-green-800';
                      } else if (balance.paid > 0) {
                        status = 'partial';
                        statusLabel = 'Partiel';
                        statusColor = 'bg-yellow-100 text-yellow-800';
                      } else {
                        status = 'unpaid';
                        statusLabel = 'Non paye';
                        statusColor = 'bg-red-100 text-red-800';
                      }
                    }

                    return (
                      <tr key={enrollment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium">{student.firstName} {student.lastName}</div>
                          {student.matricule && (
                            <div className="text-xs text-gray-500">{student.matricule}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {classInfo?.name || '--'}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {formatCurrency(balance.total)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {formatCurrency(balance.paid)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-red-600">
                          {formatCurrency(balance.remaining)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <button
                            onClick={() => {
                              setStudentFilter(student.id);
                              setActiveTab('schedules');
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Voir details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
                      Aucun eleve trouve.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="rounded-lg bg-white shadow">
          {/* Barre d'actions : bouton PDF rapport */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="text-sm text-gray-500">
              {filteredPayments.length} paiement{filteredPayments.length !== 1 ? 's' : ''} trouvé{filteredPayments.length !== 1 ? 's' : ''}
              {(dateFrom || dateTo) && (
                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {dateFrom && dateTo
                    ? `${formatDate(dateFrom)} → ${formatDate(dateTo)}`
                    : dateFrom
                    ? `À partir du ${formatDate(dateFrom)}`
                    : `Jusqu'au ${formatDate(dateTo)}`}
                </span>
              )}
            </div>
            <button
              onClick={handleGeneratePDFReport}
              disabled={filteredPayments.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Rapport PDF
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Eleve</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Classe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Methode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paymentsLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-4 text-center text-sm text-gray-500">
                      Chargement...
                    </td>
                  </tr>
                ) : filteredPayments.length > 0 ? (
                  filteredPayments.map((payment: any) => {
                    const classId = studentClassMap.get(payment.studentId);
                    const classInfo = classId ? classById.get(classId) : null;
                    return (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">{formatDate(payment.paymentDate)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {payment.student ? (
                            <>
                              {payment.student.firstName} {payment.student.lastName}
                              {payment.student.matricule ? (
                                <div className="text-xs text-gray-400">{payment.student.matricule}</div>
                              ) : null}
                            </>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-medium text-red-500">Eleve inconnu</span>
                              <span className="text-xs text-gray-400">ID: {payment.studentId || 'N/A'}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {classInfo?.name || '--'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {payment.feeSchedule?.feeType?.name || '--'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {payment.referenceNumber || '--'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewPayment(payment)}
                              className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                              title="Voir details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleGenerateReceipt(payment.id)}
                              disabled={generatingPaymentId === payment.id}
                              className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                              title="Generer recu"
                            >
                              <Receipt className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                      Aucun paiement trouve.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'schedules' && (
        <div className="rounded-lg bg-white shadow">
          {/* Barre d'actions : bouton Relance globale */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="text-sm text-gray-500">
              {filteredSchedules.length} écheance{filteredSchedules.length !== 1 ? 's' : ''} trouvée{filteredSchedules.length !== 1 ? 's' : ''}
            </div>
            <button
              onClick={() => openReminderDialog()}
              disabled={!filteredSchedules.some((s: any) => s.status === 'overdue' && s.remainingAmount > 0)}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Bell className="h-4 w-4" />
              Relancer les retards
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Echeance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Eleve</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Classe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Paye</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reste</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {schedulesLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-4 text-center text-sm text-gray-500">
                      Chargement...
                    </td>
                  </tr>
                ) : filteredSchedules.length > 0 ? (
                  filteredSchedules.map((schedule: any) => {
                    const classId = studentClassMap.get(schedule.studentId);
                    const classInfo = classId ? classById.get(classId) : null;
                    return (
                      <tr key={schedule.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {formatDate(schedule.dueDate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {schedule.student?.firstName} {schedule.student?.lastName}
                          {schedule.student?.matricule ? (
                            <div className="text-xs text-gray-400">{schedule.student.matricule}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {classInfo?.name || '--'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {schedule.feeType?.name || '--'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                          {formatCurrency(schedule.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {formatCurrency(schedule.paidAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {formatCurrency(schedule.remainingAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${scheduleStatusStyles[schedule.status] || 'bg-gray-100 text-gray-700'
                              }`}
                          >
                            {scheduleStatusLabels[schedule.status] || schedule.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openRecordDialog(schedule)}
                              className="rounded-md border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Enregistrer
                            </button>
                            {schedule.status === 'overdue' && schedule.remainingAmount > 0 && (
                              <button
                                onClick={() => openReminderDialog(schedule.studentId)}
                                className="rounded-md border border-orange-200 p-1.5 text-orange-600 hover:bg-orange-50"
                                title="Envoyer une relance"
                              >
                                <Bell className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-500">
                      Aucune echeance trouvee.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'exemptions' && (
        <div className="rounded-lg bg-white shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Eleve</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Valeur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Raison</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Periode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {exemptionsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-500">
                      Chargement...
                    </td>
                  </tr>
                ) : filteredExemptions.length > 0 ? (
                  filteredExemptions.map((exemption: any) => (
                    <tr key={exemption.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {exemption.student?.firstName} {exemption.student?.lastName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{exemption.exemptionType}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {exemption.amount ? formatCurrency(exemption.amount) : `${exemption.percentage || 0}%`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{exemption.reason}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatDate(exemption.validFrom)} - {formatDate(exemption.validUntil)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {exemption.isActive ? 'Oui' : 'Non'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                      Aucune exemption trouvee.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recordDialogOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Enregistrer un paiement</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Confirmez les informations puis validez le paiement.
                </p>
              </div>
              <button
                onClick={() => setRecordDialogOpen(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-6 pt-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Eleve
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedSchedule.student?.firstName} {selectedSchedule.student?.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Frais
                    </p>
                    <p className="text-sm text-slate-700">{selectedSchedule.feeType?.name || '--'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Annee
                    </p>
                    <p className="text-sm text-slate-700">
                      {academicYears.find((y) => y.id === selectedSchedule?.academicYearId)?.name || '--'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700">
                    <p className="text-[11px] uppercase tracking-wide">Reste a payer</p>
                    <p className="text-sm font-semibold">
                      {formatCurrency(selectedSchedule.remainingAmount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Montant</label>
                  <div className="relative mt-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={recordForm.amount ? Math.round(recordForm.amount).toLocaleString('fr-FR') : ''}
                      onChange={(event) => {
                        const raw = event.target.value.replace(/[^0-9]/g, '');
                        setRecordForm({ ...recordForm, amount: Number(raw) || 0 });
                      }}
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-16 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">FCFA</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Methode</label>
                  <select
                    value={recordForm.paymentMethod}
                    onChange={(event) =>
                      setRecordForm({ ...recordForm, paymentMethod: event.target.value })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {Object.entries(paymentMethodLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Reference</label>
                  <input
                    type="text"
                    value={recordForm.referenceNumber}
                    onChange={(event) =>
                      setRecordForm({ ...recordForm, referenceNumber: event.target.value })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Date de paiement</label>
                  <input
                    type="date"
                    value={recordForm.paymentDate}
                    onChange={(event) =>
                      setRecordForm({ ...recordForm, paymentDate: event.target.value })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Notes</label>
                  <textarea
                    value={recordForm.notes}
                    onChange={(event) => setRecordForm({ ...recordForm, notes: event.target.value })}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <button
                onClick={() => setRecordDialogOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Annuler
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={recordPayment.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {recordPayment.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reminderDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {reminderConfig.isGlobal ? 'Relancer tous les retards' : 'Envoyer une relance'}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Choisissez le niveau de sévérité du message.
                </p>
              </div>
              <button
                onClick={() => setReminderDialogOpen(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-6 pt-4">
              <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-orange-100 p-2 text-orange-600">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-orange-900">
                      {reminderConfig.isGlobal 
                        ? `${reminderConfig.studentIds.length} élève(s) ciblé(s)`
                        : '1 élève ciblé'
                      }
                    </p>
                    <p className="text-xs text-orange-700">
                      Un email et une notification PUSH seront envoyés aux parents.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Type de message</label>
                <div className="mt-3 space-y-3">
                  {Object.entries(reminderTypeLabels).map(([value, label]) => (
                    <label key={value} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 transition">
                      <div className="flex h-5 items-center">
                        <input
                          type="radio"
                          name="reminderType"
                          value={value}
                          checked={reminderConfig.type === value}
                          onChange={(e) => setReminderConfig({ ...reminderConfig, type: e.target.value as any })}
                          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-600"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">{label}</span>
                        <span className="text-xs text-slate-500">
                          {value === 'first' && 'Message courtois pour rappeler une échéance récente.'}
                          {value === 'second' && 'Message plus ferme pour un retard prolongé.'}
                          {value === 'final' && 'Dernier avertissement avant d\'éventuelles sanctions.'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <button
                onClick={() => setReminderDialogOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Annuler
              </button>
              <button
                onClick={handleSendReminders}
                disabled={sendReminders.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-50"
              >
                {sendReminders.isPending ? 'Envoi...' : <>Envoyer <Send className="h-4 w-4 ml-1" /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentDetailsOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Details du paiement</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Apercu complet des informations de paiement.
                </p>
              </div>
              <button
                onClick={() => setPaymentDetailsOpen(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-6 pt-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Eleve</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedPayment.student?.firstName} {selectedPayment.student?.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</p>
                    <p className="text-sm text-slate-700">
                      {selectedPayment.feeSchedule?.feeType?.name || '--'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-700">
                    <p className="text-[11px] uppercase tracking-wide">Montant</p>
                    <p className="text-sm font-semibold">{formatCurrency(selectedPayment.amount)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-100 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p>
                  <p className="mt-1 text-sm text-slate-900">{formatDate(selectedPayment.paymentDate)}</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Methode</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {paymentMethodLabels[selectedPayment.paymentMethod] || selectedPayment.paymentMethod}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference</p>
                  <p className="mt-1 text-sm text-slate-900">{selectedPayment.referenceNumber || '--'}</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recu</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {selectedPayment.receiptNumber || 'Non genere'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <button
                onClick={() => handleGenerateReceipt(selectedPayment.id)}
                disabled={generatingPaymentId === selectedPayment.id}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white disabled:opacity-50"
              >
                Generer recu
              </button>
              <button
                onClick={() => setPaymentDetailsOpen(false)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
