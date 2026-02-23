'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Users,
  GraduationCap,
  DoorOpen,
  MoreHorizontal,
  Edit,
  Trash2,
  Search,
  Filter,
  TrendingUp,
  BookOpen,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@novaconnect/data';
import {
  useClasses,
  useLevels,
  useAcademicYears,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
  useClass,
} from '@novaconnect/data';
import { ClassForm } from '../settings/components/ClassForm';

export default function ClassesManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile, user } = useAuthContext();
  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    user?.schoolId ||
    (user as any)?.school_id;
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);

  // Filter states
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data
  const { data: classes = [], isLoading: isLoadingClasses } = useClasses(
    schoolId || '',
    selectedAcademicYear || undefined
  );
  const { data: levels = [] } = useLevels(schoolId || '');
  const { data: academicYears = [] } = useAcademicYears(schoolId || '');
  const { data: classDetails, isLoading: isLoadingDetails } = useClass(
    selectedClass?.id || ""
  );

  const createMutation = useCreateClass();
  const updateMutation = useUpdateClass();
  const deleteMutation = useDeleteClass();

  // Filter classes
  const filteredClasses = classes.filter((classItem: any) => {
    const matchesSearch =
      classItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      classItem.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = selectedLevel === 'all' || classItem.levelId === selectedLevel;
    return matchesSearch && matchesLevel;
  });

  // Handle create
  const handleCreate = async (data: any) => {
    try {
      await createMutation.mutateAsync({ ...data, schoolId });
      toast({
        title: 'Classe créée avec succès',
        description: 'La classe a été ajoutée.',
      });
      setCreateDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Erreur lors de la création',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Handle update
  const handleUpdate = async (data: any) => {
    try {
      await updateMutation.mutateAsync({ id: selectedClass.id, ...data });
      toast({
        title: 'Classe mise à jour',
        description: 'Les modifications ont été enregistrées.',
      });
      setEditDialogOpen(false);
      setSelectedClass(null);
    } catch (error: any) {
      toast({
        title: 'Erreur lors de la mise à jour',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedClass) return;
    try {
      await deleteMutation.mutateAsync(selectedClass.id);
      toast({
        title: 'Classe supprimée',
        description: 'La classe a été supprimée avec succès.',
      });
      setDeleteDialogOpen(false);
      setSelectedClass(null);
    } catch (error: any) {
      toast({
        title: 'Erreur lors de la suppression',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Open edit dialog
  const handleEdit = (classItem: any) => {
    setSelectedClass(classItem);
    setEditDialogOpen(true);
  };

  // Open delete dialog
  const handleDeleteClick = (classItem: any) => {
    setSelectedClass(classItem);
    setDeleteDialogOpen(true);
  };

  // View class details
  const handleView = (classItem: any) => {
    setSelectedClass(classItem);
    setViewDialogOpen(true);
  };

  // Get level name
  const getLevelName = (levelId: string) => {
    return levels.find((l: any) => l.id === levelId)?.name || '-';
  };

  // Get academic year name
  const getAcademicYearName = (yearId: string) => {
    return academicYears.find((y: any) => y.id === yearId)?.name || '-';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Classes</h1>
          <p className="text-muted-foreground mt-2">
            Gérez les classes, les élèves et les professeurs
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle Classe
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{classes.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredClasses.length} affichée(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Niveaux</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{levels.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Capacité Totale</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {classes.reduce((sum: number, c: any) => sum + (c.capacity || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Année Scolaire</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {academicYears.find((y: any) => y.is_current)?.name || '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Rechercher</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Nom ou code de classe..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-level">Niveau</Label>
              <SearchableSelect
                options={levels.map((l: any) => ({ value: l.id, label: l.name }))}
                value={selectedLevel}
                onValueChange={setSelectedLevel}
                placeholder="Tous les niveaux"
                searchPlaceholder="Rechercher un niveau..."
                allLabel="Tous les niveaux"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-year">Année Scolaire</Label>
              <SearchableSelect
                options={academicYears.map((y: any) => ({ value: y.id, label: y.name + (y.is_current ? ' (Actuelle)' : '') }))}
                value={selectedAcademicYear}
                onValueChange={setSelectedAcademicYear}
                placeholder="Toutes les années"
                searchPlaceholder="Rechercher une année..."
                allLabel="Toutes les années"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Classes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Classes</CardTitle>
          <CardDescription>
            {filteredClasses.length} classe(s) trouvée(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingClasses ? (
            <div className="text-center py-8">Chargement...</div>
          ) : filteredClasses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune classe trouvée. Créez votre première classe pour commencer.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Année Scolaire</TableHead>
                  <TableHead>Capacité</TableHead>
                  <TableHead>Prof. Principal</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.map((classItem: any) => (
                  <TableRow key={classItem.id}>
                    <TableCell className="font-medium">{classItem.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{classItem.code}</Badge>
                    </TableCell>
                    <TableCell>{getLevelName(classItem.levelId)}</TableCell>
                    <TableCell>{getAcademicYearName(classItem.academicYearId)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {classItem.capacity || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {classItem.homeroomTeacherId ? (
                        <Badge variant="secondary">Assigné</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Non assigné</span>
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
                          <DropdownMenuItem onClick={() => handleView(classItem)}>
                            <Users className="mr-2 h-4 w-4" />
                            Voir détails
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(classItem)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(classItem)}
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
            <DialogTitle>Créer une nouvelle classe</DialogTitle>
            <DialogDescription>
              Ajoutez une nouvelle classe à votre établissement
            </DialogDescription>
          </DialogHeader>
          <ClassForm
            schoolId={schoolId || ""}
            onSubmit={handleCreate}
            isLoading={createMutation.isPending}
            submitLabel="Créer"
            levels={levels}
            academicYears={academicYears}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier la classe</DialogTitle>
            <DialogDescription>
              Modifiez les informations de la classe
            </DialogDescription>
          </DialogHeader>
          <ClassForm
            defaultValues={selectedClass}
            schoolId={schoolId || ""}
            onSubmit={handleUpdate}
            isLoading={updateMutation.isPending}
            submitLabel="Mettre à jour"
            levels={levels}
            academicYears={academicYears}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la classe</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la classe "{selectedClass?.name || "-"}"
              Cette action est irréversible et pourrait affecter les données associées (élèves, notes, etc.).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de la classe</DialogTitle>
            <DialogDescription>
              Informations complètes sur {selectedClass?.name || "-"}
            </DialogDescription>
          </DialogHeader>
          {isLoadingDetails ? (
            <div className="text-center py-8">Chargement des détails...</div>
          ) : classDetails ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Nom</Label>
                  <p className="text-lg font-semibold">{classDetails.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Code</Label>
                  <p className="text-lg font-semibold">{classDetails.code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Niveau</Label>
                  <p className="text-lg">{getLevelName(classDetails.levelId)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Année Scolaire</Label>
                  <p className="text-lg">{getAcademicYearName(classDetails.academicYearId)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Capacité</Label>
                  <p className="text-lg">{classDetails.capacity || 'Non définie'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Salle</Label>
                  <p className="text-lg">{classDetails.roomId || 'Non assignée'}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewDialogOpen(false);
                    handleEdit(selectedClass);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewDialogOpen(false);
                    router.push(`/admin/students?classId=${selectedClass.id}`);
                  }}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Voir les élèves
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun détail disponible
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}





