'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Calendar,
    Clock,
    MapPin,
    Users,
    ChevronLeft,
    ChevronRight,
    Filter,
    ArrowLeft,
    BookOpen,
    Loader2,
    X,
    GraduationCap,
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
    useAuthContext,
    usePlannedSessions,
    useTeacherAssignmentsByTeacher,
} from '@novaconnect/data';
import {
    format,
    addDays,
    subDays,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameDay,
    parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';

export default function TeacherSchedulePage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user, profile } = useAuthContext();

    const teacherId = user?.id;
    const schoolId = profile?.schoolId || user?.schoolId;

    // View mode: day or week
    const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
    const [currentDate, setCurrentDate] = useState(new Date());

    // Filters state
    const [selectedSubject, setSelectedSubject] = useState<string>('all');
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [selectedLevel, setSelectedLevel] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<string>('all');
    const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD

    // Calculate week range
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday

    // Fetch teacher's planned sessions
    const {
        data: scheduleEntries = [],
        isLoading: isLoadingSchedule,
    } = usePlannedSessions(
        schoolId || '',
        {
            teacherId,
            startDate: format(weekStart, 'yyyy-MM-dd'),
            endDate: format(weekEnd, 'yyyy-MM-dd'),
            isCancelled: false,
        }
    );

    // Fetch assignments for year/level/class data (static data not in sessions)
    const { data: assignments } = useTeacherAssignmentsByTeacher(teacherId || '');

    // Extract academic years from assignments
    const academicYears = useMemo(() => {
        if (!assignments) return [];
        const map = new Map();
        (assignments as any[]).forEach((a: any) => {
            const year = a.academicYear || a.academic_year;
            if (year && !map.has(year.id)) map.set(year.id, year);
        });
        return Array.from(map.values());
    }, [assignments]);

    // Extract classes from assignments (filtered by year)
    const allAssignmentClasses = useMemo(() => {
        if (!assignments) return [];
        const map = new Map();
        (assignments as any[]).forEach((a: any) => {
            if (a.class && !map.has(a.class.id)) {
                const year = a.academicYear || a.academic_year;
                map.set(a.class.id, { ...a.class, academicYearId: year?.id });
            }
        });
        return Array.from(map.values());
    }, [assignments]);

    const classesByYear = useMemo(() => {
        if (selectedYear === 'all') return allAssignmentClasses;
        return allAssignmentClasses.filter((c: any) => c.academicYearId === selectedYear);
    }, [allAssignmentClasses, selectedYear]);

    // Extract unique subjects from sessions
    const subjects = useMemo(() => {
        const map = new Map();
        (scheduleEntries as any[]).forEach((e: any) => {
            if (e.subject && !map.has(e.subject.id)) map.set(e.subject.id, e.subject);
        });
        return Array.from(map.values());
    }, [scheduleEntries]);

    // Extract unique levels from sessions
    const levels = useMemo(() => {
        const map = new Map();
        (scheduleEntries as any[]).forEach((e: any) => {
            const level = e.class?.level;
            if (level && !map.has(level.id)) map.set(level.id, level);
        });
        return Array.from(map.values());
    }, [scheduleEntries]);

    // Extract unique classes from sessions (filtered by level)
    const sessionClasses = useMemo(() => {
        const map = new Map();
        (scheduleEntries as any[]).forEach((e: any) => {
            if (e.class && !map.has(e.class.id)) map.set(e.class.id, e.class);
        });
        return Array.from(map.values());
    }, [scheduleEntries]);

    // Check if any filter is active
    const hasActiveFilters = selectedSubject !== 'all' || selectedClass !== 'all' ||
        selectedLevel !== 'all' || selectedYear !== 'all' || selectedDate !== '';

    const resetFilters = () => {
        setSelectedSubject('all');
        setSelectedClass('all');
        setSelectedLevel('all');
        setSelectedYear('all');
        setSelectedDate('');
    };

    // Filter schedule entries
    const filteredEntries = useMemo(() => {
        return (scheduleEntries as any[]).filter((entry: any) => {
            if (selectedSubject !== 'all' && entry.subject?.id !== selectedSubject) return false;
            if (selectedClass !== 'all' && entry.class?.id !== selectedClass) return false;
            if (selectedLevel !== 'all' && entry.class?.level?.id !== selectedLevel) return false;
            // Year filter: match via assignment class list
            if (selectedYear !== 'all') {
                const matchingClass = allAssignmentClasses.find((c: any) => c.id === entry.class?.id);
                if (matchingClass?.academicYearId !== selectedYear) return false;
            }
            // Date filter: show only entries for this specific date
            if (selectedDate) {
                const entryDate = entry.sessionDate?.split('T')[0];
                if (entryDate !== selectedDate) return false;
            }
            return true;
        });
    }, [scheduleEntries, selectedSubject, selectedClass, selectedLevel, selectedYear, selectedDate, allAssignmentClasses]);

    // Navigation
    const goToPrevious = () => {
        if (viewMode === 'day') setCurrentDate(subDays(currentDate, 1));
        else setCurrentDate(subDays(currentDate, 7));
    };

    const goToNext = () => {
        if (viewMode === 'day') setCurrentDate(addDays(currentDate, 1));
        else setCurrentDate(addDays(currentDate, 7));
    };

    const goToToday = () => setCurrentDate(new Date());

    // If date filter set, switch to day view on that date
    const handleDateFilter = (dateStr: string) => {
        setSelectedDate(dateStr);
        if (dateStr) {
            const d = new Date(dateStr);
            setCurrentDate(d);
            setViewMode('day');
        }
    };

    // Get week days
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const getDayName = (date: Date) => {
        const today = new Date();
        const tomorrow = addDays(today, 1);
        if (isSameDay(date, today)) return "Aujourd'hui";
        if (isSameDay(date, tomorrow)) return 'Demain';
        return format(date, 'EEEE', { locale: fr });
    };

    const getEntriesForDay = (date: Date) => {
        return filteredEntries
            .filter((entry: any) => isSameDay(parseISO(entry.sessionDate), date))
            .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
    };

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

    const todayEntries = getEntriesForDay(new Date());
    const totalHoursThisWeek = (scheduleEntries as any[]).reduce((acc: number, entry: any) => {
        const [startH, startM] = entry.startTime.split(':').map(Number);
        const [endH, endM] = entry.endTime.split(':').map(Number);
        return acc + ((endH * 60 + endM) - (startH * 60 + startM));
    }, 0) / 60;

    const userName = profile?.fullName || user?.email || 'Professeur';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
            <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 sm:py-6">
                {/* Header */}
                <div className="mb-4 sm:mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="sm" onClick={() => router.push('/teacher')} className="text-gray-600">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                                <Calendar className="h-5 w-5 sm:h-7 sm:w-7" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900">
                                    Mon emploi du temps
                                </h1>
                                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600">{userName}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid gap-2 sm:gap-3 md:gap-6 grid-cols-2 md:grid-cols-2 xl:grid-cols-4 mb-4 sm:mb-6">
                    <Card className="relative overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                        <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-blue-100/50" />
                        <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
                            <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">Cours aujourd'hui</CardTitle>
                            <div className="flex h-6 w-6 sm:h-8 sm:w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                            </div>
                        </CardHeader>
                        <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
                            <div className="text-lg sm:text-xl md:text-3xl font-bold text-blue-700">{todayEntries.length}</div>
                            <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">Cours</p>
                        </CardContent>
                    </Card>

                    <Card className="relative overflow-hidden border-green-200 bg-gradient-to-br from-green-50 to-white">
                        <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-green-100/50" />
                        <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
                            <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">Cette semaine</CardTitle>
                            <div className="flex h-6 w-6 sm:w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                            </div>
                        </CardHeader>
                        <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
                            <div className="text-lg sm:text-xl md:text-3xl font-bold text-green-700">{totalHoursThisWeek.toFixed(1)}h</div>
                            <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">Total heures</p>
                        </CardContent>
                    </Card>

                    <Card className="relative overflow-hidden border-purple-200 bg-gradient-to-br from-purple-50 to-white">
                        <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-purple-100/50" />
                        <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
                            <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">Classes</CardTitle>
                            <div className="flex h-6 w-6 sm:w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                            </div>
                        </CardHeader>
                        <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
                            <div className="text-lg sm:text-xl md:text-3xl font-bold text-purple-700">{sessionClasses.length}</div>
                            <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">différentes</p>
                        </CardContent>
                    </Card>

                    <Card className="relative overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 to-white">
                        <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-amber-100/50" />
                        <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
                            <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">Matières</CardTitle>
                            <div className="flex h-6 w-6 sm:w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                            </div>
                        </CardHeader>
                        <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
                            <div className="text-lg sm:text-xl md:text-3xl font-bold text-amber-700">{subjects.length}</div>
                            <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">enseignées</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters Card */}
                <Card className="mb-4 sm:mb-6 border-border/60 bg-white/80 shadow-sm">
                    <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-4 pb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">Filtres</span>
                                {hasActiveFilters && (
                                    <Badge variant="secondary" className="text-xs">
                                        {filteredEntries.length} cours
                                    </Badge>
                                )}
                            </div>
                            {hasActiveFilters && (
                                <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-gray-500 hover:text-gray-700">
                                    <X className="h-3 w-3 mr-1" />
                                    Effacer
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="px-3 sm:px-6 pb-3 sm:pb-4 border-t pt-3">
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                            {/* Date filter — calendrier */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                                    <Calendar className="h-3 w-3" />
                                    Date précise
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => handleDateFilter(e.target.value)}
                                        className="text-sm h-9"
                                    />
                                    {selectedDate && (
                                        <Button variant="ghost" size="sm" className="h-9 px-2" onClick={() => setSelectedDate('')}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Year filter */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                                    <Calendar className="h-3 w-3" />
                                    Année scolaire
                                </label>
                                <SearchableSelect
                                    options={academicYears.map((y: any) => ({ value: y.id, label: y.name }))}
                                    value={selectedYear}
                                    onValueChange={(v) => { setSelectedYear(v); setSelectedClass('all'); }}
                                    placeholder="Toutes les années"
                                    searchPlaceholder="Rechercher..."
                                    allLabel="Toutes les années"
                                />
                            </div>

                            {/* Level filter */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                                    <GraduationCap className="h-3 w-3" />
                                    Niveau
                                </label>
                                <SearchableSelect
                                    options={levels.map((l: any) => ({ value: l.id, label: l.name }))}
                                    value={selectedLevel}
                                    onValueChange={setSelectedLevel}
                                    placeholder="Tous les niveaux"
                                    searchPlaceholder="Rechercher..."
                                    allLabel="Tous les niveaux"
                                />
                            </div>

                            {/* Class filter */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                                    <Users className="h-3 w-3" />
                                    Classe
                                </label>
                                <SearchableSelect
                                    options={classesByYear.map((c: any) => ({ value: c.id, label: c.name }))}
                                    value={selectedClass}
                                    onValueChange={setSelectedClass}
                                    placeholder="Toutes les classes"
                                    searchPlaceholder="Rechercher..."
                                    allLabel="Toutes les classes"
                                />
                            </div>

                            {/* Subject filter */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                                    <BookOpen className="h-3 w-3" />
                                    Matière
                                </label>
                                <SearchableSelect
                                    options={subjects.map((s: any) => ({ value: s.id, label: s.name }))}
                                    value={selectedSubject}
                                    onValueChange={setSelectedSubject}
                                    placeholder="Toutes les matières"
                                    searchPlaceholder="Rechercher..."
                                    allLabel="Toutes les matières"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Navigation */}
                <Card className="mb-4 sm:mb-6 border-border/60 bg-white/80 shadow-sm">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 sm:px-6 pt-3 sm:pt-4 pb-3 sm:pb-4">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={goToPrevious} className="h-8 sm:h-9">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={goToToday} className="text-xs sm:text-sm h-8 sm:h-9">
                                Aujourd'hui
                            </Button>
                            <Button variant="outline" size="sm" onClick={goToNext} className="h-8 sm:h-9">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <h2 className="ml-2 text-sm sm:text-base font-semibold text-gray-900">
                                {viewMode === 'day'
                                    ? format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })
                                    : `${format(weekStart, 'd MMM', { locale: fr })} – ${format(weekEnd, 'd MMM yyyy', { locale: fr })}`}
                            </h2>
                        </div>
                        <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                            <SelectTrigger className="w-[120px] h-8 sm:h-9 text-xs sm:text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="day">Jour</SelectItem>
                                <SelectItem value="week">Semaine</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardHeader>
                </Card>

                {/* Schedule Display */}
                {isLoadingSchedule ? (
                    <Card className="border-border/60 bg-white/80 shadow-sm">
                        <CardContent className="py-12 text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
                            <div className="text-gray-400">Chargement...</div>
                        </CardContent>
                    </Card>
                ) : viewMode === 'week' ? (
                    <div className="space-y-3 sm:space-y-4 md:space-y-6">
                        {weekDays.map((day) => {
                            const dayEntries = getEntriesForDay(day);
                            const isToday = isSameDay(day, new Date());
                            return (
                                <Card key={day.toISOString()} className={`border-border/60 bg-white/80 shadow-sm ${isToday ? 'ring-2 ring-primary/20' : ''}`}>
                                    <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-4 pb-2">
                                        <div>
                                            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                                                {getDayName(day)}
                                                {isToday && <Badge variant="default" className="text-xs">Aujourd'hui</Badge>}
                                            </CardTitle>
                                            <p className="text-xs text-gray-500 mt-1">{format(day, 'd MMMM yyyy', { locale: fr })}</p>
                                        </div>
                                        <Badge variant="outline" className="text-xs">{dayEntries.length} cours</Badge>
                                    </CardHeader>
                                    <CardContent className="px-3 sm:px-6 pb-3 sm:pb-4">
                                        {dayEntries.length === 0 ? (
                                            <div className="text-center py-6 text-xs sm:text-sm text-gray-400">Aucun cours ce jour</div>
                                        ) : (
                                            <div className="space-y-2 sm:space-y-3">
                                                {dayEntries.map((entry: any, idx: number) => (
                                                    <div key={entry.id} className={`flex items-center gap-2 sm:gap-3 md:gap-4 rounded-lg border p-2 sm:p-3 md:p-4 ${getTimeSlotColor(idx)}`}>
                                                        <div className="flex flex-col items-center justify-center min-w-[60px] sm:min-w-[80px]">
                                                            <span className="text-xs sm:text-sm font-semibold">{entry.startTime}</span>
                                                            <span className="text-[10px] sm:text-xs opacity-70">{entry.endTime}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">{entry.subject?.name || 'Cours'}</p>
                                                            <p className="text-[10px] sm:text-xs opacity-80 flex items-center gap-1 sm:gap-2 flex-wrap">
                                                                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{entry.class?.name || 'Classe'}</span>
                                                                {entry.class?.level && (
                                                                    <><span>•</span><span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{entry.class.level.name}</span></>
                                                                )}
                                                                <span>•</span>
                                                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{entry.room?.name || 'Salle'}</span>
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
                        <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-4 pb-2">
                            <CardTitle className="text-sm sm:text-base">
                                {getDayName(currentDate)} — {format(currentDate, 'd MMMM yyyy', { locale: fr })}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                            {(() => {
                                const dayEntries = getEntriesForDay(currentDate);
                                return dayEntries.length === 0 ? (
                                    <div className="text-center py-8 sm:py-12 text-xs sm:text-sm text-gray-500">Aucun cours ce jour</div>
                                ) : (
                                    <div className="space-y-2 sm:space-y-3">
                                        {dayEntries.map((entry: any, idx: number) => (
                                            <div key={entry.id} className={`flex items-center gap-2 sm:gap-3 md:gap-4 rounded-lg border p-2 sm:p-3 md:p-4 ${getTimeSlotColor(idx)}`}>
                                                <div className="flex flex-col items-center justify-center min-w-[60px] sm:min-w-[80px]">
                                                    <span className="text-xs sm:text-sm font-semibold">{entry.startTime}</span>
                                                    <span className="text-[10px] sm:text-xs opacity-70">{entry.endTime}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">{entry.subject?.name || 'Cours'}</p>
                                                    <p className="text-[10px] sm:text-xs opacity-80 flex items-center gap-1 sm:gap-2 flex-wrap">
                                                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{entry.class?.name || 'Classe'}</span>
                                                        {entry.class?.level && (
                                                            <><span>•</span><span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{entry.class.level.name}</span></>
                                                        )}
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{entry.room?.name || 'Salle'}</span>
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
                    <Card className="border-border/60 bg-white/80 shadow-sm mt-4">
                        <CardContent className="py-12 text-center">
                            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-sm sm:text-base text-gray-500">Aucun cours trouvé pour cette période</p>
                            {hasActiveFilters && (
                                <Button variant="link" onClick={resetFilters} className="mt-2">Effacer les filtres</Button>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
