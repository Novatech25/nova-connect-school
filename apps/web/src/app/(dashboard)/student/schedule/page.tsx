'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowLeft,
  BookOpen,
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
import { useAuthContext, usePlannedSessions } from '@novaconnect/data';
import { getStudentProfileSecure, getAcademicYearsSecure } from '@/actions/payment-actions';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function StudentSchedulePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuthContext();

  // Get the student ID from profile
  const studentId = profile?.studentId || profile?.student?.id;
  const schoolId = profile?.schoolId || profile?.school?.id || user?.schoolId;

  // View mode: day or week
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch schedule for the week
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday

  // Fetch planned sessions for this student's school
  // RLS will filter to only show sessions for the student's class
  const { data: scheduleEntries = [], isLoading: isLoadingSchedule } = usePlannedSessions(
    schoolId || '',
    {
      startDate: format(weekStart, 'yyyy-MM-dd'),
      endDate: format(weekEnd, 'yyyy-MM-dd'),
      isCancelled: false,
    }
  );

  // Get unique subjects and teachers for filtering
  const subjects = scheduleEntries.reduce((acc: any[], entry: any) => {
    if (entry.subject && !acc.find((s: any) => s.id === entry.subject.id)) {
      acc.push(entry.subject);
    }
    return acc;
  }, []);

  const teachers = scheduleEntries.reduce((acc: any[], entry: any) => {
    if (entry.teacher && !acc.find((t: any) => t.id === entry.teacher.id)) {
      acc.push(entry.teacher);
    }
    return acc;
  }, []);

  // Filters
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');

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

  // Filter schedule entries
  const filteredEntries = scheduleEntries.filter((entry: any) => {
    if (selectedSubject !== 'all' && entry.subject?.id !== selectedSubject) return false;
    if (selectedTeacher !== 'all' && entry.teacher?.id !== selectedTeacher) return false;
    return true;
  });

  // Navigation
  const goToPrevious = () => {
    if (viewMode === 'day') {
      setCurrentDate(subDays(currentDate, 1));
    } else {
      setCurrentDate(subDays(currentDate, 7));
    }
  };

  const goToNext = () => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 7));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get week days
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Get day name
  const getDayName = (date: Date) => {
    const today = new Date();
    const tomorrow = addDays(today, 1);

    if (isSameDay(date, today)) return "Aujourd'hui";
    if (isSameDay(date, tomorrow)) return 'Demain';
    return format(date, 'EEEE', { locale: fr });
  };

  // Get entries for a specific day
  const getEntriesForDay = (date: Date) => {
    return filteredEntries
      .filter((entry: any) => {
        const entryDate = parseISO(entry.sessionDate);
        return isSameDay(entryDate, date);
      })
      .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
  };

  // Get time slot color
  const getTimeSlotColor = (index: number) => {
    const colors = [
      'bg-blue-100 border-blue-200 text-blue-700',
      'bg-green-100 border-green-200 text-green-700',
      'bg-purple-100 border-purple-200 text-purple-700',
      'bg-orange-100 border-orange-200 text-orange-700',
      'bg-pink-100 border-pink-200 text-pink-700',
      'bg-teal-100 border-teal-200 text-teal-700',
      'bg-indigo-100 border-indigo-200 text-indigo-700',
    ];
    return colors[index % colors.length];
  };

  // Calculate statistics
  const todayEntries = getEntriesForDay(new Date());
  const totalHoursThisWeek = filteredEntries.reduce((acc: number, entry: any) => {
    const [startH, startM] = entry.startTime.split(':').map(Number);
    const [endH, endM] = entry.endTime.split(':').map(Number);
    const duration = (endH * 60 + endM) - (startH * 60 + startM);
    return acc + duration;
  }, 0) / 60;

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
                <Calendar className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900">
                  Emploi du temps
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
          {/* Cours aujourd'hui */}
          <Card className="relative overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-blue-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Cours aujourd'hui
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-blue-700 leading-tight">
                {todayEntries.length}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                {todayEntries.length > 1 ? 'Cours' : 'Cours'}
              </p>
            </CardContent>
          </Card>

          {/* Heures cette semaine */}
          <Card className="relative overflow-hidden border-green-200 bg-gradient-to-br from-green-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-green-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Cette semaine
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-green-700 leading-tight">
                {totalHoursThisWeek.toFixed(1)}h
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                Total heures
              </p>
            </CardContent>
          </Card>

          {/* Matières */}
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
                différen-tes{subjects.length > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          {/* Prochain cours */}
          <Card className="relative overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-amber-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Prochain cours
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-sm sm:text-base md:text-lg font-bold text-amber-700 leading-tight truncate">
                {(() => {
                  const now = new Date();
                  const nextClass = todayEntries.find((entry: any) => {
                    const [hours, minutes] = entry.startTime.split(':').map(Number);
                    const classTime = new Date();
                    classTime.setHours(hours, minutes, 0, 0);
                    return classTime > now;
                  });
                  return nextClass ? nextClass.subject?.name || 'Cours' : 'Aucun';
                })()}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600 truncate">
                {(() => {
                  const now = new Date();
                  const nextClass = todayEntries.find((entry: any) => {
                    const [hours, minutes] = entry.startTime.split(':').map(Number);
                    const classTime = new Date();
                    classTime.setHours(hours, minutes, 0, 0);
                    return classTime > now;
                  });
                  return nextClass ? `${nextClass.startTime} - ${nextClass.room?.name || 'Salle'}` : 'Aujourdhui';
                })()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Navigation and Filters */}
        <Card className="mb-4 sm:mb-6 border-border/60 bg-white/80 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevious}
                className="h-8 sm:h-9"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="text-xs sm:text-sm h-8 sm:h-9"
              >
                Aujourd'hui
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNext}
                className="h-8 sm:h-9"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="ml-2">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                  {viewMode === 'day'
                    ? format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })
                    : `${format(weekStart, 'd MMM', { locale: fr })} - ${format(weekEnd, 'd MMM yyyy', { locale: fr })}`}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Sélecteur de date directe */}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
                <input
                  type="date"
                  value={format(currentDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    if (e.target.value) {
                      setCurrentDate(new Date(e.target.value + 'T12:00:00'));
                      setViewMode('day');
                    }
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs sm:text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none h-8 sm:h-9"
                />
              </div>
              <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                <SelectTrigger className="w-[100px] sm:w-[120px] h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Jour</SelectItem>
                  <SelectItem value="week">Semaine</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          {/* Filters */}
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 border-t">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {/* Année scolaire */}
              {academicYears.length > 0 && (
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                    <Filter className="h-3 w-3" />
                    Année scolaire
                  </label>
                  <select
                    value={selectedYearId}
                    onChange={(e) => setSelectedYearId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
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
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                  <Filter className="h-3 w-3" />
                  Matière
                </label>
                <SearchableSelect
                  options={subjects.map((subject: any) => ({ value: subject.id, label: subject.name }))}
                  value={selectedSubject}
                  onValueChange={setSelectedSubject}
                  placeholder="Toutes les matières"
                  searchPlaceholder="Rechercher une matière..."
                  allLabel="Toutes les matières"
                />
              </div>

              {/* Teacher Filter */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  Professeur
                </label>
                <SearchableSelect
                  options={teachers.map((teacher: any) => ({ value: teacher.id, label: `${teacher.firstName} ${teacher.lastName}` }))}
                  value={selectedTeacher}
                  onValueChange={setSelectedTeacher}
                  placeholder="Tous les professeurs"
                  searchPlaceholder="Rechercher un professeur..."
                  allLabel="Tous les professeurs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Display */}
        {isLoadingSchedule ? (
          <Card className="border-border/60 bg-white/80 shadow-sm">
            <CardContent className="py-12 text-center">
              <div className="animate-pulse text-gray-400">Chargement...</div>
            </CardContent>
          </Card>
        ) : viewMode === 'week' ? (
          /* Week View */
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {weekDays.map((day, index) => {
              const dayEntries = getEntriesForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <Card
                  key={day.toISOString()}
                  className={`border-border/60 bg-white/80 shadow-sm ${isToday ? 'ring-2 ring-primary/20' : ''
                    }`}
                >
                  <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
                    <div>
                      <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                        {getDayName(day)}
                        {isToday && (
                          <Badge variant="default" className="text-xs">
                            Aujourd'hui
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(day, 'd MMMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {dayEntries.length} cours
                    </Badge>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                    {dayEntries.length === 0 ? (
                      <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-gray-500">
                        Aucun cours ce jour
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        {dayEntries.map((entry: any, entryIndex: number) => (
                          <div
                            key={entry.id}
                            className={`flex items-center gap-2 sm:gap-3 md:gap-4 rounded-lg border p-2 sm:p-3 md:p-4 ${getTimeSlotColor(entryIndex)}`}
                          >
                            <div className="flex flex-col items-center justify-center min-w-[60px] sm:min-w-[80px]">
                              <span className="text-xs sm:text-sm font-semibold">
                                {entry.startTime}
                              </span>
                              <span className="text-[10px] sm:text-xs opacity-70">
                                {entry.endTime}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">
                                {entry.subject?.name || 'Cours'}
                              </p>
                              <p className="text-[10px] sm:text-xs opacity-80 flex items-center gap-1 sm:gap-2 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {entry.teacher?.firstName} {entry.teacher?.lastName}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {entry.room?.name || 'Salle'}
                                </span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Day View */
          <Card className="border-border/60 bg-white/80 shadow-sm">
            <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
              <CardTitle className="text-sm sm:text-base">
                {getDayName(currentDate)} - {format(currentDate, 'd MMMM yyyy', { locale: fr })}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              {(() => {
                const dayEntries = getEntriesForDay(currentDate);
                return dayEntries.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 text-xs sm:text-sm text-gray-500">
                    Aucun cours ce jour
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {dayEntries.map((entry: any, index: number) => (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-2 sm:gap-3 md:gap-4 rounded-lg border p-2 sm:p-3 md:p-4 ${getTimeSlotColor(index)}`}
                      >
                        <div className="flex flex-col items-center justify-center min-w-[60px] sm:min-w-[80px]">
                          <span className="text-xs sm:text-sm font-semibold">
                            {entry.startTime}
                          </span>
                          <span className="text-[10px] sm:text-xs opacity-70">
                            {entry.endTime}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">
                            {entry.subject?.name || 'Cours'}
                          </p>
                          <p className="text-[10px] sm:text-xs opacity-80 flex items-center gap-1 sm:gap-2 flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {entry.teacher?.firstName} {entry.teacher?.lastName}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {entry.room?.name || 'Salle'}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {filteredEntries.length === 0 && !isLoadingSchedule && (
          <Card className="border-border/60 bg-white/80 shadow-sm">
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-sm sm:text-base text-gray-500">
                Aucun cours trouvé pour cette période
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
