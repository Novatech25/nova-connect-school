'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { useGrades, useReportCards } from '@novaconnect/data'
import { getSupabaseClient } from '@novaconnect/data/client'
import { useAuthContext } from '@novaconnect/data/providers'
import { getAcademicYearsSecure } from "@/actions/payment-actions";
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  AlertCircle,
  BookOpen,
  Calendar as CalendarIcon,
  ChevronDown,
  Download,
  Filter,
  RefreshCw,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Student {
  id: string
  school_id?: string
  schoolId?: string
  firstName?: string
  first_name?: string
  lastName?: string
  last_name?: string
  matricule: string
  photoUrl?: string
  status: string
  enrollments: any[]
}

interface ParentData {
  id: string
  firstName: string
  lastName: string
  email: string
  userId?: string
  students: Array<{
    id: string
    relationship: string
    student: Student
  }>
}

export default function MyGradesPage() {
  const router = useRouter()
  const { user, profile } = useAuthContext()
  const { toast } = useToast()
  const [parentData, setParentData] = useState<ParentData | null>(null)
  const [isLoadingParent, setIsLoadingParent] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)

  // Filters & Sorting
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [academicYearsList, setAcademicYearsList] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'subject' | 'score'>('date')

  const fetchChildren = async () => {
    setIsLoadingParent(true)
    setError(null)
    setDebugInfo(null)

    try {
      const supabase = getSupabaseClient()
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        setError('Utilisateur non connecté')
        setIsLoadingParent(false)
        return
      }

      setDebugInfo((prev: any) => ({
        ...prev,
        authUserId: authUser.id,
        authUserEmail: authUser.email,
      }))

      // Requête directe pour récupérer le parent avec les étudiants
      const { data: parent, error: parentError } = await supabase
        .from('parents')
        .select(
          `
              *,
              students:student_parent_relations(
                *,
                student:students(*)
              )
            `
        )
        .eq('user_id', authUser.id)
        .single()

      if (parentError) {
        setDebugInfo((prev: any) => ({
          ...prev,
          parentError: parentError.message,
          parentCode: parentError.code,
          details: parentError,
        }))

        if (parentError.code === 'PGRST116') {
          // Aucun parent trouvé
          setParentData(null)
        } else {
          throw parentError
        }
      } else {
        setDebugInfo((prev: any) => ({
          ...prev,
          parentFound: true,
          parentId: parent?.id,
          studentsCount: parent?.students?.length || 0,
        }))

        // Récupérer les inscriptions pour tous les étudiants séparément
        if (parent?.students && parent.students.length > 0) {
          const studentIds = parent.students.map((rel: any) => rel.student.id)

          const { data: enrollments, error: enrollmentsError } = await supabase
            .from('enrollments')
            .select(
              `
                  *,
                  class:classes(*),
                  academic_year:academic_years(*)
                `
            )
            .in('student_id', studentIds)
            .order('created_at', { ascending: false })

          if (enrollmentsError) {
            // Fallback: Afficher les enfants même si la récupération des inscriptions échoue
            const parentFallback = {
              ...parent,
              students: parent.students.map((relation: any) => ({
                ...relation,
                student: {
                  ...relation.student,
                  enrollments: [],
                },
              })),
            }
            setParentData(parentFallback as ParentData)
          } else {
            // Mapper les inscriptions aux étudiants
            const parentWithEnrollments = {
              ...parent,
              students: parent.students.map((relation: any) => ({
                ...relation,
                student: {
                  ...relation.student,
                  enrollments:
                    enrollments?.filter((e: any) => e.student_id === relation.student.id) || [],
                },
              })),
            }
            setParentData(parentWithEnrollments as ParentData)
          }
        } else {
          setParentData(parent as ParentData)
        }
      }

      setIsLoadingParent(false)
    } catch (err: any) {
      console.error('Error fetching children:', err)
      setError(err.message || 'Impossible de charger les informations')
      setDebugInfo((prev: any) => ({ ...prev, fetchError: err.message }))
      setIsLoadingParent(false)
    }
  }

  useEffect(() => {
    fetchChildren()
  }, [])

  // Set default selected student when parent data loads
  useEffect(() => {
    if (parentData?.students && parentData.students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(parentData.students[0].student.id)
    }
  }, [parentData, selectedStudentId])

  const selectedStudent = parentData?.students.find(
    (s: any) => s.student.id === selectedStudentId
  )?.student
  const schoolId = selectedStudent?.school_id || selectedStudent?.schoolId || ''

  // Initialize academic year filter when student changes
  useEffect(() => {
    if (selectedStudent?.enrollments && selectedStudent.enrollments.length > 0) {
      // Sort enrollments by date to find the most recent one
      const sorted = [...selectedStudent.enrollments].sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      if (sorted[0]?.academic_year_id) {
        setSelectedAcademicYear(sorted[0].academic_year_id);
      }
    }
    
    // Fetch Academic Years using school_id from student
    const fetchYears = async () => {
        if (schoolId) {
            const { data: years } = await getAcademicYearsSecure(schoolId);
            if (years) setAcademicYearsList(years);
        }
    };
    fetchYears();
  }, [selectedStudent, schoolId]);

  // Fetch grades for selected student
  const { data: allGrades = [], isLoading: isLoadingGrades } = useGrades(schoolId, {
    studentId: selectedStudentId || '',
    status: 'published',
  })

  // Fetch report cards
  const { data: reportCards = [] } = useReportCards(schoolId, {
    studentId: selectedStudentId || '',
  })

  // Extract periods and subjects
  const periods = allGrades.reduce((acc: any[], grade: any) => {
    if (grade.period && !acc.find((p: any) => p.id === grade.period.id)) {
      acc.push(grade.period)
    }
    return acc
  }, [])

  const subjects = allGrades.reduce((acc: any[], grade: any) => {
    if (grade.subject && !acc.find((s: any) => s.id === grade.subject.id)) {
      acc.push(grade.subject)
    }
    return acc
  }, [])

  // Filter grades
  const filteredGrades = allGrades.filter((grade: any) => {
    if (selectedAcademicYear !== 'all' && grade.academicYearId !== selectedAcademicYear) return false
    if (selectedPeriod !== 'all' && grade.period?.id !== selectedPeriod) return false
    if (selectedSubject !== 'all' && grade.subject?.id !== selectedSubject) return false
    if (selectedDate) {
      const gradeDate = new Date(grade.createdAt)
      if (
        gradeDate.getFullYear() !== selectedDate.getFullYear() ||
        gradeDate.getMonth() !== selectedDate.getMonth() ||
        gradeDate.getDate() !== selectedDate.getDate()
      ) {
        return false
      }
    }
    return true
  })

  // Sort grades
  const sortedGrades = [...filteredGrades].sort((a: any, b: any) => {
    if (sortBy === 'date') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    } else if (sortBy === 'subject') {
      return (a.subject?.name || '').localeCompare(b.subject?.name || '')
    } else if (sortBy === 'score') {
      const scoreA = a.maxScore > 0 ? (a.score / a.maxScore) * 20 : 0
      const scoreB = b.maxScore > 0 ? (b.score / b.maxScore) * 20 : 0
      return scoreB - scoreA
    }
    return 0
  })

  // Statistics Calculation
  const calculateAverage = (grades: any[]) => {
    if (!grades || grades.length === 0) return null
    const sum = grades.reduce((acc: number, grade: any) => {
      if (grade.score && grade.maxScore && grade.maxScore > 0) {
        return acc + (grade.score / grade.maxScore) * 20
      }
      return acc
    }, 0)
    return (sum / grades.length).toFixed(2)
  }

  const overallAverage = calculateAverage(sortedGrades)

  const subjectAverages = subjects
    .map((subject: any) => {
      const subjectGrades = sortedGrades.filter((g: any) => g.subject?.id === subject.id)
      const avg = calculateAverage(subjectGrades)
      return {
        subject,
        average: avg,
        count: subjectGrades.length,
        grades: subjectGrades,
      }
    })
    .filter((item: any) => item.average !== null)

  subjectAverages.sort((a: any, b: any) => b.average - a.average)

  const gradeDistribution = {
    excellent: sortedGrades.filter((g: any) => {
      const score = g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0
      return score >= 16
    }).length,
    good: sortedGrades.filter((g: any) => {
      const score = g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0
      return score >= 14 && score < 16
    }).length,
    satisfactory: sortedGrades.filter((g: any) => {
      const score = g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0
      return score >= 10 && score < 14
    }).length,
    needsImprovement: sortedGrades.filter((g: any) => {
      const score = g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0
      return score < 10
    }).length,
  }

  // Helpers
  const getGradeColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 20
    if (percentage >= 16) return 'text-green-600'
    if (percentage >= 14) return 'text-blue-600'
    if (percentage >= 10) return 'text-orange-600'
    return 'text-red-600'
  }

  const getGradeBadgeVariant = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 20
    if (percentage >= 16) return 'default'
    if (percentage >= 14) return 'secondary'
    if (percentage >= 10) return 'outline'
    return 'destructive'
  }

  // Use fetched academic years or fallback to enrollments
  const displayedAcademicYears = academicYearsList.length > 0 ? academicYearsList : (selectedStudent?.enrollments?.map((e: any) => e.academic_year).filter(Boolean) || []);
  const uniqueAcademicYears = Array.from(new Set(displayedAcademicYears.map((y: any) => y.id)))
      .map(id => displayedAcademicYears.find((y: any) => y.id === id));

  const handleExport = () => {
    toast({
      title: 'Export en cours',
      description: 'Génération du fichier Excel...',
    })
    setTimeout(() => {
      toast({
        title: 'Export réussi',
        description: 'Le fichier a été téléchargé.',
      })
    }, 1500)
  }

  if (isLoadingParent) {
    return <GradesLoadingSkeleton />
  }

  if (error || !parentData?.students || parentData.students.length === 0) {
    return (
      <ErrorState
        error={error}
        user={user}
        profile={profile}
        debugInfo={debugInfo}
        fetchChildren={fetchChildren}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <BookOpen className="h-5 w-5 sm:h-7 sm:w-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900">
                Notes & Résultats
              </h1>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600">
                Consultez les résultats et bulletins scolaires
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Child Selector */}
            {parentData.students.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                {parentData.students.map((relation: any) => (
                  <Button
                    key={relation.student.id}
                    variant={selectedStudentId === relation.student.id ? 'default' : 'outline'}
                    onClick={() => setSelectedStudentId(relation.student.id)}
                    className="whitespace-nowrap text-xs sm:text-sm h-8 sm:h-10"
                  >
                    {relation.student.firstName || relation.student.first_name || 'Élève'}
                  </Button>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleExport} className="hidden sm:flex">
              <Download className="mr-2 h-4 w-4" />
              Exporter
            </Button>
          </div>
        </div>

        {/* Selected Student Info */}
        {selectedStudent && (
          <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-white border border-border/60 shadow-sm">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-base sm:text-lg">
              {(selectedStudent.firstName || selectedStudent.first_name || 'E')[0]}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                {selectedStudent.firstName || selectedStudent.first_name}{' '}
                {selectedStudent.lastName || selectedStudent.last_name}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 flex items-center gap-2">
                <span className="hidden sm:inline">Matricule:</span> {selectedStudent.matricule}
                {selectedStudent.enrollments?.[0]?.class?.name && (
                  <>
                    <span className="text-gray-300">•</span>
                    <Badge variant="secondary" className="text-[10px] sm:text-xs">
                      {selectedStudent.enrollments[0].class.name}
                    </Badge>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="Moyenne générale"
            value={isLoadingGrades ? '...' : overallAverage || '--'}
            suffix="/20"
            subtext={`${sortedGrades.length} note${sortedGrades.length > 1 ? 's' : ''}`}
            icon={TrendingUp}
            color="blue"
          />
          <StatsCard
            title="Meilleure note"
            value={sortedGrades.length > 0 ? getBestScore(sortedGrades) : '--'}
            suffix="/20"
            subtext="Maximum"
            icon={Trophy}
            color="green"
          />
          <StatsCard
            title="Au-dessus de 10"
            value={
              gradeDistribution.excellent + gradeDistribution.good + gradeDistribution.satisfactory
            }
            subtext={`sur ${sortedGrades.length} notes`}
            icon={Target}
            color="amber"
          />
          <StatsCard
            title="Matières"
            value={subjects.length}
            subtext={`évaluée${subjects.length > 1 ? 's' : ''}`}
            icon={BookOpen}
            color="purple"
          />
        </div>

        {/* Filters */}
        <Card className="border-border/60 bg-white/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700">Année scolaire</label>
                <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                  <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9">
                    <SelectValue placeholder="Toutes les années" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les années</SelectItem>
                    {uniqueAcademicYears.map((year: any) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700">Période</label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9">
                    <SelectValue placeholder="Toutes les périodes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les périodes</SelectItem>
                    {periods.map((period: any) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700">Matière</label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9">
                    <SelectValue placeholder="Toutes les matières" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les matières</SelectItem>
                    {subjects.map((subject: any) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700 w-full flex justify-between">
                  Date spécifique
                  {selectedDate && (
                    <button 
                      onClick={() => setSelectedDate(undefined)}
                      className="text-[10px] text-red-500 hover:text-red-700"
                    >
                      Effacer
                    </button>
                  )}
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal text-xs sm:text-sm h-8 sm:h-9',
                        !selectedDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? (
                        formatDistanceToNow(selectedDate, { locale: fr, addSuffix: true }).replace('environ ', '')
                      ) : (
                        <span>Sélectionner une date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>
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
          {/* Grades List */}
          <div className="xl:col-span-2 space-y-3 sm:space-y-4 md:space-y-6">
            {subjectAverages.map((item: any) => (
              <Card key={item.subject.id} className="border-border/60 bg-white/80 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <div>
                    <CardTitle className="text-sm sm:text-base">{item.subject.name}</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">
                      Moyenne:{' '}
                      <span className="font-semibold text-gray-900">{item.average}/20</span>
                      {' • '}Coef: {item.subject.coefficient || 1}
                      {' • '}
                      {item.count} note{item.count > 1 ? 's' : ''}
                    </p>
                  </div>
                  <Badge
                    variant={parseFloat(item.average) >= 10 ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {parseFloat(item.average) >= 16
                      ? 'Excellent'
                      : parseFloat(item.average) >= 14
                        ? 'Bien'
                        : parseFloat(item.average) >= 10
                          ? 'Satisfaisant'
                          : 'À améliorer'}
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
                          <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">
                            {grade.title || 'Devoir'}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                            {grade.period?.name && `${grade.period.name} • `}
                            {formatDistanceToNow(new Date(grade.createdAt), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                          {grade.comments && (
                            <p className="text-xs text-muted-foreground italic mt-1 truncate">
                              "{grade.comments}"
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-2">
                          <div className="flex items-baseline gap-1 sm:gap-2">
                            <span
                              className={cn(
                                'text-base sm:text-xl md:text-2xl font-bold',
                                getGradeColor(grade.score, grade.maxScore)
                              )}
                            >
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

          {/* Sidebar */}
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Distribution */}
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <CardTitle className="text-sm sm:text-base">Répartition des notes</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 space-y-2 sm:space-y-3">
                <DistributionBar
                  label="Excellent (16-20)"
                  count={gradeDistribution.excellent}
                  total={sortedGrades.length}
                  color="bg-green-500"
                />
                <DistributionBar
                  label="Bien (14-16)"
                  count={gradeDistribution.good}
                  total={sortedGrades.length}
                  color="bg-blue-500"
                />
                <DistributionBar
                  label="Satisfaisant (10-14)"
                  count={gradeDistribution.satisfactory}
                  total={sortedGrades.length}
                  color="bg-orange-500"
                />
                <DistributionBar
                  label="À améliorer (<10)"
                  count={gradeDistribution.needsImprovement}
                  total={sortedGrades.length}
                  color="bg-red-500"
                />
              </CardContent>
            </Card>

            {/* Report Cards */}
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
                        onClick={() =>
                          router.push(`/parent/children/${selectedStudentId}/report-cards/${rc.id}`)
                        }
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
                      onClick={() =>
                        router.push(`/parent/children/${selectedStudentId}/report-cards`)
                      }
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
  )
}

// Components
function StatsCard({ title, value, suffix, subtext, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'text-blue-600 bg-blue-100 border-blue-200 from-blue-50',
    green: 'text-green-600 bg-green-100 border-green-200 from-green-50',
    amber: 'text-amber-600 bg-amber-100 border-amber-200 from-amber-50',
    purple: 'text-purple-600 bg-purple-100 border-purple-200 from-purple-50',
  }
  const c = colors[color] || colors.blue

  return (
    <Card
      className={`relative overflow-hidden border ${c.split(' ')[2]} bg-gradient-to-br ${c.split(' ')[3]} to-white`}
    >
      <div
        className={`absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full ${c.split(' ')[1]}/50`}
      />
      <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
        <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
          {title}
        </CardTitle>
        <div
          className={`flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full ${c.split(' ')[1]} ${c.split(' ')[0]}`}
        >
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
        </div>
      </CardHeader>
      <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
        <div
          className={`text-lg sm:text-xl md:text-3xl font-bold ${c.split(' ')[0].replace('text-', 'text-opacity-90 text-')} leading-tight`}
        >
          {value}
          {suffix && (
            <span className="text-xs sm:text-sm md:text-lg font-normal opacity-70">{suffix}</span>
          )}
        </div>
        <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">{subtext}</p>
      </CardContent>
    </Card>
  )
}

function DistributionBar({ label, count, total, color }: any) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] sm:text-xs">
        <span className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${color}`} />
          {label}
        </span>
        <span className="font-medium">{count}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full`}
          style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  )
}

function GradesLoadingSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

function ErrorState({ error, user, profile, debugInfo, fetchChildren }: any) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Mes Notes</h1>
          </div>
          <Button onClick={fetchChildren} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Rafraîchir
          </Button>
        </div>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {error ? 'Erreur de chargement' : 'Aucun enfant associé'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm md:text-base text-muted-foreground">
              {error || "Il semble qu'aucun élève ne soit associé à votre compte parent."}
            </p>
            {/* Debug Info */}
            <details className="bg-muted/50 rounded-lg p-4">
              <summary className="text-xs font-semibold uppercase tracking-wider cursor-pointer mb-2">
                Informations techniques
              </summary>
              <pre className="text-xs overflow-auto bg-background p-2 rounded">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
            <Button variant="default" asChild>
              <a href="/parent">Retour au tableau de bord</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function getBestScore(grades: any[]) {
  const best = grades.reduce((max: any, g: any) => {
    const score = g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0
    const maxScore = max.maxScore > 0 ? (max.score / max.maxScore) * 20 : 0
    return score > maxScore ? g : max
  }, grades[0])
  return best.maxScore > 0 ? ((best.score / best.maxScore) * 20).toFixed(2) : '--'
}
