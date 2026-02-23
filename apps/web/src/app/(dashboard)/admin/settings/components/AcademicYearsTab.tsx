'use client';

import { useState } from 'react';
import { useAcademicYears, useCreateAcademicYear, useUpdateAcademicYear, useDeleteAcademicYear } from '@novaconnect/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { AcademicYearForm } from './AcademicYearForm';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export function AcademicYearsTab({ schoolId }: { schoolId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<any>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: years, isLoading } = useAcademicYears(schoolId);
  const createMutation = useCreateAcademicYear();
  const updateMutation = useUpdateAcademicYear();
  const deleteMutation = useDeleteAcademicYear();
  const { toast } = useToast();

  const handleSubmit = async (data: any) => {
    try {
      setFormError(null);
      const normalized = {
        ...data,
        name: typeof data?.name === 'string' ? data.name.trim() : data?.name,
        schoolId,
        isCurrent: !!data?.isCurrent,
      };
      const normalizedName =
        typeof normalized.name === 'string'
          ? normalized.name.replace(/\s+/g, '').replace('/', '-')
          : normalized.name;
      const normalizeDateValue = (value: any) =>
        value instanceof Date ? value.toISOString().split('T')[0] : value;
      const payload = {
        ...normalized,
        name: normalizedName,
        startDate: normalizeDateValue(normalized.startDate),
        endDate: normalizeDateValue(normalized.endDate),
      };
      const startDate = new Date(payload.startDate as any);
      const endDate = new Date(payload.endDate as any);
      if (
        !Number.isNaN(startDate.getTime()) &&
        !Number.isNaN(endDate.getTime()) &&
        endDate <= startDate
      ) {
        const message = 'La date de fin doit ?tre apr?s la date de d?but.';
        setFormError(message);
        toast({
          title: 'Erreur',
          description: message,
          variant: 'destructive',
        });
        return;
      }
      if (editingYear) {
        await updateMutation.mutateAsync({ id: editingYear.id, ...payload });
        toast({ title: "Ann?e scolaire modifi?e avec succ?s" });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: "Ann?e scolaire cr??e avec succ?s" });
      }
      setIsDialogOpen(false);
      setEditingYear(null);
    } catch (error: any) {
      console.error('Academic year save error:', error, {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      const messageParts = [
        error?.message,
        error?.details,
        error?.hint,
        error?.code,
        error?.error?.message,
        error?.error?.details,
      ].filter(Boolean);
      const fallback =
        typeof error === 'string'
          ? error
          : JSON.stringify(error ?? '');
      const message =
        messageParts.length > 0
          ? messageParts.join(' | ')
          : fallback && fallback !== '{}'
            ? fallback
            : "Impossible d'enregistrer l'ann?e scolaire.";
      setFormError(message);
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("?tes-vous s?r de vouloir supprimer cette ann?e scolaire ?")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: "Ann?e scolaire supprim?e avec succ?s" });
      } catch (error: any) {
        toast({
          title: 'Erreur',
          description: error?.message,
          variant: 'destructive',
        });
      }
    }
  };

  const handleEdit = (year: any) => {
    setFormError(null);
    setEditingYear(year);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setFormError(null);
    setEditingYear(null);
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
        <CardTitle>Années scolaires</CardTitle>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une année
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Actuelle</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {years.map((year: any) => (
              <TableRow key={year.id}>
                <TableCell>{year.name}</TableCell>
                <TableCell>{format(new Date(year.startDate), 'dd/MM/yyyy')}</TableCell>
                <TableCell>{format(new Date(year.endDate), 'dd/MM/yyyy')}</TableCell>
                <TableCell>{year.isCurrent ? 'Oui' : 'Non'}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(year)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(year.id)}>
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
              <DialogTitle>{editingYear ? 'Modifier' : 'Ajouter'} une année scolaire</DialogTitle>
            </DialogHeader>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
            <AcademicYearForm
              defaultValues={editingYear}
              schoolId={schoolId}
              onSubmit={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
              submitLabel={editingYear ? 'Mettre à jour' : 'Créer'}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
