'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  useAuthContext,
  useCreateBulkGrades,
  useTeacherAssignmentsByTeacher,
  useEnrollmentsByClass,
  usePeriods,
  useCurrentAcademicYear,
  useAcademicYears,
  useSubjectCategories,
} from '@novaconnect/data';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Save, Send, Loader2, Users } from 'lucide-react';

interface StudentGrade {
  studentId: string;
  studentName: string;
  matricule: string;
  score: number;
  comments: string;
}

export default function BulkGradeEntryPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // Get authenticated user and school info
  const { user, profile } = useAuthContext();
  const teacherId = user?.id || '';

  // Get teacher assignments FIRST (to extract schoolId if needed)
  const { data: assignmentsRaw = [], isLoading: isLoadingAssignments } = useTeacherAssignmentsByTeacher(
    teacherId,
    undefined // Don't filter by academic year initially
  );

  // Extract schoolId from profile or from assignments
  const schoolIdFromProfile = profile?.schoolId || '';
  const schoolIdFromAssignments = useMemo(() => {
    const arr = assignmentsRaw as any[];
    if (arr && arr.length > 0) {
      const firstAssignment = arr[0];
      return firstAssignment?.schoolId || firstAssignment?.school_id || '';
    }
    return '';
  }, [assignmentsRaw]);

  const schoolId = schoolIdFromProfile || schoolIdFromAssignments;

  // Get all academic years and current one (now with valid schoolId)
  const { data: academicYears = [] } = useAcademicYears(schoolId);
  const { data: currentAcademicYear } = useCurrentAcademicYear(schoolId);

  // State for selected academic year (defaults to current)
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');

  // Use selected year or fallback to current year
  const academicYearId = selectedAcademicYearId || currentAcademicYear?.id || '';

  // Update selected year when current year is loaded
  useEffect(() => {
    if (!selectedAcademicYearId && currentAcademicYear?.id) {
      setSelectedAcademicYearId(currentAcademicYear.id);
    }
  }, [currentAcademicYear, selectedAcademicYearId]);

  // Filter assignments by selected academic year
  const assignments = useMemo(() => {
    if (!academicYearId) return assignmentsRaw;
    return (assignmentsRaw as any[]).filter(
      (a: any) => a.academicYearId === academicYearId || a.academic_year_id === academicYearId
    );
  }, [assignmentsRaw, academicYearId]);

  // Get periods for the academic year
  const { data: periods = [], isLoading: isLoadingPeriods } = usePeriods(schoolId, academicYearId, {
    enabled: !!schoolId && !!academicYearId,
  });

  // State for selected level
  const [selectedLevelId, setSelectedLevelId] = useState('');

  const [config, setConfig] = useState({
    classId: '',
    subjectId: '',
    periodId: '',
    gradeType: 'homework' as any,
    title: '',
    maxScore: 20,
    coefficient: 1,
    weight: 1,
  });

  // Get unique classes from assignments
  const allClasses = useMemo(() => {
    const uniqueClasses = new Map();
    (assignments as any[]).forEach((assignment: any) => {
      if (assignment.class && !uniqueClasses.has(assignment.class.id)) {
        uniqueClasses.set(assignment.class.id, assignment.class);
      }
    });
    return Array.from(uniqueClasses.values());
  }, [assignments]);

  // Get unique levels from assignment classes
  const levelsFromClasses = useMemo(() => {
    const uniqueLevels = new Map();
    allClasses.forEach((cls: any) => {
      if (cls.level && !uniqueLevels.has(cls.level.id)) {
        uniqueLevels.set(cls.level.id, cls.level);
      }
    });
    return Array.from(uniqueLevels.values());
  }, [allClasses]);

  // Filter classes by selected level
  const classes = useMemo(() => {
    if (!selectedLevelId) return allClasses;
    return allClasses.filter((cls: any) =>
      cls.levelId === selectedLevelId || cls.level?.id === selectedLevelId
    );
  }, [allClasses, selectedLevelId]);

  const subjectsForClass = useMemo(() => {
    if (!config.classId) return [];
    return (assignments as any[])
      .filter((a: any) => a.classId === config.classId && a.subject)
      .map((a: any) => a.subject)
      .filter((subject: any, index: number, self: any[]) =>
        index === self.findIndex((s: any) => s.id === subject.id)
      );
  }, [assignments, config.classId]);

  const selectedClass = useMemo(() => {
    return classes.find((cls: any) => cls.id === config.classId);
  }, [classes, config.classId]);

  const isUniversity = selectedClass?.level?.levelType === 'university';
  const { data: categories = [] } = useSubjectCategories(schoolId);
  const [entryCategoryId, setEntryCategoryId] = useState('all');

  const filteredSubjects = useMemo(() => {
    let result = subjectsForClass;
    if (isUniversity && entryCategoryId !== 'all') {
      result = result.filter((subject: any) => subject.categoryId === entryCategoryId);
    }
    return result;
  }, [subjectsForClass, entryCategoryId, isUniversity]);

  useEffect(() => {
    if (!config.subjectId || !isUniversity) return;
    const selectedSubject = filteredSubjects.find((subject: any) => subject.id === config.subjectId);
    if (selectedSubject && selectedSubject.coefficient) {
      setConfig(prev => ({ ...prev, coefficient: selectedSubject.coefficient }));
    } else {
      setConfig(prev => ({ ...prev, coefficient: 1 }));
    }
  }, [config.subjectId, filteredSubjects, isUniversity]);

  // Get enrollments (students) for selected class
  const { data: enrollments = [], isLoading: isLoadingStudents } = useEnrollmentsByClass(
    config.classId,
    { enabled: !!config.classId }
  );

  // Convert enrollments to StudentGrade format
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);

  useEffect(() => {
    if (Array.isArray(enrollments) && enrollments.length > 0) {
      setStudentGrades(
        (enrollments as any[]).map((enrollment) => ({
          studentId: enrollment.studentId,
          studentName: `${enrollment.student?.firstName || ''} ${enrollment.student?.lastName || ''}`.trim(),
          matricule: enrollment.student?.matricule || '',
          score: 0,
          comments: '',
        }))
      );
    }
  }, [enrollments]);

  const createBulkGrades = useCreateBulkGrades();

  // Calculate statistics
  const gradesEntered = studentGrades.filter((sg) => sg.score > 0).length;
  const completionPercentage = studentGrades.length > 0 ? (gradesEntered / studentGrades.length) * 100 : 0;
  const averageScore =
    gradesEntered > 0
      ? studentGrades.reduce((sum, sg) => sum + sg.score, 0) / gradesEntered
      : 0;
  const minScore = Math.min(...studentGrades.map((sg) => sg.score).filter((s) => s > 0), 0);
  const maxScore = Math.max(...studentGrades.map((sg) => sg.score));

  const handleStudentGradeChange = (studentId: string, field: 'score' | 'comments', value: any) => {
    setStudentGrades((prev) =>
      prev.map((sg) =>
        sg.studentId === studentId ? { ...sg, [field]: field === 'score' ? parseFloat(value) || 0 : value } : sg
      )
    );
  };

  const handleConfigChange = (field: string, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleAutoSave = async () => {
    if (gradesEntered > 0) {
      // Auto-save to local storage
      try {
        localStorage.setItem('bulk-grades-autosave', JSON.stringify({ config, studentGrades }));
        console.log('Auto-saved', gradesEntered, 'grades');
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }
  };

  useEffect(() => {
    // Set up auto-save every 30 seconds
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    const timer = setTimeout(handleAutoSave, 30000);
    setAutoSaveTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [studentGrades]);

  // Load from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bulk-grades-autosave');
      if (saved) {
        const { config: savedConfig, studentGrades: savedGrades } = JSON.parse(saved);
        setConfig(savedConfig);
        setStudentGrades(savedGrades);
      }
    } catch (error) {
      console.error('Failed to load auto-save:', error);
    }
  }, []);

  const handleSaveDraft = async () => {
    const validGrades = studentGrades.filter((sg) => sg.score > 0);

    if (validGrades.length === 0) {
      toast({
        title: 'Aucune note saisie',
        description: 'Veuillez saisir au moins une note',
        variant: 'destructive',
      });
      return;
    }

    if (!schoolId || !teacherId) {
      toast({
        title: 'Erreur',
        description: 'Informations utilisateur manquantes',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createBulkGrades.mutateAsync({
        ...config,
        schoolId,
        academicYearId,
        grades: validGrades.map((sg) => ({
          studentId: sg.studentId,
          score: sg.score,
          comments: sg.comments,
        })),
      });

      toast({
        title: 'Brouillon enregistré',
        description: `${validGrades.length} note(s) enregistrée(s) en brouillon`,
      });

      // Clear local storage after successful save
      localStorage.removeItem('bulk-grades-autosave');
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'enregistrer les notes',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async () => {
    const validGrades = studentGrades.filter((sg) => sg.score > 0);

    if (validGrades.length === 0) {
      toast({
        title: 'Aucune note saisie',
        description: 'Veuillez saisir au moins une note',
        variant: 'destructive',
      });
      return;
    }

    if (!config.title || !config.classId || !config.subjectId || !config.periodId) {
      toast({
        title: 'Champs manquants',
        description: 'Veuillez remplir tous les champs obligatoires',
        variant: 'destructive',
      });
      return;
    }

    // Validate scores
    const invalidScores = studentGrades.filter((sg) => sg.score > config.maxScore);
    if (invalidScores.length > 0) {
      toast({
        title: 'Erreur de validation',
        description: `${invalidScores.length} note(s) dépassent la note maximale`,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createBulkGrades.mutateAsync({
        ...config,
        schoolId,
        academicYearId,
        grades: validGrades.map((sg) => ({
          studentId: sg.studentId,
          score: sg.score,
          comments: sg.comments,
        })),
      });

      toast({
        title: 'Notes soumises',
        description: `${validGrades.length} note(s) soumise(s) pour validation`,
      });

      // Reset form & clear local storage
      setStudentGrades(studentGrades.map(sg => ({ ...sg, score: 0, comments: '' })));
      localStorage.removeItem('bulk-grades-autosave');
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de soumettre les notes',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const periodTypeLabels: Record<string, string> = {
    trimester: 'Trimestre',
    semester: 'Semestre',
    composition: 'Composition',
    exam: 'Examen',
  };

  const formatPeriodLabel = (period: any) => {
    const typeLabel = periodTypeLabels[period.periodType] || period.periodType;
    const dates = period.startDate && period.endDate
      ? `(${format(new Date(period.startDate), 'dd/MM', { locale: fr })} - ${format(new Date(period.endDate), 'dd/MM', { locale: fr })})`
      : '';
    return `${period.name} - ${typeLabel} ${dates}`;
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="space-y-1 sm:space-y-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Saisie Collective de Notes</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Enregistrez les notes de toute la classe en une seule fois
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-4">
        {/* Configuration Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Configuration</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Paramètres de l'évaluation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
              {/* Academic Year Selection */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="academicYear" className="text-xs sm:text-sm">Année Scolaire *</Label>
                <Select value={selectedAcademicYearId} onValueChange={(v) => setSelectedAcademicYearId(v)}>
                  <SelectTrigger id="academicYear" className="h-9 sm:h-10">
                    <SelectValue placeholder="Sélectionnez l'année" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.length === 0 ? (
                      <SelectItem value="none" disabled>Aucune année configurée</SelectItem>
                    ) : (
                      (academicYears as any[]).map((year) => (
                        <SelectItem key={year.id} value={year.id} className="text-sm">
                          {year.name} {year.isCurrent && '(Actuelle)'}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Level Selection */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="levelId" className="text-xs sm:text-sm">Niveau</Label>
                <SearchableSelect
                  options={levelsFromClasses.map((level: any) => ({ value: level.id, label: level.name }))}
                  value={selectedLevelId || 'all'}
                  onValueChange={(v) => {
                    setSelectedLevelId(v === 'all' ? '' : v);
                    setConfig(prev => ({ ...prev, classId: '', subjectId: '' }));
                  }}
                  placeholder="Tous les niveaux"
                  searchPlaceholder="Rechercher un niveau..."
                  allLabel="Tous les niveaux"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="classId" className="text-xs sm:text-sm">Classe *</Label>
                <SearchableSelect
                  options={classes.map((cls: any) => ({
                    value: cls.id,
                    label: `${cls.name}${cls.level?.name ? ` (${cls.level.name})` : ''}`
                  }))}
                  value={config.classId || 'all'}
                  onValueChange={(v) => handleConfigChange('classId', v === 'all' ? '' : v)}
                  placeholder={isLoadingAssignments ? "Chargement..." : "Classe"}
                  searchPlaceholder="Rechercher une classe..."
                  allLabel="Classe"
                />
              </div>

              {/* UE Selection */}
              {isUniversity && (
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="entryCategoryId" className="text-xs sm:text-sm">Unité d'Ens. (UE)</Label>
                  <SearchableSelect
                    options={categories.map((cat: any) => ({ value: cat.id, label: cat.name }))}
                    value={entryCategoryId}
                    onValueChange={(v) => {
                      setEntryCategoryId(v === 'all' ? 'all' : v);
                      handleConfigChange('subjectId', ''); // Reset subject
                    }}
                    placeholder="Toutes les UE"
                    searchPlaceholder="Rechercher une UE..."
                    allLabel="Toutes les UE"
                  />
                </div>
              )}

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="subjectId" className="text-xs sm:text-sm">Matière *</Label>
                <SearchableSelect
                  options={filteredSubjects.map((subject: any) => ({ value: subject.id, label: subject.name }))}
                  value={config.subjectId || 'all'}
                  onValueChange={(v) => handleConfigChange('subjectId', v === 'all' ? '' : v)}
                  placeholder="Matière"
                  searchPlaceholder="Rechercher une matière..."
                  allLabel="Matière"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="periodId" className="text-xs sm:text-sm">Période *</Label>
                <SearchableSelect
                  options={(periods as any[]).map((period: any) => ({ value: period.id, label: formatPeriodLabel(period) }))}
                  value={config.periodId || 'all'}
                  onValueChange={(v) => handleConfigChange('periodId', v === 'all' ? '' : v)}
                  placeholder={isLoadingPeriods ? "Chargement..." : "Période"}
                  searchPlaceholder="Rechercher une période..."
                  allLabel="Période"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="gradeType" className="text-xs sm:text-sm">Type *</Label>
                <Select value={config.gradeType} onValueChange={(v) => handleConfigChange('gradeType', v)}>
                  <SelectTrigger id="gradeType" className="h-9 sm:h-10">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homework" className="text-sm">Devoir</SelectItem>
                    <SelectItem value="exam" className="text-sm">Examen</SelectItem>
                    <SelectItem value="quiz" className="text-sm">Interrogation</SelectItem>
                    <SelectItem value="project" className="text-sm">Projet</SelectItem>
                    <SelectItem value="participation" className="text-sm">Participation</SelectItem>
                    <SelectItem value="composition" className="text-sm">Composition</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="title" className="text-xs sm:text-sm">Titre *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Devoir maison n°1"
                  value={config.title}
                  onChange={(e) => handleConfigChange('title', e.target.value)}
                  className="h-9 sm:h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="maxScore" className="text-xs sm:text-sm">Note Max *</Label>
                <Input
                  id="maxScore"
                  type="number"
                  min="0"
                  placeholder="20"
                  value={config.maxScore}
                  onChange={(e) => handleConfigChange('maxScore', parseFloat(e.target.value) || 20)}
                  className="h-9 sm:h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="coefficient" className="text-xs sm:text-sm">Coefficient</Label>
                <Input
                  id="coefficient"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="1"
                  value={config.coefficient}
                  onChange={(e) => handleConfigChange('coefficient', parseFloat(e.target.value) || 1)}
                  className="h-9 sm:h-10 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card className="shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Statistiques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-2">
                  <span>Progression</span>
                  <span className="font-medium">
                    {gradesEntered}/{studentGrades.length}
                  </span>
                </div>
                <Progress value={completionPercentage} className="h-2" />
              </div>

              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Moyenne:</span>
                  <span className="font-medium">{averageScore.toFixed(2)}/{config.maxScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min:</span>
                  <span className="font-medium">{minScore}/{config.maxScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max:</span>
                  <span className="font-medium">{maxScore}/{config.maxScore}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="shadow-sm">
            <CardContent className="pt-4 sm:pt-6 space-y-2 sm:space-y-3 p-4 sm:p-6">
              <Button
                onClick={handleSaveDraft}
                disabled={createBulkGrades.isPending || gradesEntered === 0}
                className="w-full h-9 sm:h-10 text-xs sm:text-sm"
                variant="outline"
              >
                {createBulkGrades.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Enregistrer
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || gradesEntered === 0}
                className="w-full h-9 sm:h-10 text-xs sm:text-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Soumettre
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Grades Table */}
        <div className="lg:col-span-3">
          <Card className="shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                Liste des Élèves
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Saisissez les notes pour chaque élève
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {isLoadingStudents ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                  Chargement des élèves...
                </div>
              ) : studentGrades.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  Sélectionnez une classe pour voir les élèves
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-4">
                  {studentGrades.map((studentGrade) => (
                    <div
                      key={studentGrade.studentId}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 sm:p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      {/* Student Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{studentGrade.studentName}</p>
                        <p className="text-xs text-muted-foreground">{studentGrade.matricule}</p>
                      </div>

                      {/* Score Input */}
                      <div className="w-full sm:w-28">
                        <Input
                          type="number"
                          min="0"
                          max={config.maxScore}
                          step="0.01"
                          placeholder={`/${config.maxScore}`}
                          value={studentGrade.score || ''}
                          onChange={(e) =>
                            handleStudentGradeChange(studentGrade.studentId, 'score', e.target.value)
                          }
                          className="h-9 text-sm"
                        />
                      </div>

                      {/* Comments */}
                      <div className="flex-1">
                        <Input
                          placeholder="Commentaires..."
                          value={studentGrade.comments}
                          onChange={(e) =>
                            handleStudentGradeChange(studentGrade.studentId, 'comments', e.target.value)
                          }
                          className="h-9 text-sm"
                        />
                      </div>

                      {/* Quick Actions */}
                      <div className="flex gap-1 justify-end sm:justify-start">
                        {[0, config.maxScore / 2, config.maxScore].map((quickScore) => (
                          <Button
                            key={quickScore}
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleStudentGradeChange(studentGrade.studentId, 'score', quickScore)
                            }
                            className="h-8 px-2 text-xs"
                          >
                            {quickScore}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div >
  );
}
