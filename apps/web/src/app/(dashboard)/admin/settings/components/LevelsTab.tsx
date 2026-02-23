'use client';

import { useState } from 'react';
import { useLevels, useCreateLevel, useUpdateLevel, useDeleteLevel } from '@novaconnect/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { LevelForm } from './LevelForm';
import { useToast } from '@/hooks/use-toast';

export function LevelsTab({ schoolId }: { schoolId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<any>(null);

  const { data: levels, isLoading } = useLevels(schoolId);
  const createMutation = useCreateLevel();
  const updateMutation = useUpdateLevel();
  const deleteMutation = useDeleteLevel();
  const { toast } = useToast();

  const handleSubmit = async (data: any) => {
    try {
      if (editingLevel) {
        await updateMutation.mutateAsync({ id: editingLevel.id, ...data });
        toast({ title: "Niveau modifié avec succès" });
      } else {
        await createMutation.mutateAsync({ ...data, schoolId });
        toast({ title: "Niveau créé avec succès" });
      }
      setIsDialogOpen(false);
      setEditingLevel(null);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce niveau ")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: "Niveau supprimé avec succès" });
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleEdit = (level: any) => {
    setEditingLevel(level);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingLevel(null);
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
        <CardTitle>Niveaux</CardTitle>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un niveau
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Ordre</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {levels.map((level: any) => (
              <TableRow key={level.id}>
                <TableCell>{level.name}</TableCell>
                <TableCell>{level.code}</TableCell>
                <TableCell>{level.levelType}</TableCell>
                <TableCell>{level.orderIndex}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(level)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(level.id)}>
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
              <DialogTitle>{editingLevel ? 'Modifier' : 'Ajouter'} un niveau</DialogTitle>
            </DialogHeader>
            <LevelForm
              defaultValues={editingLevel}
              schoolId={schoolId}
              onSubmit={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
              submitLabel={editingLevel ? 'Mettre ? jour' : 'Cr?er'}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
