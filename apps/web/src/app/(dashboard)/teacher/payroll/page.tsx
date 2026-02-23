'use client';

import { useState } from 'react';
import { useAuth } from '@novaconnect/data/hooks';
import { usePayrollEntriesByTeacher, useTeacherCurrentMonthEstimate } from '@novaconnect/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HoursBreakdownDialog } from './components/HoursBreakdownDialog';
import {
  Loader2,
  FileText,
  Download,
  Calendar,
  Clock,
  DollarSign,
  CheckCircle,
  TrendingUp,
  List,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@novaconnect/data/client';

// Feature flag: Enable teacher payroll UI
const TEACHER_PAYROLL_ENABLED = process.env.NEXT_PUBLIC_TEACHER_PAYROLL_ENABLED === 'true';

const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-800', icon: Clock },
  pending_payment: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  paid: { label: 'Payé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
};

export default function TeacherPayrollPage() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>();
  const [breakdownDialogOpen, setBreakdownDialogOpen] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | undefined>();

  // Hooks must be called unconditionally
  const { data: entries, isLoading } = usePayrollEntriesByTeacher(user?.id || '', {
    status: selectedPeriod,
  });
  const { data: currentMonthEstimate } = useTeacherCurrentMonthEstimate(user?.id || '');

  // Feature flag check
  if (!TEACHER_PAYROLL_ENABLED) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Fonctionnalité bientôt disponible</h3>
              <p className="text-muted-foreground">
                L'accès à vos fiches de paie sera activé prochainement.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDownloadSlip = async (entryId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-payroll-slip`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ payrollEntryId: entryId }),
        }
      );

      const result = await response.json();

      if (result.success && result.signedUrl) {
        window.open(result.signedUrl, '_blank');
      } else {
        alert(`Erreur: ${result.message}`);
      }
    } catch (error) {
      console.error('Error downloading slip:', error);
      alert('Erreur lors du téléchargement de la fiche');
    }
  };

  // Calculate totals
  const totals = entries?.reduce(
    (acc, entry) => ({
      hours: acc.hours + (entry.validatedHours || 0),
      gross: acc.gross + (entry.grossAmount || 0),
      net: acc.net + (entry.netAmount || 0),
      paid: acc.paid + (entry.status === 'paid' ? entry.netAmount || 0 : 0),
      pending: acc.pending + ((entry.status === 'draft' || entry.status === 'pending_payment') ? entry.netAmount || 0 : 0),
    }),
    { hours: 0, gross: 0, net: 0, paid: 0, pending: 0 }
  ) || { hours: 0, gross: 0, net: 0, paid: 0, pending: 0 };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ma Paie</h1>
        <p className="text-muted-foreground mt-2">
          Consultez vos fiches de paie et historique des paiements
        </p>
      </div>

      {/* Current Month Estimate */}
      {currentMonthEstimate && currentMonthEstimate.currentMonthHours > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Paie en cours (estimation)
              </CardTitle>
              <Badge className="bg-blue-100 text-blue-800">Estimation</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Heures validées ce mois</div>
                <div className="text-2xl font-bold">{currentMonthEstimate.currentMonthHours.toFixed(2)}h</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Montant estimé</div>
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(currentMonthEstimate.estimatedAmount).toLocaleString('fr-FR')} FCFA
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Séances validées</div>
                <div className="text-2xl font-bold">{currentMonthEstimate.validatedSessionsCount}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heures Total</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.hours.toFixed(2)}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Montant Brut</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(totals.gross).toLocaleString('fr-FR')} FCFA
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payé</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Math.round(totals.paid).toLocaleString('fr-FR')} FCFA
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {Math.round(totals.pending).toLocaleString('fr-FR')} FCFA
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Button
          variant={selectedPeriod === undefined ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedPeriod(undefined)}
        >
          Toutes
        </Button>
        <Button
          variant={selectedPeriod === 'paid' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedPeriod('paid')}
        >
          Payées
        </Button>
        <Button
          variant={selectedPeriod === 'pending_payment' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedPeriod('pending_payment')}
        >
          En attente
        </Button>
      </div>

      {/* Entries List */}
      <div className="space-y-4">
        {entries && entries.length > 0 ? (
          entries.map((entry) => (
            <Card key={entry.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold">
                        {entry.payrollPeriod?.periodName}
                      </h3>
                      <Badge className={statusLabels[entry.status]?.color || ''}>
                        {statusLabels[entry.status]?.label || entry.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">
                      Du {format(new Date(entry.payrollPeriod?.startDate || ''), 'dd MMM yyyy', { locale: fr })} au{' '}
                      {format(new Date(entry.payrollPeriod?.endDate || ''), 'dd MMM yyyy', { locale: fr })}
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Heures validées: </span>
                        <span className="font-medium">{entry.validatedHours.toFixed(2)}h</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Taux horaire: </span>
                        <span className="font-medium">{Math.round(entry.hourlyRate).toLocaleString('fr-FR')} FCFA</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Montant brut: </span>
                        <span className="font-medium">{Math.round(entry.grossAmount).toLocaleString('fr-FR')} FCFA</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Net à payer: </span>
                        <span className="font-bold text-lg">{Math.round(entry.netAmount).toLocaleString('fr-FR')} FCFA</span>
                      </div>
                    </div>
                    {entry.salaryComponents && entry.salaryComponents.length > 0 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                        <div className="font-medium mb-2">Détail des ajustements:</div>
                        {entry.salaryComponents.map((comp) => (
                          <div key={comp.id} className="flex justify-between mb-1">
                            <span>{comp.label}:</span>
                            <span className={comp.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                              {comp.amount > 0 ? '+' : ''}{Math.round(comp.amount).toLocaleString('fr-FR')} FCFA
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPeriodId(entry.payrollPeriodId);
                        setBreakdownDialogOpen(true);
                      }}
                    >
                      <List className="w-4 h-4 mr-2" />
                      Voir détail
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadSlip(entry.id)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune fiche de paie</h3>
              <p className="text-muted-foreground text-center">
                Vous n'avez pas encore de fiches de paie disponibles
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Hours Breakdown Dialog */}
      {user?.id && (
        <HoursBreakdownDialog
          open={breakdownDialogOpen}
          onOpenChange={setBreakdownDialogOpen}
          teacherId={user.id}
          periodId={selectedPeriodId}
        />
      )}
    </div>
  );
}
