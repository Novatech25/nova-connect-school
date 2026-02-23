'use client';

import { useState } from 'react';
import { usePeriods, useCreatePeriod, useUpdatePeriod, useDeletePeriod, useAcademicYears } from '@novaconnect/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { PeriodForm } from './PeriodForm';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export function PeriodsTab({ schoolId }: { schoolId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<any>(null);

  // Get periods for all academic years or first year if none selected
  const { data: academicYears } = useAcademicYears(schoolId);
  const currentYearId = academicYears?.find((y: any) => y.isCurrent)?.id || academicYears?.[0]?.id;
  const { data: periods, isLoading } = usePeriods(schoolId, currentYearId || '');
  const createMutation = useCreatePeriod();
  const updateMutation = useUpdatePeriod();
  const deleteMutation = useDeletePeriod();
  const { toast } = useToast();

  const handleSubmit = async (data: any) => {
    try {
      if (editingPeriod) {
        await updateMutation.mutateAsync({ id: editingPeriod.id, ...data });
        toast({ title: "Période modifiée avec succès" });
      } else {
        await createMutation.mutateAsync({ ...data, schoolId });
        toast({ title: "Période créée avec succès" });
      }
      setIsDialogOpen(false);
      setEditingPeriod(null);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette période ")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: "Période supprimée avec succès" });
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleEdit = (period: any) => {
    setEditingPeriod(period);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingPeriod(null);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Périodes</CardTitle>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une période
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Année scolaire</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.map((period: any) => (
              <TableRow key={period.id}>
                <TableCell>{period.name}</TableCell>
                <TableCell>{period.periodType}</TableCell>
                <TableCell>{academicYears.find((y: any) => y.id === period.academicYearId).name || '-'}</TableCell>
                <TableCell>{format(new Date(period.startDate), 'dd/MM/yyyy')}</TableCell>
                <TableCell>{format(new Date(period.endDate), 'dd/MM/yyyy')}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(period)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(period.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPeriod ? 'Modifier' : 'Ajouter'} une période</DialogTitle>
            </DialogHeader>
            <PeriodForm
              defaultValues={editingPeriod}
              schoolId={schoolId}
              onSubmit={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
              submitLabel={editingPeriod ? 'Mettre ? jour' : 'Cr?er'}
              academicYears={academicYears || []}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
