'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Upload,
  Filter,
  ArrowLeft,
  Paperclip,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext, useAssignments } from '@novaconnect/data';
import { getStudentProfileSecure, getAcademicYearsSecure } from '@/actions/payment-actions';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function StudentHomeworkPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuthContext();

  // Get the student ID from profile
  const studentId = profile?.studentId || profile?.student?.id;
  const schoolId = profile?.schoolId || profile?.school?.id || user?.schoolId;

  // Filters
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'postedDate' | 'subject'>('dueDate');
  const [selectedDate, setSelectedDate] = useState<string>(''); // filtre par date limite (dueDate)

  // Academic Year filter
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('all');

  useEffect(() => {
    async function loadYears() {
      if (!user?.id) return;
      const { data: studentData } = await getStudentProfileSecure(user.id);
      if (!studentData?.school_id) return;
      const { data: years } = await getAcademicYearsSecure(studentData.school_id);
      if (years && years.length > 0) {
        setAcademicYears(years);
        const current = years.find((y: any) => y.isCurrent || y.is_current || y.current);
        if (current) setSelectedYearId(current.id);
      }
    }
    loadYears();
  }, [user?.id]);

  // Fetch assignments
  const { data: assignments = [], isLoading: isLoadingAssignments } = useAssignments(
    schoolId || '',
    {
      studentId,
    }
  );

  // Get unique subjects from assignments
  const subjects = assignments.reduce((acc: any[], assignment: any) => {
    if (assignment.subject && !acc.find((s: any) => s.id === assignment.subject.id)) {
      acc.push(assignment.subject);
    }
    return acc;
  }, []);

  // Filter assignments
  const filteredAssignments = assignments.filter((assignment: any) => {
    if (selectedSubject !== 'all' && assignment.subject?.id !== selectedSubject) return false;
    // Filtre par année scolaire (si disponible sur l'assignment)
    if (selectedYearId !== 'all' && assignment.academicYearId && assignment.academicYearId !== selectedYearId) return false;
    // Filtre par date limite spécifique
    if (selectedDate) {
      const due = new Date(assignment.dueDate).toISOString().split('T')[0];
      if (due !== selectedDate) return false;
    }

    const hasSubmitted = assignment.submissions && assignment.submissions.length > 0;
    const isOverdue = isPast(new Date(assignment.dueDate));

    if (selectedStatus === 'pending' && hasSubmitted) return false;
    if (selectedStatus === 'submitted' && !hasSubmitted) return false;
    if (selectedStatus === 'overdue' && (!isOverdue || hasSubmitted)) return false;
    if (selectedStatus === 'upcoming' && (isOverdue || hasSubmitted)) return false;

    return true;
  });

  // Sort assignments
  const sortedAssignments = [...filteredAssignments].sort((a: any, b: any) => {
    if (sortBy === 'dueDate') {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    } else if (sortBy === 'postedDate') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortBy === 'subject') {
      return (a.subject?.name || '').localeCompare(b.subject?.name || '');
    }
    return 0;
  });

  // Calculate statistics
  const now = new Date();
  const overdueCount = assignments.filter((a: any) => {
    const hasSubmitted = a.submissions && a.submissions.length > 0;
    return isPast(new Date(a.dueDate)) && !hasSubmitted;
  }).length;

  const pendingCount = assignments.filter((a: any) => {
    const hasSubmitted = a.submissions && a.submissions.length > 0;
    return !isPast(new Date(a.dueDate)) && !hasSubmitted;
  }).length;

  const submittedCount = assignments.filter((a: any) =>
    a.submissions && a.submissions.length > 0
  ).length;

  const gradedCount = assignments.filter((a: any) =>
    a.submissions && a.submissions.length > 0 && a.submissions[0].score !== null
  ).length;

  // Get assignment status
  const getAssignmentStatus = (assignment: any) => {
    const hasSubmitted = assignment.submissions && assignment.submissions.length > 0;
    const isOverdue = isPast(new Date(assignment.dueDate));

    if (hasSubmitted) {
      const submission = assignment.submissions[0];
      if (submission.score !== null) {
        return { status: 'graded', label: 'Noté', color: 'green' };
      }
      return { status: 'submitted', label: 'Soumis', color: 'blue' };
    }

    if (isOverdue) {
      return { status: 'overdue', label: 'En retard', color: 'red' };
    }

    const daysUntilDue = Math.ceil((new Date(assignment.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue <= 2) {
      return { status: 'urgent', label: 'Urgent', color: 'orange' };
    }

    return { status: 'pending', label: 'À faire', color: 'gray' };
  };

  // Get status badge
  const getStatusBadge = (assignment: any) => {
    const { status, label, color } = getAssignmentStatus(assignment);
    const variants: Record<string, any> = {
      graded: 'default',
      submitted: 'secondary',
      overdue: 'destructive',
      urgent: 'outline',
      pending: 'outline',
    };

    return (
      <Badge variant={variants[status]} className="text-xs">
        {label}
      </Badge>
    );
  };

  // Get urgent assignments (due within 3 days)
  const urgentAssignments = sortedAssignments.filter((a: any) => {
    const hasSubmitted = a.submissions && a.submissions.length > 0;
    if (hasSubmitted) return false;
    const daysUntilDue = Math.ceil((new Date(a.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue <= 3 && daysUntilDue >= 0;
  });

  // View assignment details
  const viewAssignment = (assignment: any) => {
    toast({
      title: assignment.title,
      description: `Date limite: ${format(new Date(assignment.dueDate), 'dd MMMM yyyy à HH:mm', { locale: fr })}`,
    });
  };

  const userName = user?.user_metadata
    ? `${user.user_metadata.firstName || ''} ${user.user_metadata.lastName || ''}`.trim()
    : profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : user?.email || 'Élève';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/student')}
                className="text-gray-600"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                <BookOpen className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900">
                  Devoirs
                </h1>
                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600">
                  {userName}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-2 sm:gap-3 md:gap-6 grid-cols-2 md:grid-cols-2 xl:grid-cols-4 mb-4 sm:mb-6">
          {/* En retard */}
          <Card className="relative overflow-hidden border-red-200 bg-gradient-to-br from-red-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-red-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                En retard
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-red-700 leading-tight">
                {overdueCount}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                Devoir{overdueCount > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          {/* À faire */}
          <Card className="relative overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-blue-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                À faire
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-blue-700 leading-tight">
                {pendingCount}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                En attente
              </p>
            </CardContent>
          </Card>

          {/* Soumis */}
          <Card className="relative overflow-hidden border-green-200 bg-gradient-to-br from-green-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-green-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Soumis
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-green-700 leading-tight">
                {submittedCount}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                Devoir{submittedCount > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          {/* Notés */}
          <Card className="relative overflow-hidden border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-purple-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Notés
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-purple-700 leading-tight">
                {gradedCount}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                Corrigé{gradedCount > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-4 sm:mb-6 border-border/60 bg-white/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
              {/* Année scolaire */}
              {academicYears.length > 0 && (
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-xs font-medium text-gray-700">Année scolaire</label>
                  <select
                    value={selectedYearId}
                    onChange={(e) => setSelectedYearId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm text-gray-700 focus:border-blue-500 focus:outline-none h-8 sm:h-9"
                  >
                    <option value="all">Toutes les années</option>
                    {academicYears.map((y: any) => (
                      <option key={y.id} value={y.id}>
                        {y.name}{(y.isCurrent || y.is_current) ? ' (actuelle)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subject Filter */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700">Matière</label>
                <SearchableSelect
                  options={subjects.map((subject: any) => ({ value: subject.id, label: subject.name }))}
                  value={selectedSubject}
                  onValueChange={setSelectedSubject}
                  placeholder="Toutes les matières"
                  searchPlaceholder="Rechercher une matière..."
                  allLabel="Toutes les matières"
                />
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700">Statut</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="pending">À faire</SelectItem>
                    <SelectItem value="overdue">En retard</SelectItem>
                    <SelectItem value="submitted">Soumis</SelectItem>
                    <SelectItem value="upcoming">À venir</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date limite spécifique */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Date limite
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs sm:text-sm text-gray-700 focus:border-blue-500 focus:outline-none h-8 sm:h-9"
                  />
                  {selectedDate && (
                    <button
                      onClick={() => setSelectedDate('')}
                      className="h-8 sm:h-9 px-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 text-xs"
                      title="Réinitialiser la date"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Sort By */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700">Trier par</label>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dueDate">Date limite</SelectItem>
                    <SelectItem value="postedDate">Date de publication</SelectItem>
                    <SelectItem value="subject">Matière</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:gap-4 md:gap-6 lg:grid-cols-1 xl:grid-cols-3">
          {/* Main Content - Assignments List */}
          <div className="xl:col-span-2 space-y-3 sm:space-y-4 md:space-y-6">
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <CardTitle className="text-sm sm:text-base">
                  Liste des devoirs ({sortedAssignments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {isLoadingAssignments ? (
                  <div className="py-12 text-center text-sm text-gray-500">
                    Chargement...
                  </div>
                ) : sortedAssignments.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-500">
                    <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    Aucun devoir trouvé
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {sortedAssignments.map((assignment: any) => {
                      const { status, color } = getAssignmentStatus(assignment);
                      const hasSubmitted = assignment.submissions && assignment.submissions.length > 0;
                      const isOverdue = isPast(new Date(assignment.dueDate));

                      return (
                        <div
                          key={assignment.id}
                          className={`rounded-lg border p-3 sm:p-4 hover:shadow-md transition-all cursor-pointer ${isOverdue && !hasSubmitted ? 'border-red-200 bg-red-50/50' :
                              status === 'urgent' ? 'border-orange-200 bg-orange-50/50' :
                                'hover:bg-gray-50'
                            }`}
                          onClick={() => viewAssignment(assignment)}
                        >
                          <div className="flex items-start justify-between gap-2 sm:gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                                <h3 className="font-semibold text-gray-900 text-xs sm:text-sm truncate">
                                  {assignment.title}
                                </h3>
                                {getStatusBadge(assignment)}
                              </div>

                              <p className="text-[10px] sm:text-xs text-gray-600 line-clamp-2 mb-2">
                                {assignment.description}
                              </p>

                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <BookOpen className="h-3 w-3" />
                                  {assignment.subject?.name || 'Matière'}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(assignment.dueDate), 'dd MMM yyyy', { locale: fr })}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(assignment.dueDate), 'HH:mm')}
                                </span>
                              </div>

                              {assignment.maxScore && (
                                <div className="mt-2 text-[10px] sm:text-xs text-gray-500">
                                  Barème: {assignment.maxScore} points
                                </div>
                              )}

                              {hasSubmitted && assignment.submissions[0].score !== null && (
                                <div className="mt-2 flex items-center gap-2">
                                  <Badge variant="default" className="text-xs">
                                    Note: {assignment.submissions[0].score}/{assignment.maxScore}
                                  </Badge>
                                </div>
                              )}

                              {assignment.files && assignment.files.length > 0 && (
                                <div className="mt-2 flex items-center gap-1 text-[10px] sm:text-xs text-gray-500">
                                  <Paperclip className="h-3 w-3" />
                                  {assignment.files.length} fichier{assignment.files.length > 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          </div>

                          {!hasSubmitted && (
                            <div className="mt-3 pt-3 border-t">
                              <Button
                                size="sm"
                                className="w-full text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast({
                                    title: "Soumettre un devoir",
                                    description: "La fonctionnalité de soumission sera bientôt disponible.",
                                  });
                                }}
                              >
                                <Upload className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">Soumettre</span>
                                <span className="sm:hidden">Soumettre</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Urgent Assignments */}
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Urgent Assignments */}
            {urgentAssignments.length > 0 && (
              <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white shadow-sm">
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-orange-900">
                    <AlertCircle className="h-4 w-4" />
                    Urgent
                  </CardTitle>
                  <p className="text-xs text-orange-700 mt-1">
                    {urgentAssignments.length} devoir{urgentAssignments.length > 1 ? 's' : ''} à faire
                  </p>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="space-y-2">
                    {urgentAssignments.slice(0, 5).map((assignment: any) => {
                      const daysUntilDue = Math.ceil(
                        (new Date(assignment.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                      );
                      return (
                        <div
                          key={assignment.id}
                          className="rounded-lg border border-orange-200 bg-white/60 p-2 sm:p-3 hover:bg-white/80 transition-colors cursor-pointer"
                          onClick={() => viewAssignment(assignment)}
                        >
                          <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">
                            {assignment.title}
                          </p>
                          <p className="text-[10px] sm:text-xs text-orange-700 mt-1">
                            {daysUntilDue === 0 ? "Aujourd'hui" :
                              daysUntilDue === 1 ? 'Demain' :
                                `Dans ${daysUntilDue} jours`}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                            {assignment.subject?.name}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tips */}
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <CardTitle className="text-sm sm:text-base">Conseils</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <ul className="space-y-2 text-[10px] sm:text-xs text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Soumettez vos devoirs avant la date limite pour éviter les pénalités</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Vérifiez les fichiers joints avant de commencer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Contactez votre professeur si vous avez des questions</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
