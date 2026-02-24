'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Filter,
  ArrowLeft,
  UserCheck,
  AlertTriangle,
  Info,
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
import { useAuthContext, useStudentAttendance } from '@novaconnect/data';
import { getStudentProfileSecure, getAcademicYearsSecure } from '@/actions/payment-actions';
import { format, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function StudentAttendancePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuthContext();

  // Get the student ID from profile
  const studentId = profile?.studentId || profile?.student?.id;
  const schoolId = profile?.schoolId || profile?.school?.id || user?.schoolId;

  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedDate, setSelectedDate] = useState<string>(''); // filtre date spécifique

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

  // Fetch attendance records
  const { data: rawRecords = [], isLoading: isLoadingAttendance } = useStudentAttendance(
    studentId || ''
  );

  // Map the raw records to the format expected by the page
  const attendanceRecords = rawRecords.map((record: any) => ({
    id: record.id,
    date: record.attendanceSession?.sessionDate,
    status: record.status,
    checkInTime: null, // Note: real check-in time logic here if needed
    comments: record.comment || record.justification,
    period: record.attendanceSession?.plannedSession ? {
      id: record.attendanceSession.plannedSession.id,
      name: `${record.attendanceSession.plannedSession.startTime.slice(0, 5)} - ${record.attendanceSession.plannedSession.endTime.slice(0, 5)}`,
    } : null,
    subject: record.attendanceSession?.plannedSession?.subjectName ? {
      name: record.attendanceSession.plannedSession.subjectName,
    } : null,
  }));

  // Get unique periods from attendance records
  const periods = attendanceRecords.reduce((acc: any[], record: any) => {
    if (record.period && !acc.find((p: any) => p.id === record.period.id)) {
      acc.push(record.period);
    }
    return acc;
  }, []);

  // Filter attendance records by month
  const filteredRecords = attendanceRecords.filter((record: any) => {
    if (!record.date) return false;
    const recordDate = new Date(record.date);
    const recordMonth = format(recordDate, 'yyyy-MM');
    const recordDateStr = record.date.split('T')[0];

    // Filtre par date spécifique (prioritaire sur le mois)
    if (selectedDate) {
      if (recordDateStr !== selectedDate) return false;
    } else {
      // Filtre par mois
      if (selectedMonth !== recordMonth) return false;
    }

    if (selectedPeriod !== 'all' && record.period?.id !== selectedPeriod) return false;
    return true;
  });

  // Calculate statistics
  const calculateStats = (records: any[]) => {
    const present = records.filter((r: any) => r.status === 'present').length;
    const absent = records.filter((r: any) => r.status === 'absent').length;
    const late = records.filter((r: any) => r.status === 'late').length;
    const excused = records.filter((r: any) => r.status === 'excused').length;
    const total = records.length;

    return {
      present,
      absent,
      late,
      excused,
      total,
      attendanceRate: total > 0 ? ((present + late) / total) * 100 : 100,
    };
  };

  const currentMonthStats = calculateStats(filteredRecords);
  const allTimeStats = calculateStats(attendanceRecords);

  // Get months for the filter (last 12 months)
  const getMonthsList = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      months.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy', { locale: fr }),
      });
    }
    return months;
  };

  // Get month name
  const getMonthName = (monthStr: string) => {
    const date = new Date(monthStr + '-01');
    return format(date, 'MMMM yyyy', { locale: fr });
  };

  // Get attendance history by month
  const getMonthlyHistory = () => {
    const monthMap = new Map();

    attendanceRecords.forEach((record: any) => {
      const monthKey = format(new Date(record.date), 'yyyy-MM');
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthKey,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0,
        });
      }

      const stats = monthMap.get(monthKey);
      stats.total++;
      if (record.status === 'present') stats.present++;
      else if (record.status === 'absent') stats.absent++;
      else if (record.status === 'late') stats.late++;
      else if (record.status === 'excused') stats.excused++;
    });

    return Array.from(monthMap.values())
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 6);
  };

  const monthlyHistory = getMonthlyHistory();

  // Get attendance status badge
  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      present: 'default',
      absent: 'destructive',
      late: 'secondary',
      excused: 'outline',
    };

    const labels: Record<string, string> = {
      present: 'Présent',
      absent: 'Absent',
      late: 'Retard',
      excused: 'Excusé',
    };

    return (
      <Badge variant={variants[status]} className="text-xs">
        {labels[status] || status}
      </Badge>
    );
  };

  // Get attendance rate color
  const getAttendanceRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-blue-600';
    if (rate >= 75) return 'text-orange-600';
    return 'text-red-600';
  };

  // Get attendance rate label
  const getAttendanceRateLabel = (rate: number) => {
    if (rate >= 95) return 'Excellent';
    if (rate >= 85) return 'Très bien';
    if (rate >= 75) return 'Bien';
    if (rate >= 60) return 'Satisfaisant';
    return 'À améliorer';
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
                <UserCheck className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900">
                  Présences
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
          {/* Taux de présence */}
          <Card className="relative overflow-hidden border-green-200 bg-gradient-to-br from-green-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-green-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Taux de présence
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className={`text-lg sm:text-xl md:text-3xl font-bold leading-tight ${getAttendanceRateColor(currentMonthStats.attendanceRate)}`}>
                {currentMonthStats.attendanceRate.toFixed(1)}%
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                {getMonthName(selectedMonth)}
              </p>
            </CardContent>
          </Card>

          {/* Présences */}
          <Card className="relative overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-blue-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Présences
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-blue-700 leading-tight">
                {currentMonthStats.present}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                sur {currentMonthStats.total} jours
              </p>
            </CardContent>
          </Card>

          {/* Absences */}
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
                {currentMonthStats.absent}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                ce mois
              </p>
            </CardContent>
          </Card>

          {/* Retards */}
          <Card className="relative overflow-hidden border-orange-200 bg-gradient-to-br from-orange-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-orange-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Retards
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-orange-700 leading-tight">
                {currentMonthStats.late}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                ce mois
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

              {/* Month Filter */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700">Mois</label>
                <SearchableSelect
                  options={getMonthsList().map((month) => ({ value: month.value, label: month.label }))}
                  value={selectedMonth}
                  onValueChange={(v) => { setSelectedMonth(v); setSelectedDate(''); }}
                  placeholder="Sélectionner un mois"
                  searchPlaceholder="Rechercher un mois..."
                  allLabel="Sélectionner un mois"
                />
              </div>

              {/* Date spécifique */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Date spécifique
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
                      title="Réinitialiser"
                    >
                      ×
                    </button>
                  )}
                </div>
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
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:gap-4 md:gap-6 lg:grid-cols-1 xl:grid-cols-3">
          {/* Main Content - Attendance Records */}
          <div className="xl:col-span-2 space-y-3 sm:space-y-4 md:space-y-6">
            {/* Current Month Summary */}
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base">
                    Résumé du mois - {getMonthName(selectedMonth)}
                  </CardTitle>
                  <Badge
                    variant={currentMonthStats.attendanceRate >= 85 ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {getAttendanceRateLabel(currentMonthStats.attendanceRate)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {/* Progress bars */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1">
                      <span className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        Présences
                      </span>
                      <span className="font-medium">{currentMonthStats.present}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{
                          width: `${currentMonthStats.total > 0 ? (currentMonthStats.present / currentMonthStats.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1">
                      <span className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        Absences
                      </span>
                      <span className="font-medium">{currentMonthStats.absent}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full transition-all"
                        style={{
                          width: `${currentMonthStats.total > 0 ? (currentMonthStats.absent / currentMonthStats.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1">
                      <span className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                        Retards
                      </span>
                      <span className="font-medium">{currentMonthStats.late}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all"
                        style={{
                          width: `${currentMonthStats.total > 0 ? (currentMonthStats.late / currentMonthStats.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1">
                      <span className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        Excusés
                      </span>
                      <span className="font-medium">{currentMonthStats.excused}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{
                          width: `${currentMonthStats.total > 0 ? (currentMonthStats.excused / currentMonthStats.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Records */}
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <CardTitle className="text-sm sm:text-base">
                  Détail des présences ({filteredRecords.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {isLoadingAttendance ? (
                  <div className="py-12 text-center text-sm text-gray-500">
                    Chargement...
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-500">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    Aucune donnée de présence pour ce mois
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredRecords.map((record: any) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between rounded-lg border p-2 sm:p-3 md:p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-gray-900 text-xs sm:text-sm">
                              {format(new Date(record.date), 'EEEE dd MMMM yyyy', { locale: fr })}
                            </p>
                            {getStatusBadge(record.status)}
                          </div>
                          <p className="text-[10px] sm:text-xs text-gray-500">
                            {record.subject?.name && `${record.subject?.name} • `}
                            {record.period?.name || 'Cours'}
                          </p>
                          {record.comments && (
                            <p className="text-[10px] sm:text-xs text-gray-600 mt-1 italic">
                              "{record.comments}"
                            </p>
                          )}
                        </div>
                        {record.checkInTime && (
                          <div className="text-right ml-2">
                            <p className="text-[10px] sm:text-xs text-gray-500">
                              Arrivée: {record.checkInTime}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Statistics & History */}
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Overall Statistics */}
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                <CardTitle className="text-sm sm:text-base">Statistiques globales</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 space-y-3">
                <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg">
                  <div className={`text-2xl sm:text-3xl font-bold ${getAttendanceRateColor(allTimeStats.attendanceRate)}`}>
                    {allTimeStats.attendanceRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Taux global de présence</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
                  <div className="bg-green-50 p-2 rounded-lg text-center">
                    <div className="font-semibold text-green-700">{allTimeStats.present}</div>
                    <div className="text-gray-600">Présences</div>
                  </div>
                  <div className="bg-red-50 p-2 rounded-lg text-center">
                    <div className="font-semibold text-red-700">{allTimeStats.absent}</div>
                    <div className="text-gray-600">Absences</div>
                  </div>
                  <div className="bg-orange-50 p-2 rounded-lg text-center">
                    <div className="font-semibold text-orange-700">{allTimeStats.late}</div>
                    <div className="text-gray-600">Retards</div>
                  </div>
                  <div className="bg-blue-50 p-2 rounded-lg text-center">
                    <div className="font-semibold text-blue-700">{allTimeStats.excused}</div>
                    <div className="text-gray-600">Excusés</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly History */}
            {monthlyHistory.length > 0 && (
              <Card className="border-border/60 bg-white/80 shadow-sm">
                <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base">Historique mensuel</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="space-y-2">
                    {monthlyHistory.map((monthData: any) => {
                      const rate = ((monthData.present + monthData.late) / monthData.total) * 100;
                      return (
                        <div
                          key={monthData.month}
                          className="flex items-center justify-between rounded-lg border p-2 hover:bg-gray-50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 text-xs truncate">
                              {getMonthName(monthData.month)}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {monthData.total} jours
                            </p>
                          </div>
                          <div className="text-right ml-2">
                            <p className={`text-sm font-semibold ${getAttendanceRateColor(rate)}`}>
                              {rate.toFixed(0)}%
                            </p>
                          </div>
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
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Informations
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <ul className="space-y-2 text-[10px] sm:text-xs text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Un taux de présence supérieur à 90% est recommandé</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span>Les retards répétitifs peuvent affecter votre apprentissage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Contactez l'administration en cas d'absence justifiée</span>
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
