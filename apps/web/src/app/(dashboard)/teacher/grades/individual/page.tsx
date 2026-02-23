'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  useAuthContext,
  useCreateGrade,
  useTeacherGrades,
  useSubmitGrade,
  useTeacherAssignmentsByTeacher,
  useEnrollmentsByClass,
  usePeriods,
  useCurrentAcademicYear,
  useAcademicYears,
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Save, Send, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function IndividualGradeEntryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const { data: grades } = useTeacherGrades(teacherId, { status: 'draft' });
  const createGrade = useCreateGrade();
  const submitGrade = useSubmitGrade();

  const [formData, setFormData] = useState({
    studentId: '',
    classId: '',
    subjectId: '',
    periodId: '',
    gradeType: 'homework' as any,
    title: '',
    score: 0,
    maxScore: 20,
    coefficient: 1,
    weight: 1,
    comments: '',
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

  // Get subjects for selected class
  const subjectsForClass = useMemo(() => {
    if (!formData.classId) return [];
    return (assignments as any[])
      .filter((a: any) => a.classId === formData.classId && a.subject)
      .map((a: any) => a.subject)
      .filter((subject: any, index: number, self: any[]) =>
        index === self.findIndex((s: any) => s.id === subject.id)
      );
  }, [assignments, formData.classId]);

  // Get enrollments (students) for selected class
  const { data: enrollments = [], isLoading: isLoadingStudents } = useEnrollmentsByClass(
    formData.classId,
    { enabled: !!formData.classId }
  );

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveDraft = async () => {
    if (!schoolId || !teacherId) {
      toast({
        title: 'Erreur',
        description: 'Informations utilisateur manquantes',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createGrade.mutateAsync({
        ...formData,
        schoolId,
        academicYearId,
      });
      toast({
        title: 'Brouillon enregistré',
        description: 'La note a été enregistrée en brouillon',
      });
      // Reset form
      setFormData({
        studentId: '',
        classId: formData.classId, // Keep class selected
        subjectId: formData.subjectId, // Keep subject selected
        periodId: formData.periodId, // Keep period selected
        gradeType: 'homework',
        title: '',
        score: 0,
        maxScore: 20,
        coefficient: 1,
        weight: 1,
        comments: '',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'enregistrer la note',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.studentId || !formData.classId || !formData.subjectId || !formData.periodId || !formData.title) {
      toast({
        title: 'Champs manquants',
        description: 'Veuillez remplir tous les champs obligatoires',
        variant: 'destructive',
      });
      return;
    }

    if (formData.score > formData.maxScore) {
      toast({
        title: 'Erreur de validation',
        description: 'La note ne peut pas être supérieure à la note maximale',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // First create the grade
      const grade = await createGrade.mutateAsync({
        ...formData,
        schoolId,
        academicYearId,
      });

      // Then submit it
      await submitGrade.mutateAsync({ id: grade.id });

      toast({
        title: 'Note soumise',
        description: 'La note a été soumise pour validation',
      });

      router.push('/teacher/grades');
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de soumettre la note',
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
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Saisie Individuelle de Notes</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Enregistrez les notes des élèves une par une
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Informations de la Note</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Remplissez les détails de la note à enregistrer
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
                    setFormData(prev => ({ ...prev, classId: '', subjectId: '', studentId: '' }));
                  }}
                  placeholder="Tous les niveaux"
                  searchPlaceholder="Rechercher un niveau..."
                  allLabel="Tous les niveaux"
                />
              </div>

              {/* Class Selection */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="classId" className="text-xs sm:text-sm">Classe *</Label>
                <SearchableSelect
                  options={classes.map((cls: any) => ({
                    value: cls.id,
                    label: `${cls.name}${cls.level?.name ? ` (${cls.level.name})` : ''}`
                  }))}
                  value={formData.classId || 'all'}
                  onValueChange={(v) => handleInputChange('classId', v === 'all' ? '' : v)}
                  placeholder={isLoadingAssignments ? "Chargement..." : "Sélectionnez une classe"}
                  searchPlaceholder="Rechercher une classe..."
                  allLabel="Sélectionnez une classe"
                />
              </div>

              {/* Subject Selection */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="subjectId" className="text-xs sm:text-sm">Matière *</Label>
                <SearchableSelect
                  options={subjectsForClass.map((subject: any) => ({ value: subject.id, label: subject.name }))}
                  value={formData.subjectId || 'all'}
                  onValueChange={(v) => handleInputChange('subjectId', v === 'all' ? '' : v)}
                  placeholder="Sélectionnez une matière"
                  searchPlaceholder="Rechercher une matière..."
                  allLabel="Sélectionnez une matière"
                />
              </div>

              {/* Period Selection */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="periodId" className="text-xs sm:text-sm">Période *</Label>
                <SearchableSelect
                  options={(periods as any[]).map((period: any) => ({ value: period.id, label: formatPeriodLabel(period) }))}
                  value={formData.periodId || 'all'}
                  onValueChange={(v) => handleInputChange('periodId', v === 'all' ? '' : v)}
                  placeholder={isLoadingPeriods ? "Chargement..." : "Sélectionnez une période"}
                  searchPlaceholder="Rechercher une période..."
                  allLabel="Sélectionnez une période"
                />
              </div>

              {/* Student Selection */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="studentId" className="text-xs sm:text-sm">Élève *</Label>
                <SearchableSelect
                  options={(enrollments as any[]).map((enrollment: any) => ({
                    value: enrollment.studentId,
                    label: `${enrollment.student?.firstName || ''} ${enrollment.student?.lastName || ''}${enrollment.student?.matricule ? ` (${enrollment.student.matricule})` : ''}`.trim()
                  }))}
                  value={formData.studentId || 'all'}
                  onValueChange={(v) => handleInputChange('studentId', v === 'all' ? '' : v)}
                  placeholder={isLoadingStudents ? "Chargement..." : "Sélectionnez un élève"}
                  searchPlaceholder="Rechercher un élève..."
                  allLabel="Sélectionnez un élève"
                />
              </div>

              {/* Grade Type */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="gradeType" className="text-xs sm:text-sm">Type de Note *</Label>
                <Select value={formData.gradeType} onValueChange={(v) => handleInputChange('gradeType', v)}>
                  <SelectTrigger id="gradeType" className="h-9 sm:h-10">
                    <SelectValue placeholder="Sélectionnez le type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homework" className="text-sm">Devoir Maison</SelectItem>
                    <SelectItem value="exam" className="text-sm">Examen</SelectItem>
                    <SelectItem value="quiz" className="text-sm">Interrogation</SelectItem>
                    <SelectItem value="project" className="text-sm">Projet</SelectItem>
                    <SelectItem value="participation" className="text-sm">Participation</SelectItem>
                    <SelectItem value="composition" className="text-sm">Composition</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="title" className="text-xs sm:text-sm">Titre *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Devoir maison n°1"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="h-9 sm:h-10 text-sm"
                />
              </div>

              {/* Score and Max Score */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="score" className="text-xs sm:text-sm">Note *</Label>
                  <Input
                    id="score"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="15"
                    value={formData.score}
                    onChange={(e) => handleInputChange('score', parseFloat(e.target.value) || 0)}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="maxScore" className="text-xs sm:text-sm">Note Max *</Label>
                  <Input
                    id="maxScore"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="20"
                    value={formData.maxScore}
                    onChange={(e) => handleInputChange('maxScore', parseFloat(e.target.value) || 0)}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>

              {/* Coefficient and Weight */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="coefficient" className="text-xs sm:text-sm">Coefficient</Label>
                  <Input
                    id="coefficient"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="1"
                    value={formData.coefficient}
                    onChange={(e) => handleInputChange('coefficient', parseFloat(e.target.value) || 1)}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="weight" className="text-xs sm:text-sm">Poids</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="1"
                    value={formData.weight}
                    onChange={(e) => handleInputChange('weight', parseFloat(e.target.value) || 1)}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>

              {/* Comments */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="comments" className="text-xs sm:text-sm">Commentaires</Label>
                <Textarea
                  id="comments"
                  placeholder="Observations sur la note..."
                  value={formData.comments}
                  onChange={(e) => handleInputChange('comments', e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          {/* Actions Card */}
          <Card className="shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 p-4 sm:p-6">
              <Button
                onClick={handleSaveDraft}
                disabled={createGrade.isPending || !formData.studentId}
                className="w-full h-9 sm:h-10 text-xs sm:text-sm"
                variant="outline"
              >
                {createGrade.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Enregistrer Brouillon
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.studentId}
                className="w-full h-9 sm:h-10 text-xs sm:text-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Soumettre pour Validation
              </Button>
            </CardContent>
          </Card>

          {/* Draft Grades */}
          {grades && grades.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Brouillons</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {grades.length} note(s) en brouillon
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-2">
                  {grades.map((grade: any) => (
                    <div
                      key={grade.id}
                      className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    >
                      <p className="font-medium text-xs sm:text-sm">{grade.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {grade.student?.firstName} {grade.student?.lastName} - {grade.score}/{grade.maxScore}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
