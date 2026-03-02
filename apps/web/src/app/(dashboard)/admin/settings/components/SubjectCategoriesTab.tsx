'use client';

import { useState } from 'react';
import {
  useSubjectCategories,
  useCreateSubjectCategory,
  useUpdateSubjectCategory,
  useDeleteSubjectCategory,
} from '@novaconnect/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { SubjectCategoryForm } from './SubjectCategoryForm';
import { useToast } from '@/hooks/use-toast';

export function SubjectCategoriesTab({ schoolId }: { schoolId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const { data: categories, isLoading } = useSubjectCategories(schoolId);
  const createMutation = useCreateSubjectCategory();
  const updateMutation = useUpdateSubjectCategory();
  const deleteMutation = useDeleteSubjectCategory();
  const { toast } = useToast();

  const handleSubmit = async (data: any) => {
    try {
      const normalizedCode =
        typeof data.code === 'string' ? data.code.trim().toUpperCase() : data.code;
      const normalized = {
        ...data,
        name: typeof data.name === 'string' ? data.name.trim() : data.name,
        code: normalizedCode,
      };

      if (editingCategory) {
        await updateMutation.mutateAsync({ id: editingCategory.id, ...normalized });
        toast({ title: "Unité d'Enseignement modifiée avec succès" });
      } else {
        await createMutation.mutateAsync({
          ...normalized,
          schoolId,
        });
        toast({ title: "Unité d'Enseignement créée avec succès" });
      }
      setIsDialogOpen(false);
      setEditingCategory(null);
    } catch (error: any) {
      console.error('Subject Category save error:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer l'Unité d'Enseignement.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette Unité d'Enseignement ? Les matières associées perdront ce lien.")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: "Unité d'Enseignement supprimée avec succès" });
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCategory(null);
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
        <CardTitle>Unités d'Enseignement (UE)</CardTitle>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une UE
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Couleur</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories?.map((category: any) => (
              <TableRow key={category.id}>
                <TableCell>{category.name}</TableCell>
                <TableCell>{category.code || '-'}</TableCell>
                <TableCell>{category.description || '-'}</TableCell>
                <TableCell>
                  {category.color ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-sm text-gray-600">{category.color}</span>
                    </div>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(category)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(category.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )) || (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                  Aucune Unité d'Enseignement n'a été créée.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Modifier' : 'Ajouter'} une Unité d'Enseignement</DialogTitle>
            </DialogHeader>
            <SubjectCategoryForm
              defaultValues={editingCategory}
              schoolId={schoolId}
              onSubmit={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
              submitLabel={editingCategory ? 'Mettre à jour' : 'Créer'}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
