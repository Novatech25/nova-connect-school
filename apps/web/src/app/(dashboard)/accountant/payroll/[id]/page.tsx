'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { usePayrollPeriod, usePayrollEntriesByPeriod } from '@novaconnect/data';
import { getSupabaseClient } from '@novaconnect/data/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Loader2,
  ArrowLeft,
  Calculator,
  FileText,
  Download,
  CheckCircle,
  Clock,
  Users,
  FileSpreadsheet,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-800', icon: Clock },
  pending_payment: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  paid: { label: 'Payé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
};

export default function PayrollPeriodDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const periodId = params.id as string;
  const [isCalculating, setIsCalculating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: period, isLoading: periodLoading } = usePayrollPeriod(periodId);
  const { data: entries, isLoading: entriesLoading, refetch } = usePayrollEntriesByPeriod(periodId);

  const handleCalculatePayroll = async () => {
    setShowConfirmDialog(false);
    setIsCalculating(true);
    try {
      const { data, error } = await getSupabaseClient().functions.invoke('calculate-payroll', {
        body: { 
          payrollPeriodId: periodId,
          schoolId: period?.schoolId || period?.school_id
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Succès",
          description: `Paie calculée avec succès pour ${data.entriesCount} enseignants`,
          variant: "default",
        });
        refetch();
      } else {
        toast({
          title: "Erreur",
          description: data?.message || 'Erreur inconnue',
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error calculating payroll:', error);
      toast({
        title: "Erreur",
        description: error.message || 'Erreur lors du calcul de la paie',
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleGenerateSlip = async (entryId: string) => {
    try {
      const { data, error } = await getSupabaseClient().functions.invoke('generate-payroll-slip', {
        body: { payrollEntryId: entryId },
      });

      if (error) throw error;

      if (data?.success && data?.signedUrl) {
        // Download the PDF
        window.open(data.signedUrl, '_blank');
        toast({
          title: "Succès",
          description: "La fiche de paie a été générée.",
        });
        refetch();
      } else {
        toast({
          title: "Erreur",
          description: data?.message || 'Erreur inconnue',
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error generating slip:', error);
      toast({
        title: "Erreur",
        description: error.message || 'Erreur lors de la génération de la fiche',
        variant: "destructive",
      });
    }
  };

  const handleExportExcel = async () => {
    try {
      // Create a direct fetch call for Excel because we need the raw Blob response
      // supabase.functions.invoke tries to parse JSON automatically
      const supabaseObj = getSupabaseClient();
      const { data: { session } } = await supabaseObj.auth.getSession();
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/export-payroll-excel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ payrollPeriodId: periodId }),
        }
      );

      if (response.ok) {
        // Download the Excel file
        const blob = await response.blob();
        const url = globalThis.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paie_${period?.periodName.replaceAll(/\s+/g, '_') || 'export'}.xlsx`;
        document.body.appendChild(a);
        a.click();
        globalThis.URL.revokeObjectURL(url);
        a.remove();
      } else {
        const errorText = await response.text();
        alert(`Erreur d'export: ${errorText}`);
      }
    } catch (error: any) {
      console.error('Error exporting Excel:', error);
      alert(error.message || 'Erreur lors de l\'export Excel');
    }
  };


  if (periodLoading || entriesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!period) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Période non trouvée</h2>
        <Link href="/accountant/payroll">
          <Button>Retour à la liste</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/accountant/payroll">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{period.periodName}</h1>
              <Badge className={statusLabels[period.status]?.color || ''}>
                {statusLabels[period.status]?.label || period.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Du {format(new Date(period.startDate), 'dd MMM yyyy', { locale: fr })} au{' '}
              {format(new Date(period.endDate), 'dd MMM yyyy', { locale: fr })}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleExportExcel}
            variant="outline"
            disabled={!entries || entries.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exporter Excel
          </Button>
          {period.status === 'draft' && (
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={isCalculating}
              size="lg"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Calcul en cours...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4 mr-2" />
                  Calculer la paie
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* AlertDialog de confirmation */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Calculator className="h-5 w-5 text-blue-600" />
              </div>
              <AlertDialogTitle className="text-lg">Calculer la paie</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-gray-600 leading-relaxed">
              Cette action va calculer automatiquement les salaires de tous les
              enseignants pour la période{' '}
              <span className="font-semibold text-gray-900">{period?.periodName}</span>.
              <br /><br />
              Les heures validées issues des journaux de cours seront agrégées
              et les entrées de paie existantes mises à jour.
              <br /><br />
              <span className="text-amber-700 font-medium">
                ⚠️ Cette opération peut prendre quelques secondes.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel disabled={isCalculating}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCalculatePayroll}
              disabled={isCalculating}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calcul en cours...
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Lancer le calcul
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enseignants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entries?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heures Total</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entries?.reduce((sum, e) => sum + (e.validatedHours || 0), 0).toFixed(2)}h
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Montant Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entries?.reduce((sum, e) => sum + (e.netAmount || 0), 0).toLocaleString('fr-FR')} FCFA
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Entrées de paie</CardTitle>
        </CardHeader>
        <CardContent>
          {entries && entries.length > 0 ? (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">
                          {entry.teacher?.firstName} {entry.teacher?.lastName}
                        </h4>
                        <Badge className={statusLabels[entry.status]?.color || ''}>
                          {statusLabels[entry.status]?.label || entry.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Heures: </span>
                          <span className="font-medium">{entry.validatedHours.toFixed(2)}h</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Taux: </span>
                          <span className="font-medium">{entry.hourlyRate.toLocaleString('fr-FR')} FCFA</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Brut: </span>
                          <span className="font-medium">{entry.grossAmount.toLocaleString('fr-FR')} FCFA</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Net: </span>
                          <span className="font-bold">{entry.netAmount.toLocaleString('fr-FR')} FCFA</span>
                        </div>
                      </div>
                      {entry.salaryComponents && entry.salaryComponents.length > 0 && (
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">Ajustements: </span>
                          {entry.salaryComponents.map((comp: any) => (
                            <span key={comp.id} className="mr-3">
                              {comp.label}: {comp.amount.toLocaleString('fr-FR')} FCFA
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/accountant/payroll/entry/${entry.id}`)}
                      >
                        Modifier
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateSlip(entry.id)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Fiche
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune entrée de paie pour cette période</p>
              <p className="text-sm mt-2">Cliquez sur "Calculer la paie" pour commencer</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
