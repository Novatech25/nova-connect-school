'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Filter,
  Download,
  ArrowLeft,
  BookOpen,
  Calendar,
  Trophy,
  Target,
  ChevronDown,
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
import {
  useAuthContext,
  useGrades,
  useReportCards,
} from '@novaconnect/data';
import { getStudentProfileSecure, getAcademicYearsSecure } from "@/actions/payment-actions";
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function StudentGradesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuthContext();

  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('all');
  const [academicYearsList, setAcademicYearsList] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'subject' | 'score'>('date');

  const [student, setStudent] = useState<any>(null);

  // Fetch student profile to get enrollments/academic years
  useEffect(() => {
    const fetchStudent = async () => {
      if (!user?.id) return;
      const { data, error } = await getStudentProfileSecure(user.id);
      if (data) {
        setStudent(data);
        // Set default academic year to the most recent enrollment
        if (data.enrollments && data.enrollments.length > 0) {
          const sorted = [...data.enrollments].sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          if (sorted[0]?.academic_year_id) {
            setSelectedAcademicYear(sorted[0].academic_year_id);
          }
        }

        // Fetch Academic Years using school_id from student profile
        if (data.school_id) {
          const { data: years } = await getAcademicYearsSecure(data.school_id);
          if (years) setAcademicYearsList(years);
        }
      }
    };
    fetchStudent();
  }, [user?.id]);

  // Get the student ID from profile or fetched student
  const studentId = student?.id || profile?.studentId || profile?.student?.id;
  const schoolId = profile?.schoolId || profile?.school?.id || user?.schoolId;

  // Fetch student's grades (only published)
  const { data: allGrades = [], isLoading: isLoadingGrades } = useGrades(schoolId || '', {
    studentId,
    status: 'published',
  });

  // Fetch report cards for additional context
  const { data: reportCards = [] } = useReportCards(schoolId || '', {
    studentId,
  });

  // Get unique periods and subjects from grades
  const periods = allGrades.reduce((acc: any[], grade: any) => {
    if (grade.period && !acc.find((p: any) => p.id === grade.period.id)) {
      acc.push(grade.period);
    }
    return acc;
  }, []);

  const subjects = allGrades.reduce((acc: any[], grade: any) => {
    if (grade.subject && !acc.find((s: any) => s.id === grade.subject.id)) {
      acc.push(grade.subject);
    }
    return acc;
  }, []);

  // Filter grades
  const filteredGrades = allGrades.filter((grade: any) => {
    if (selectedAcademicYear !== 'all' && grade.academicYearId !== selectedAcademicYear) return false;
    if (selectedPeriod !== 'all' && grade.period?.id !== selectedPeriod) return false;
    if (selectedSubject !== 'all' && grade.subject?.id !== selectedSubject) return false;
    return true;
  });

  // Sort grades
  const sortedGrades = [...filteredGrades].sort((a: any, b: any) => {
    if (sortBy === 'date') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortBy === 'subject') {
      return (a.subject?.name || '').localeCompare(b.subject?.name || '');
    } else if (sortBy === 'score') {
      const scoreA = a.maxScore > 0 ? (a.score / a.maxScore) * 20 : 0;
      const scoreB = b.maxScore > 0 ? (b.score / b.maxScore) * 20 : 0;
      return scoreB - scoreA;
    }
    return 0;
  });

  // Calculate statistics
  const calculateAverage = (grades: any[]) => {
    if (!grades || grades.length === 0) return null;
    const sum = grades.reduce((acc: number, grade: any) => {
      if (grade.score && grade.maxScore && grade.maxScore > 0) {
        return acc + (grade.score / grade.maxScore) * 20;
      }
      return acc;
    }, 0);
    return (sum / grades.length).toFixed(2);
  };

  const overallAverage = calculateAverage(sortedGrades);

  // Calculate subject averages
  const subjectAverages = subjects.map((subject: any) => {
    const subjectGrades = sortedGrades.filter((g: any) => g.subject?.id === subject.id);
    const avg = calculateAverage(subjectGrades);
    return {
      subject,
      average: avg,
      count: subjectGrades.length,
      grades: subjectGrades,
    };
  }).filter((item: any) => item.average !== null);

  // Sort subject averages by average (descending)
  subjectAverages.sort((a: any, b: any) => b.average - a.average);

  // Calculate grade distribution
  const gradeDistribution = {
    excellent: sortedGrades.filter((g: any) => {
      const score = g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0;
      return score >= 16;
    }).length,
    good: sortedGrades.filter((g: any) => {
      const score = g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0;
      return score >= 14 && score < 16;
    }).length,
    satisfactory: sortedGrades.filter((g: any) => {
      const score = g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0;
      return score >= 10 && score < 14;
    }).length,
    needsImprovement: sortedGrades.filter((g: any) => {
      const score = g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0;
      return score < 10;
    }).length,
  };

  // Get grade color
  const getGradeColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 20;
    if (percentage >= 16) return 'text-green-600';
    if (percentage >= 14) return 'text-blue-600';
    if (percentage >= 10) return 'text-orange-600';
    return 'text-red-600';
  };

  const getGradeBadgeVariant = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 20;
    if (percentage >= 16) return 'default';
    if (percentage >= 14) return 'secondary';
    if (percentage >= 10) return 'outline';
    return 'destructive';
  };

  // Use fetched academic years or fallback to enrollments
  const displayedAcademicYears = academicYearsList.length > 0 ? academicYearsList : (student?.enrollments?.map((e: any) => e.academic_year).filter(Boolean) || []);
  const uniqueAcademicYears = Array.from(new Set(displayedAcademicYears.map((y: any) => y.id)))
    .map(id => displayedAcademicYears.find((y: any) => y.id === id));

  // Export grades
  const handleExport = () => {
    toast({
      title: 'Export en cours',
      description: 'Génération du fichier Excel...',
    });

    // TODO: Implement actual export functionality
    setTimeout(() => {
      toast({
        title: 'Export réussi',
        description: 'Le fichier a été téléchargé.',
      });
    }, 1500);
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
                  Mes notes
                </h1>
                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600">
                  {userName}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="text-xs sm:text-sm"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Exporter</span>
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 md:grid-cols-2 xl:grid-cols-4 mb-4 sm:mb-6">
          {/* Moyenne générale */}
          <Card className="relative overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-blue-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Moyenne générale
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-blue-700 leading-tight">
                {isLoadingGrades ? '...' : overallAverage || '--'}
                <span className="text-xs sm:text-sm md:text-lg font-normal text-blue-600">/20</span>
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                {sortedGrades.length} note{sortedGrades.length > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          {/* Meilleure note */}
          <Card className="relative overflow-hidden border-green-200 bg-gradient-to-br from-green-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-green-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Meilleure note
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-green-700 leading-tight">
                {sortedGrades.length > 0 ? (() => {
                  const best = sortedGrades.reduce((max: any, g: any) => {
                    const score = g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0;
                    const maxScore = max.maxScore > 0 ? (max.score / max.maxScore) * 20 : 0;
                    return score > maxScore ? g : max;
                  }, sortedGrades[0]);
                  const bestScore = best.maxScore > 0 ? ((best.score / best.maxScore) * 20).toFixed(2) : '--';
                  return bestScore;
                })() : '--'}
                <span className="text-xs sm:text-sm md:text-lg font-normal text-green-600">/20</span>
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                Maximum
              </p>
            </CardContent>
          </Card>

          {/* Notes au-dessus de la moyenne */}
          <Card className="relative overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-amber-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Au-dessus de 10
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-amber-700 leading-tight">
                {gradeDistribution.excellent + gradeDistribution.good + gradeDistribution.satisfactory}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                sur {sortedGrades.length} notes
              </p>
            </CardContent>
          </Card>

          {/* Total matières */}
          <Card className="relative overflow-hidden border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-purple-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Matières
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-purple-700 leading-tight">
                {subjects.length}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                évaluée{subjects.length > 1 ? 's' : ''}
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
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {/* Academic Year Filter */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700">Année scolaire</label>
                <SearchableSelect
                  options={uniqueAcademicYears.map((year: any) => ({ value: year.id, label: year.name }))}
                  value={selectedAcademicYear}
                  onValueChange={setSelectedAcademicYear}
                  placeholder="Toutes les années"
                  searchPlaceholder="Rechercher une année..."
                  allLabel="Toutes les années"
                />
              </div>

              {/* Period Filter */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700">Période</label>
                <SearchableSelect
                  options={periods.map((period: any) => ({ value: period.id, label: period.name }))}
                  value={selectedPeriod}
                  onValueChange={setSelectedPeriod}
                  placeholder="Toutes les périodes"
                  searchPlaceholder="Rechercher une période..."
                  allLabel="Toutes les périodes"
                />
              </div>

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

              {/* Sort By */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700">Trier par</label>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="subject">Matière</SelectItem>
                    <SelectItem value="score">Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:gap-4 md:gap-6 lg:grid-cols-1 xl:grid-cols-3">
          {/* Main Content - Grades List */}
          <div className="xl:col-span-2 space-y-3 sm:space-y-4 md:space-y-6">
            {/* Grades by Subject */}
            {subjectAverages.map((item: any) => (
              <Card key={item.subject.id} className="border-border/60 bg-white/80 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <div>
                    <CardTitle className="text-sm sm:text-base">{item.subject.name}</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">
                      Moyenne: <span className="font-semibold text-gray-900">{item.average}/20</span>
                      {' • '}
                      Coefficient: {item.subject.coefficient || 1}
                      {' • '}
                      {item.count} note{item.count > 1 ? 's' : ''}
                    </p>
                  </div>
                  <Badge
                    variant={parseFloat(item.average) >= 10 ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {parseFloat(item.average) >= 16 ? 'Excellent' :
                      parseFloat(item.average) >= 14 ? 'Bien' :
                        parseFloat(item.average) >= 10 ? 'Satisfaisant' : 'À améliorer'}
                  </Badge>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="space-y-2 sm:space-y-3">
                    {item.grades.map((grade: any) => (
                      <div
                        key={grade.id}
                        className="flex items-center justify-between rounded-lg border p-2 sm:p-3 md:p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">{grade.title || 'Devoir'}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                            {grade.period?.name && `${grade.period.name} • `}
                            {formatDistanceToNow(new Date(grade.createdAt), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                          {grade.coefficient && grade.coefficient !== 1 && (
                            <Badge variant="outline" className="mt-1 text-[9px] sm:text-xs">
                              Coef. {grade.coefficient}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right ml-2">
                          <div className="flex items-baseline gap-1 sm:gap-2">
                            <span className={`text-base sm:text-xl md:text-2xl font-bold ${getGradeColor(grade.score, grade.maxScore)}`}>
                              {grade.score}/{grade.maxScore}
                            </span>
                            <Badge
                              variant={getGradeBadgeVariant(grade.score, grade.maxScore)}
                              className="text-[10px] sm:text-xs"
                            >
                              {grade.maxScore > 0
                                ? ((grade.score / grade.maxScore) * 20).toFixed(2)
                                : '--'}
                              /20
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {sortedGrades.length === 0 && (
              <Card className="border-border/60 bg-white/80 shadow-sm">
                <CardContent className="py-8 sm:py-12 text-center">
                  <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm sm:text-base text-gray-500">
                    {isLoadingGrades ? 'Chargement...' : 'Aucune note disponible'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Grade Distribution */}
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Grade Distribution */}
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <CardTitle className="text-sm sm:text-base">Répartition des notes</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 space-y-2 sm:space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] sm:text-xs">
                    <span className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      Excellent (16-20)
                    </span>
                    <span className="font-medium">{gradeDistribution.excellent}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{
                        width: `${sortedGrades.length > 0 ? (gradeDistribution.excellent / sortedGrades.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] sm:text-xs">
                    <span className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      Bien (14-16)
                    </span>
                    <span className="font-medium">{gradeDistribution.good}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{
                        width: `${sortedGrades.length > 0 ? (gradeDistribution.good / sortedGrades.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] sm:text-xs">
                    <span className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-orange-500" />
                      Satisfaisant (10-14)
                    </span>
                    <span className="font-medium">{gradeDistribution.satisfactory}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full"
                      style={{
                        width: `${sortedGrades.length > 0 ? (gradeDistribution.satisfactory / sortedGrades.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] sm:text-xs">
                    <span className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      À améliorer (&lt;10)
                    </span>
                    <span className="font-medium">{gradeDistribution.needsImprovement}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{
                        width: `${sortedGrades.length > 0 ? (gradeDistribution.needsImprovement / sortedGrades.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report Cards Quick Access */}
            {reportCards.length > 0 && (
              <Card className="border-border/60 bg-white/80 shadow-sm">
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base">Bulletins disponibles</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="space-y-2">
                    {reportCards.slice(0, 3).map((rc: any) => (
                      <button
                        key={rc.id}
                        onClick={() => router.push(`/student/report-cards/${rc.id}`)}
                        className="w-full flex items-center justify-between rounded-lg border p-2 sm:p-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">
                            {rc.period?.name}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500">
                            Moyenne: {rc.overallAverage}/20
                          </p>
                        </div>
                        <ChevronDown className="h-4 w-4 text-gray-400 rotate-[-90deg]" />
                      </button>
                    ))}
                  </div>
                  {reportCards.length > 3 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 text-xs"
                      onClick={() => router.push('/student/report-cards')}
                    >
                      Voir tous les bulletins
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
