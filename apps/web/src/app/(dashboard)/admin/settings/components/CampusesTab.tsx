'use client';

import { useState } from 'react';
import { useCampuses, useCreateCampus, useUpdateCampus, useDeleteCampus } from '@novaconnect/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Loader2, MapPin } from 'lucide-react';
import { CampusForm } from './CampusForm';
import { useToast } from '@/hooks/use-toast';

export function CampusesTab({ schoolId }: { schoolId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCampus, setEditingCampus] = useState<any>(null);

  const { data: campuses, isLoading } = useCampuses(schoolId);
  const createMutation = useCreateCampus();
  const updateMutation = useUpdateCampus();
  const deleteMutation = useDeleteCampus();
  const { toast } = useToast();

  const handleSubmit = async (data: any) => {
    try {
      if (editingCampus) {
        await updateMutation.mutateAsync({ id: editingCampus.id, ...data });
        toast({ title: "Campus modifié avec succès" });
      } else {
        await createMutation.mutateAsync({ ...data, schoolId });
        toast({ title: "Campus créé avec succès" });
      }
      setIsDialogOpen(false);
      setEditingCampus(null);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce campus ")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: "Campus supprimé avec succès" });
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleEdit = (campus: any) => {
    setEditingCampus(campus);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCampus(null);
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
        <CardTitle>Campus</CardTitle>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un campus
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campuses.map((campus: any) => (
              <TableRow key={campus.id}>
                <TableCell>{campus.name}</TableCell>
                <TableCell>{campus.address}</TableCell>
                <TableCell>{campus.city}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(campus)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(campus.id)}>
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
              <DialogTitle>{editingCampus ? 'Modifier' : 'Ajouter'} un campus</DialogTitle>
            </DialogHeader>
            <CampusForm
              defaultValues={editingCampus}
              schoolId={schoolId}
              onSubmit={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
              submitLabel={editingCampus ? 'Mettre à jour' : 'Créer'}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
