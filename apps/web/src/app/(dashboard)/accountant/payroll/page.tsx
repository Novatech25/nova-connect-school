'use client';

import { useState } from 'react';
import { useAuth } from '@novaconnect/data/hooks';
import { usePayrollPeriods, useCreatePayrollPeriod, useDeletePayrollPeriod } from '@novaconnect/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, FileText, Loader2, Calendar, Users, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-800' },
  pending_payment: { label: 'En attente de paiement', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Payé', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800' },
};

export default function PayrollPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: periods, isLoading } = usePayrollPeriods(user?.schoolId || '');
  const createMutation = useCreatePayrollPeriod(user?.schoolId || '');
  const deleteMutation = useDeletePayrollPeriod(user?.schoolId || '');

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette période de paie ?')) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error('Error deleting period:', error);
      alert('Erreur lors de la suppression');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestion de la Paie</h1>
          <p className="text-muted-foreground mt-2">
            Gérez les périodes de paie et les rémunérations des enseignants
          </p>
        </div>
        <Button onClick={() => router.push('/accountant/payroll/create')}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle période
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Périodes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periods?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enseignants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {periods?.reduce((sum, p) => sum + (p.totalTeachers || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Montant Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(periods?.reduce((sum, p) => sum + (p.totalAmount || 0), 0) || 0).toLocaleString('fr-FR')} FCFA
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Periods List */}
      <div className="space-y-4">
        {periods && periods.length > 0 ? (
          periods.map((period) => (
            <Card key={period.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{period.periodName}</h3>
                      <Badge className={statusLabels[period.status]?.color || ''}>
                        {statusLabels[period.status]?.label || period.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Du </span>
                        {format(new Date(period.startDate), 'dd MMM yyyy', { locale: fr })}
                      </div>
                      <div>
                        <span className="font-medium">Au </span>
                        {format(new Date(period.endDate), 'dd MMM yyyy', { locale: fr })}
                      </div>
                      <div>
                        <span className="font-medium">Créé le </span>
                        {format(new Date(period.createdAt), 'dd MMM yyyy', { locale: fr })}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Enseignants: </span>
                        <span className="font-medium">{period.totalTeachers}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Montant total: </span>
                        <span className="font-medium">{Math.round(period.totalAmount).toLocaleString('fr-FR')} FCFA</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/accountant/payroll/${period.id}`)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Détails
                    </Button>
                    {period.status === 'draft' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(period.id)}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune période de paie</h3>
              <p className="text-muted-foreground text-center mb-4">
                Commencez par créer une période de paie pour gérer les rémunérations
              </p>
              <Button onClick={() => router.push('/accountant/payroll/create')}>
                <Plus className="w-4 h-4 mr-2" />
                Créer une période
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
