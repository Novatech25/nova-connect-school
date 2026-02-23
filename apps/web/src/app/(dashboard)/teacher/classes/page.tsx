'use client';

import { useState, useMemo } from 'react';
import {
    useAuthContext,
    useTeacherAssignmentsByTeacher,
    useEnrollmentsByClass
} from '@novaconnect/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Users,
    BookOpen,
    GraduationCap,
    Search,
    Filter,
    X,
    ChevronRight,
    ClipboardCheck,
    FileText,
    Calendar,
    Building
} from 'lucide-react';
import Link from 'next/link';

// Component to display students count for a class
function ClassStudentsCount({ classId }: { classId: string }) {
    const { data: enrollments, isLoading } = useEnrollmentsByClass(classId, { enabled: !!classId });

    if (isLoading) return <Skeleton className="h-4 w-8 inline-block" />;
    return <span>{enrollments?.length || 0}</span>;
}

export default function TeacherClassesPage() {
    const { user, profile } = useAuthContext();
    const teacherId = user?.id || '';

    // Filters state
    const [levelFilter, setLevelFilter] = useState<string>('all');
    const [subjectFilter, setSubjectFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

    // Get teacher assignments
    const { data: assignments, isLoading } = useTeacherAssignmentsByTeacher(teacherId);

    // Extract unique classes from assignments
    const classes = useMemo(() => {
        if (!assignments) return [];
        const uniqueClasses = new Map();
        (assignments as any[]).forEach((a: any) => {
            if (a.class && !uniqueClasses.has(a.class.id)) {
                // Collect all subjects for this class
                const classSubjects = (assignments as any[])
                    .filter((as: any) => as.class?.id === a.class.id && as.subject)
                    .map((as: any) => as.subject);

                uniqueClasses.set(a.class.id, {
                    ...a.class,
                    subjects: classSubjects,
                    level: a.class.level || null,
                    academicYear: a.academicYear || a.academic_year || null
                });
            }
        });
        return Array.from(uniqueClasses.values());
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

    // Extract all unique subjects from assignments
    const allSubjects = useMemo(() => {
        if (!assignments) return [];
        const uniqueSubjects = new Map();
        (assignments as any[]).forEach((a: any) => {
            if (a.subject && !uniqueSubjects.has(a.subject.id)) {
                uniqueSubjects.set(a.subject.id, a.subject);
            }
        });
        return Array.from(uniqueSubjects.values());
    }, [assignments]);

    // Apply filters to classes
    const filteredClasses = useMemo(() => {
        return classes.filter((cls: any) => {
            // Level filter
            if (levelFilter !== 'all' && cls.level?.id !== levelFilter) return false;

            // Subject filter - check if class has this subject
            if (subjectFilter !== 'all') {
                const hasSubject = cls.subjects?.some((s: any) => s.id === subjectFilter);
                if (!hasSubject) return false;
            }

            // Search query
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const className = (cls.name || '').toLowerCase();
                const levelName = (cls.level?.name || '').toLowerCase();
                if (!className.includes(query) && !levelName.includes(query)) return false;
            }

            return true;
        });
    }, [classes, levelFilter, subjectFilter, searchQuery]);

    // Get enrollments for selected class
    const { data: selectedClassEnrollments, isLoading: isLoadingEnrollments } = useEnrollmentsByClass(
        selectedClassId || '',
        { enabled: !!selectedClassId }
    );

    // Statistics
    const stats = useMemo(() => ({
        totalClasses: classes.length,
        totalSubjects: allSubjects.length,
        totalLevels: levels.length,
    }), [classes, allSubjects, levels]);

    // Check if any filter is active
    const hasActiveFilters = levelFilter !== 'all' || subjectFilter !== 'all' || searchQuery !== '';

    // Reset all filters
    const resetFilters = () => {
        setLevelFilter('all');
        setSubjectFilter('all');
        setSearchQuery('');
    };

    // Get selected class details
    const selectedClass = selectedClassId ? classes.find((c: any) => c.id === selectedClassId) : null;

    return (
        <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
            {/* Header */}
            <div className="space-y-1 sm:space-y-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900">
                    Mes Classes
                </h1>
                <p className="text-sm sm:text-base text-gray-600">
                    Gérez vos classes et consultez la liste des élèves
                </p>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <Card>
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100">
                                <Building className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm text-gray-500">Classes</p>
                                {isLoading ? (
                                    <Skeleton className="h-6 w-12 mt-1" />
                                ) : (
                                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.totalClasses}</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100">
                                <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm text-gray-500">Matières</p>
                                {isLoading ? (
                                    <Skeleton className="h-6 w-12 mt-1" />
                                ) : (
                                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.totalSubjects}</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-100">
                                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm text-gray-500">Niveaux</p>
                                {isLoading ? (
                                    <Skeleton className="h-6 w-12 mt-1" />
                                ) : (
                                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.totalLevels}</p>
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Rechercher une classe..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {/* Level Filter */}
                        <SearchableSelect
                            options={levels.map((level: any) => ({ value: level.id, label: level.name }))}
                            value={levelFilter}
                            onValueChange={setLevelFilter}
                            placeholder="Niveau"
                            searchPlaceholder="Rechercher un niveau..."
                            allLabel="Tous les niveaux"
                        />

                        {/* Subject Filter */}
                        <SearchableSelect
                            options={allSubjects.map((subject: any) => ({ value: subject.id, label: subject.name }))}
                            value={subjectFilter}
                            onValueChange={setSubjectFilter}
                            placeholder="Matière"
                            searchPlaceholder="Rechercher une matière..."
                            allLabel="Toutes les matières"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Main Content - Classes Grid and Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Classes List */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader className="p-4 sm:p-6">
                            <CardTitle className="text-base sm:text-lg md:text-xl">
                                Liste des Classes
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                {filteredClasses.length} classe{filteredClasses.length !== 1 ? 's' : ''} trouvée{filteredClasses.length !== 1 ? 's' : ''}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6">
                            {isLoading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="flex items-center gap-3 p-4 rounded-lg border">
                                            <Skeleton className="h-12 w-12 rounded-lg" />
                                            <div className="flex-1">
                                                <Skeleton className="h-5 w-32 mb-2" />
                                                <Skeleton className="h-4 w-48" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : filteredClasses.length === 0 ? (
                                <div className="text-center py-8 sm:py-12 text-gray-500">
                                    <Building className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm sm:text-base">
                                        {hasActiveFilters ? 'Aucune classe ne correspond aux filtres' : 'Aucune classe assignée'}
                                    </p>
                                    {hasActiveFilters && (
                                        <Button variant="link" onClick={resetFilters} className="mt-2">
                                            Effacer les filtres
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredClasses.map((cls: any) => (
                                        <div
                                            key={cls.id}
                                            className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${selectedClassId === cls.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-white hover:bg-gray-50'
                                                }`}
                                            onClick={() => setSelectedClassId(selectedClassId === cls.id ? null : cls.id)}
                                        >
                                            <div className="p-3 rounded-lg bg-blue-100">
                                                <Building className="h-6 w-6 text-blue-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-base font-semibold text-gray-900">{cls.name}</h3>
                                                    {cls.level && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {cls.level.name}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <Users className="h-4 w-4" />
                                                        <ClassStudentsCount classId={cls.id} /> élèves
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <BookOpen className="h-4 w-4" />
                                                        {cls.subjects?.length || 0} matière{(cls.subjects?.length || 0) !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                {cls.subjects && cls.subjects.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {cls.subjects.slice(0, 3).map((subject: any) => (
                                                            <Badge key={subject.id} variant="outline" className="text-xs">
                                                                {subject.name}
                                                            </Badge>
                                                        ))}
                                                        {cls.subjects.length > 3 && (
                                                            <Badge variant="outline" className="text-xs">
                                                                +{cls.subjects.length - 3}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${selectedClassId === cls.id ? 'rotate-90' : ''
                                                }`} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Class Details / Actions Panel */}
                <div className="lg:col-span-1">
                    <Card className="sticky top-4">
                        <CardHeader className="p-4 sm:p-6">
                            <CardTitle className="text-base sm:text-lg">
                                {selectedClass ? selectedClass.name : 'Détails de la classe'}
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                {selectedClass
                                    ? `${selectedClass.level?.name || 'Niveau non défini'}`
                                    : 'Sélectionnez une classe pour voir les détails'
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6">
                            {!selectedClass ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm">Cliquez sur une classe pour voir les détails</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Quick Actions */}
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-gray-700">Actions rapides</h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            <Link href={`/teacher/attendance?classId=${selectedClass.id}`}>
                                                <Button variant="outline" className="w-full justify-start gap-2">
                                                    <ClipboardCheck className="h-4 w-4 text-green-600" />
                                                    Faire l'appel
                                                </Button>
                                            </Link>
                                            <Link href={`/teacher/grades/bulk?classId=${selectedClass.id}`}>
                                                <Button variant="outline" className="w-full justify-start gap-2">
                                                    <FileText className="h-4 w-4 text-purple-600" />
                                                    Saisir des notes
                                                </Button>
                                            </Link>
                                            <Link href={`/teacher/schedule?classId=${selectedClass.id}`}>
                                                <Button variant="outline" className="w-full justify-start gap-2">
                                                    <Calendar className="h-4 w-4 text-blue-600" />
                                                    Voir l'emploi du temps
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Subjects */}
                                    {selectedClass.subjects && selectedClass.subjects.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-medium text-gray-700">Matières enseignées</h4>
                                            <div className="flex flex-wrap gap-1">
                                                {selectedClass.subjects.map((subject: any) => (
                                                    <Badge key={subject.id} variant="secondary" className="text-xs">
                                                        {subject.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Students List */}
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-gray-700 flex items-center justify-between">
                                            <span>Élèves</span>
                                            {selectedClassEnrollments && (
                                                <Badge variant="outline">{selectedClassEnrollments.length}</Badge>
                                            )}
                                        </h4>
                                        {isLoadingEnrollments ? (
                                            <div className="space-y-2">
                                                {[1, 2, 3].map((i) => (
                                                    <div key={i} className="flex items-center gap-2 p-2 rounded border">
                                                        <Skeleton className="h-8 w-8 rounded-full" />
                                                        <Skeleton className="h-4 w-24" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : !selectedClassEnrollments || selectedClassEnrollments.length === 0 ? (
                                            <p className="text-sm text-gray-500 text-center py-4">
                                                Aucun élève inscrit
                                            </p>
                                        ) : (
                                            <div className="max-h-64 overflow-y-auto space-y-1">
                                                {selectedClassEnrollments.map((enrollment: any) => {
                                                    const student = enrollment.student || enrollment;
                                                    return (
                                                        <div
                                                            key={enrollment.id}
                                                            className="flex items-center gap-2 p-2 rounded border hover:bg-gray-50"
                                                        >
                                                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                                                {(student?.firstName?.[0] || '?')}{(student?.lastName?.[0] || '')}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                                    {student?.firstName} {student?.lastName}
                                                                </p>
                                                                {student?.matricule && (
                                                                    <p className="text-xs text-gray-500">{student.matricule}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
