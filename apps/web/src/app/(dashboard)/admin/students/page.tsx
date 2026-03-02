'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Users,
  GraduationCap,
  Search,
  Filter,
  TrendingUp,
  BookOpen,
  UserMinus,
  UserPlus,
  FileText,
  X,
  Edit,
  Trash2,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  Flag,
  MapPin,
  User,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@novaconnect/data';
import {
  useStudents,
  useClasses,
  useLevels,
  useAcademicYears,
  useCurrentAcademicYear,
  useDeleteStudent,
  useParentsByStudent,
} from '@novaconnect/data';
import type { Student } from '@novaconnect/core';
import { AccountCreationDialog } from '@/components/admin/students/AccountCreationDialog';

export default function StudentsManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile, user } = useAuthContext();
  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    user?.schoolId ||
    (user as any)?.school_id;

  // Debug logging
  console.log('🔍 Students Page - Debug Info:', {
    profileSchoolId: profile?.school?.id,
    profileSchoolIdAlt: profile?.school_id,
    userSchoolId: user?.schoolId,
    userSchoolIdAlt: (user as any)?.school_id,
    finalSchoolId: schoolId,
    profile,
    user,
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const { data: students = [], isLoading: isLoadingStudents, error: studentsError } = useStudents(schoolId || '', {
    status: selectedStatus === 'all' ? undefined : selectedStatus,
  });

  console.log('📊 Students Query Result:', {
    studentsCount: students.length,
    isLoading: isLoadingStudents,
    error: studentsError,
    schoolIdUsed: schoolId || '',
  });

  // Log detailed error if exists
  if (studentsError) {
    console.error('❌ Students Query Error Details:', {
      message: studentsError.message,
      status: studentsError.status,
      code: studentsError.code,
      hint: studentsError.hint,
      details: studentsError.details,
      fullError: studentsError,
    });
  }

  const { data: classes = [] } = useClasses(schoolId || '');
  const { data: levels = [] } = useLevels(schoolId || '');
  const { data: academicYears = [] } = useAcademicYears(schoolId || '');
  const { data: currentAcademicYear } = useCurrentAcademicYear(schoolId || '');
  const activeStudentId = selectedStudent?.id || '00000000-0000-0000-0000-000000000000';
  const { data: parents = [] } = useParentsByStudent(activeStudentId);

  const deleteMutation = useDeleteStudent();

  const currentAcademicYearId = currentAcademicYear?.id;

  // Set default academic year to current one when available
  useEffect(() => {
    if (currentAcademicYearId && selectedAcademicYear === 'all') {
      setSelectedAcademicYear(currentAcademicYearId);
    }
  }, [currentAcademicYearId, selectedAcademicYear]);

  // Debug: Check enrollment data for each student
  useEffect(() => {
    console.log('🔍 Students Debug Info:');
    console.log('currentAcademicYearId:', currentAcademicYearId);
    console.log('selectedAcademicYear:', selectedAcademicYear);
    students.forEach((student: any) => {
      console.log(`📚 Student: ${student.firstName} ${student.lastName} (${student.matricule})`);
      console.log('  Enrollments:', student.enrollments);
      if (student.enrollments && student.enrollments.length > 0) {
        student.enrollments.forEach((enrollment: any) => {
          console.log('    - Enrollment:', {
            id: enrollment.id,
            classId: enrollment.classId,
            academicYearId: enrollment.academicYearId,
            status: enrollment.status,
            class: enrollment.class,
            academicYear: enrollment.academicYear,
          });
        });
      } else {
        console.log('    No enrollments found');
      }
    });
  }, [students, currentAcademicYearId, selectedAcademicYear]);

  const filteredStudents = students.filter((student: any) => {
    const matchesSearch =
      student.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.matricule?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesClass =
      selectedClass === 'all' ||
      student.enrollments?.some((e: any) => e.classId === selectedClass);
    const matchesLevel =
      selectedLevel === 'all' ||
      student.enrollments?.some((e: any) => e.class?.levelId === selectedLevel);
    const matchesAcademicYear =
      selectedAcademicYear === 'all' ||
      student.enrollments?.some((e: any) => e.academicYearId === selectedAcademicYear);

    return matchesSearch && matchesClass && matchesLevel && matchesAcademicYear;
  });

  const detailsEnrollment = useMemo(() => {
    if (!selectedStudent?.enrollments || selectedStudent.enrollments.length === 0) return null;
    return (
      selectedStudent.enrollments.find((e: any) => e.status === 'enrolled') ||
      selectedStudent.enrollments[0]
    );
  }, [selectedStudent]);

  const detailsClass = useMemo(() => {
    if (!selectedStudent) return null;
    const classFromList = classes.find((c: any) => c.id === detailsEnrollment?.classId);
    return classFromList || detailsEnrollment?.class || null;
  }, [selectedStudent, classes, detailsEnrollment]);

  const detailsLevel = useMemo(() => {
    const levelId =
      detailsClass?.levelId ||
      detailsEnrollment?.class?.levelId ||
      selectedStudent?.levelId;
    if (!levelId) {
      return detailsClass?.level || detailsEnrollment?.class?.level || null;
    }
    const levelFromList = levels.find((l: any) => l.id === levelId);
    return levelFromList || detailsClass?.level || detailsEnrollment?.class?.level || null;
  }, [detailsClass, detailsEnrollment, levels, selectedStudent]);

  const hasFilters = Boolean(
    searchQuery ||
    selectedClass !== 'all' ||
    selectedLevel !== 'all' ||
    selectedAcademicYear !== 'all' ||
    selectedStatus !== 'all'
  );

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedClass('all');
    setSelectedLevel('all');
    setSelectedAcademicYear('all');
    setSelectedStatus('all');
  };

  const handleDelete = async () => {
    if (!selectedStudent) return;
    try {
      await deleteMutation.mutateAsync(selectedStudent.id);
      toast({
        title: 'Élève supprimé',
        description: "L'élève a été supprimé avec succès.",
      });
      setDeleteDialogOpen(false);
      setSelectedStudent(null);
    } catch (error: any) {
      toast({
        title: 'Erreur lors de la suppression',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleView = (student: Student) => {
    setSelectedStudent(student);
    setViewDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: 'default',
      inactive: 'secondary',
      graduated: 'outline',
      transferred: 'outline',
      suspended: 'destructive',
      expelled: 'destructive',
    };
    const labels: Record<string, string> = {
      active: 'Actif',
      inactive: 'Inactif',
      graduated: 'Diplômé',
      transferred: 'Transféré',
      suspended: 'Suspendu',
      expelled: 'Expulsé',
    };
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const stats = {
    total: students.length,
    active: students.filter((s: any) => s.status === 'active').length,
    inactive: students.filter((s: any) => s.status === 'inactive').length,
    graduated: students.filter((s: any) => s.status === 'graduated').length,
  };

  const activeRate = stats.total ? Math.round((stats.active / stats.total) * 100) : 0;

  // Show warning if schoolId is not available
  if (!schoolId) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
          <Card className="border-red-200 bg-red-50/60">
            <CardHeader>
              <CardTitle className="text-red-900">Erreur: École non identifiée</CardTitle>
              <CardDescription className="text-red-700">
                Impossible de charger les élèves. L'identifiant de l'école n'est pas disponible.
                Veuillez vous reconnecter ou contacter l'administrateur.
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Gestion des élèves</h1>
              <p className="text-muted-foreground mt-1">
                Gérez les élèves, leurs inscriptions et leurs informations clés.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {hasFilters && (
              <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
                {filteredStudents.length} / {students.length} affichés
              </Badge>
            )}
            <Button onClick={() => router.push('/admin/students/new')} className="shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Nouvel élève
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="relative overflow-hidden border-border/60 bg-white/80 shadow-sm">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-primary/5" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-semibold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredStudents.length} affichés
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/60 bg-white/80 shadow-sm">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-emerald-100/60" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Actifs</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-emerald-700">
                  {stats.active}
                </span>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                  {activeRate}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Taux d'activité</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/60 bg-white/80 shadow-sm">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-amber-100/60" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inactifs</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <UserMinus className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-semibold text-amber-700">{stats.inactive}</div>
              <p className="text-xs text-muted-foreground mt-1">Comptes en pause</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/60 bg-white/80 shadow-sm">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-indigo-100/60" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Diplômés</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                <GraduationCap className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-semibold text-indigo-700">{stats.graduated}</div>
              <p className="text-xs text-muted-foreground mt-1">Années précédentes</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/60 bg-white/80 shadow-sm">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-slate-100/70" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Année scolaire
              </CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <BookOpen className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-semibold">{currentAcademicYear?.name || '-'}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {currentAcademicYear ? 'Année en cours' : 'Aucune année active'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60 bg-white/80 shadow-sm">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4 text-muted-foreground" />
                Filtres avancés
              </CardTitle>
              <CardDescription>
                Affinez la liste par statut, classe, niveau ou année scolaire.
              </CardDescription>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Réinitialiser
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="search">Recherche rapide</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Nom, matricule, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-7 w-7 p-0"
                      onClick={() => setSearchQuery('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-status">Statut</Label>
                <SearchableSelect
                  options={[
                    { value: 'active', label: 'Actifs' },
                    { value: 'inactive', label: 'Inactifs' },
                    { value: 'graduated', label: 'Diplômés' },
                    { value: 'transferred', label: 'Transférés' },
                    { value: 'suspended', label: 'Suspendus' },
                    { value: 'expelled', label: 'Expulsés' },
                  ]}
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                  placeholder="Tous les statuts"
                  searchPlaceholder="Rechercher..."
                  allLabel="Tous les statuts"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-class">Classe</Label>
                <SearchableSelect
                  options={classes.map((c: any) => ({ value: c.id, label: c.name }))}
                  value={selectedClass}
                  onValueChange={setSelectedClass}
                  placeholder="Toutes les classes"
                  searchPlaceholder="Rechercher une classe..."
                  allLabel="Toutes les classes"
                />
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
                <Label htmlFor="filter-year">Année scolaire</Label>
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

        <Card className="border-border/60 bg-white/80 shadow-sm">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Liste des élèves</CardTitle>
              <CardDescription>
                {filteredStudents.length} élève(s) trouvé(s)
                {filteredStudents.length !== students.length &&
                  ` sur ${students.length} au total`}
              </CardDescription>
            </div>
            {hasFilters && (
              <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                Filtres actifs
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {isLoadingStudents ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                Chargement des élèves...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Users className="h-5 w-5" />
                </div>
                <p className="max-w-sm text-sm">
                  {hasFilters
                    ? 'Aucun élève ne correspond aux filtres sélectionnés.'
                    : 'Aucun élève trouvé. Créez votre premier élève pour commencer.'}
                </p>
                {hasFilters ? (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Réinitialiser les filtres
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => router.push('/admin/students/new')}>
                    Ajouter un élève
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Élève
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Matricule
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Classe
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Niveau
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Genre
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Statut
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student: any) => {
                      const displayEnrollments =
                        student.enrollments?.filter((e: any) => {
                          if (selectedAcademicYear !== 'all') {
                            return e.academicYearId === selectedAcademicYear;
                          }
                          if (currentAcademicYearId) {
                            return e.academicYearId === currentAcademicYearId;
                          }
                          return true;
                        }) || [];

                      return (
                        <TableRow key={student.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 ring-1 ring-border">
                                <AvatarImage src={student.photoUrl} alt={student.firstName} />
                                <AvatarFallback>
                                  {getInitials(student.firstName, student.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {student.firstName} {student.lastName}
                                </div>
                                {student.email && (
                                  <div className="text-sm text-muted-foreground">
                                    {student.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              {student.matricule}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {displayEnrollments.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {displayEnrollments.map((enrollment: any) => {
                                  const classItem = classes.find(
                                    (classEntry: any) => classEntry.id === enrollment.classId
                                  );
                                  return classItem ? (
                                    <Badge key={enrollment.id} variant="secondary" className="text-xs">
                                      {classItem.name}
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Non inscrit</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {displayEnrollments.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {(() => {
                                  // Get unique levels from all enrollments
                                  const uniqueLevels = new Map();
                                  displayEnrollments.forEach((enrollment: any) => {
                                    const classItem = classes.find(
                                      (classEntry: any) => classEntry.id === enrollment.classId
                                    );
                                    if (classItem?.level) {
                                      uniqueLevels.set(classItem.level.id, classItem.level);
                                    } else if (classItem?.levelId) {
                                      const level = levels.find((l: any) => l.id === classItem.levelId);
                                      if (level) {
                                        uniqueLevels.set(level.id, level);
                                      }
                                    }
                                  });
                                  return Array.from(uniqueLevels.values()).map((level: any) => (
                                    <Badge key={level.id} variant="outline" className="text-xs border-primary/20">
                                      {level.name}
                                    </Badge>
                                  ));
                                })()}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {student.gender === 'male' && 'Masculin'}
                            {student.gender === 'female' && 'Féminin'}
                            {student.gender === 'other' && 'Autre'}
                            {student.gender === 'prefer_not_to_say' && '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(student.status)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleView(student)}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  Voir détails
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => router.push(`/admin/students/${student.id}/edit`)}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => router.push(`/admin/students/${student.id}/parents`)}
                                >
                                  <Users className="mr-2 h-4 w-4" />
                                  Gérer les parents
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => router.push(`/admin/students/${student.id}/enrollment`)}
                                >
                                  <GraduationCap className="mr-2 h-4 w-4" />
                                  Inscriptions
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => router.push(`/admin/students/${student.id}/documents`)}
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Documents
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedStudent(student);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l'élève</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer l'élève{' '}
              <strong>
                {selectedStudent?.firstName} {selectedStudent?.lastName}
              </strong>
              ? Cette action est irréversible et pourrait affecter les données associées
              (notes, inscriptions, etc.).
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

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden sm:rounded-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Détails de l'élève</DialogTitle>
            <DialogDescription>
              Informations complètes sur {selectedStudent?.firstName} {selectedStudent?.lastName}
            </DialogDescription>
          </DialogHeader>

          {selectedStudent && (
            <div className="bg-slate-50/80 flex flex-col">
              {/* Header Profile */}
              <div className="bg-white px-6 pt-6 pb-5 flex items-center gap-4 border-b border-slate-200 shadow-sm relative z-10">
                <Avatar className="h-16 w-16 border border-slate-200 shadow-sm">
                  <AvatarImage src={selectedStudent.photoUrl} className="object-cover" />
                  <AvatarFallback className="text-xl font-semibold bg-emerald-50 text-emerald-700">
                    {getInitials(selectedStudent.firstName, selectedStudent.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-slate-900 truncate">
                    {selectedStudent.firstName} {selectedStudent.lastName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-200/60 font-mono text-xs font-medium">
                      ID: {selectedStudent.matricule || '-'}
                    </Badge>
                    {getStatusBadge(selectedStudent.status)}
                  </div>
                </div>
              </div>

              {/* Content Details */}
              <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Academic */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 sm:col-span-2 lg:col-span-3">
                  <div className="flex items-center gap-2 text-slate-500 mb-3">
                    <GraduationCap className="h-4 w-4 text-emerald-600" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Scolarité</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Classe</p>
                      <p className="text-sm font-semibold text-slate-900">{detailsClass?.name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Niveau</p>
                      <p className="text-sm font-semibold text-slate-900">{detailsLevel?.name || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Personal Info fields */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wider">Email</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 truncate" title={selectedStudent.email}>{selectedStudent.email || '-'}</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Phone className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wider">Téléphone</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{selectedStudent.phone || '-'}</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wider">Naissance</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedStudent.dateOfBirth
                      ? new Date(selectedStudent.dateOfBirth).toLocaleDateString('fr-FR')
                      : '-'}
                    {selectedStudent.placeOfBirth ? ` à ${selectedStudent.placeOfBirth}` : ''}
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Flag className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wider">Nationalité</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{selectedStudent.nationality || '-'}</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <User className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wider">Genre</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedStudent.gender === 'male' && 'Masculin'}
                    {selectedStudent.gender === 'female' && 'Féminin'}
                    {selectedStudent.gender === 'other' && 'Autre'}
                    {selectedStudent.gender === 'prefer_not_to_say' && 'Non renseigné'}
                    {!selectedStudent.gender && '-'}
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center sm:col-span-2 lg:col-span-3">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wider">Adresse</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedStudent.address
                      ? `${selectedStudent.address}${selectedStudent.city ? ', ' + selectedStudent.city : ''}`
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 relative z-10">
                <Button
                  variant="default"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  onClick={() => {
                    setViewDialogOpen(false);
                    setAccountDialogOpen(true);
                  }}
                >
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Comptes utilisateurs
                </Button>
                
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-200 text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setViewDialogOpen(false);
                      router.push(`/admin/students/${selectedStudent.id}/edit`);
                    }}
                  >
                    <Edit className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-200 text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setViewDialogOpen(false);
                      router.push(`/admin/students/${selectedStudent.id}/parents`);
                    }}
                  >
                    <Users className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                    Parents
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-200 text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setViewDialogOpen(false);
                      router.push(`/admin/students/${selectedStudent.id}/enrollment`);
                    }}
                  >
                    <GraduationCap className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                    Inscriptions
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AccountCreationDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        studentData={selectedStudent ? {
          id: selectedStudent.id,
          firstName: selectedStudent.firstName || '',
          lastName: selectedStudent.lastName || '',
          email: selectedStudent.email || null,
          schoolId: selectedStudent.schoolId || schoolId || '',
        } : undefined}
        parentsData={parents
          .filter((relation: any) => relation.parent)  // Filter out relations without parent data
          .map((relation: any) => ({
            id: relation.parent.id,
            firstName: relation.parent.firstName || '',
            lastName: relation.parent.lastName || '',
            email: relation.parent.email || null,
            schoolId: relation.parent.schoolId || schoolId || '',
          }))
        }
      />
    </div>
  );
}




