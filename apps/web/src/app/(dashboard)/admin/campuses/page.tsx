'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MapPin, MoreHorizontal, Edit, Trash2, Users, Building, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext, campusQueries, usePremiumCheck } from '@novaconnect/data';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@novaconnect/data/client';

export default function CampusesManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile, user } = useAuthContext();
  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    user?.schoolId ||
    (user as any)?.school_id;
  const queryClient = useQueryClient();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    latitude: '',
    longitude: '',
    radiusMeters: '200',
    isMain: false,
  });

  // Check if multi-campus module is enabled
  const { data: premiumCheck, isLoading: checkingPremium } = usePremiumCheck(schoolId, 'multi_campus');

  // Fetch campuses
  const { data: campuses = [], isLoading } = useQuery(
    campusQueries.getBySchool(schoolId || '')
  );

  // Create campus mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        school_id: schoolId,
        name: data.name,
        code: data.code,
        address: data.address || null,
        city: data.city || null,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        radius_meters: parseInt(data.radiusMeters) || 200,
        is_main: data.isMain,
      };

      const { data: result, error } = await supabase
        .from('campuses')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campuses', schoolId] });
      toast({
        title: 'Campus créé avec succès',
        description: 'Le campus a été ajouté.',
      });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur lors de la création',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update campus mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const payload = {
        name: data.name,
        code: data.code,
        address: data.address || null,
        city: data.city || null,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        radius_meters: parseInt(data.radiusMeters) || 200,
        is_main: data.isMain,
      };

      const { data: result, error } = await supabase
        .from('campuses')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campuses', schoolId] });
      toast({
        title: 'Campus mis à jour',
        description: 'Les modifications ont été enregistrées.',
      });
      setEditDialogOpen(false);
      setSelectedCampus(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur lors de la mise à jour',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete campus mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campuses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campuses', schoolId] });
      toast({
        title: 'Campus supprimé',
        description: 'Le campus a été supprimé avec succès.',
      });
      setDeleteDialogOpen(false);
      setSelectedCampus(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur lors de la suppression',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      latitude: '',
      longitude: '',
      radiusMeters: '200',
      isMain: false,
    });
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.code) {
      toast({
        title: 'Champs obligatoires',
        description: 'Le nom et le code sont requis.',
        variant: 'destructive',
      });
      return;
    }
    await createMutation.mutateAsync(formData);
  };

  const handleEdit = (campus: any) => {
    setSelectedCampus(campus);
    setFormData({
      name: campus.name,
      code: campus.code,
      address: campus.address || '',
      city: campus.city || '',
      latitude: campus.latitude?.toString() || '',
      longitude: campus.longitude?.toString() || '',
      radiusMeters: campus.radius_meters?.toString() || '200',
      isMain: campus.is_main || false,
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedCampus) return;
    await updateMutation.mutateAsync({ id: selectedCampus.id, ...formData });
  };

  const handleDelete = (campus: any) => {
    setSelectedCampus(campus);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedCampus) return;
    await deleteMutation.mutateAsync(selectedCampus.id);
  };

  // Show upgrade prompt if multi-campus not enabled
  if (!checkingPremium && !premiumCheck?.hasAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Campus</h1>
          <p className="text-muted-foreground mt-2">
            Gérez les différents campus de votre établissement
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Module Premium Requis</CardTitle>
            <CardDescription>
              La fonctionnalité multi-campus nécessite une licence Premium ou Enterprise.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
              <Building className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium">Multi-Campus</p>
                <p className="text-sm text-muted-foreground">
                  Gérez plusieurs sites géographiques avec contrôle d'accès et validation GPS
                </p>
              </div>
            </div>
            <Button className="mt-4" onClick={() => router.push('/settings')}>
              Voir les plans tarifaires
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Campus</h1>
          <p className="text-muted-foreground mt-2">
            Gérez les différents campus de votre établissement
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau Campus
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des Campus</CardTitle>
          <CardDescription>
            {campuses.length} campus configuré(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : campuses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun campus configuré. Créez votre premier campus pour commencer.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>GPS</TableHead>
                  <TableHead>Rayon</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campuses.map((campus: any) => (
                  <TableRow key={campus.id}>
                    <TableCell className="font-medium">{campus.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{campus.code}</Badge>
                    </TableCell>
                    <TableCell>{campus.address || '-'}</TableCell>
                    <TableCell>{campus.city || '-'}</TableCell>
                    <TableCell>
                      {campus.latitude && campus.longitude ? (
                        <div className="flex items-center gap-1 text-xs">
                          <MapPin className="h-3 w-3" />
                          {campus.latitude.toFixed(4)}, {campus.longitude.toFixed(4)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Non configuré</span>
                      )}
                    </TableCell>
                    <TableCell>{campus.radius_meters || 200}m</TableCell>
                    <TableCell>
                      {campus.is_main ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/admin/campuses/${campus.id}`)}>
                            <Users className="mr-2 h-4 w-4" />
                            Voir détails
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(campus)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(campus)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Créer un nouveau campus</DialogTitle>
            <DialogDescription>
              Ajoutez un nouveau campus à votre établissement
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Campus Principal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="MAIN"
                  maxLength={20}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Rue de l'Université"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ville</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Paris"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="48.8566"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="2.3522"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="radius">Rayon (m)</Label>
                <Input
                  id="radius"
                  type="number"
                  value={formData.radiusMeters}
                  onChange={(e) => setFormData({ ...formData, radiusMeters: e.target.value })}
                  placeholder="200"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isMain"
                checked={formData.isMain}
                onCheckedChange={(checked) => setFormData({ ...formData, isMain: checked })}
              />
              <Label htmlFor="isMain">Campus principal</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier le campus</DialogTitle>
            <DialogDescription>
              Modifiez les informations du campus
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-code">Code *</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  maxLength={20}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Adresse</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-city">Ville</Label>
              <Input
                id="edit-city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-latitude">Latitude</Label>
                <Input
                  id="edit-latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-longitude">Longitude</Label>
                <Input
                  id="edit-longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-radius">Rayon (m)</Label>
                <Input
                  id="edit-radius"
                  type="number"
                  value={formData.radiusMeters}
                  onChange={(e) => setFormData({ ...formData, radiusMeters: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-isMain"
                checked={formData.isMain}
                onCheckedChange={(checked) => setFormData({ ...formData, isMain: checked })}
              />
              <Label htmlFor="edit-isMain">Campus principal</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Mise à jour...' : 'Mettre à jour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le campus</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer le campus "{selectedCampus?.name}" ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}





