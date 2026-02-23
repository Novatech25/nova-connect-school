'use client';

import { useMemo, useState } from 'react';
import {
  useAuthContext,
  useClasses,
  useCurrentAcademicYear,
  useExportReportCards,
  useGenerateBatchReportCards,
  usePeriods,
  useReportCards,
} from '@novaconnect/data';
import type { PaymentBlockStatus, ReportCardStatus } from '@novaconnect/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, RefreshCw, X } from 'lucide-react';
import { ReportCardsTable } from './components/ReportCardsTable';
import { GenerateDialog } from './components/GenerateDialog';
import { GenerationModeIndicator } from '@/components/report-card/GenerationModeIndicator';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  generated: 'Soumis',
  published: 'Publié',
  archived: 'Archivé',
};

const PAYMENT_LABELS: Record<string, string> = {
  ok: 'OK',
  warning: 'Attention',
  blocked: 'Bloqué',
};

export default function ReportCardsPage() {
  const { profile, user } = useAuthContext();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<ReportCardStatus | 'all'>('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<PaymentBlockStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    user?.schoolId ||
    (user as any)?.school_id;

  if (!schoolId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Accès non autorisé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Vous devez être rattaché à une école pour accéder aux bulletins.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: currentAcademicYear } = useCurrentAcademicYear(schoolId);
  const academicYearId = currentAcademicYear?.id || '';

  const { data: periods } = usePeriods(schoolId, academicYearId);
  const { data: classes } = useClasses(schoolId, academicYearId);

  const statusFilter = selectedStatus === 'all' ? undefined : selectedStatus;
  const paymentStatusFilter = selectedPaymentStatus === 'all' ? undefined : selectedPaymentStatus;

  const { data: reportCards, isLoading } = useReportCards(schoolId, {
    periodId: selectedPeriod || undefined,
    classId: selectedClass || undefined,
    status: statusFilter,
    paymentStatus: paymentStatusFilter,
    academicYearId: academicYearId || undefined,
  });

  const generateBatch = useGenerateBatchReportCards();
  const exportCards = useExportReportCards();

  const handleGenerateBatch = async () => {
    if (!selectedClass || !selectedPeriod) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner une classe et une période.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await generateBatch.mutateAsync({
        classId: selectedClass,
        periodId: selectedPeriod,
      });

      toast({
        title: 'Génération terminée',
        description: `${result.successful} bulletins générés avec succès, ${result.failed} échecs.`,
      });
    } catch (error: any) {
      const errorMessage =
        error?.context?.message ||
        error?.message ||
        'Échec de la génération des bulletins.';
      toast({
        title: 'Erreur',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    if (!selectedPeriod) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner une période.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const blob = await exportCards.mutateAsync({
        periodId: selectedPeriod,
        classId: selectedClass || undefined,
        format,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulletins_${selectedPeriod}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export réussi',
        description: `Fichier ${format.toUpperCase()} téléchargé.`,
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: "Échec de l'export.",
        variant: 'destructive',
      });
    }
  };

  const filteredReportCards = useMemo(() => {
    if (!reportCards) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return reportCards;
    return reportCards.filter((card) => {
      const student = card.student;
      const fullName = `${student?.firstName || ''} ${student?.lastName || ''}`.trim().toLowerCase();
      const matricule = student?.matricule?.toLowerCase() || '';
      return fullName.includes(query) || matricule.includes(query);
    });
  }, [reportCards, searchQuery]);

  const activeFiltersLabel = useMemo(() => {
    const labels: string[] = [];
    if (selectedClass) {
      const className = classes?.find((cls: any) => cls.id === selectedClass)?.name;
      labels.push(className ? `Classe: ${className}` : 'Classe');
    }
    if (selectedPeriod) {
      const periodName = periods?.find((period: any) => period.id === selectedPeriod)?.name;
      labels.push(periodName ? `Période: ${periodName}` : 'Période');
    }
    if (selectedStatus !== 'all') {
      labels.push(`Statut: ${STATUS_LABELS[selectedStatus] || selectedStatus}`);
    }
    if (selectedPaymentStatus !== 'all') {
      labels.push(`Paiement: ${PAYMENT_LABELS[selectedPaymentStatus] || selectedPaymentStatus}`);
    }
    if (searchQuery.trim()) {
      labels.push(`Recherche: "${searchQuery.trim()}"`);
    }
    return labels;
  }, [classes, periods, searchQuery, selectedClass, selectedPaymentStatus, selectedPeriod, selectedStatus]);

  const resetFilters = () => {
    setSelectedClass('');
    setSelectedPeriod('');
    setSelectedStatus('all');
    setSelectedPaymentStatus('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Bulletins scolaires</h1>
          <div className="mt-2">
            <GenerationModeIndicator />
          </div>
        </div>
        <GenerateDialog schoolId={schoolId} academicYearId={academicYearId} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres et actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <SearchableSelect
              options={(periods || []).map((p: any) => ({ value: p.id, label: p.name }))}
              value={selectedPeriod}
              onValueChange={setSelectedPeriod}
              placeholder={periods?.length ? 'Sélectionner une période' : 'Chargement...'}
              searchPlaceholder="Rechercher une période..."
            />

            <SearchableSelect
              options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
              value={selectedClass}
              onValueChange={setSelectedClass}
              placeholder={classes?.length ? 'Sélectionner une classe' : 'Chargement...'}
              searchPlaceholder="Rechercher une classe..."
            />

            <SearchableSelect
              options={[
                { value: 'draft', label: 'Brouillon' },
                { value: 'generated', label: 'Soumis' },
                { value: 'published', label: 'Publié' },
                { value: 'archived', label: 'Archivé' },
              ]}
              value={selectedStatus}
              onValueChange={(value) => setSelectedStatus(value as ReportCardStatus | 'all')}
              placeholder="Statut"
              searchPlaceholder="Rechercher un statut..."
              allLabel="Tous les statuts"
            />

            <SearchableSelect
              options={[
                { value: 'ok', label: 'OK' },
                { value: 'warning', label: 'Attention' },
                { value: 'blocked', label: 'Bloqué' },
              ]}
              value={selectedPaymentStatus}
              onValueChange={(value) => setSelectedPaymentStatus(value as PaymentBlockStatus | 'all')}
              placeholder="Paiement"
              searchPlaceholder="Rechercher..."
              allLabel="Tous les paiements"
            />

            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechercher un élève ou un matricule"
            />
          </div>

          {activeFiltersLabel.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFiltersLabel.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="mr-2 h-4 w-4" />
                Réinitialiser
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleGenerateBatch}
              disabled={!selectedClass || !selectedPeriod || generateBatch.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {generateBatch.isPending ? 'Génération...' : 'Générer (Classe)'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              disabled={!selectedPeriod || exportCards.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('excel')}
              disabled={!selectedPeriod || exportCards.isPending}
            >
              <FileText className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <ReportCardsTable reportCards={filteredReportCards} isLoading={isLoading} />
    </div>
  );
}
