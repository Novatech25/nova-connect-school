'use client';

import { useState } from 'react';
import { useClasses, useCreateClass, useUpdateClass, useDeleteClass, useLevels, useAcademicYears } from '@novaconnect/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { ClassForm } from './ClassForm';
import { useToast } from '@/hooks/use-toast';

export function ClassesTab({ schoolId }: { schoolId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);

  const { data: classes, isLoading } = useClasses(schoolId);
  const { data: levels } = useLevels(schoolId);
  const { data: academicYears } = useAcademicYears(schoolId);
  const createMutation = useCreateClass();
  const updateMutation = useUpdateClass();
  const deleteMutation = useDeleteClass();
  const { toast } = useToast();

  const handleSubmit = async (data: any) => {
    try {
      if (editingClass) {
        await updateMutation.mutateAsync({ id: editingClass.id, ...data });
        toast({ title: "Classe modifiée avec succès" });
      } else {
        await createMutation.mutateAsync({ ...data, schoolId });
        toast({ title: "Classe créée avec succès" });
      }
      setIsDialogOpen(false);
      setEditingClass(null);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette classe ")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: "Classe supprimée avec succès" });
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleEdit = (classItem: any) => {
    setEditingClass(classItem);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingClass(null);
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
        <CardTitle>Classes</CardTitle>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une classe
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead>Année scolaire</TableHead>
              <TableHead>Capacité</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((classItem: any) => (
              <TableRow key={classItem.id}>
                <TableCell>{classItem.name}</TableCell>
                <TableCell>{classItem.code}</TableCell>
                <TableCell>{levels.find((l: any) => l.id === classItem.levelId).name || '-'}</TableCell>
                <TableCell>{academicYears.find((y: any) => y.id === classItem.academicYearId).name || '-'}</TableCell>
                <TableCell>{classItem.capacity || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(classItem)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(classItem.id)}>
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
              <DialogTitle>{editingClass ? 'Modifier' : 'Ajouter'} une classe</DialogTitle>
            </DialogHeader>
            <ClassForm
              defaultValues={editingClass}
              schoolId={schoolId}
              onSubmit={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
              submitLabel={editingClass ? 'Mettre à jour' : 'Créer'}
              levels={levels || []}
              academicYears={academicYears || []}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
