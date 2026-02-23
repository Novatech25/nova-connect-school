'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Filter,
  UserCheck,
  UserX,
  ClipboardList,
  BookOpen,
  GraduationCap,
  MoreHorizontal,
  FileText,
  Settings2,
  X,
  Plus,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import {
  useAcademicYears,
  useClasses,
  useSubjects,
  useTeacherAssignments,
  useUsers,
  useAuthContext,
  userQueries,
  useCreateUserAccount,
} from '@novaconnect/data';

type TeacherRecord = {
  id: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  isActive?: boolean | null;
  is_active?: boolean | null;
  createdAt?: string | null;
  created_at?: string | null;
};

export default function TeachersManagementPage() {
  const { profile, user, isLoading } = useAuthContext();
  const schoolId =
    profile?.school?.id || user?.schoolId || (user as any)?.school_id;

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
          <Card className="border-border/60 bg-white/80 shadow-sm">
            <CardContent className="py-10 text-center text-muted-foreground">
              Chargement...
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
          <Card className="border-border/60 bg-white/80 shadow-sm">
            <CardContent className="py-10 text-center text-muted-foreground">
              Impossible de charger l'identifiant de l'ecole.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return <TeachersManagementContent schoolId={schoolId} />;
}

function TeachersManagementContent({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRecord | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('all');

  const { data: teachers = [], isLoading: isLoadingTeachers } = useUsers(
    schoolId,
    'teacher'
  );
  const { data: classes = [] } = useClasses(schoolId);
  const { data: subjects = [] } = useSubjects(schoolId);
  const { data: academicYears = [] } = useAcademicYears(schoolId);
  const { data: assignments = [] } = useTeacherAssignments(
    schoolId,
    selectedAcademicYear === 'all' ? undefined : selectedAcademicYear
  );

  const updateTeacherStatus = useMutation({
    ...userQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['users', 'school', schoolId, 'teacher'],
      });
    },
  });

  const createTeacherMutation = useMutation({
    ...userQueries.createAccount(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['users', 'school', schoolId, 'teacher'],
      });
    },
  });

  const handleCreateTeacher = async () => {
    if (!createForm.firstName || !createForm.lastName || !createForm.email || !createForm.password) {
      toast({
        title: 'Champs requis',
        description: 'Veuillez remplir tous les champs obligatoires.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await createTeacherMutation.mutateAsync({
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        email: createForm.email,
        password: createForm.password,
        role: 'teacher',
        schoolId,
      });
      toast({
        title: 'Enseignant créé avec succès',
        description: `Le compte de ${createForm.firstName} ${createForm.lastName} a été créé.`,
      });
      setCreateDialogOpen(false);
      setCreateForm({ firstName: '', lastName: '', email: '', phone: '', password: '' });
    } catch (error: any) {
      toast({
        title: 'Erreur lors de la création',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const classMap = useMemo(() => {
    return new Map(classes.map((item: any) => [item.id, item]));
  }, [classes]);

  const subjectMap = useMemo(() => {
    return new Map(subjects.map((item: any) => [item.id, item]));
  }, [subjects]);

  const assignmentsByTeacher = useMemo(() => {
    const map = new Map<string, any[]>();
    assignments.forEach((assignment: any) => {
      const teacherId = assignment.teacherId || assignment.teacher_id;
      if (!teacherId) return;
      if (!map.has(teacherId)) {
        map.set(teacherId, []);
      }
      map.get(teacherId)!.push(assignment);
    });
    return map;
  }, [assignments]);

  const getTeacherName = (teacher: TeacherRecord) => {
    const firstName = teacher.firstName || teacher.first_name || '';
    const lastName = teacher.lastName || teacher.last_name || '';
    return `${firstName} ${lastName}`.trim() || '-';
  };

  const getTeacherInitials = (teacher: TeacherRecord) => {
    const firstName = teacher.firstName || teacher.first_name || '';
    const lastName = teacher.lastName || teacher.last_name || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'PR';
  };

  const getTeacherEmail = (teacher: TeacherRecord) => teacher.email || '-';

  const isTeacherActive = (teacher: TeacherRecord) => {
    if (teacher.isActive !== undefined && teacher.isActive !== null) {
      return Boolean(teacher.isActive);
    }
    if (teacher.is_active !== undefined && teacher.is_active !== null) {
      return Boolean(teacher.is_active);
    }
    return true;
  };

  const getAssignmentsSummary = (teacherId: string) => {
    const list = assignmentsByTeacher.get(teacherId) || [];
    const subjectNames = new Set<string>();
    const classNames = new Set<string>();

    list.forEach((assignment: any) => {
      const subjectName =
        assignment.subject?.name || subjectMap.get(assignment.subjectId)?.name;
      const className =
        assignment.class?.name || classMap.get(assignment.classId)?.name;

      if (subjectName) subjectNames.add(subjectName);
      if (className) classNames.add(className);
    });

    return {
      assignments: list,
      subjectNames: Array.from(subjectNames),
      classNames: Array.from(classNames),
    };
  };

  const filteredTeachers = teachers.filter((teacher: TeacherRecord) => {
    const name = getTeacherName(teacher).toLowerCase();
    const email = (teacher.email || '').toLowerCase();
    const phone = (teacher.phone || '').toLowerCase();
    const matchesSearch =
      name.includes(searchQuery.toLowerCase()) ||
      email.includes(searchQuery.toLowerCase()) ||
      phone.includes(searchQuery.toLowerCase());

    const active = isTeacherActive(teacher);
    const matchesStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'active' && active) ||
      (selectedStatus === 'inactive' && !active);

    const assignmentSummary = getAssignmentsSummary(teacher.id);
    const matchesClass =
      selectedClass === 'all' ||
      assignmentSummary.assignments.some((assignment: any) => {
        const classId = assignment.classId || assignment.class_id;
        return classId === selectedClass;
      });

    const matchesSubject =
      selectedSubject === 'all' ||
      assignmentSummary.assignments.some((assignment: any) => {
        const subjectId = assignment.subjectId || assignment.subject_id;
        return subjectId === selectedSubject;
      });

    return matchesSearch && matchesStatus && matchesClass && matchesSubject;
  });

  const hasFilters = Boolean(
    searchQuery ||
    selectedStatus !== 'all' ||
    selectedClass !== 'all' ||
    selectedSubject !== 'all' ||
    selectedAcademicYear !== 'all'
  );

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedClass('all');
    setSelectedSubject('all');
    setSelectedAcademicYear('all');
  };

  const stats = useMemo(() => {
    const total = teachers.length;
    const active = teachers.filter((teacher: TeacherRecord) => isTeacherActive(teacher))
      .length;
    const assigned = teachers.filter((teacher: TeacherRecord) => {
      const list = assignmentsByTeacher.get(teacher.id) || [];
      return list.length > 0;
    }).length;

    const subjectIds = new Set<string>();
    const classIds = new Set<string>();
    assignments.forEach((assignment: any) => {
      if (assignment.subjectId) subjectIds.add(assignment.subjectId);
      if (assignment.classId) classIds.add(assignment.classId);
    });

    return {
      total,
      active,
      inactive: total - active,
      assigned,
      subjectsCovered: subjectIds.size,
      classesCovered: classIds.size,
    };
  }, [teachers, assignments, assignmentsByTeacher]);

  const activeRate = stats.total
    ? Math.round((stats.active / stats.total) * 100)
    : 0;

  const handleView = (teacher: TeacherRecord) => {
    setSelectedTeacher(teacher);
    setViewDialogOpen(true);
  };

  const handleToggleStatus = async (teacher: TeacherRecord) => {
    const nextStatus = !isTeacherActive(teacher);
    try {
      await updateTeacherStatus.mutateAsync({
        id: teacher.id,
        is_active: nextStatus,
      });
      toast({
        title: nextStatus ? 'Enseignant active' : 'Enseignant desactive',
        description: `${getTeacherName(teacher)} est maintenant ${nextStatus ? 'actif' : 'inactif'
          }.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erreur de mise a jour',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Gestion des enseignants</h1>
              <p className="text-muted-foreground mt-1">
                Suivez les enseignants, leurs contacts et leurs affectations.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {hasFilters && (
              <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
                {filteredTeachers.length} / {teachers.length} affiches
              </Badge>
            )}
            <Button variant="outline" onClick={() => router.push('/admin/settings')}>
              <Settings2 className="mr-2 h-4 w-4" />
              Affectations
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau Professeur
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="relative overflow-hidden border-border/60 bg-white/80 shadow-sm">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-primary/5" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-semibold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredTeachers.length} affiches
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/60 bg-white/80 shadow-sm">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-emerald-100/60" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Actifs</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <UserCheck className="h-4 w-4" />
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
              <p className="text-xs text-muted-foreground mt-1">Taux actif</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/60 bg-white/80 shadow-sm">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-amber-100/60" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inactifs
              </CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <UserX className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-semibold text-amber-700">{stats.inactive}</div>
              <p className="text-xs text-muted-foreground mt-1">Comptes suspendus</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/60 bg-white/80 shadow-sm">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-indigo-100/60" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Affectes
              </CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                <ClipboardList className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-semibold text-indigo-700">{stats.assigned}</div>
              <p className="text-xs text-muted-foreground mt-1">Avec des classes</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/60 bg-white/80 shadow-sm">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-slate-100/70" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Couverture
              </CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <BookOpen className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-semibold">
                {stats.subjectsCovered}/{stats.classesCovered}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Matieres / classes
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60 bg-white/80 shadow-sm">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4 text-muted-foreground" />
                Filtres avances
              </CardTitle>
              <CardDescription>
                Recherchez par nom, statut, classe, matiere et annee scolaire.
              </CardDescription>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Reinitialiser
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
                    placeholder="Nom, email, telephone..."
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
                  ]}
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                  placeholder="Tous les statuts"
                  searchPlaceholder="Rechercher..."
                  allLabel="Tous"
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
                  allLabel="Toutes"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-subject">Matière</Label>
                <SearchableSelect
                  options={subjects.map((s: any) => ({ value: s.id, label: s.name }))}
                  value={selectedSubject}
                  onValueChange={setSelectedSubject}
                  placeholder="Toutes les matières"
                  searchPlaceholder="Rechercher une matière..."
                  allLabel="Toutes"
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
              <CardTitle>Liste des enseignants</CardTitle>
              <CardDescription>
                {filteredTeachers.length} enseignant(s) trouve(s)
                {filteredTeachers.length !== teachers.length &&
                  ` sur ${teachers.length} au total`}
              </CardDescription>
            </div>
            {hasFilters && (
              <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                Filtres actifs
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {isLoadingTeachers ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                Chargement des enseignants...
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Users className="h-5 w-5" />
                </div>
                <p className="max-w-sm text-sm">
                  {hasFilters
                    ? 'Aucun enseignant ne correspond aux filtres selectionnes.'
                    : 'Aucun enseignant trouve dans cet etablissement.'}
                </p>
                {hasFilters && (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Reinitialiser les filtres
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Enseignant
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Contact
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Classes
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Matieres
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
                    {filteredTeachers.map((teacher: TeacherRecord) => {
                      const summary = getAssignmentsSummary(teacher.id);
                      const active = isTeacherActive(teacher);
                      return (
                        <TableRow key={teacher.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 ring-1 ring-border">
                                <AvatarImage
                                  src={teacher.avatarUrl || teacher.avatar_url || undefined}
                                  alt={getTeacherName(teacher)}
                                />
                                <AvatarFallback>{getTeacherInitials(teacher)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{getTeacherName(teacher)}</div>
                                <div className="text-sm text-muted-foreground">
                                  {getTeacherEmail(teacher)}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {teacher.phone || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {summary.classNames.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {summary.classNames.slice(0, 3).map((name) => (
                                  <Badge key={name} variant="secondary" className="text-xs">
                                    {name}
                                  </Badge>
                                ))}
                                {summary.classNames.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{summary.classNames.length - 3}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Non assigne</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {summary.subjectNames.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {summary.subjectNames.slice(0, 3).map((name) => (
                                  <Badge key={name} variant="outline" className="text-xs">
                                    {name}
                                  </Badge>
                                ))}
                                {summary.subjectNames.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{summary.subjectNames.length - 3}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={active ? 'default' : 'secondary'}>
                              {active ? 'Actif' : 'Inactif'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleView(teacher)}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  Voir details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
                                  <GraduationCap className="mr-2 h-4 w-4" />
                                  Affectations
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleStatus(teacher)}>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  {active ? 'Desactiver' : 'Activer'}
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

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau professeur</DialogTitle>
            <DialogDescription>
              Créez un compte pour un nouvel enseignant. Un email et un mot de passe lui seront attribués.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-firstName">Prénom *</Label>
                <Input
                  id="create-firstName"
                  placeholder="Prénom"
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-lastName">Nom *</Label>
                <Input
                  id="create-lastName"
                  placeholder="Nom"
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="professeur@ecole.com"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Téléphone</Label>
              <Input
                id="create-phone"
                type="tel"
                placeholder="+237 6XX XXX XXX"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Mot de passe *</Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 caractères"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                L'enseignant pourra changer son mot de passe après la première connexion.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={createTeacherMutation.isPending}>
              Annuler
            </Button>
            <Button onClick={handleCreateTeacher} disabled={createTeacherMutation.isPending}>
              {createTeacherMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer le compte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Details de l'enseignant</DialogTitle>
            <DialogDescription>
              Informations completes sur {selectedTeacher ? getTeacherName(selectedTeacher) : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedTeacher && (
            <div className="space-y-6">
              <div className="rounded-xl border bg-muted/20 p-5">
                <div className="flex flex-col gap-6 md:flex-row md:items-start">
                  <Avatar className="h-24 w-24 ring-2 ring-white shadow-sm">
                    <AvatarImage
                      src={selectedTeacher.avatarUrl || selectedTeacher.avatar_url || undefined}
                      alt={getTeacherName(selectedTeacher)}
                    />
                    <AvatarFallback className="text-2xl">
                      {getTeacherInitials(selectedTeacher)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-2xl font-semibold">
                        {getTeacherName(selectedTeacher)}
                      </h3>
                      <Badge
                        variant={isTeacherActive(selectedTeacher) ? 'default' : 'secondary'}
                        className="h-6"
                      >
                        {isTeacherActive(selectedTeacher) ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg border bg-white p-4 shadow-sm">
                        <Label className="text-xs uppercase text-muted-foreground">Email</Label>
                        <p className="mt-2 text-sm font-medium break-words">
                          {getTeacherEmail(selectedTeacher)}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-white p-4 shadow-sm">
                        <Label className="text-xs uppercase text-muted-foreground">Téléphone</Label>
                        <p className="mt-2 text-sm font-medium">
                          {selectedTeacher.phone || '-'}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-white p-4 shadow-sm">
                        <Label className="text-xs uppercase text-muted-foreground">Identifiant</Label>
                        <p className="mt-2 text-sm font-medium break-words">
                          {selectedTeacher.id}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <Label className="text-xs uppercase text-muted-foreground">Affectations</Label>
                {(() => {
                  const summary = getAssignmentsSummary(selectedTeacher.id);
                  if (summary.assignments.length === 0) {
                    return (
                      <div className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Aucune affectation enregistrée pour cette période.
                      </div>
                    );
                  }
                  return (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border bg-muted/20 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Classes</p>
                          <Badge variant="secondary">{summary.classNames.length}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {summary.classNames.map((name) => (
                            <Badge key={name} variant="secondary">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Matières</p>
                          <Badge variant="outline">{summary.subjectNames.length}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {summary.subjectNames.map((name) => (
                            <Badge key={name} variant="outline">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
