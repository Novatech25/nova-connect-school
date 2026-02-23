'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  BookOpen,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Bell,
  FileText,
  GraduationCap,
  User,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  useAuthContext,
  useGrades,
  useReportCards,
  useSchedule,
  useAttendance,
  usePayments,
  useNotifications,
  useAssignments,
  useSchool,
} from '@novaconnect/data';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function StudentDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuthContext();

  // Get the student ID from profile
  const studentId = profile?.studentId || profile?.student?.id;
  const schoolId = profile?.schoolId || profile?.school?.id || user?.schoolId;

  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch student's grades (only published)
  const { data: grades = [], isLoading: isLoadingGrades } = useGrades(schoolId || '', {
    studentId,
    status: 'published',
  });

  // Fetch report cards
  const { data: reportCards = [], isLoading: isLoadingReportCards } = useReportCards(schoolId || '', {
    studentId,
  });

  // Fetch today's schedule
  const { data: scheduleEntries = [] } = useSchedule(schoolId || '', {
    startDate: currentDate.toISOString().split('T')[0],
    endDate: currentDate.toISOString().split('T')[0],
  });

  // Fetch attendance
  const { data: attendanceRecords = [] } = useAttendance(schoolId || '', {
    studentId,
  });

  // Fetch payments
  const { data: payments = [] } = usePayments(schoolId || '', {
    studentId,
  });

  // Fetch notifications
  const { data: notifications = [] } = useNotifications(user?.id || '', {
    limit: 5,
    unreadOnly: false,
  });

  // Fetch assignments
  const { data: assignments = [] } = useAssignments(schoolId || '', {
    studentId,
  });

  // Calculate average from grades
  const calculateAverage = () => {
    if (!grades || grades.length === 0) return '--';
    const sum = grades.reduce((acc: number, grade: any) => {
      if (grade.score && grade.maxScore && grade.maxScore > 0) {
        return acc + (grade.score / grade.maxScore) * 20;
      }
      return acc;
    }, 0);
    return (sum / grades.length).toFixed(2);
  };

  // Get pending assignments count
  const pendingAssignments = assignments?.filter((a: any) =>
    !a.submissions || a.submissions.length === 0
  ).length || 0;

  // Get this month's absences
  const thisMonthAbsences = attendanceRecords?.filter((a: any) => {
    const recordDate = new Date(a.date);
    const now = new Date();
    return (
      recordDate.getMonth() === now.getMonth() &&
      recordDate.getFullYear() === now.getFullYear() &&
      a.status === 'absent'
    );
  }).length || 0;

  // Get payment status
  const getPaymentStatus = () => {
    if (!payments || payments.length === 0) return { status: 'unknown', label: 'Non renseigné', color: 'gray' };
    const latestPayment = payments[0];
    if (latestPayment.status === 'paid') {
      return { status: 'ok', label: 'À jour', color: 'green' };
    } else if (latestPayment.status === 'partial') {
      return { status: 'warning', label: 'Partiel', color: 'yellow' };
    } else {
      return { status: 'blocked', label: 'En retard', color: 'red' };
    }
  };

  const paymentStatus = getPaymentStatus();

  // Get today's classes
  const todayClasses = scheduleEntries?.filter((entry: any) => {
    const entryDate = new Date(entry.date);
    return entryDate.toDateString() === currentDate.toDateString();
  }) || [];

  // Recent grades (last 5)
  const recentGrades = grades
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Published report cards
  const publishedReportCards = reportCards?.filter((rc: any) => rc.status === 'published') || [];

  // Unread notifications count
  const unreadCount = notifications?.filter((n: any) => !n.readAt).length || 0;

  const { school } = useSchool(schoolId || '');

  const userName =
    (profile?.first_name && profile?.last_name)
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : (profile?.firstName && profile?.lastName)
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : user?.user_metadata?.firstName
      ? `${user.user_metadata.firstName || ''} ${user.user_metadata.lastName || ''}`.trim()
      : user?.email?.split('@')[0] || 'Élève';

  const schoolName = school?.name || profile?.school?.name || '';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                <GraduationCap className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div>
                <p className="text-xs font-medium text-indigo-600 uppercase tracking-widest">
                  {getGreeting()}
                </p>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900">
                  {userName} 👋
                </h1>
                {schoolName && (
                  <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
                    {schoolName}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/student/notifications')}
              className="relative text-xs sm:text-sm"
            >
              <Bell className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Notifications</span>
              {unreadCount > 0 && (
                <Badge className="ml-1.5 sm:ml-2 h-4 sm:h-5 px-1 sm:px-1.5 text-xs" variant="destructive">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            {currentDate.toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-2 sm:gap-3 md:gap-6 grid-cols-2 md:grid-cols-2 xl:grid-cols-4 mb-3 sm:mb-4 md:mb-6">
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
                {isLoadingGrades ? '...' : calculateAverage()}
                <span className="text-xs sm:text-sm md:text-lg font-normal text-blue-600">/20</span>
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                {grades.length} note{grades.length > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          {/* Devoirs à faire */}
          <Card className="relative overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-amber-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Devoirs
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-amber-700 leading-tight">
                {pendingAssignments}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                {pendingAssignments > 1 ? 'Devoirs' : 'Devoir'}
              </p>
            </CardContent>
          </Card>

          {/* Absences ce mois */}
          <Card className="relative overflow-hidden border-red-200 bg-gradient-to-br from-red-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-red-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Absences
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-red-700 leading-tight">
                {thisMonthAbsences}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                {thisMonthAbsences > 1 ? 'Jours' : 'Jour'}
              </p>
            </CardContent>
          </Card>

          {/* Statut paiement */}
          <Card className="relative overflow-hidden border-gray-200 bg-gradient-to-br from-gray-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-gray-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Paiement
              </CardTitle>
              <div className={`flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full ${
                paymentStatus.status === 'ok' ? 'bg-green-100 text-green-600' :
                paymentStatus.status === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                'bg-red-100 text-red-600'
              }`}>
                {paymentStatus.status === 'ok' ? (
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                ) : paymentStatus.status === 'warning' ? (
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                )}
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className={`text-sm sm:text-base md:text-3xl font-bold leading-tight ${
                paymentStatus.status === 'ok' ? 'text-green-700' :
                paymentStatus.status === 'warning' ? 'text-yellow-700' :
                'text-red-700'
              }`}>
                {paymentStatus.label}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                Scolarité
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 sm:gap-4 md:gap-6 lg:grid-cols-1 xl:grid-cols-3">
          {/* Main Content - 2 columns */}
          <div className="xl:col-span-2 space-y-3 sm:space-y-4 md:space-y-6">
            {/* Dernières notes */}
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <CardTitle className="text-sm sm:text-base">Dernières notes</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/student/grades')}
                  className="text-primary text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                >
                  <span className="hidden sm:inline">Voir tout</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {isLoadingGrades ? (
                  <div className="py-4 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                    Chargement...
                  </div>
                ) : grades.length === 0 ? (
                  <div className="py-4 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                    Aucune note disponible
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {recentGrades.map((grade: any) => (
                      <div
                        key={grade.id}
                        className="flex items-center justify-between rounded-lg border p-2 sm:p-3 md:p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">{grade.subject?.name || 'Matière'}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                            {grade.title || 'Devoir'}
                            {grade.period && ` • ${grade.period.name}`}
                          </p>
                        </div>
                        <div className="text-right ml-2">
                          <div className="flex items-baseline gap-1 sm:gap-2">
                            <span className="text-base sm:text-xl md:text-2xl font-bold text-gray-900">
                              {grade.score}/{grade.maxScore}
                            </span>
                            <Badge
                              variant={grade.score >= grade.maxScore * 0.5 ? 'default' : 'destructive'}
                              className="text-[10px] sm:text-xs"
                            >
                              {grade.maxScore > 0
                                ? ((grade.score / grade.maxScore) * 20).toFixed(2)
                                : '--'}
                              /20
                            </Badge>
                          </div>
                          <p className="mt-0.5 sm:mt-1 text-[9px] sm:text-xs text-gray-500 hidden sm:block">
                            {formatDistanceToNow(new Date(grade.createdAt), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Emploi du temps du jour */}
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <CardTitle className="text-sm sm:text-base">Emploi du temps du jour</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/student/schedule')}
                  className="text-primary text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                >
                  <span className="hidden sm:inline">Voir tout</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {todayClasses.length === 0 ? (
                  <div className="py-4 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                    Aucun cours aujourd'hui
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {todayClasses.map((entry: any, index: number) => (
                      <div
                        key={entry.id || index}
                        className="flex items-center gap-2 sm:gap-3 md:gap-4 rounded-lg border p-2 sm:p-3 md:p-4"
                      >
                        <div className="flex h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 flex-shrink-0">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">
                            {entry.subject?.name || 'Cours'}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                            {entry.room?.name || 'Salle'} • {entry.teacher?.firstName} {entry.teacher?.lastName}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs sm:text-sm font-medium text-gray-900">
                            {entry.startTime}
                          </p>
                          <p className="text-[9px] sm:text-xs text-gray-500 hidden sm:block">
                            {entry.endTime}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bulletins disponibles */}
            {publishedReportCards.length > 0 && (
              <Card className="border-border/60 bg-white/80 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base">Mes bulletins</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/student/report-cards')}
                    className="text-primary text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                  >
                    <span className="hidden sm:inline">Voir tout</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2">
                    {publishedReportCards.slice(0, 4).map((rc: any) => (
                      <div
                        key={rc.id}
                        className="flex items-center justify-between rounded-lg border p-2 sm:p-3 md:p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/student/report-cards/${rc.id}`)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">
                            {rc.period?.name}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                            {rc.overallAverage}/20 • Rang : {rc.rankInClass}/{rc.classSize}
                          </p>
                          {rc.mention && (
                            <Badge variant="outline" className="mt-1 text-[9px] sm:text-xs hidden sm:inline-block">
                              {rc.mention}
                            </Badge>
                          )}
                        </div>
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0 ml-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Notifications */}
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Notifications récentes */}
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <CardTitle className="text-sm sm:text-base">Notifications</CardTitle>
                <Badge variant={unreadCount > 0 ? 'default' : 'secondary'} className="text-xs">
                  {unreadCount}
                </Badge>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {notifications.length === 0 ? (
                  <div className="py-4 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                    Aucune notification
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {notifications.slice(0, 5).map((notification: any) => (
                      <div
                        key={notification.id}
                        className={`rounded-lg border p-2 sm:p-3 cursor-pointer transition-colors ${
                          !notification.readAt ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => router.push('/student/notifications')}
                      >
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full mt-1 sm:mt-2 flex-shrink-0 ${
                            !notification.readAt ? 'bg-blue-500' : 'bg-gray-300'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                              {notification.title}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-600 line-clamp-2">
                              {notification.body}
                            </p>
                            <p className="mt-1 text-[9px] sm:text-xs text-gray-500">
                              {formatDistanceToNow(new Date(notification.createdAt || notification.sentAt), {
                                addSuffix: true,
                                locale: fr,
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions rapides */}
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <CardTitle className="text-sm sm:text-base">Accès rapide</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 space-y-1.5 sm:space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                  onClick={() => router.push('/student/grades')}
                >
                  <TrendingUp className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Voir mes </span>notes
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                  onClick={() => router.push('/student/homework')}
                >
                  <BookOpen className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Mes </span>devoirs
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                  onClick={() => router.push('/student/attendance')}
                >
                  <Calendar className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Présences
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
                  onClick={() => router.push('/student/profile')}
                >
                  <User className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Mon profil
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
