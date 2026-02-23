'use client';

import { useState } from 'react';
import { useRooms, useCreateRoom, useUpdateRoom, useDeleteRoom, useCampuses } from '@novaconnect/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { RoomForm } from './RoomForm';
import { useToast } from '@/hooks/use-toast';

export function RoomsTab({ schoolId }: { schoolId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);

  const { data: rooms, isLoading } = useRooms(schoolId);
  const { data: campuses } = useCampuses(schoolId);
  const createMutation = useCreateRoom();
  const updateMutation = useUpdateRoom();
  const deleteMutation = useDeleteRoom();
  const { toast } = useToast();

  const handleSubmit = async (data: any) => {
    try {
      if (editingRoom) {
        await updateMutation.mutateAsync({ id: editingRoom.id, ...data });
        toast({ title: "Salle modifiée avec succès" });
      } else {
        await createMutation.mutateAsync({ ...data, schoolId });
        toast({ title: "Salle créée avec succès" });
      }
      setIsDialogOpen(false);
      setEditingRoom(null);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette salle ")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: "Salle supprimée avec succès" });
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleEdit = (room: any) => {
    setEditingRoom(room);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingRoom(null);
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
        <CardTitle>Salles</CardTitle>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une salle
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Capacité</TableHead>
              <TableHead>Campus</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room: any) => (
              <TableRow key={room.id}>
                <TableCell>{room.name}</TableCell>
                <TableCell>{room.roomType}</TableCell>
                <TableCell>{room.capacity}</TableCell>
                <TableCell>{campuses.find((c: any) => c.id === room.campusId).name || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(room)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(room.id)}>
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
              <DialogTitle>{editingRoom ? 'Modifier' : 'Ajouter'} une salle</DialogTitle>
            </DialogHeader>
            <RoomForm
              defaultValues={editingRoom}
              schoolId={schoolId}
              onSubmit={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
              submitLabel={editingRoom ? 'Mettre ? jour' : 'Cr?er'}
              campuses={campuses || []}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
