'use client';

import { useState, useMemo } from 'react';
import { useAuthContext, useTeacherGrades, useTeacherAssignmentsByTeacher } from '@novaconnect/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, FileEdit, Clock, CheckCircle, Send, Search, Filter, X } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function TeacherGradesPage() {
    const { user } = useAuthContext();

    // Filters state
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [classFilter, setClassFilter] = useState<string>('all');
    const [subjectFilter, setSubjectFilter] = useState<string>('all');
    const [levelFilter, setLevelFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Récupérer les notes de l'enseignant
    const { data: grades, isLoading } = useTeacherGrades(user?.id || '');

    // Récupérer les assignments pour avoir les classes et matières
    const { data: assignments } = useTeacherAssignmentsByTeacher(user?.id || '');

    // Extract unique classes from assignments
    const classes = useMemo(() => {
        if (!assignments) return [];
        const uniqueClasses = new Map();
        (assignments as any[]).forEach((a: any) => {
            if (a.class && !uniqueClasses.has(a.class.id)) {
                uniqueClasses.set(a.class.id, a.class);
            }
        });
        return Array.from(uniqueClasses.values());
    }, [assignments]);

    // Extract unique subjects from assignments
    const subjects = useMemo(() => {
        if (!assignments) return [];
        const uniqueSubjects = new Map();
        (assignments as any[]).forEach((a: any) => {
            if (a.subject && !uniqueSubjects.has(a.subject.id)) {
                uniqueSubjects.set(a.subject.id, a.subject);
            }
        });
        return Array.from(uniqueSubjects.values());
    }, [assignments]);

    // Extract unique levels from classes
    const levels = useMemo(() => {
        const uniqueLevels = new Map();
        classes.forEach((cls: any) => {
            if (cls.level && !uniqueLevels.has(cls.level.id)) {
                uniqueLevels.set(cls.level.id, cls.level);
            }
        });
        return Array.from(uniqueLevels.values());
    }, [classes]);

    // Calculer les statistiques à partir des vraies données
    const stats = useMemo(() => {
        if (!grades) return { drafts: 0, submitted: 0, published: 0, thisWeek: 0 };

        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        return {
            drafts: grades.filter(g => g.status === 'draft').length,
            submitted: grades.filter(g => g.status === 'submitted').length,
            published: grades.filter(g => g.status === 'published').length,
            thisWeek: grades.filter(g => new Date(g.createdAt) >= oneWeekAgo).length,
        };
    }, [grades]);

    // Apply filters to grades
    const filteredGrades = useMemo(() => {
        if (!grades) return [];

        return grades.filter(grade => {
            // Status filter
            if (statusFilter !== 'all' && grade.status !== statusFilter) return false;

            // Level filter
            if (levelFilter !== 'all') {
                const gradeClass = classes.find((c: any) => c.id === grade.classId);
                if (!gradeClass || gradeClass.level?.id !== levelFilter) return false;
            }

            // Class filter
            if (classFilter !== 'all' && grade.classId !== classFilter) return false;

            // Subject filter
            if (subjectFilter !== 'all' && grade.subjectId !== subjectFilter) return false;

            // Search query (search in title, student name)
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const title = (grade.title || '').toLowerCase();
                const studentName = `${grade.student?.firstName || ''} ${grade.student?.lastName || ''}`.toLowerCase();
                if (!title.includes(query) && !studentName.includes(query)) return false;
            }

            return true;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [grades, statusFilter, classFilter, subjectFilter, levelFilter, searchQuery, classes]);

    // Check if any filter is active
    const hasActiveFilters = statusFilter !== 'all' || classFilter !== 'all' || subjectFilter !== 'all' || levelFilter !== 'all' || searchQuery !== '';

    // Reset all filters
    const resetFilters = () => {
        setStatusFilter('all');
        setClassFilter('all');
        setSubjectFilter('all');
        setLevelFilter('all');
        setSearchQuery('');
    };

    return (
        <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
            {/* Header */}
            <div className="space-y-1 sm:space-y-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900">
                    Gestion des Notes
                </h1>
                <p className="text-sm sm:text-base text-gray-600">
                    Saisissez et gérez les notes de vos élèves
                </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Link href="/teacher/grades/individual">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="p-4 sm:p-6">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="p-2 sm:p-3 rounded-lg bg-blue-100">
                                    <FileEdit className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <CardTitle className="text-base sm:text-lg">Saisie Individuelle</CardTitle>
                                    <CardDescription className="text-xs sm:text-sm">
                                        Enregistrer les notes élève par élève
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/teacher/grades/bulk">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="p-4 sm:p-6">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="p-2 sm:p-3 rounded-lg bg-green-100">
                                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <CardTitle className="text-base sm:text-lg">Saisie Collective</CardTitle>
                                    <CardDescription className="text-xs sm:text-sm">
                                        Saisir les notes de toute la classe
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card className={`cursor-pointer transition-all ${statusFilter === 'draft' ? 'ring-2 ring-gray-500' : ''}`}
                    onClick={() => setStatusFilter(statusFilter === 'draft' ? 'all' : 'draft')}>
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gray-100">
                                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm text-gray-500">Brouillons</p>
                                {isLoading ? (
                                    <Skeleton className="h-6 w-12 mt-1" />
                                ) : (
                                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.drafts}</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className={`cursor-pointer transition-all ${statusFilter === 'submitted' ? 'ring-2 ring-yellow-500' : ''}`}
                    onClick={() => setStatusFilter(statusFilter === 'submitted' ? 'all' : 'submitted')}>
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-yellow-100">
                                <Send className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm text-gray-500">Soumises</p>
                                {isLoading ? (
                                    <Skeleton className="h-6 w-12 mt-1" />
                                ) : (
                                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.submitted}</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className={`cursor-pointer transition-all ${statusFilter === 'published' ? 'ring-2 ring-green-500' : ''}`}
                    onClick={() => setStatusFilter(statusFilter === 'published' ? 'all' : 'published')}>
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100">
                                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm text-gray-500">Publiées</p>
                                {isLoading ? (
                                    <Skeleton className="h-6 w-12 mt-1" />
                                ) : (
                                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.published}</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100">
                                <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm text-gray-500">Cette semaine</p>
                                {isLoading ? (
                                    <Skeleton className="h-6 w-12 mt-1" />
                                ) : (
                                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.thisWeek}</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters Section */}
            <Card>
                <CardHeader className="p-4 sm:p-6 pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Filter className="h-5 w-5 text-gray-500" />
                            <CardTitle className="text-base sm:text-lg">Filtres</CardTitle>
                        </div>
                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-gray-500 hover:text-gray-700">
                                <X className="h-4 w-4 mr-1" />
                                Effacer
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Rechercher..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {/* Status Filter */}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Statut" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les statuts</SelectItem>
                                <SelectItem value="draft">Brouillon</SelectItem>
                                <SelectItem value="submitted">Soumise</SelectItem>
                                <SelectItem value="published">Publiée</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Level Filter */}
                        <SearchableSelect
                            options={levels.map((level: any) => ({ value: level.id, label: level.name }))}
                            value={levelFilter}
                            onValueChange={setLevelFilter}
                            placeholder="Niveau"
                            searchPlaceholder="Rechercher un niveau..."
                            allLabel="Tous les niveaux"
                        />

                        {/* Class Filter */}
                        <SearchableSelect
                            options={classes.map((cls: any) => ({ value: cls.id, label: cls.name }))}
                            value={classFilter}
                            onValueChange={setClassFilter}
                            placeholder="Classe"
                            searchPlaceholder="Rechercher une classe..."
                            allLabel="Toutes les classes"
                        />

                        {/* Subject Filter */}
                        <SearchableSelect
                            options={subjects.map((subject: any) => ({ value: subject.id, label: subject.name }))}
                            value={subjectFilter}
                            onValueChange={setSubjectFilter}
                            placeholder="Matière"
                            searchPlaceholder="Rechercher une matière..."
                            allLabel="Toutes les matières"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Grades List */}
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base sm:text-lg md:text-xl">Toutes les Notes</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                {filteredGrades.length} note{filteredGrades.length !== 1 ? 's' : ''} trouvée{filteredGrades.length !== 1 ? 's' : ''}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="flex-1">
                                        <Skeleton className="h-4 w-3/4 mb-2" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredGrades.length === 0 ? (
                        <div className="text-center py-8 sm:py-12 text-gray-500">
                            <FileEdit className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-gray-300" />
                            <p className="text-sm sm:text-base">
                                {hasActiveFilters ? 'Aucune note ne correspond aux filtres' : 'Aucune note enregistrée'}
                            </p>
                            {hasActiveFilters && (
                                <Button variant="link" onClick={resetFilters} className="mt-2">
                                    Effacer les filtres
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredGrades.map((grade) => (
                                <div key={grade.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <div className={`p-2 rounded-full ${grade.status === 'published' ? 'bg-green-100' :
                                        grade.status === 'submitted' ? 'bg-yellow-100' : 'bg-gray-100'
                                        }`}>
                                        {grade.status === 'published' ? (
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                        ) : grade.status === 'submitted' ? (
                                            <Send className="h-4 w-4 text-yellow-600" />
                                        ) : (
                                            <Clock className="h-4 w-4 text-gray-600" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {grade.title || 'Note sans titre'}
                                            </p>
                                            <span className="text-sm font-bold text-blue-600">
                                                {grade.score}/{grade.maxScore}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {grade.student?.firstName} {grade.student?.lastName}
                                            {grade.subject?.name && ` • ${grade.subject.name}`}
                                            {grade.class?.name && ` • ${grade.class.name}`}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {format(new Date(grade.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${grade.status === 'published' ? 'bg-green-100 text-green-700' :
                                        grade.status === 'submitted' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                        {grade.status === 'published' ? 'Publiée' :
                                            grade.status === 'submitted' ? 'Soumise' : 'Brouillon'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
