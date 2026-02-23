'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, UserSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campusQueries } from '@novaconnect/data';
import { getSupabaseClient } from '@novaconnect/data/client';

export default function CampusAccessPage() {
  const router = useRouter();
  const params = useParams();
  const campusId = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    accessType: 'full_access',
  });

  // Fetch campus details
  const { data: campus } = useQuery(campusQueries.getById(campusId));

  // Fetch users with access
  const { data: accessList = [], isLoading } = useQuery({
    queryKey: ['campus_access', campusId, roleFilter],
    queryFn: async () => {
      let query = supabase
        .from('user_campus_access')
        .select(`
          *,
          user:users(id, first_name, last_name, email, role)
        `)
        .eq('campus_id', campusId)
        .eq('can_access', true);

      if (roleFilter !== 'all') {
        query = query.eq('user.role', roleFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Assign access mutation
  const assignMutation = useMutation({
    mutationFn: async (data: any) => {
      const supabase = getSupabaseClient();
      // Get campus info to get school_id
      const { data: campusData } = await supabase
        .from('campuses')
        .select('school_id')
        .eq('id', campusId)
        .single();

      if (!campusData) throw new Error('Campus not found');

      const payload = {
        school_id: campusData.school_id,
        user_id: data.userId,
        campus_id: campusId,
        access_type: data.accessType,
        can_access: true,
      };

      const { data: result, error } = await supabase
        .from('user_campus_access')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus_access', campusId] });
      toast({
        title: 'Accès accordé',
        description: 'L\'utilisateur a désormais accès à ce campus.',
      });
      setAddDialogOpen(false);
      setFormData({ userId: '', accessType: 'full_access' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Revoke access mutation
  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('user_campus_access')
        .delete()
        .eq('user_id', userId)
        .eq('campus_id', campusId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campus_access', campusId] });
      toast({
        title: 'Accès révoqué',
        description: 'L\'utilisateur n\'a plus accès à ce campus.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleAssign = async () => {
    if (!formData.userId) {
      toast({
        title: 'Utilisateur requis',
        description: 'Sélectionnez un utilisateur.',
        variant: 'destructive',
      });
      return;
    }
    await assignMutation.mutateAsync(formData);
  };

  const handleRevoke = async (userId: string) => {
    if (confirm('Êtes-vous sûr de vouloir révoquer l\'accès de cet utilisateur ?')) {
      await revokeMutation.mutateAsync(userId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Gestion des Accès</h1>
            <p className="text-muted-foreground mt-1">
              {campus?.name} - {accessList.length} utilisateur(s) avec accès
            </p>
          </div>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un utilisateur
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label htmlFor="role-filter">Filtrer par rôle:</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger id="role-filter" className="w-[200px]">
                <SelectValue placeholder="Tous les rôles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="teacher">Professeurs</SelectItem>
                <SelectItem value="student">Étudiants</SelectItem>
                <SelectItem value="parent">Parents</SelectItem>
                <SelectItem value="supervisor">Surveillants</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Access List */}
      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs avec accès</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : accessList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun utilisateur n'a accès à ce campus
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Type d'accès</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accessList.map((access: any) => (
                  <TableRow key={access.id}>
                    <TableCell className="font-medium">
                      {access.user?.first_name} {access.user?.last_name}
                    </TableCell>
                    <TableCell>{access.user?.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{access.user?.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          access.access_type === 'full_access'
                            ? 'default'
                            : access.access_type === 'restricted'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {access.access_type === 'full_access' && 'Accès complet'}
                        {access.access_type === 'restricted' && 'Restreint'}
                        {access.access_type === 'read_only' && 'Lecture seule'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(access.user_id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un utilisateur</DialogTitle>
            <DialogDescription>
              Donnez accès à ce campus à un utilisateur
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <UserSearchForm
              onSelect={(userId) => setFormData({ ...formData, userId })}
            />
            <div className="space-y-2">
              <Label htmlFor="access-type">Type d'accès</Label>
              <Select
                value={formData.accessType}
                onValueChange={(value) =>
                  setFormData({ ...formData, accessType: value })
                }
              >
                <SelectTrigger id="access-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_access">Accès complet</SelectItem>
                  <SelectItem value="restricted">Restreint</SelectItem>
                  <SelectItem value="read_only">Lecture seule</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAssign}
              disabled={assignMutation.isPending || !formData.userId}
            >
              {assignMutation.isPending ? 'Ajout...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// User Search Component
function UserSearchForm({
  onSelect,
}: {
  onSelect: (userId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const searchUsers = async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);

      if (!error && data) {
        setResults(data);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Rechercher un utilisateur</Label>
      <div className="relative">
        <UserSearch className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Nom ou email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            searchUsers(e.target.value);
          }}
          className="pl-9"
        />
      </div>
      {results.length > 0 && (
        <div className="border rounded-md max-h-60 overflow-y-auto">
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                onSelect(user.id);
                setSearch(`${user.first_name} ${user.last_name}`);
                setResults([]);
              }}
              className="w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b last:border-b-0"
            >
              <p className="font-medium">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </button>
          ))}
        </div>
      )}
      {searching && <p className="text-sm text-muted-foreground">Recherche...</p>}
    </div>
  );
}
