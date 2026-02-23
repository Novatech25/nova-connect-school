'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useAuthContext,
  useGrades,
  useSubmitGrade,
  useApproveGrade,
  usePublishGrade,
  useRejectGrade,
  useUpdateGrade,
  useStudents,
  useUsers,
  useTeachersFromGrades,
  useCreateBulkGrades,
  useCurrentAcademicYear,
  useAcademicYears,
  useClasses,
  useLevels,
  useSubjects,
  usePeriods,
} from '@novaconnect/data';
// ... imports
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { Textarea } from '@/components/ui/textarea';
import { GradeStatus } from '@core/schemas/grades';
import {
  Eye,
  FileCheck,
  FileX,
  Send as SendIcon,
  Check,
  CheckCircle2,
  Ban,
  Loader2,
  MoreHorizontal
} from 'lucide-react';

export default function AdminGradesPage() {
  const { toast } = useToast();
  const { profile, user } = useAuthContext();
  const [selectedStatus, setSelectedStatus] = useState<GradeStatus | 'all'>('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('all');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState('all');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>(''); // New State
  const [entryAcademicYearId, setEntryAcademicYearId] = useState<string>(''); // New State for Quick Entry
  const [studentSearch, setStudentSearch] = useState('');
  const [entryClassId, setEntryClassId] = useState('');
  const [entrySubjectId, setEntrySubjectId] = useState('');
  const [entryPeriodId, setEntryPeriodId] = useState('');
  const [entryGradeType, setEntryGradeType] = useState('exam');
  const [entryTitle, setEntryTitle] = useState('');
  const [entryMaxScore, setEntryMaxScore] = useState(20);
  const [entryCoefficient, setEntryCoefficient] = useState(1);
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [studentGrades, setStudentGrades] = useState<any[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<any>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    user?.schoolId ||
    (user as any)?.school_id;

  // ... auth check

  // Data Fetching
  const { data: currentAcademicYear } = useCurrentAcademicYear(schoolId);
  const { data: academicYears = [] } = useAcademicYears(schoolId);

  // Set default academic year when current one loads
  useEffect(() => {
    if (currentAcademicYear?.id) {
      if (!selectedAcademicYearId) {
        setSelectedAcademicYearId(currentAcademicYear.id);
      }
      if (!entryAcademicYearId) {
        setEntryAcademicYearId(currentAcademicYear.id);
      }
    }
  }, [currentAcademicYear, selectedAcademicYearId, entryAcademicYearId]);

  // Use the SELECTED academic year for related queries, not just the current one
  const activeAcademicYearId = selectedAcademicYearId || currentAcademicYear?.id || '';
  const academicYearId = activeAcademicYearId; // Keep for existing logic consistency if needed, but entry logic should use entryAcademicYearId

  const activeClassFilter =
    selectedClassFilter && selectedClassFilter !== 'all' ? selectedClassFilter : undefined;

  // Pass activeAcademicYearId to useGrades if supported/needed, 
  // or rely on the class ID which is implicitly tied to an academic year.
  // Generally, filtering by class is enough, but if we want to filter grades 
  // by year regardless of class, we might need to update useGrades.
  // For now, let's assume class filter is primary for grades list.

  const { data: grades, isLoading, error } = useGrades(schoolId, {
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    classId: activeClassFilter,
    // Add academicYearId filter if your backend supports it, otherwise 
    // filtering classes/periods by year effectively filters grades.
  });

  // ... mutations
  const updateGrade = useUpdateGrade();
  const submitGrade = useSubmitGrade();
  const approveGrade = useApproveGrade();
  const publishGrade = usePublishGrade();
  const rejectGradeMutation = useRejectGrade();
  const createBulkGrades = useCreateBulkGrades();
  const { data: users } = useUsers(schoolId);

  const { data: levels = [] } = useLevels(schoolId);
  // Fetch classes based on the academic year selected for ENTRY if we want strict year-based class lists, 
  // but for now classes are often valid across years or we want to filter them. 
  // Let's use entryAcademicYearId for the entry form classes if possible, or fallback to activeAcademicYearId.
  // Actually, useClasses hook might need the year ID to return correct classes.
  const { data: classesForEntry = [] } = useClasses(schoolId, entryAcademicYearId || activeAcademicYearId);
  const { data: classes = [] } = useClasses(schoolId, activeAcademicYearId); // For filters

  const { data: teachers = [], isLoading: isLoadingTeachers } = useTeachersFromGrades(schoolId);

  // ... memoization logic

  const { data: periods = [] } = usePeriods(schoolId, entryAcademicYearId || activeAcademicYearId);
  const selectedClass = useMemo(
    () => classesForEntry.find((cls: any) => cls.id === entryClassId),
    [classesForEntry, entryClassId]
  );
  const filteredClasses = useMemo(() => {
    if (!selectedLevelFilter || selectedLevelFilter === 'all') {
      return classes;
    }
    return classes.filter((cls: any) => cls.levelId === selectedLevelFilter);
  }, [classes, selectedLevelFilter]);
  useEffect(() => {
    if (
      selectedClassFilter !== 'all' &&
      !filteredClasses.some((cls: any) => cls.id === selectedClassFilter)
    ) {
      setSelectedClassFilter('all');
    }
  }, [filteredClasses, selectedClassFilter]);
  const { data: allSubjects = [] } = useSubjects(schoolId);
  const subjects = useMemo(() => {
    const levelId = selectedClass?.levelId;
    if (!levelId) return allSubjects;
    const hasLevelSpecific = allSubjects.some((subject: any) => subject.levelId);
    if (!hasLevelSpecific) return allSubjects;
    return allSubjects.filter(
      (subject: any) => !subject.levelId || subject.levelId === levelId
    );
  }, [allSubjects, selectedClass?.levelId]);

  const quickEntryClassId =
    entryClassId || (selectedClassFilter !== 'all' ? selectedClassFilter : '');
  console.log('🏫 AdminGradesPage using schoolId:', schoolId);
  const { data: students = [] } = useStudents(
    schoolId,
    quickEntryClassId ? { classId: quickEntryClassId } : undefined
  );
  const visibleStudents = useMemo(() => {
    console.log('🔍 Filtering students:', {
      totalStudents: students.length,
      quickEntryClassId,
      firstStudent: students[0]
    });

    if (!quickEntryClassId) return [];

    const filtered = students.filter((student: any) => {
      const enrollments = student?.enrollments || [];
      const hasMatchingEnrollment = enrollments.some((item: any) => item.classId === quickEntryClassId);
      const hasMatchingLegacyClass = student?.classId === quickEntryClassId || student?.class_id === quickEntryClassId;

      // Debug specific student if needed
      // if (student.firstName === 'NomDuNouveau') console.log('Checking student:', student.firstName, { enrollments, hasMatchingEnrollment, hasMatchingLegacyClass });

      // ALWAY check both. If either matches, show the student.
      // This handles cases where enrollment data might be incomplete but legacy data exists,
      // or vice versa, or if there's a sync lag.
      return hasMatchingEnrollment || hasMatchingLegacyClass;
    });

    console.log('✅ Visible students:', filtered.length);
    return filtered;
  }, [students, quickEntryClassId]);
  const studentIdsKey = useMemo(
    () => visibleStudents.map((student: any) => student.id).join('|'),
    [visibleStudents]
  );
  const prevStudentIdsKeyRef = useRef('');

  useEffect(() => {
    setEntrySubjectId('');
  }, [entryClassId]);

  useEffect(() => {
    if (!entrySubjectId) return;
    const exists = subjects.some((subject: any) => subject.id === entrySubjectId);
    if (!exists) {
      setEntrySubjectId('');
    }
  }, [subjects, entrySubjectId]);

  useEffect(() => {
    if (studentIdsKey === prevStudentIdsKeyRef.current) {
      return;
    }
    prevStudentIdsKeyRef.current = studentIdsKey;
    if (!visibleStudents || visibleStudents.length === 0) {
      setStudentGrades([]);
      return;
    }
    setStudentGrades((prev) => {
      const prevMap = new Map(prev.map((grade) => [grade.studentId, grade]));
      return visibleStudents.map((student: any) => {
        const existing = prevMap.get(student.id);
        return existing ?? { studentId: student.id, score: 0, comments: '' };
      });
    });
  }, [studentIdsKey]);

  const formatDateShort = (value?: string | Date | null) => {
    if (!value) return '--';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '--';
    return new Intl.DateTimeFormat('fr-FR').format(date);
  };

  const formatGender = (value?: string | null) => {
    switch (value) {
      case 'male':
        return 'Garçon';
      case 'female':
        return 'Fille';
      case 'other':
        return 'Autre';
      case 'prefer_not_to_say':
        return 'Non précisé';
      default:
        return '--';
    }
  };

  const normalizedStudentSearch = studentSearch.trim().toLowerCase();
  const matchesStudentSearch = (student: any) => {
    if (!normalizedStudentSearch) return true;
    const firstName = student?.firstName || '';
    const lastName = student?.lastName || '';
    const matricule = student?.matricule || '';
    return [firstName, lastName, matricule].some((value: string) =>
      value.toLowerCase().includes(normalizedStudentSearch)
    );
  };

  const getStudentClassName = (student: any) => {
    const enrollment =
      student?.enrollments?.find((item: any) => item.classId === quickEntryClassId) ||
      student?.enrollments?.[0];
    return enrollment?.class?.name || '--';
  };


  const handleApprove = async (gradeId: string) => {
    try {
      await approveGrade.mutateAsync({ id: gradeId });
      toast({
        title: 'Note approuvée',
        description: 'La note a été approuvée avec succès',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'approuver la note',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitGrade = async (gradeId: string) => {
    try {
      await submitGrade.mutateAsync({ id: gradeId });
      toast({
        title: 'Note soumise',
        description: 'La note a ete soumise pour validation.',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: "Impossible de soumettre la note",
        variant: 'destructive',
      });
    }
  };

  const handlePublish = async (gradeId: string) => {
    try {
      await publishGrade.mutateAsync({ id: gradeId });
      toast({
        title: 'Note publiée',
        description: 'La note a été publiée avec succès',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de publier la note',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async () => {
    if (!selectedGrade || !rejectionReason) {
      toast({
        title: 'Erreur',
        description: 'Veuillez fournir une raison',
        variant: 'destructive',
      });
      return;
    }

    try {
      await rejectGradeMutation.mutateAsync({
        id: selectedGrade.id,
        reason: rejectionReason,
      });
      toast({
        title: 'Note rejetée',
        description: 'La note a été rejetée et retournée au professeur',
      });
      setShowRejectDialog(false);
      setRejectionReason('');
      setSelectedGrade(null);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de repasser la note en brouillon',
        variant: 'destructive',
      });
    }
  };

  const handleToggleReportCardImpact = async (grade: any) => {
    try {
      await updateGrade.mutateAsync({
        id: grade.id,
        affectsReportCard: !grade.affectsReportCard,
      });

      const newStatus = !grade.affectsReportCard;
      toast({
        title: 'Impact bulletin mis à jour',
        description: newStatus
          ? 'La note sera incluse dans le bulletin de l\'élève'
          : 'La note ne sera pas incluse dans le bulletin de l\'élève',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour l\'impact bulletin',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: GradeStatus) => {
    const variants: Record<GradeStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'secondary',
      submitted: 'outline',
      approved: 'default',
      published: 'destructive',
    };

    const labels: Record<GradeStatus, string> = {
      draft: 'Brouillon',
      submitted: 'Soumise',
      approved: 'Approuvée',
      published: 'Publiée',
    };

    return (
      <Badge variant={variants[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const levelClassIds = new Set(
    selectedLevelFilter && selectedLevelFilter !== 'all'
      ? classes.filter((cls: any) => cls.levelId === selectedLevelFilter).map((cls: any) => cls.id)
      : []
  );

  const getGradeClassId = (grade: any) =>
    grade?.class?.id || grade?.classId || grade?.class_id || null;

  const filteredGrades = useMemo(() => {
    let list = grades || [];

    if (selectedStatus !== 'all') {
      list = list.filter((g: any) => g.status === selectedStatus);
    }

    if (selectedClassFilter && selectedClassFilter !== 'all') {
      list = list.filter((g: any) => getGradeClassId(g) === selectedClassFilter);
    }

    if (selectedLevelFilter && selectedLevelFilter !== 'all') {
      list = list.filter((g: any) => {
        const classId = getGradeClassId(g);
        return classId && levelClassIds.has(classId);
      });
    }

    if (selectedTeacherFilter && selectedTeacherFilter !== 'all') {
      list = list.filter((g: any) => g.teacherId === selectedTeacherFilter);
    }

    if (normalizedStudentSearch) {
      list = list.filter((g: any) => matchesStudentSearch(g.student));
    }

    return list;
  }, [
    grades,
    selectedStatus,
    selectedClassFilter,
    selectedLevelFilter,
    selectedTeacherFilter,
    levelClassIds,
    normalizedStudentSearch,
  ]);

  const filteredStudentsForEntry = useMemo(() => {
    if (!normalizedStudentSearch) return visibleStudents;
    return visibleStudents.filter((student: any) => matchesStudentSearch(student));
  }, [visibleStudents, normalizedStudentSearch]);

  const stats = {
    total: filteredGrades.length,
    draft: filteredGrades.filter((g: any) => g.status === 'draft').length,
    submitted: filteredGrades.filter((g: any) => g.status === 'submitted').length,
    approved: filteredGrades.filter((g: any) => g.status === 'approved').length,
    published: filteredGrades.filter((g: any) => g.status === 'published').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Erreur lors du chargement des notes</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestion des Notes</h1>
        <p className="text-muted-foreground">
          Valider et publier les notes soumises par les professeurs
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Brouillons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-600">{stats.draft}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">À Valider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Publiées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.published}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <SearchableSelect
                options={academicYears.map((y: any) => ({ value: y.id, label: y.name + (y.current ? ' (En cours)' : '') }))}
                value={selectedAcademicYearId}
                onValueChange={(v) => {
                  setSelectedAcademicYearId(v);
                  setSelectedClassFilter('all');
                }}
                placeholder="Année scolaire"
                searchPlaceholder="Rechercher une année..."
              />
            </div>
            <div>
              <SearchableSelect
                options={[
                  { value: 'draft', label: 'Brouillons' },
                  { value: 'submitted', label: 'Soumises' },
                  { value: 'approved', label: 'Approuvées' },
                  { value: 'published', label: 'Publiées' },
                ]}
                value={selectedStatus}
                onValueChange={(v: any) => setSelectedStatus(v)}
                placeholder="Statut"
                searchPlaceholder="Rechercher..."
                allLabel="Tous les statuts"
              />
            </div>
            <div>
              <SearchableSelect
                options={levels.map((l: any) => ({ value: l.id, label: l.name }))}
                value={selectedLevelFilter}
                onValueChange={setSelectedLevelFilter}
                placeholder="Tous les niveaux"
                searchPlaceholder="Rechercher un niveau..."
                allLabel="Tous les niveaux"
              />
            </div>
            <div>
              <SearchableSelect
                options={filteredClasses.map((c: any) => ({ value: c.id, label: c.name }))}
                value={selectedClassFilter}
                onValueChange={setSelectedClassFilter}
                placeholder="Toutes les classes"
                searchPlaceholder="Rechercher une classe..."
                allLabel="Toutes les classes"
              />
            </div>
            <div>
              <SearchableSelect
                options={teachers.map((t: any) => {
                  const firstName = t.firstName || t.first_name || '';
                  const lastName = t.lastName || t.last_name || '';
                  const displayName = `${firstName} ${lastName}`.trim() || 'Enseignant';
                  return { value: t.id, label: displayName };
                })}
                value={selectedTeacherFilter}
                onValueChange={setSelectedTeacherFilter}
                placeholder="Tous les enseignants"
                searchPlaceholder="Rechercher un enseignant..."
                allLabel="Tous les enseignants"
              />
            </div>
            <div>
              <Input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Rechercher élève (prénom, nom, matricule)"
              />
            </div>
          </div>
          {(selectedLevelFilter !== 'all' ||
            selectedClassFilter !== 'all' ||
            selectedTeacherFilter !== 'all' ||
            normalizedStudentSearch) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Filtré par :</span>
                {selectedLevelFilter !== 'all' && (
                  <Badge variant="secondary">
                    Niveau {levels.find((lvl: any) => lvl.id === selectedLevelFilter)?.name || '--'}
                  </Badge>
                )}
                {selectedClassFilter !== 'all' && (
                  <Badge variant="secondary">
                    Classe{' '}
                    {classes.find((cls: any) => cls.id === selectedClassFilter)?.name || '--'}
                  </Badge>
                )}
                {selectedTeacherFilter !== 'all' && (
                  <Badge variant="secondary">
                    Enseignant{' '}
                    {(() => {
                      const teacher = teachers.find((t: any) => t.id === selectedTeacherFilter);
                      if (teacher) {
                        const firstName = teacher.firstName || teacher.first_name || '';
                        const lastName = teacher.lastName || teacher.last_name || '';
                        return `${firstName} ${lastName}`.trim();
                      }
                      return '';
                    })()}
                  </Badge>
                )}
                {normalizedStudentSearch && (
                  <Badge variant="secondary">Recherche "{studentSearch.trim()}"</Badge>
                )}
              </div>
            )}
        </CardContent>
      </Card>

      {/* Quick Grade Entry */}
      <Card>
        <CardHeader>
          <CardTitle>Saisie rapide des notes (Admin)</CardTitle>
          <CardDescription>
            Sélectionnez une classe, une matière et une période pour saisir les notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Academic Year Selection for Entry */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-muted-foreground">Année scolaire</label>
              <Select
                value={entryAcademicYearId}
                onValueChange={(v) => {
                  setEntryAcademicYearId(v);
                  setEntryClassId(''); // Reset class as it might not exist in new year
                  setEntryPeriodId(''); // Reset period
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une année" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year: any) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.name} {year.current ? '(En cours)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Classe</label>
              <Select value={entryClassId} onValueChange={setEntryClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {classesForEntry.map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Matière</label>
              <Select value={entrySubjectId} onValueChange={setEntrySubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une matière" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject: any) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Période</label>
              <Select value={entryPeriodId} onValueChange={setEntryPeriodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une période" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period: any) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Type de note</label>
              <Select value={entryGradeType} onValueChange={(v: any) => setEntryGradeType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homework">Devoir Maison</SelectItem>
                  <SelectItem value="exam">Examen</SelectItem>
                  <SelectItem value="quiz">Interrogation</SelectItem>
                  <SelectItem value="project">Projet</SelectItem>
                  <SelectItem value="participation">Participation</SelectItem>
                  <SelectItem value="composition">Composition</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">Titre</label>
              <Input
                value={entryTitle}
                onChange={(e) => setEntryTitle(e.target.value)}
                placeholder="Ex: Devoir maison 1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Note max</label>
              <Input
                type="number"
                value={entryMaxScore}
                onChange={(e) => setEntryMaxScore(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Coefficient</label>
              <Input
                type="number"
                value={entryCoefficient}
                onChange={(e) => setEntryCoefficient(Number(e.target.value) || 1)}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="publishImmediately"
                checked={publishImmediately}
                onChange={(e) => setPublishImmediately(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="publishImmediately" className="text-sm font-medium cursor-pointer">
                Publier immédiatement
              </label>
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Sexe</TableHead>
                  <TableHead>Naissance</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudentsForEntry.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {quickEntryClassId
                        ? normalizedStudentSearch
                          ? 'Aucun élève ne correspond à la recherche.'
                          : 'Aucun élève trouvé dans cette classe.'
                        : 'Sélectionnez une classe pour afficher les élèves.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudentsForEntry.map((student: any) => {
                    const grade = studentGrades.find((g) => g.studentId === student.id);
                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          {student.firstName} {student.lastName}
                        </TableCell>
                        <TableCell>{student.matricule || '--'}</TableCell>
                        <TableCell>{getStudentClassName(student)}</TableCell>
                        <TableCell>{formatGender(student.gender)}</TableCell>
                        <TableCell>{formatDateShort(student.dateOfBirth)}</TableCell>
                        <TableCell>{student.phone || '--'}</TableCell>
                        <TableCell className="w-32">
                          <Input
                            type="number"
                            value={grade?.score ?? 0}
                            onChange={(e) => {
                              const value = Number(e.target.value) || 0;
                              setStudentGrades((prev) =>
                                prev.map((g) =>
                                  g.studentId === student.id ? { ...g, score: value } : g
                                )
                              );
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={async () => {
                if (!entryAcademicYearId || !entryClassId || !entrySubjectId || !entryPeriodId) {
                  toast({
                    title: 'Champs manquants',
                    description: 'Année, classe, matière et période sont obligatoires.',
                    variant: 'destructive',
                  });
                  return;
                }

                if (!entryTitle.trim()) {
                  toast({
                    title: 'Titre requis',
                    description: 'Veuillez renseigner un titre de note.',
                    variant: 'destructive',
                  });
                  return;
                }

                const validGrades = studentGrades.filter((g) => g.score > 0);
                if (validGrades.length === 0) {
                  toast({
                    title: 'Aucune note saisie',
                    description: 'Veuillez saisir au moins une note.',
                    variant: 'destructive',
                  });
                  return;
                }
                if (entryMaxScore <= 0) {
                  toast({
                    title: 'Note max invalide',
                    description: 'La note maximale doit ?tre sup?rieure ? 0.',
                    variant: 'destructive',
                  });
                  return;
                }

                const hasOverMax = validGrades.some((grade) => grade.score > entryMaxScore);
                if (hasOverMax) {
                  toast({
                    title: 'Notes invalides',
                    description: 'Certaines notes d?passent la note maximale.',
                    variant: 'destructive',
                  });
                  return;
                }

                try {
                  const created = await createBulkGrades.mutateAsync({
                    schoolId,
                    academicYearId: entryAcademicYearId,
                    classId: entryClassId,
                    subjectId: entrySubjectId,
                    periodId: entryPeriodId,
                    gradeType: entryGradeType,
                    title: entryTitle.trim(),
                    maxScore: entryMaxScore,
                    coefficient: entryCoefficient,
                    weight: 1,
                    grades: validGrades,
                    status: publishImmediately ? 'published' : 'draft',
                    affectsReportCard: true,
                  });

                  if (!created || created.length === 0) {
                    toast({
                      title: 'Aucune note enregistr?e',
                      description: "L'enregistrement a ?t? bloqu?. V?rifiez vos autorisations.",
                      variant: 'destructive',
                    });
                    return;
                  }

                  toast({
                    title: 'Notes enregistr?es',
                    description: publishImmediately 
                      ? `${validGrades.length} note(s) publi?e(s) et incluse(s) dans les bulletins.`
                      : `${validGrades.length} note(s) enregistr?e(s) en brouillon.`,
                  });
                } catch (err: any) {
                  console.error('Bulk grade save error:', err);
                  const fallbackMessage =
                    err?.message ||
                    err?.error?.message ||
                    err?.details ||
                    err?.hint;

                  let message = fallbackMessage;
                  if (!message) {
                    try {
                      const details = JSON.stringify(err ?? {}, null, 2);
                      message = details && details !== '{}' ? details : undefined;
                    } catch (stringifyError) {
                      message = undefined;
                    }
                  }

                  toast({
                    title: 'Erreur',
                    description: message || 'Impossible d?enregistrer les notes',
                    variant: 'destructive',
                  });
                }
              }}
              disabled={createBulkGrades.isPending}
            >
              {createBulkGrades.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...
                </span>
              ) : (
                'Enregistrer les notes'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grades Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Notes</CardTitle>
          <CardDescription>
            {filteredGrades.length} note(s) trouvée(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead>
                <TableHead>Matière</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Professeur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Impact Bulletin</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGrades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Aucune note trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredGrades.map((grade: any) => (
                  <TableRow key={grade.id}>
                    <TableCell>
                      <div className="font-medium">
                        {grade.student?.firstName} {grade.student?.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {grade.student?.matricule}
                      </div>
                    </TableCell>
                    <TableCell>{grade.subject?.name}</TableCell>
                    <TableCell>{grade.title}</TableCell>
                    <TableCell>
                      <div className="font-mono font-bold">
                        {grade.score}/{grade.maxScore}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Coeff: {grade.coefficient}
                      </div>
                    </TableCell>
                    <TableCell>{grade.class?.name}</TableCell>
                    <TableCell>
                      {grade.teacher?.firstName || grade.teacher?.first_name || ''} {grade.teacher?.lastName || grade.teacher?.last_name || ''}
                    </TableCell>
                    <TableCell>{getStatusBadge(grade.status)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={grade.affectsReportCard ? 'default' : 'secondary'}
                        className={grade.affectsReportCard ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                      >
                        {grade.affectsReportCard ? 'Oui' : 'Non'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          <DropdownMenuItem onClick={() => setSelectedGrade(grade)}>
                            <Eye className="mr-2 h-4 w-4" />
                            <span>Voir détails</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => handleToggleReportCardImpact(grade)}
                            disabled={updateGrade.isPending}
                          >
                            {grade.affectsReportCard ? (
                              <>
                                <FileCheck className="mr-2 h-4 w-4 text-green-600" />
                                <span>Exclure du bulletin</span>
                              </>
                            ) : (
                              <>
                                <FileX className="mr-2 h-4 w-4 text-orange-600" />
                                <span>Inclure dans le bulletin</span>
                              </>
                            )}
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {grade.status === 'draft' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleSubmitGrade(grade.id)}
                                disabled={submitGrade.isPending}
                              >
                                <SendIcon className="mr-2 h-4 w-4 text-blue-600" />
                                <span>Soumettre pour validation</span>
                              </DropdownMenuItem>
                            </>
                          )}

                          {grade.status === 'submitted' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleApprove(grade.id)}
                                disabled={approveGrade.isPending}
                              >
                                <Check className="mr-2 h-4 w-4 text-green-600" />
                                <span>Approuver</span>
                              </DropdownMenuItem>
                            </>
                          )}

                          {grade.status === 'approved' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handlePublish(grade.id)}
                                disabled={publishGrade.isPending}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4 text-purple-600" />
                                <span>Publier</span>
                              </DropdownMenuItem>
                            </>
                          )}

                          {grade.status !== 'draft' && grade.status !== 'published' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedGrade(grade);
                                  setShowRejectDialog(true);
                                }}
                                className="text-red-600"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                <span>Rejeter (Brouillon)</span>
                              </DropdownMenuItem>
                            </>
                          )}

                          {grade.status === 'published' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled
                                className="text-muted-foreground"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                <span>Rejeter (Non disponible)</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Grade Details Modal */}
      <Dialog open={!!selectedGrade && !showRejectDialog} onOpenChange={() => setSelectedGrade(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de la Note</DialogTitle>
            <DialogDescription>
              Informations complètes et historique de la note
            </DialogDescription>
          </DialogHeader>
          {selectedGrade && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Élève</p>
                  <p className="text-lg">
                    {selectedGrade.student?.firstName} {selectedGrade.student?.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Matière</p>
                  <p className="text-lg">{selectedGrade.subject?.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Note</p>
                  <p className="text-lg font-mono">
                    {selectedGrade.score}/{selectedGrade.maxScore}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Statut</p>
                  <div>{getStatusBadge(selectedGrade.status)}</div>
                </div>
              </div>

              {selectedGrade.comments && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Commentaires</p>
                  <p className="text-sm">{selectedGrade.comments}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedGrade(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passer en brouillon</DialogTitle>
            <DialogDescription>
              Veuillez fournir une raison pour repasser en brouillon
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Expliquez la raison..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleReject} disabled={!rejectionReason}>
              Rejeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}






