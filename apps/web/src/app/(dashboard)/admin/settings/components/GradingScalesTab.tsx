'use client';

import { useState } from 'react';
import {
  useGradingSystems,
  useCreateGradingSystem,
  useUpdateGradingSystem,
  useDeleteGradingSystem,
  useQuickSetupPrimary,
  useQuickSetupSecondary,
  useQuickSetupUniversity,
  useQuickSetupVocational,
  useLevels,
} from '@novaconnect/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Loader2, GraduationCap, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GradingSystemForm } from './GradingSystemForm';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function GradingScalesTab({ schoolId }: { schoolId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<any>(null);

  const { data: systems, isLoading } = useGradingSystems(schoolId);
  const { data: levels = [] } = useLevels(schoolId);

  const createMutation = useCreateGradingSystem();
  const updateMutation = useUpdateGradingSystem();
  const deleteMutation = useDeleteGradingSystem();

  // Quick setup mutations
  const quickSetupPrimary = useQuickSetupPrimary();
  const quickSetupSecondary = useQuickSetupSecondary();
  const quickSetupUniversity = useQuickSetupUniversity();
  const quickSetupVocational = useQuickSetupVocational();

  const { toast } = useToast();

  const handleSubmit = async (data: any) => {
    try {
      if (editingSystem) {
        await updateMutation.mutateAsync({ id: editingSystem.id, ...data });
        toast({ title: "Système modifié avec succès" });
      } else {
        await createMutation.mutateAsync({ ...data, schoolId });
        toast({ title: "Système créé avec succès" });
      }
      setIsDialogOpen(false);
      setEditingSystem(null);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce système de notation ")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast({ title: "Système supprimé avec succès" });
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleEdit = (system: any) => {
    setEditingSystem(system);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingSystem(null);
    setIsDialogOpen(true);
  };

  // Get level name
  const getLevelName = (levelId: string) => {
    return levels.find((l: any) => l.id === levelId).name || 'Tous les niveaux';
  };

  // Get system type label
  const getSystemTypeLabel = (systemType: string) => {
    const labels: Record<string, string> = {
      'points_0_10': 'Points (0-10)',
      'points_0_20': 'Points (0-20)',
      'credits_ects': 'Crédits ECTS',
      'grade_points': 'Grade Points (GPA)',
      'credits_skills': 'Compétences',
      'pass_fail': 'Réussite/Échec',
    };
    return labels[systemType] || systemType;
  };

  // Quick setup handlers
  const handleQuickSetup = async (type: 'primary' | 'secondary' | 'university' | 'vocational', levelId: string) => {
    if (!levelId && type !== 'primary' && type !== 'secondary') {
      toast({
        title: "Niveau requis",
        description: `Pour une configuration ${type === 'university' ? 'universitaire' : 'professionnelle'}, veuillez d'abord créer un niveau universitaire.`,
        variant: "destructive"
      });
      return;
    }

    try {
      const mutations = {
        primary: quickSetupPrimary,
        secondary: quickSetupSecondary,
        university: quickSetupUniversity,
        vocational: quickSetupVocational,
      };

      const data = {
        schoolId,
        levelId: levelId || '',
      };

      if (type === 'university') {
        await mutations.university.mutateAsync({
          ...data,
          totalCredits: 60,
          passingGpa: 2.0,
        });
      } else if (type === 'vocational') {
        await mutations.vocational.mutateAsync({
          ...data,
          totalCredits: 120,
        });
      } else {
        await mutations[type].mutateAsync(data);
      }

      toast({
        title: "Configuration rapide terminée",
        description: `Le système ${type} a été configuré avec succès.`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
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
    <div className="space-y-6">
      {/* Quick Setup Section */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration Rapide par Niveau
          </CardTitle>
          <CardDescription>
            Configurez rapidement un système de notation pour chaque niveau de votre établissement
          </CardDescription>
        </CardHeader>
        <CardContent>
          {levels.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              Aucun niveau configuré. Allez dans l'onglet "Niveaux" pour créer des niveaux d'abord.
            </div>
          ) : (
            <div className="space-y-3">
              {levels.filter((l: any) => l.levelType !== 'university').map((level: any) => (
                <div
                  key={level.id}
                  className="flex items-center justify-between rounded-lg border p-3 bg-background hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">{level.name}</div>
                      <div className="text-xs text-muted-foreground">{level.levelType}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickSetup('primary', level.id)}
                    >
                      Primaire (0-10)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickSetup('secondary', level.id)}
                    >
                      Secondaire (0-20)
                    </Button>
                  </div>
                </div>
              ))}
              {levels.filter((l: any) => l.levelType === 'university').map((level: any) => (
                <div
                  key={level.id}
                  className="flex items-center justify-between rounded-lg border p-3 bg-background hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-purple-600" />
                    <div>
                      <div className="font-medium">{level.name}</div>
                      <div className="text-xs text-muted-foreground">Université</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickSetup('university', level.id)}
                    >
                      Université (ECTS)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickSetup('vocational', level.id)}
                    >
                      Formation Pro
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Systems Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Systèmes de Notation Configurés</CardTitle>
            <CardDescription>
              Gérez tous les systèmes de notation de votre établissement
            </CardDescription>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau système
          </Button>
        </CardHeader>
        <CardContent>
          {systems && systems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Note Max</TableHead>
                  <TableHead>Note de Passage</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systems.map((system: any) => (
                  <TableRow key={system.id}>
                    <TableCell className="font-medium">
                      {system.name}
                      {system.isDefault && (
                        <Badge variant="secondary" className="ml-2">Défaut</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getSystemTypeLabel(system.system_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{system.max_score}</TableCell>
                    <TableCell>
                      <span className="font-medium">{system.min_passing_score}</span>
                      {system.passing_grade && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({system.passing_grade})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {system.level ? (
                        <div>
                          <div>{getLevelName(system.level_id)}</div>
                          {!system.is_level_specific && (
                            <div className="text-xs text-muted-foreground">
                              Tous les niveaux
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Tous les niveaux</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={system.is_active ? 'default' : 'secondary'}
                      >
                        {system.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(system)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm('Désactiver ce système ')) {
                                // Add toggle functionality
                              }
                            }}
                          >
                            {system.is_active ? 'Désactiver' : 'Activer'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(system.id)}
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
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun système de notation configuré. Utilisez la configuration rapide ci-dessus ou créez un nouveau système.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for Create/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSystem ? 'Modifier' : 'Créer'} un système de notation
            </DialogTitle>
          </DialogHeader>
          <GradingSystemForm
            defaultValues={editingSystem}
            onSubmit={handleSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
            submitLabel={editingSystem ? 'Mettre à jour' : 'Créer'}
            schoolId={schoolId}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
