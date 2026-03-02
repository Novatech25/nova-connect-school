'use client';

import { useState } from 'react';
import {
  useSubjects,
  useCreateSubject,
  useUpdateSubject,
  useDeleteSubject,
  useLevels,
  useSubjectCategories,
} from '@novaconnect/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { SubjectForm } from './SubjectForm';
import { useToast } from '@/hooks/use-toast';

export function SubjectsTab({ schoolId }: { schoolId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);

  const { data: subjects = [], isLoading } = useSubjects(schoolId);
  const { data: levels = [] } = useLevels(schoolId);
  const { data: rawCategories } = useSubjectCategories(schoolId);
  const categories = Array.isArray(rawCategories) ? rawCategories : [];
  const createMutation = useCreateSubject();
  const updateMutation = useUpdateSubject();
  const deleteMutation = useDeleteSubject();
  const { toast } = useToast();

  const handleSubmit = async (data: any) => {
    try {
      const normalizedCode =
        typeof data.code === 'string' ? data.code.trim().toUpperCase() : data.code;
      const normalized = {
        ...data,
        name: typeof data.name === 'string' ? data.name.trim() : data.name,
        code: normalizedCode,
        levelId: data.levelId || null,
        categoryId: data.categoryId || null,
        coefficient: data.coefficient || 1,
      };

      if (normalizedCode) {
        const duplicate = (subjects || []).some((subject: any) => {
          const existingCode =
            typeof subject.code === 'string' ? subject.code.trim().toUpperCase() : subject.code;
          const isSame = existingCode === normalizedCode;
          if (!isSame) return false;
          if (editingSubject && subject.id === editingSubject.id) return false;
          return true;
        });
        if (duplicate) {
          toast({
            title: "Code d??j?? utilis??",
            description: "Une autre mati??re utilise d??j?? ce code. Choisissez un code unique.",
            variant: "destructive",
          });
          return;
        }
      }

      if (editingSubject) {
        await updateMutation.mutateAsync({ id: editingSubject.id, ...normalized });
        toast({ title: "Mati??re modifi??e avec succ??s" });
      } else {
        await createMutation.mutateAsync({
          ...normalized,
          schoolId,
          isActive: true,
        });
        toast({ title: "Mati??re cr????e avec succ??s" });
      }
      setIsDialogOpen(false);
      setEditingSubject(null);
    } catch (error: any) {
      console.error('Subject save error:', error);
      const rawMessage =
        error?.message ||
        error?.error?.message ||
        error?.details ||
        error?.hint ||
        "Impossible d'enregistrer la mati??re.";
      const message =
        typeof rawMessage === 'string' &&
        (rawMessage.includes('subjects_code_school_unique') ||
          rawMessage.toLowerCase().includes('duplicate key'))
          ? "Ce code de mati??re existe d??j?? pour cette ??cole."
          : rawMessage;
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette matière ")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: "Matière supprimée avec succès" });
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleEdit = (subject: any) => {
    setEditingSubject(subject);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingSubject(null);
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
        <CardTitle>Matières</CardTitle>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une matière
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead>Unité d'Ens.</TableHead>
              <TableHead>Crédits/Coef.</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Couleur</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.map((subject: any) => (
              <TableRow key={subject.id}>
                <TableCell>{subject.name}</TableCell>
                <TableCell>{subject.code}</TableCell>
                <TableCell>
                  {subject.level?.name ||
                    levels.find((level: any) => level.id === subject.levelId)?.name ||
                    'Tous'}
                </TableCell>
                <TableCell>
                  {subject.category?.name ||
                    categories.find((cat: any) => cat.id === subject.categoryId)?.name ||
                    '-'}
                </TableCell>
                <TableCell>{subject.coefficient ?? 1}</TableCell>
                <TableCell>{subject.description || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: subject.color }}
                    />
                    <span className="text-sm text-gray-600">{subject.color}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(subject)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(subject.id)}>
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
              <DialogTitle>{editingSubject ? 'Modifier' : 'Ajouter'} une matière</DialogTitle>
            </DialogHeader>
            <SubjectForm
              defaultValues={editingSubject}
              schoolId={schoolId}
              levels={levels}
              categories={categories}
              onSubmit={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
              submitLabel={editingSubject ? 'Mettre à jour' : 'Créer'}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
