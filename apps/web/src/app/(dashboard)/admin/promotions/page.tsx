'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthContext, usePromotionEligibility, useBulkPromote, useLevels, useAcademicYears } from '@novaconnect/data';
import {
  groupBySuggestion,
  calculatePromotionStats,
  filterEligibility,
} from '@novaconnect/data';
import type { PromotionEligibility } from '@novaconnect/core';
import { cn } from '@/lib/utils';

export default function PromotionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();
  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    user?.schoolId ||
    (user as any)?.school_id;

  // State
  const [selectedCurrentYear, setSelectedCurrentYear] = useState<string>('');
  const [selectedNextYear, setSelectedNextYear] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedSuggestion, setSelectedSuggestion] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isPromoting, setIsPromoting] = useState(false);

  // Queries
  const {
    data: eligibility = [],
    isLoading: isLoadingEligibility,
  } = usePromotionEligibility(schoolId || '', selectedCurrentYear);

  const bulkPromoteMutation = useBulkPromote();

  // Fetch levels and academic years
  const { data: levels = [] } = useLevels(schoolId || '');
  const { data: academicYears = [] } = useAcademicYears(schoolId || '');

  // Filter and group data
  const filteredData = filterEligibility(eligibility, {
    status: selectedSuggestion !== 'all' ? [selectedSuggestion] : undefined,
    levelId: selectedLevel !== 'all' ? selectedLevel : undefined,
    searchQuery: searchQuery || undefined,
  });

  const groupedData = groupBySuggestion(filteredData);
  const stats = calculatePromotionStats(eligibility);

  // Handle student selection
  const handleSelectStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleSelectAll = (students: PromotionEligibility[]) => {
    const allIds = new Set(students.map((s) => s.studentId));
    setSelectedStudents(allIds);
  };

  const handleClearSelection = () => {
    setSelectedStudents(new Set());
  };

  // Execute promotion
  const handlePromoteSelected = async () => {
    if (!schoolId || !selectedCurrentYear || !selectedNextYear) {
      toast({
        title: 'Paramètres manquants',
        description: 'Veuillez sélectionner l\'année actuelle et l\'année suivante',
        variant: 'destructive',
      });
      return;
    }

    if (selectedStudents.size === 0) {
      toast({
        title: 'Aucun élève sélectionné',
        description: 'Sélectionnez au moins un élève à promouvoir',
        variant: 'destructive',
      });
      return;
    }

    setIsPromoting(true);

    try {
      // Build promotions array
      const promotions = Array.from(selectedStudents).map((studentId) => {
        const student = eligibility.find((s) => s.studentId === studentId);
        return {
          studentId,
          targetClassId: student?.nextLevelId || student?.currentClassId,
          isRepeating: !student?.isEligibleForPromotion,
        };
      });

      // Execute bulk promotion
      const result = await bulkPromoteMutation.mutateAsync({
        schoolId,
        currentYearId: selectedCurrentYear,
        nextYearId: selectedNextYear,
        promotions,
      });

      // Show results
      toast({
        title: 'Promotion terminée',
        description: `${result.successful} élèves promouvés, ${result.failed} échecs`,
        variant: result.failed === 0 ? 'default' : 'destructive',
      });

      // Clear selection and refetch
      setSelectedStudents(new Set());
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    } catch (error: any) {
      toast({
        title: 'Erreur lors de la promotion',
        description: error.message || 'Une erreur est survenue',
        variant: 'destructive',
      });
    } finally {
      setIsPromoting(false);
    }
  };

  // Get classes for next year (TODO: implement query)
  // For now, we'll use a placeholder

  if (!schoolId) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
          <Card className="border-red-200 bg-red-50/60">
            <CardHeader>
              <CardTitle className="text-red-900">Erreur: École non identifiée</CardTitle>
              <CardDescription className="text-red-700">
                Impossible de charger les promotions. L'identifiant de l'école n'est pas disponible.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Promotions des Élèves</h1>
              <p className="text-sm text-gray-600">
                Gérez le passage des élèves à la classe supérieure
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.back()}
            >
              Retour
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Élèves
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600">
                À Promouvoir
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.eligible}</div>
              <Progress value={stats.promotionRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-600">
                À Considérer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {groupedData.borderline.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">
                En Difficulté
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.notEligible}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                En Attente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuration de la Promotion</CardTitle>
            <CardDescription>
              Sélectionnez les années académiques et filtrez les élèves
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {/* Current Year */}
              <div className="space-y-2">
                <label htmlFor="currentYear" className="text-sm font-medium">Année Actuelle</label>
                <SearchableSelect
                  options={academicYears.map((y: any) => ({ value: y.id, label: y.name }))}
                  value={selectedCurrentYear}
                  onValueChange={setSelectedCurrentYear}
                  placeholder="Sélectionner"
                  searchPlaceholder="Rechercher une année..."
                />
              </div>

              {/* Next Year */}
              <div className="space-y-2">
                <label htmlFor="nextYear" className="text-sm font-medium">Année Suivante</label>
                <SearchableSelect
                  options={academicYears.map((y: any) => ({ value: y.id, label: y.name }))}
                  value={selectedNextYear}
                  onValueChange={setSelectedNextYear}
                  placeholder="Sélectionner"
                  searchPlaceholder="Rechercher une année..."
                />
              </div>

              {/* Level Filter */}
              <div className="space-y-2">
                <label htmlFor="level" className="text-sm font-medium">Niveau</label>
                <SearchableSelect
                  options={levels.map((l: any) => ({ value: l.id, label: l.name }))}
                  value={selectedLevel}
                  onValueChange={setSelectedLevel}
                  placeholder="Tous les niveaux"
                  searchPlaceholder="Rechercher un niveau..."
                  allLabel="Tous les niveaux"
                />
              </div>

              {/* Suggestion Filter */}
              <div className="space-y-2">
                <label htmlFor="suggestion" className="text-sm font-medium">Statut</label>
                <SearchableSelect
                  options={[
                    { value: 'eligible', label: 'À promouvoir' },
                    { value: 'borderline', label: 'À considérer' },
                    { value: 'failing', label: 'En difficulté' },
                    { value: 'pending', label: 'En attente' },
                  ]}
                  value={selectedSuggestion}
                  onValueChange={setSelectedSuggestion}
                  placeholder="Tous les statuts"
                  searchPlaceholder="Rechercher un statut..."
                  allLabel="Tous les statuts"
                />
              </div>

              {/* Search */}
              <div className="space-y-2">
                <label htmlFor="search" className="text-sm font-medium">Rechercher</label>
                <Input
                  id="search"
                  placeholder="Nom, prénom, matricule..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Élèves à Promouvoir</CardTitle>
                <CardDescription>
                  {selectedStudents.size} élève(s) sélectionné(s)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelection}
                  disabled={selectedStudents.size === 0}
                >
                  Effacer la sélection
                </Button>
                <Button
                  size="sm"
                  onClick={handlePromoteSelected}
                  disabled={selectedStudents.size === 0 || isPromoting}
                >
                  {isPromoting ? 'Promotion...' : `Promouvoir (${selectedStudents.size})`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEligibility ? (
              <div className="flex justify-center py-8">
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                </div>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun élève trouvé avec les filtres actuels
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedStudents.size === filteredData.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleSelectAll(filteredData);
                          } else {
                            handleClearSelection();
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Classe Actuelle</TableHead>
                    <TableHead>Moyenne</TableHead>
                    <TableHead>Rang</TableHead>
                    <TableHead>Suggestion</TableHead>
                    <TableHead>Année Suivante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((student) => (
                    <TableRow
                      key={student.studentId}
                      className={cn(
                        'cursor-pointer hover:bg-muted/30',
                        selectedStudents.has(student.studentId) && 'bg-primary/5'
                      )}
                      onClick={() => handleSelectStudent(student.studentId)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedStudents.has(student.studentId)}
                          onCheckedChange={() => handleSelectStudent(student.studentId)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {student.studentFirstName} {student.studentLastName}
                          </div>
                          {student.studentMatricule && (
                            <div className="text-sm text-muted-foreground">
                              {student.studentMatricule}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{student.currentClassName}</div>
                          <div className="text-sm text-muted-foreground">
                            {student.currentLevelName}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.finalAverage !== null ? (
                          <Badge
                            variant={student.finalAverage >= student.passingScore ? 'default' : 'destructive'}
                          >
                            {student.finalAverage.toFixed(2)}/20
                          </Badge>
                        ) : (
                          <Badge variant="outline">N/A</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.rankInClass !== null ? (
                          <span className="text-sm">#{student.rankInClass}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            student.isEligibleForPromotion
                              ? 'default'
                              : student.finalAverage === null
                                ? 'outline'
                                : 'destructive'
                          }
                        >
                          {student.suggestion}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {student.nextLevelName ? (
                          <div className="flex items-center gap-1 text-sm">
                            <span>{student.currentLevelName}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{student.nextLevelName}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Études terminées
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
