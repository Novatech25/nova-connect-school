'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAuthContext,
  useClasses,
  useAcademicYears,
  useLevels,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const queryClient = useQueryClient();
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<ReportCardStatus | 'all'>('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<PaymentBlockStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('classic');

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
  const currentAcademicYearId = currentAcademicYear?.id || '';

  const { data: academicYears = [] } = useAcademicYears(schoolId);
  const { data: levels = [] } = useLevels(schoolId);
  const { data: periods = [] } = usePeriods(schoolId, selectedAcademicYear);
  const { data: classes = [] } = useClasses(schoolId, selectedAcademicYear);

  // Set default year when available
  useMemo(() => {
    if (academicYears.length > 0 && !selectedAcademicYear) {
      const currentYear = (academicYears as any[]).find((y: any) => y.is_current) || (academicYears as any[])[0];
      if (currentYear) {
        setSelectedAcademicYear(currentYear.id);
      }
    }
  }, [academicYears, selectedAcademicYear]);

  // Compute filtered classes based on selected level
  const filteredClasses = classes.filter((c: any) => 
    selectedLevel === 'all' || c.level_id === selectedLevel || c.levelId === selectedLevel
  );

  const statusFilter = selectedStatus === 'all' ? undefined : selectedStatus;
  const paymentStatusFilter = selectedPaymentStatus === 'all' ? undefined : selectedPaymentStatus;

  const { data: reportCards, isLoading } = useReportCards(schoolId, {
    periodId: selectedPeriod || undefined,
    classId: selectedClass || undefined,
    status: statusFilter,
    paymentStatus: paymentStatusFilter,
    academicYearId: selectedPeriod ? undefined : (selectedAcademicYear || undefined),
  });

  const generateBatch = useGenerateBatchReportCards();
  const exportCards = useExportReportCards();

  const triggerGenerateBatch = () => {
    if (!selectedClass || !selectedPeriod) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner une classe et une période.',
        variant: 'destructive',
      });
      return;
    }
    setShowBatchDialog(true);
  };

  const handleGenerateBatch = async () => {
    setShowBatchDialog(false);

    try {
      const result = await generateBatch.mutateAsync({
        classId: selectedClass,
        periodId: selectedPeriod,
        regenerate: true,
        templateId: selectedTemplate,
      });

      toast({
        title: 'Génération terminée',
        description: `${result.successful} bulletins générés avec succès, ${result.failed} échecs.`,
      });

      // Force refreshing the table data
      await queryClient.invalidateQueries({ queryKey: ['report_cards'] });
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
    return reportCards.filter((card: any) => {
      const student = card.student;
      const fullName = `${student?.firstName || ''} ${student?.lastName || ''}`.trim().toLowerCase();
      const matricule = student?.matricule?.toLowerCase() || '';
      return fullName.includes(query) || matricule.includes(query);
    });
  }, [reportCards, searchQuery]);

  const activeFiltersLabel = useMemo(() => {
    const labels: string[] = [];
    if (selectedAcademicYear) {
      const yearName = academicYears?.find((y: any) => y.id === selectedAcademicYear)?.name;
      labels.push(yearName ? `Année: ${yearName}` : 'Année');
    }
    if (selectedLevel !== 'all') {
      const levelName = levels?.find((l: any) => l.id === selectedLevel)?.name;
      labels.push(levelName ? `Niveau: ${levelName}` : 'Niveau');
    }
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
    setSelectedLevel('all');
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
        <GenerateDialog schoolId={schoolId} academicYearId={currentAcademicYearId} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres et actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
            <SearchableSelect
              options={(academicYears || []).map((y: any) => ({ value: y.id, label: y.name }))}
              value={selectedAcademicYear}
              onValueChange={(val) => {
                setSelectedAcademicYear(val);
                setSelectedPeriod(''); // Reset period when year changes
                setSelectedClass(''); // Optional but logical
              }}
              placeholder={academicYears?.length ? 'Année scolaire' : 'Chargement...'}
              searchPlaceholder="Rechercher une année..."
            />

            <SearchableSelect
              options={(levels || []).map((l: any) => ({ value: l.id, label: l.name }))}
              value={selectedLevel}
              onValueChange={(val) => {
                setSelectedLevel(val);
                setSelectedClass(''); // Reset class when level changes
              }}
              placeholder={levels?.length ? 'Niveau' : 'Chargement...'}
              searchPlaceholder="Rechercher un niveau..."
              allLabel="Tous les niveaux"
            />

            <SearchableSelect
              options={(periods || []).map((p: any) => ({ value: p.id, label: p.name }))}
              value={selectedPeriod}
              onValueChange={setSelectedPeriod}
              placeholder={periods?.length ? 'Sélectionner une période' : 'Chargement...'}
              searchPlaceholder="Rechercher une période..."
            />

            <SearchableSelect
              options={(filteredClasses || []).map((c: any) => ({ value: c.id, label: c.name }))}
              value={selectedClass}
              onValueChange={setSelectedClass}
              placeholder={filteredClasses?.length ? 'Sélectionner une classe' : 'Aucune classe'}
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
              onClick={triggerGenerateBatch}
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

      {/* Dialog for batch generation template selection */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              Générer pour la classe
            </DialogTitle>
            <DialogDescription>
              Vous allez générer les bulletins pour tous les élèves de la classe sélectionnée.
              Quel modèle de document souhaitez-vous appliquer ?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-2">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Choix de la couleur thématique
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { id: 'classic', name: 'Défaut', desc: 'Selon le niveau', bg: 'bg-slate-800' },
                { id: 'blue', name: 'Bleu', bg: 'bg-blue-700' },
                { id: 'green', name: 'Vert', bg: 'bg-emerald-600' },
                { id: 'purple', name: 'Violet', bg: 'bg-purple-700' },
                { id: 'red', name: 'Rouge', bg: 'bg-rose-700' },
                { id: 'orange', name: 'Orange', bg: 'bg-orange-600' },
              ].map(theme => (
                <label key={theme.id} className={`border rounded-lg p-2 cursor-pointer flex flex-col gap-1 transition-all ${selectedTemplate === theme.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-primary/50 bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" className="sr-only" name="batch_template_selection" value={theme.id} checked={selectedTemplate === theme.id} onChange={(e) => setSelectedTemplate(e.target.value)} />
                    <div className={`w-4 h-4 rounded-full ${theme.bg} ${selectedTemplate === theme.id ? 'ring-2 ring-offset-2 ring-primary' : ''}`} />
                    <span className="font-semibold text-slate-900 text-xs">{theme.name}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleGenerateBatch}
              disabled={generateBatch.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generateBatch.isPending ? 'Génération en cours...' : 'Confirmer la génération'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
