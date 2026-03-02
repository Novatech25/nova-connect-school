'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  TrendingUp,
  Download,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
import { useAuthContext, usePromotionEligibility, useBulkPromote, useLevels, useAcademicYears, useClasses, useSchool, usePeriods } from '@novaconnect/data';
import {
  groupBySuggestion,
  calculatePromotionStats,
  filterEligibility,
  promotionQueries
} from '@novaconnect/data';
import type { PromotionEligibility } from '@novaconnect/core';
import { cn } from '@/lib/utils';
import { generatePassListPdf } from '@/lib/pdf/passListPdf';
import { generateMeritListPdf } from '@/lib/pdf/meritListPdf';

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
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedSuggestion, setSelectedSuggestion] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isPromoting, setIsPromoting] = useState(false);
  const [isExportingMeritList, setIsExportingMeritList] = useState(false);
  
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [targetLevelsForPromotion, setTargetLevelsForPromotion] = useState<{id: string; name: string}[]>([]);
  const [tuitionAmounts, setTuitionAmounts] = useState<Record<string, number>>({});

  // Queries
  const { school } = useSchool(schoolId || '');

  const {
    data: eligibility = [],
    isLoading: isLoadingEligibility,
  } = usePromotionEligibility(schoolId || '', selectedCurrentYear);

  const bulkPromoteMutation = useBulkPromote();

  // Fetch levels and academic years
  const { data: levels = [] } = useLevels(schoolId || '');
  const { data: classes = [] } = useClasses(schoolId || '');
  const { data: academicYears = [] } = useAcademicYears(schoolId || '');
  const { data: periods = [] } = usePeriods(schoolId || '', selectedCurrentYear);

  // Set default years when available
  useEffect(() => {
    if (academicYears.length > 0 && !selectedCurrentYear) {
      const currentYear = academicYears.find((y: any) => y.is_current) || academicYears[0];
      if (currentYear) {
        setSelectedCurrentYear(currentYear.id);
        
        // Find next logical year
        const nextYears = academicYears
          .filter((y: any) => new Date(y.start_date) > new Date(currentYear.start_date))
          .sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
          
        if (nextYears.length > 0 && !selectedNextYear) {
          setSelectedNextYear(nextYears[0].id);
        }
      }
    }
  }, [academicYears, selectedCurrentYear, selectedNextYear]);

  // Also reset period when year changes
  useEffect(() => {
    setSelectedPeriod('all');
  }, [selectedCurrentYear]);

  // Reset class selection when level changes
  useEffect(() => {
    if (selectedLevel !== 'all') {
      setSelectedClass('all');
    }
  }, [selectedLevel]);

  // Compute filtered classes based on selected level
  const filteredClasses = classes.filter((c: any) => 
    selectedLevel === 'all' || c.levelId === selectedLevel
  );

  // Filter and group data
  const filteredData = filterEligibility(eligibility, {
    status: selectedSuggestion !== 'all' ? [selectedSuggestion] : undefined,
    levelId: selectedLevel !== 'all' ? selectedLevel : undefined,
    classId: selectedClass !== 'all' ? selectedClass : undefined,
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

  // Open configuration modal
  const handleOpenConfig = () => {
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

    const targetLevels = Array.from(selectedStudents).reduce((acc, studentId) => {
      const student = eligibility.find((s) => s.studentId === studentId);
      if (student) {
        const targetLevelId = student.nextLevelId || student.currentLevelId;
        const targetLevelName = student.nextLevelName || student.currentLevelName;
        
        if (targetLevelId && !acc.some(l => l.id === targetLevelId)) {
          acc.push({ id: targetLevelId, name: targetLevelName });
        }
      }
      return acc;
    }, [] as { id: string; name: string }[]);

    setTargetLevelsForPromotion(targetLevels);
    
    // Initialize tuition amounts if not set
    const newTuitionAmounts = { ...tuitionAmounts };
    targetLevels.forEach(l => {
      if (newTuitionAmounts[l.id] === undefined) {
        newTuitionAmounts[l.id] = 0;
      }
    });
    setTuitionAmounts(newTuitionAmounts);
    
    setIsConfigModalOpen(true);
  };

  // Execute promotion
  const handlePromoteSelected = async () => {
    setIsPromoting(true);

    try {
      // Build promotions array
      const promotions = Array.from(selectedStudents).map((studentId) => {
        const student = eligibility.find((s) => s.studentId === studentId);
        const targetLevelId = student?.nextLevelId || student?.currentLevelId;
        
        return {
          studentId,
          targetClassId: targetLevelId || '',
          isRepeating: !student?.isEligibleForPromotion,
          annualTuitionAmount: targetLevelId ? tuitionAmounts[targetLevelId] : undefined,
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
      if (result.failed > 0) {
        const errorDetails = result.results
          .filter((r: any) => !r.success)
          .map((r: any) => r.message || r.error || 'Erreur inconnue')
          .join(', ');

        toast({
          title: 'Promotion avec échecs',
          description: `${result.successful} promouvés, ${result.failed} échecs. Détails: ${errorDetails}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Promotion terminée',
          description: `${result.successful} élèves promouvés avec succès`,
          variant: 'default',
        });
      }

      // Clear selection and refetch
      setSelectedStudents(new Set());
      setIsConfigModalOpen(false);
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

  // Export PDF
  const handleExportPdf = async () => {
    if (!schoolId) return;

    const currentYearObj = academicYears.find((y: any) => y.id === selectedCurrentYear);
    const nextYearObj = academicYears.find((y: any) => y.id === selectedNextYear);
    const levelObj = levels.find((l: any) => l.id === selectedLevel);
    const classObj = classes.find((c: any) => c.id === selectedClass);

    await generatePassListPdf({
      school: school || profile?.school || user?.school || { name: 'Établissement' },
      academicYear: currentYearObj,
      nextAcademicYear: nextYearObj,
      levelName: levelObj?.name,
      className: classObj?.name,
      students: filteredData,
    });
  };

  const handleExportMeritListPdf = async () => {
    if (!schoolId || selectedClass === 'all' || selectedPeriod === 'all') {
      toast({
        title: "Paramètres manquants",
        description: "Veuillez sélectionner une classe et une période pour générer le palmarès.",
        variant: "destructive",
      });
      return;
    }
    setIsExportingMeritList(true);

    try {
      // Fetch ranking explicitly to avoid re-rendering layout just for generating export.
      const rankingData = await queryClient.fetchQuery(
         promotionQueries.getPeriodRanking(selectedClass, selectedPeriod)
      );

      if (!rankingData || rankingData.length === 0) {
        toast({
          title: "Aucune donnée",
          description: "Aucun bulletin vérifié n'a été trouvé pour cette classe et cette période.",
          variant: "destructive",
        });
        return;
      }

      const currentYearObj = academicYears.find((y: any) => y.id === selectedCurrentYear);
      const levelObj = levels.find((l: any) => l.id === selectedLevel);
      const classObj = classes.find((c: any) => c.id === selectedClass);
      const periodObj = periods.find((p: any) => p.id === selectedPeriod);

      await generateMeritListPdf({
        school: school || profile?.school || user?.school || { name: 'Établissement' },
        academicYear: currentYearObj,
        periodName: periodObj?.name,
        levelName: levelObj?.name,
        className: classObj?.name,
        students: rankingData,
      });

    } catch (error: any) {
      console.error("[Export Palmarès] Erreur complète:", error);
      toast({
        title: "Erreur d'exportation",
        description: `Une erreur est survenue lors de la compilation du palmarès: ${error?.message || 'Erreur inconnue'}`,
        variant: "destructive",
      });
    } finally {
      setIsExportingMeritList(false);
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

              {/* Class Filter */}
              <div className="space-y-2">
                <label htmlFor="class" className="text-sm font-medium">Classe</label>
                <SearchableSelect
                  options={filteredClasses.map((c: any) => ({ value: c.id, label: c.name }))}
                  value={selectedClass}
                  onValueChange={setSelectedClass}
                  placeholder="Toutes les classes"
                  searchPlaceholder="Rechercher une classe..."
                  allLabel="Toutes les classes"
                />
              </div>

              {/* Period Filter */}
              <div className="space-y-2">
                <label htmlFor="period" className="text-sm font-medium">Période (Pour Palmarès)</label>
                <SearchableSelect
                  options={periods.map((p: any) => ({ value: p.id, label: p.name }))}
                  value={selectedPeriod}
                  onValueChange={setSelectedPeriod}
                  placeholder="Toutes les périodes"
                  searchPlaceholder="Rechercher une période..."
                  allLabel="Toutes les périodes"
                  disabled={!selectedCurrentYear}
                />
              </div>

              {/* Suggestion Filter */}
              <div className="space-y-2">
                <label htmlFor="suggestion" className="text-sm font-medium">Décision du Conseil</label>
                <Select value={selectedSuggestion} onValueChange={setSelectedSuggestion}>
                  <SelectTrigger className="h-10 bg-white border-gray-200 hover:border-blue-300 transition-colors">
                    <SelectValue placeholder="Toutes les décisions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les décisions</SelectItem>
                    <SelectItem value="eligible">Admis (Promouvoir)</SelectItem>
                    <SelectItem value="borderline">Ajournés (À considérer)</SelectItem>
                    <SelectItem value="failing">Recalés (Redoublement)</SelectItem>
                    <SelectItem value="pending">En attente des notes</SelectItem>
                  </SelectContent>
                </Select>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Élèves à Promouvoir</CardTitle>
                <CardDescription>
                  {selectedStudents.size} élève(s) sélectionné(s)
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={filteredData.length === 0}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exporter (PDF)
                </Button>
                {selectedClass !== 'all' && selectedPeriod !== 'all' && (
                  <Button
                    variant="default"
                    className="bg-purple-600 hover:bg-purple-700 gap-2"
                    size="sm"
                    onClick={handleExportMeritListPdf}
                    disabled={isExportingMeritList}
                  >
                    <Download className="h-4 w-4" />
                    {isExportingMeritList ? 'Compilation...' : 'Palmarès (PDF)'}
                  </Button>
                )}
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
                  onClick={handleOpenConfig}
                  disabled={selectedStudents.size === 0 || isPromoting}
                >
                  {isPromoting ? 'Promotion...' : `Promouvoir (${selectedStudents.size})`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEligibility && selectedCurrentYear ? (
              <div className="flex justify-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
                <p className="text-sm text-muted-foreground">Chargement...</p>
              </div>
            ) : !selectedCurrentYear ? (
              <div className="text-center py-8 text-muted-foreground">
                Veuillez sélectionner une année actuelle pour afficher les élèves à promouvoir
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun élève trouvé avec les filtres actuels
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-md">
                <Table className="min-w-[700px]">
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration Modal */}
        <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Configuration des frais de scolarité</DialogTitle>
              <DialogDescription>
                Définissez les frais de scolarité annuels pour les classes dans lesquelles les élèves seront placés.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              {targetLevelsForPromotion.map((level) => (
                <div key={level.id} className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4 p-2 sm:p-0">
                  <Label htmlFor={`fee-${level.id}`} className="sm:col-span-2 text-sm font-medium">
                    {level.name}
                  </Label>
                  <Input
                    id={`fee-${level.id}`}
                    type="number"
                    className="sm:col-span-2"
                    value={tuitionAmounts[level.id] || 0}
                    onChange={(e) => setTuitionAmounts({
                      ...tuitionAmounts,
                      [level.id]: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsConfigModalOpen(false)} disabled={isPromoting} className="w-full sm:w-auto">
                Annuler
              </Button>
              <Button onClick={handlePromoteSelected} disabled={isPromoting} className="w-full sm:w-auto">
                {isPromoting ? 'Promotion...' : 'Confirmer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
