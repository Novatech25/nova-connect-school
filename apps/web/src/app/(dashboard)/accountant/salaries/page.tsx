'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, DollarSign, FileText, Search, Users, Wallet, Save, X, Calculator, Loader2 } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useAuthContext } from '@novaconnect/data/providers';
import { getSupabaseClient } from '@novaconnect/data/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  useAcademicYears,
  usePayrollPeriods,
  usePayrollEntriesByPeriod,
  useRecordPayrollPayment,
  useUpdatePayrollEntry,
  useTeacherHoursBreakdown,
} from '@novaconnect/data';

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  pending_payment: 'En attente',
  paid: 'Paye',
  cancelled: 'Annule',
};

const statusStyles: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_payment: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-700',
};

const paymentMethodLabels: Record<string, string> = {
  cash: 'Especes',
  bank_transfer: 'Virement bancaire',
  check: 'Cheque',
  mobile_money: 'Mobile Money',
  card: 'Carte',
  other: 'Autre',
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

export default function AccountantSalariesPage() {
  const { user, profile } = useAuthContext();

  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    (user?.user_metadata as any)?.schoolId ||
    (user?.user_metadata as any)?.school_id ||
    (user as any)?.schoolId ||
    (user as any)?.school_id;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');

  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    paymentMethod: 'cash',
    referenceNumber: '',
    notes: '',
    autoGenerateSlip: true,
  });

  const [breakdownEntry, setBreakdownEntry] = useState<any>(null);
  const [editedEntries, setEditedEntries] = useState<Record<string, { validatedHours?: number; hourlyRate?: number }>>({});
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const queryClient = useQueryClient();

  const { data: academicYears = [] } = useAcademicYears(schoolId || '');

  const defaultAcademicYearId = useMemo(() => {
    const current = academicYears.find((year: any) => year.isCurrent);
    return current?.id || academicYears[0]?.id || '';
  }, [academicYears]);

  const activeAcademicYearId = selectedAcademicYearId || defaultAcademicYearId;

  const { data: payrollPeriods = [], isLoading: periodsLoading } = usePayrollPeriods(
    schoolId || '',
    activeAcademicYearId || undefined
  );

  const activePeriodId = selectedPeriodId || payrollPeriods[0]?.id || '';

  const { data: payrollEntries = [], isLoading: entriesLoading } = usePayrollEntriesByPeriod(activePeriodId || '');

  const { data: breakdownData = [], isLoading: breakdownLoading } = useTeacherHoursBreakdown(
    breakdownEntry?.teacherId || '',
    activePeriodId || undefined
  );

  const updateEntry = useUpdatePayrollEntry();
  const recordPayment = useRecordPayrollPayment(schoolId || '');

  const handleCalculatePayroll = async () => {
    if (!activePeriodId) {
      toast.error('Veuillez sélectionner une période de paie.');
      return;
    }
    setIsCalculating(true);
    try {
      const { data, error } = await getSupabaseClient().functions.invoke('calculate-payroll', {
        body: { payrollPeriodId: activePeriodId, schoolId },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Paie calculée pour ${data.entriesCount ?? 0} enseignant(s).`);
        queryClient.invalidateQueries({ queryKey: ['payroll-entries'] });
      } else {
        toast.error(data?.message || 'Erreur lors du calcul.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du calcul de la paie.');
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    if (!selectedPeriodId && payrollPeriods[0]?.id) {
      setSelectedPeriodId(payrollPeriods[0].id);
      return;
    }
    if (selectedPeriodId && payrollPeriods.length > 0) {
      const exists = payrollPeriods.some((period: any) => period.id === selectedPeriodId);
      if (!exists) {
        setSelectedPeriodId(payrollPeriods[0]?.id || '');
      }
    }
  }, [payrollPeriods, selectedPeriodId]);

  const getPaidAmount = (entry: any) => {
    return entry?.payments?.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0) || 0;
  };

  const getRemainingAmount = (entry: any) => {
    const netAmount = entry?.netAmount || 0;
    const paidAmount = getPaidAmount(entry);
    return Math.max(netAmount - paidAmount, 0);
  };

  const handleOpenPayment = (entry: any) => {
    const remaining = getRemainingAmount(entry);
    setSelectedEntry(entry);
    setPaymentForm({
      amount: remaining > 0 ? remaining : entry.netAmount || 0,
      paymentMethod: 'cash',
      referenceNumber: '',
      notes: '',
      autoGenerateSlip: true,
    });
    setPaymentDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedEntry || !schoolId) return;
    if (!paymentForm.amount || paymentForm.amount <= 0) {
      alert('Veuillez saisir un montant valide.');
      return;
    }

    try {
      await recordPayment.mutateAsync({
        payrollEntryId: selectedEntry.id,
        amount: paymentForm.amount,
        paymentMethod: paymentForm.paymentMethod as any,
        referenceNumber: paymentForm.referenceNumber || undefined,
        notes: paymentForm.notes || undefined,
        autoGenerateSlip: paymentForm.autoGenerateSlip,
      } as any);
      setPaymentDialogOpen(false);
      setSelectedEntry(null);
    } catch (error: any) {
      console.error('Record payroll payment error:', error);
      alert(error?.message || 'Erreur lors du paiement.');
    }
  };

  const handleSaveEntry = async (entry: any) => {
    const edits = editedEntries[entry.id];
    if (!edits) return;

    setSavingEntryId(entry.id);
    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        validatedHours: edits.validatedHours ?? entry.validatedHours,
        hourlyRate: edits.hourlyRate ?? entry.hourlyRate,
      });
      setEditedEntries((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
    } catch (error: any) {
      console.error('Update payroll entry error:', error);
      alert(error?.message || 'Erreur lors de la mise a jour.');
    } finally {
      setSavingEntryId(null);
    }
  };

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return payrollEntries.filter((entry: any) => {
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;

      if (query) {
        const teacher = entry.teacher || {};
        const haystack = `${teacher.firstName || ''} ${teacher.lastName || ''} ${teacher.email || ''}`
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [payrollEntries, searchQuery, statusFilter]);

  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry: any) => {
        acc.totalHours += entry.totalHours || 0;
        acc.validatedHours += entry.validatedHours || 0;
        acc.netAmount += entry.netAmount || 0;
        acc.paidAmount += getPaidAmount(entry);
        return acc;
      },
      { totalHours: 0, validatedHours: 0, netAmount: 0, paidAmount: 0 }
    );
  }, [filteredEntries]);

  const totalRemaining = Math.max(totals.netAmount - totals.paidAmount, 0);
  const activePeriod = payrollPeriods.find((period: any) => period.id === activePeriodId);

  if (!schoolId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Salaires</h1>
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
          <h1 className="text-3xl font-bold text-gray-900">Salaires enseignants</h1>
          <p className="mt-1 text-gray-600">
            Suivi des volumes horaires, validation et paiements des professeurs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/accountant/payroll"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            Periodes
          </Link>
          {activePeriodId && (
            <button
              onClick={handleCalculatePayroll}
              disabled={isCalculating}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {isCalculating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              {isCalculating ? 'Calcul en cours...' : 'Calculer la paie'}
            </button>
          )}
          <Link
            href="/accountant/payroll/create"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Calendar className="h-4 w-4" />
            Nouvelle periode
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Enseignants</span>
            <Users className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {filteredEntries.length}
          </div>
          <div className="text-xs text-gray-400">Entrees sur la periode</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Heures validees</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {totals.validatedHours.toFixed(1)} h
          </div>
          <div className="text-xs text-gray-400">Total sur la periode</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Montant net</span>
            <DollarSign className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {formatCurrency(totals.netAmount)}
          </div>
          <div className="text-xs text-gray-400">A regler</div>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Reste a payer</span>
            <Wallet className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {formatCurrency(totalRemaining)}
          </div>
          <div className="text-xs text-gray-400">Apres paiements</div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechercher un professeur"
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
            options={payrollPeriods.map((p: any) => ({ value: p.id, label: p.periodName }))}
            value={selectedPeriodId || activePeriodId}
            onValueChange={setSelectedPeriodId}
            placeholder={periodsLoading ? 'Chargement...' : (payrollPeriods.length === 0 ? 'Aucune période' : 'Sélectionner période')}
            searchPlaceholder="Rechercher une période..."
          />

          <SearchableSelect
            options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
            value={statusFilter}
            onValueChange={setStatusFilter}
            placeholder="Statut"
            searchPlaceholder="Rechercher un statut..."
            allLabel="Tous statuts"
          />

          <div className="text-sm text-gray-600">
            {activePeriod ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="text-xs text-gray-500">Periode active</div>
                <div className="font-medium text-gray-700">{activePeriod.periodName}</div>
                <div className="text-xs text-gray-500">
                  {formatDate(activePeriod.startDate)} - {formatDate(activePeriod.endDate)}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                Selectionnez une periode
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Professeur</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Heures</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Taux horaire</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Net</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Paye</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reste</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {entriesLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-sm text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : filteredEntries.length > 0 ? (
                filteredEntries.map((entry: any) => {
                  const paidAmount = getPaidAmount(entry);
                  const remainingAmount = getRemainingAmount(entry);
                  const edits = editedEntries[entry.id] || {};
                  const validatedHours = edits.validatedHours ?? entry.validatedHours ?? 0;
                  const hourlyRate = edits.hourlyRate ?? entry.hourlyRate ?? 0;
                  const hasChanges =
                    validatedHours !== entry.validatedHours || hourlyRate !== entry.hourlyRate;

                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-medium">
                          {entry.teacher?.firstName} {entry.teacher?.lastName}
                        </div>
                        <div className="text-xs text-gray-400">{entry.teacher?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="text-xs text-gray-400">
                          Total: {Number(entry.totalHours || 0).toFixed(1)} h
                        </div>
                        <input
                          type="number"
                          value={validatedHours}
                          onChange={(event) =>
                            setEditedEntries((prev) => ({
                              ...prev,
                              [entry.id]: {
                                ...prev[entry.id],
                                validatedHours: Number(event.target.value) || 0,
                              },
                            }))
                          }
                          className="mt-1 w-24 rounded-md border border-gray-200 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <input
                          type="number"
                          value={hourlyRate}
                          onChange={(event) =>
                            setEditedEntries((prev) => ({
                              ...prev,
                              [entry.id]: {
                                ...prev[entry.id],
                                hourlyRate: Number(event.target.value) || 0,
                              },
                            }))
                          }
                          className="w-28 rounded-md border border-gray-200 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {formatCurrency(entry.netAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatCurrency(paidAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatCurrency(remainingAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[entry.status] || 'bg-gray-100 text-gray-700'
                            }`}
                        >
                          {statusLabels[entry.status] || entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setBreakdownEntry(entry)}
                            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Heures
                          </button>
                          <button
                            onClick={() => handleOpenPayment(entry)}
                            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Payer
                          </button>
                          <Link
                            href={`/accountant/payroll/entry/${entry.id}`}
                            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Details
                          </Link>
                          <button
                            onClick={() => handleSaveEntry(entry)}
                            disabled={!hasChanges || savingEntryId === entry.id}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Save className="h-3 w-3" />
                            {savingEntryId === entry.id ? 'Sauvegarde...' : 'Sauver'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Calculator className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                    {!activePeriodId ? (
                      <>
                        <p className="text-sm font-medium text-gray-700 mb-1">Aucune période de paie trouvée</p>
                        <p className="text-xs text-gray-500 mb-4">Créez d'abord une période de paie pour afficher les salaires.</p>
                        <Link href="/accountant/payroll/create" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                          <Calendar className="h-4 w-4" />
                          Créer une période
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-700 mb-1">Aucune entrée de paie pour cette période</p>
                        <p className="text-xs text-gray-500 mb-4">Cliquez sur "Calculer la paie" pour générer les salaires à partir des séances validées.</p>
                        <button
                          onClick={handleCalculatePayroll}
                          disabled={isCalculating}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                          {isCalculating ? 'Calcul en cours...' : 'Calculer la paie'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paymentDialogOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Enregistrer un paiement</h2>
              <button
                onClick={() => setPaymentDialogOpen(false)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <div>
                Professeur: {selectedEntry.teacher?.firstName} {selectedEntry.teacher?.lastName}
              </div>
              <div>Net a payer: {formatCurrency(selectedEntry.netAmount)}</div>
              <div>Reste: {formatCurrency(getRemainingAmount(selectedEntry))}</div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Montant</label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm({ ...paymentForm, amount: Number(event.target.value) || 0 })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Methode</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(event) =>
                    setPaymentForm({ ...paymentForm, paymentMethod: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Reference</label>
                <input
                  type="text"
                  value={paymentForm.referenceNumber}
                  onChange={(event) =>
                    setPaymentForm({ ...paymentForm, referenceNumber: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={paymentForm.autoGenerateSlip}
                  onChange={(event) =>
                    setPaymentForm({ ...paymentForm, autoGenerateSlip: event.target.checked })
                  }
                />
                Generer automatiquement le bulletin
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setPaymentDialogOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={recordPayment.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {recordPayment.isPending ? 'Paiement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {breakdownEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Details des heures</h2>
              <button
                onClick={() => setBreakdownEntry(null)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 text-sm text-gray-600">
              {breakdownEntry.teacher?.firstName} {breakdownEntry.teacher?.lastName}
            </div>
            <div className="mt-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-4 gap-2 bg-gray-50 px-3 py-2 text-xs font-medium uppercase text-gray-500">
                <div>Classe</div>
                <div>Matiere</div>
                <div>Heures</div>
                <div>Montant</div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {breakdownLoading ? (
                  <div className="p-4 text-center text-sm text-gray-500">Chargement...</div>
                ) : breakdownData.length > 0 ? (
                  breakdownData.map((item: any, index: number) => (
                    <div key={`${item.className}-${item.subjectName}-${index}`} className="grid grid-cols-4 gap-2 border-t border-gray-100 px-3 py-2 text-sm text-gray-700">
                      <div>{item.className}</div>
                      <div>{item.subjectName}</div>
                      <div>{item.totalHours.toFixed(1)} h</div>
                      <div>{formatCurrency(item.amount)}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">Aucun detail disponible.</div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setBreakdownEntry(null)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
