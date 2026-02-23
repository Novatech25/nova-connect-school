'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Calendar, CreditCard, FileText, LineChart as LineIcon, PieChart as PieIcon } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { PieChart } from '@/components/charts/PieChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { useAuthContext } from '@novaconnect/data/providers';
import {
  useAcademicYears,
  useClasses,
  useEnrollments,
  useFeeSchedules,
  usePayments,
  usePayrollEntriesByPeriod,
  usePayrollPeriods,
  useMobileMoneyKpis,
} from '@novaconnect/data';

const paymentMethodLabels: Record<string, string> = {
  cash: 'Especes',
  bank_transfer: 'Virement',
  check: 'Cheque',
  mobile_money: 'Mobile Money',
  card: 'Carte',
  other: 'Autre',
};

const cycleLabels: Record<string, string> = {
  primary: 'Primaire',
  middle_school: 'College',
  high_school: 'Lycee',
  university: 'Universite',
};

const paymentMethodColors: Record<string, string> = {
  cash: '#10b981',
  bank_transfer: '#3b82f6',
  check: '#f59e0b',
  mobile_money: '#8b5cf6',
  card: '#ec4899',
  other: '#6b7280',
};

const scheduleStatusLabels: Record<string, string> = {
  pending: 'En attente',
  paid: 'Paye',
  partial: 'Partiel',
  overdue: 'En retard',
  cancelled: 'Annule',
};

const scheduleStatusColors: Record<string, string> = {
  pending: '#f59e0b',
  paid: '#10b981',
  partial: '#3b82f6',
  overdue: '#ef4444',
  cancelled: '#9ca3af',
};

const payrollStatusLabels: Record<string, string> = {
  draft: 'Brouillon',
  pending_payment: 'En attente',
  paid: 'Paye',
  cancelled: 'Annule',
};

const payrollStatusColors: Record<string, string> = {
  draft: '#9ca3af',
  pending_payment: '#f59e0b',
  paid: '#10b981',
  cancelled: '#ef4444',
};

const formatCurrency = (value?: number | null) => {
  const safeValue = typeof value === 'number' ? value : 0;
  return `${Math.round(safeValue).toLocaleString('fr-FR')} FCFA`;
};

const getMonthKey = (dateValue: string | Date) => {
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (Number.isNaN(date.getTime())) return 'invalid';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export default function AccountantReportsPage() {
  const { user, profile } = useAuthContext();

  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    (user?.user_metadata as any)?.schoolId ||
    (user?.user_metadata as any)?.school_id ||
    (user as any)?.schoolId ||
    (user as any)?.school_id;

  const [dateFrom, setDateFrom] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return start.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [cycleFilter, setCycleFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');

  const { data: academicYears = [] } = useAcademicYears(schoolId || '');

  const defaultAcademicYearId = useMemo(() => {
    const current = academicYears.find((year: any) => year.isCurrent);
    return current?.id || academicYears[0]?.id || '';
  }, [academicYears]);

  const activeAcademicYearId = selectedAcademicYearId || defaultAcademicYearId;

  const { data: classes = [] } = useClasses(schoolId || '', activeAcademicYearId || undefined);
  const { data: enrollments = [] } = useEnrollments(schoolId || '', activeAcademicYearId || undefined);

  const { data: payments = [] } = usePayments({
    schoolId: schoolId || undefined,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
  } as any);

  const { data: feeSchedules = [] } = useFeeSchedules({
    schoolId: schoolId || undefined,
    academicYearId: activeAcademicYearId || undefined,
  } as any);

  const { data: payrollPeriods = [], isLoading: payrollPeriodsLoading } = usePayrollPeriods(
    schoolId || '',
    activeAcademicYearId || undefined
  );

  const activePeriodId = selectedPeriodId || payrollPeriods[0]?.id || '';

  const { data: payrollEntries = [] } = usePayrollEntriesByPeriod(activePeriodId || '');

  const { data: mobileKpis } = useMobileMoneyKpis(schoolId || '', dateFrom, dateTo);

  useEffect(() => {
    if (!selectedPeriodId && payrollPeriods[0]?.id) {
      setSelectedPeriodId(payrollPeriods[0].id);
    }
  }, [selectedPeriodId, payrollPeriods]);

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

  const filteredPayments = useMemo(() => {
    return payments.filter((payment: any) => {
      const classId = studentClassMap.get(payment.studentId);
      const classInfo = classId ? classById.get(classId) : null;
      const levelType = classInfo?.level?.levelType;

      if (cycleFilter !== 'all' && levelType !== cycleFilter) return false;
      if (classFilter !== 'all' && classId !== classFilter) return false;

      return true;
    });
  }, [payments, cycleFilter, classFilter, studentClassMap, classById]);

  const filteredFeeSchedules = useMemo(() => {
    return feeSchedules.filter((schedule: any) => {
      const classId = studentClassMap.get(schedule.studentId);
      const classInfo = classId ? classById.get(classId) : null;
      const levelType = classInfo?.level?.levelType;

      if (cycleFilter !== 'all' && levelType !== cycleFilter) return false;
      if (classFilter !== 'all' && classId !== classFilter) return false;

      return true;
    });
  }, [feeSchedules, cycleFilter, classFilter, studentClassMap, classById]);

  const paymentsTotal = useMemo(() => {
    return filteredPayments.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
  }, [filteredPayments]);

  const paymentTrend = useMemo(() => {
    const map = new Map<string, { month: string; amount: number; count: number }>();
    filteredPayments.forEach((payment: any) => {
      if (!payment.paymentDate) return;
      const key = getMonthKey(payment.paymentDate);
      if (key === 'invalid') return;
      if (!map.has(key)) {
        map.set(key, { month: key, amount: 0, count: 0 });
      }
      const item = map.get(key)!;
      item.amount += payment.amount || 0;
      item.count += 1;
    });

    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredPayments]);

  const paymentMethodData = useMemo(() => {
    const map = new Map<string, number>();
    filteredPayments.forEach((payment: any) => {
      const method = payment.paymentMethod || 'other';
      map.set(method, (map.get(method) || 0) + (payment.amount || 0));
    });

    return Array.from(map.entries()).map(([method, value]) => ({
      name: paymentMethodLabels[method] || method,
      value,
      color: paymentMethodColors[method] || '#6b7280',
    }));
  }, [filteredPayments]);

  const scheduleTotals = useMemo(() => {
    return filteredFeeSchedules.reduce(
      (acc: any, schedule: any) => {
        acc.totalDue += schedule.amount || 0;
        acc.totalPaid += schedule.paidAmount || 0;
        acc.totalRemaining += schedule.remainingAmount || 0;
        if (schedule.status === 'overdue') {
          acc.totalOverdue += schedule.remainingAmount || 0;
        }
        return acc;
      },
      { totalDue: 0, totalPaid: 0, totalRemaining: 0, totalOverdue: 0 }
    );
  }, [filteredFeeSchedules]);

  const scheduleStatusData = useMemo(() => {
    const map = new Map<string, number>();
    filteredFeeSchedules.forEach((schedule: any) => {
      const status = schedule.status || 'pending';
      map.set(status, (map.get(status) || 0) + (schedule.remainingAmount || 0));
    });

    return Array.from(map.entries()).map(([status, value]) => ({
      name: scheduleStatusLabels[status] || status,
      value,
      color: scheduleStatusColors[status] || '#6b7280',
    }));
  }, [filteredFeeSchedules]);

  const topOutstanding = useMemo(() => {
    const map = new Map<string, { id: string; name: string; matricule?: string; amount: number }>();
    filteredFeeSchedules.forEach((schedule: any) => {
      if (!schedule.remainingAmount || schedule.remainingAmount <= 0) return;
      const student = schedule.student || {};
      const id = schedule.studentId || student.id;
      if (!id) return;
      const name = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Eleve';
      const matricule = student.matricule || '';
      if (!map.has(id)) {
        map.set(id, { id, name, matricule, amount: 0 });
      }
      const item = map.get(id)!;
      item.amount += schedule.remainingAmount || 0;
    });

    return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 6);
  }, [filteredFeeSchedules]);

  const payrollTotals = useMemo(() => {
    return payrollEntries.reduce(
      (acc: any, entry: any) => {
        const paid = entry.payments?.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0) || 0;
        acc.totalNet += entry.netAmount || 0;
        acc.totalPaid += paid;
        acc.totalHours += entry.totalHours || 0;
        acc.validatedHours += entry.validatedHours || 0;
        return acc;
      },
      { totalNet: 0, totalPaid: 0, totalHours: 0, validatedHours: 0 }
    );
  }, [payrollEntries]);

  const payrollStatusData = useMemo(() => {
    const map = new Map<string, number>();
    payrollEntries.forEach((entry: any) => {
      const status = entry.status || 'draft';
      map.set(status, (map.get(status) || 0) + 1);
    });

    return Array.from(map.entries()).map(([status, value]) => ({
      name: payrollStatusLabels[status] || status,
      value,
      color: payrollStatusColors[status] || '#6b7280',
    }));
  }, [payrollEntries]);

  const payrollByTeacher = useMemo(() => {
    const map = new Map<string, { name: string; net: number; paid: number }>();

    payrollEntries.forEach((entry: any) => {
      const teacher = entry.teacher || {};
      const id = entry.teacherId || teacher.id || entry.id;
      const name = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Professeur';
      const paid = entry.payments?.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0) || 0;

      if (!map.has(id)) {
        map.set(id, { name, net: 0, paid: 0 });
      }
      const item = map.get(id)!;
      item.net += entry.netAmount || 0;
      item.paid += paid;
    });

    return Array.from(map.values()).sort((a, b) => b.net - a.net).slice(0, 8);
  }, [payrollEntries]);

  const mobileDailyData = useMemo(() => {
    if (!mobileKpis?.daily_volume) return [];
    return mobileKpis.daily_volume.map((item: any) => ({
      date: item.date,
      amount: item.amount,
      count: item.count,
    }));
  }, [mobileKpis]);

  const providerBreakdownData = useMemo(() => {
    if (!mobileKpis?.provider_breakdown) return [];
    return mobileKpis.provider_breakdown.map((item: any) => ({
      name: item.provider_name || item.provider_code,
      amount: item.total_amount || 0,
      count: item.total_transactions || 0,
      successRate: item.success_rate || 0,
    }));
  }, [mobileKpis]);

  const mobileProviderChart = useMemo(() => {
    return providerBreakdownData.map((item, index) => ({
      name: item.name,
      value: item.amount,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280'][index % 6],
    }));
  }, [providerBreakdownData]);

  const collectionRate =
    scheduleTotals.totalDue > 0
      ? (scheduleTotals.totalPaid / scheduleTotals.totalDue) * 100
      : 0;
  const payrollRemaining = Math.max(payrollTotals.totalNet - payrollTotals.totalPaid, 0);

  const activeYear = academicYears.find((year: any) => year.id === activeAcademicYearId);
  const activePeriod = payrollPeriods.find((period: any) => period.id === activePeriodId);

  const escapeCsv = (value: any) => {
    const raw = value === null || value === undefined ? '' : String(value);
    if (raw.includes(',') || raw.includes('\n') || raw.includes('"')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const handleExportCsv = () => {
    const rows: string[] = [];
    rows.push('section,metric,value');

    const addRow = (section: string, metric: string, value: any) => {
      rows.push([section, metric, escapeCsv(value)].join(','));
    };

    addRow('resume', 'periode', `${dateFrom} - ${dateTo}`);
    addRow('resume', 'annee', activeYear?.name || '');
    addRow('resume', 'periode_paie', activePeriod?.periodName || '');
    addRow('resume', 'cycle', cycleFilter === 'all' ? 'Tous' : cycleLabels[cycleFilter] || cycleFilter);
    addRow('resume', 'classe', classFilter === 'all' ? 'Toutes' : classes.find((c: any) => c.id === classFilter)?.name || '');

    addRow('paiements', 'total_encaisse', paymentsTotal);
    addRow('paiements', 'transactions', filteredPayments.length);
    addRow('paiements', 'recouvrement', `${collectionRate.toFixed(1)}%`);
    addRow('echeances', 'total_du', scheduleTotals.totalDue);
    addRow('echeances', 'total_paye', scheduleTotals.totalPaid);
    addRow('echeances', 'reste', scheduleTotals.totalRemaining);
    addRow('echeances', 'retard', scheduleTotals.totalOverdue);
    addRow('paie', 'net_total', payrollTotals.totalNet);
    addRow('paie', 'paye', payrollTotals.totalPaid);
    addRow('paie', 'reste', payrollRemaining);

    addRow('mobile_money', 'total', mobileKpis?.total_amount || 0);
    addRow('mobile_money', 'transactions', mobileKpis?.total_transactions || 0);
    addRow('mobile_money', 'taux_succes', `${(mobileKpis?.success_rate || 0).toFixed(1)}%`);
    addRow('mobile_money', 'auto_reconciliation', `${(mobileKpis?.auto_reconciliation_rate || 0).toFixed(1)}%`);

    paymentMethodData.forEach((item) => {
      addRow('paiements_par_methode', item.name, item.value);
    });

    scheduleStatusData.forEach((item) => {
      addRow('echeances_statut', item.name, item.value);
    });

    payrollStatusData.forEach((item) => {
      addRow('paie_statut', item.name, item.value);
    });

    topOutstanding.forEach((item) => {
      addRow('impayes_top', item.name, item.amount);
    });

    payrollByTeacher.forEach((item) => {
      addRow('paie_par_prof', item.name, item.net);
    });

    providerBreakdownData.forEach((item) => {
      addRow('mobile_fournisseurs', item.name, item.amount);
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport_comptable_${dateFrom}_${dateTo}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    const paymentRows = paymentMethodData
      .map((item) => `<tr><td>${item.name}</td><td>${formatCurrency(item.value)}</td></tr>`)
      .join('');

    const scheduleRows = scheduleStatusData
      .map((item) => `<tr><td>${item.name}</td><td>${formatCurrency(item.value)}</td></tr>`)
      .join('');

    const topRows = topOutstanding
      .map((item) => `<tr><td>${item.name}</td><td>${formatCurrency(item.amount)}</td></tr>`)
      .join('');

    const payrollRows = payrollByTeacher
      .map((item) => `<tr><td>${item.name}</td><td>${formatCurrency(item.net)}</td><td>${formatCurrency(item.paid)}</td></tr>`)
      .join('');

    const providerRows = providerBreakdownData
      .map((item) => `<tr><td>${item.name}</td><td>${formatCurrency(item.amount)}</td><td>${item.count}</td></tr>`)
      .join('');

    const reportHtml = `
      <html>
        <head>
          <title>Rapport comptable</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin-bottom: 4px; }
            .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
            .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
            .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
            .card h3 { margin: 0 0 6px 0; font-size: 14px; color: #374151; }
            .card div { font-size: 16px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; font-size: 12px; }
            th { background: #f9fafb; }
            .section { margin-top: 18px; }
          </style>
        </head>
        <body>
          <h1>Rapport comptable</h1>
          <div class="meta">
            Periode: ${dateFrom} - ${dateTo}<br />
            Annee: ${activeYear?.name || '--'} | Periode paie: ${activePeriod?.periodName || '--'}<br />
            Cycle: ${cycleFilter === 'all' ? 'Tous' : cycleLabels[cycleFilter] || cycleFilter} |
            Classe: ${classFilter === 'all' ? 'Toutes' : classes.find((c) => c.id === classFilter)?.name || '--'}
          </div>

          <div class="summary">
            <div class="card"><h3>Encaissements</h3><div>${formatCurrency(paymentsTotal)}</div></div>
            <div class="card"><h3>Recouvrement</h3><div>${collectionRate.toFixed(1)}%</div></div>
            <div class="card"><h3>Reste a percevoir</h3><div>${formatCurrency(scheduleTotals.totalRemaining)}</div></div>
            <div class="card"><h3>Reste paie</h3><div>${formatCurrency(payrollRemaining)}</div></div>
          </div>

          <div class="section">
            <h2>Paiements par methode</h2>
            <table>
              <thead><tr><th>Methode</th><th>Montant</th></tr></thead>
              <tbody>${paymentRows || '<tr><td colspan="2">Aucune donnee</td></tr>'}</tbody>
            </table>
          </div>

          <div class="section">
            <h2>Echeances par statut</h2>
            <table>
              <thead><tr><th>Statut</th><th>Montant</th></tr></thead>
              <tbody>${scheduleRows || '<tr><td colspan="2">Aucune donnee</td></tr>'}</tbody>
            </table>
          </div>

          <div class="section">
            <h2>Top impayes</h2>
            <table>
              <thead><tr><th>Eleve</th><th>Reste</th></tr></thead>
              <tbody>${topRows || '<tr><td colspan="2">Aucune donnee</td></tr>'}</tbody>
            </table>
          </div>

          <div class="section">
            <h2>Paie par enseignant</h2>
            <table>
              <thead><tr><th>Professeur</th><th>Net</th><th>Paye</th></tr></thead>
              <tbody>${payrollRows || '<tr><td colspan="3">Aucune donnee</td></tr>'}</tbody>
            </table>
          </div>

          <div class="section">
            <h2>Mobile Money fournisseurs</h2>
            <table>
              <thead><tr><th>Fournisseur</th><th>Montant</th><th>Transactions</th></tr></thead>
              <tbody>${providerRows || '<tr><td colspan="3">Aucune donnee</td></tr>'}</tbody>
            </table>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  if (!schoolId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Rapports</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Impossible de charger les informations de l ecole.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rapports comptables</h1>
          <p className="mt-1 text-gray-600">
            Analyses detaillees des paiements, de la paie et du Mobile Money.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/accountant/payments"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            Paiements
          </Link>
          <Link
            href="/accountant/salaries"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <CreditCard className="h-4 w-4" />
            Salaires
          </Link>
          <Link
            href="/accountant/mobile-money"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <LineIcon className="h-4 w-4" />
            Mobile Money
          </Link>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="text-sm font-medium text-gray-700">Date debut</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Date fin</label>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Annee scolaire</label>
            <SearchableSelect
              options={academicYears.map((y: any) => ({ value: y.id, label: y.name }))}
              value={selectedAcademicYearId || defaultAcademicYearId || ''}
              onValueChange={setSelectedAcademicYearId}
              placeholder="Sélectionner une année"
              searchPlaceholder="Rechercher une année..."
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Cycle</label>
            <SearchableSelect
              options={Object.entries(cycleLabels).map(([value, label]) => ({ value, label }))}
              value={cycleFilter}
              onValueChange={(v) => {
                setCycleFilter(v);
                setClassFilter('all');
              }}
              placeholder="Cycle"
              searchPlaceholder="Rechercher un cycle..."
              allLabel="Tous cycles"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Classe</label>
            <SearchableSelect
              options={classesForCycle.map((c: any) => ({ value: c.id, label: c.name }))}
              value={classFilter}
              onValueChange={setClassFilter}
              placeholder="Classe"
              searchPlaceholder="Rechercher une classe..."
              allLabel="Toutes classes"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Periode de paie</label>
            <SearchableSelect
              options={payrollPeriods.map((p: any) => ({ value: p.id, label: p.periodName }))}
              value={selectedPeriodId || activePeriodId}
              onValueChange={setSelectedPeriodId}
              placeholder={payrollPeriodsLoading ? 'Chargement...' : (payrollPeriods.length === 0 ? 'Aucune période' : 'Sélectionner période')}
              searchPlaceholder="Rechercher une période..."
              className="mt-1"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            onClick={handleExportCsv}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            onClick={handleExportPdf}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Encaissements</span>
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {formatCurrency(paymentsTotal)}
          </div>
          <div className="text-xs text-gray-400">Periode selectionnee</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Recouvrement</span>
            <LineIcon className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {collectionRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-400">Selon echeances</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Solde restant</span>
            <PieIcon className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {formatCurrency(scheduleTotals.totalRemaining)}
          </div>
          <div className="text-xs text-gray-400">Frais a percevoir</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Paie restante</span>
            <Calendar className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {formatCurrency(payrollRemaining)}
          </div>
          <div className="text-xs text-gray-400">Periode active</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Evolution des encaissements</h2>
            <LineIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="mt-4">
            {paymentTrend.length > 0 ? (
              <LineChart
                data={paymentTrend}
                xAxisKey="month"
                lines={[
                  { dataKey: 'amount', name: 'Montant', color: '#3b82f6' },
                  { dataKey: 'count', name: 'Transactions', color: '#10b981' },
                ]}
                height={280}
              />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                Pas de donnees sur la periode.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Repartition par methode</h2>
            <CreditCard className="h-5 w-5 text-gray-400" />
          </div>
          <div className="mt-4">
            {paymentMethodData.length > 0 ? (
              <PieChart data={paymentMethodData} height={280} />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                Pas de donnees de paiement.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Etat des echeances</h2>
            <PieIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="mt-4">
            {scheduleStatusData.length > 0 ? (
              <DonutChart
                data={scheduleStatusData}
                height={280}
                centerContent={
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Reste total</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(scheduleTotals.totalRemaining)}
                    </div>
                  </div>
                }
              />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                Pas de donnees d echeance.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Top soldes impayes</h2>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="mt-4 space-y-3">
            {topOutstanding.length > 0 ? (
              topOutstanding.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-400">{item.matricule || 'Sans matricule'}</div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex h-40 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                Aucun solde en attente.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Paie par enseignant</h2>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="mt-4">
            {payrollByTeacher.length > 0 ? (
              <BarChart
                data={payrollByTeacher}
                xAxisKey="name"
                bars={[
                  { dataKey: 'net', name: 'Net', color: '#3b82f6' },
                  { dataKey: 'paid', name: 'Paye', color: '#10b981' },
                ]}
                height={320}
              />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                Pas de donnees de paie pour la periode.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Statut de la paie</h2>
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
          <div className="mt-4">
            {payrollStatusData.length > 0 ? (
              <DonutChart
                data={payrollStatusData}
                height={280}
                centerContent={
                  <div className="text-center">
                    <div className="text-xs text-gray-500">Reste</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(payrollRemaining)}
                    </div>
                  </div>
                }
              />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                Pas de donnees sur la paie.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Mobile Money - volume journalier</h2>
            <LineIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="mt-4">
            {mobileDailyData.length > 0 ? (
              <LineChart
                data={mobileDailyData}
                xAxisKey="date"
                lines={[
                  { dataKey: 'amount', name: 'Montant', color: '#8b5cf6' },
                  { dataKey: 'count', name: 'Transactions', color: '#f59e0b' },
                ]}
                height={280}
              />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                Pas de donnees Mobile Money.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Mobile Money - fournisseurs</h2>
            <CreditCard className="h-5 w-5 text-gray-400" />
          </div>
          <div className="mt-4">
            {mobileProviderChart.length > 0 ? (
              <PieChart data={mobileProviderChart} height={280} />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                Pas de donnees fournisseur.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <div className="text-sm text-gray-500">Mobile Money total</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {formatCurrency(mobileKpis?.total_amount || 0)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Transactions</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {mobileKpis?.total_transactions || 0}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Taux succes</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {(mobileKpis?.success_rate || 0).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Auto reconciliation</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">
              {(mobileKpis?.auto_reconciliation_rate || 0).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
