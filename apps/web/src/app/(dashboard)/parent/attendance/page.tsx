"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@novaconnect/data/providers";
import { useStudentAttendance } from "@novaconnect/data";
import { getSupabaseClient } from "@novaconnect/data/client";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
    Calendar,
    Clock,
    AlertCircle,
    CheckCircle,
    XCircle,
    User,
    ArrowLeft,
    Filter,
    RefreshCw
} from "lucide-react";
import { format, parseISO, isSameDay, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Student {
    id: string;
    firstName?: string;
    first_name?: string;
    lastName?: string;
    last_name?: string;
    matricule: string;
    photoUrl?: string;
    status: string;
    enrollments: any[];
}

interface ParentData {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    userId?: string;
    students: Array<{
        id: string;
        relationship: string;
        student: Student;
    }>;
}

export default function MyAttendancePage() {
    const router = useRouter();
    const { user, profile } = useAuthContext();
    const [parentData, setParentData] = useState<ParentData | null>(null);
    const [isLoadingParent, setIsLoadingParent] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<any>(null);
    
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [periodFilter, setPeriodFilter] = useState<string>("30days");

    const fetchChildren = async () => {
        setIsLoadingParent(true);
        setError(null);
        setDebugInfo(null);
    
        try {
          const supabase = getSupabaseClient();
          const { data: { user: authUser } } = await supabase.auth.getUser();
    
          if (!authUser) {
            setError("Utilisateur non connecté");
            setIsLoadingParent(false);
            return;
          }
    
          setDebugInfo((prev: any) => ({ ...prev, authUserId: authUser.id, authUserEmail: authUser.email }));
    
          // Requête directe pour récupérer le parent avec les étudiants
          const { data: parent, error: parentError } = await supabase
            .from("parents")
            .select(`
              *,
              students:student_parent_relations(
                *,
                student:students(*)
              )
            `)
            .eq("user_id", authUser.id)
            .single();
    
          if (parentError) {
            setDebugInfo((prev: any) => ({ ...prev, parentError: parentError.message, parentCode: parentError.code, details: parentError }));
    
            if (parentError.code === 'PGRST116') {
              // Aucun parent trouvé
              setParentData(null);
            } else {
              throw parentError;
            }
          } else {
            setDebugInfo((prev: any) => ({ ...prev, parentFound: true, parentId: parent?.id, studentsCount: parent?.students?.length || 0 }));
    
            // Récupérer les inscriptions pour tous les étudiants séparément
            if (parent?.students && parent.students.length > 0) {
              const studentIds = parent.students.map((rel: any) => rel.student.id);
    
              const { data: enrollments, error: enrollmentsError } = await supabase
                .from("enrollments")
                .select(`
                  *,
                  class:classes(*),
                  academic_year:academic_years(*)
                `)
                .in("student_id", studentIds)
                .order("created_at", { ascending: false });
    
              if (enrollmentsError) {
                // Fallback: Afficher les enfants même si la récupération des inscriptions échoue
                const parentFallback = {
                  ...parent,
                  students: parent.students.map((relation: any) => ({
                    ...relation,
                    student: {
                      ...relation.student,
                      enrollments: []
                    }
                  }))
                };
                setParentData(parentFallback as ParentData);
              } else {
                // Mapper les inscriptions aux étudiants
                const parentWithEnrollments = {
                  ...parent,
                  students: parent.students.map((relation: any) => ({
                    ...relation,
                    student: {
                      ...relation.student,
                      enrollments: enrollments?.filter((e: any) => e.student_id === relation.student.id) || []
                    }
                  }))
                };
                setParentData(parentWithEnrollments as ParentData);
              }
            } else {
              setParentData(parent as ParentData);
            }
          }
    
          setIsLoadingParent(false);
        } catch (err: any) {
          console.error("Error fetching children:", err);
          setError(err.message || "Impossible de charger les informations");
          setDebugInfo((prev: any) => ({ ...prev, fetchError: err.message }));
          setIsLoadingParent(false);
        }
      };

    useEffect(() => {
        fetchChildren();
    }, []);

    // Set default selected student when parent data loads
    useEffect(() => {
        if (parentData?.students && parentData.students.length > 0 && !selectedStudentId) {
            setSelectedStudentId(parentData.students[0].student.id);
        }
    }, [parentData, selectedStudentId]);

    // Calculate date range based on filter
    const getDateRange = () => {
        const end = new Date();
        let start = new Date();
        
        if (periodFilter === "30days") {
            start.setDate(end.getDate() - 30);
        } else if (periodFilter === "90days") {
            start.setDate(end.getDate() - 90);
        } else if (periodFilter === "year") {
            start.setMonth(end.getMonth() - 12);
        }
        
        return {
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd')
        };
    };

    const { startDate, endDate } = getDateRange();

    // Fetch attendance for selected student
    const { 
        data: attendanceRecords = [], 
        isLoading: isLoadingAttendance 
    } = useStudentAttendance(selectedStudentId || "", startDate, endDate);

    // Calculate stats
    const stats = attendanceRecords.reduce((acc: any, record: any) => {
        acc.total++;
        if (record.status === 'present') acc.present++;
        if (record.status === 'absent') acc.absent++;
        if (record.status === 'late') acc.late++;
        if (record.status === 'excused') acc.excused++;
        return acc;
    }, { total: 0, present: 0, absent: 0, late: 0, excused: 0 });

    const attendanceRate = stats.total > 0 
        ? ((stats.present + stats.late) / stats.total * 100).toFixed(1) 
        : 100;

    if (isLoadingParent) {
        return <AttendanceLoadingSkeleton />;
    }

    if (error || !parentData?.students || parentData.students.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 md:p-8">
                <div className="max-w-3xl mx-auto">
                    {/* Header avec bouton de rafraîchissement */}
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                                Assiduité & Présences
                            </h1>
                            <p className="text-sm md:text-base text-muted-foreground mt-1">
                                Suivi des absences et retards
                            </p>
                        </div>
                        <Button onClick={fetchChildren} variant="outline" size="sm">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Rafraîchir
                        </Button>
                    </div>

                    {/* Message d'erreur ou d'information */}
                    <Card className="border-destructive/50 bg-destructive/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-destructive" />
                                {error ? "Erreur de chargement" : "Aucun enfant associé"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm md:text-base text-muted-foreground">
                                {error || "Il semble qu'aucun élève ne soit associé à votre compte parent."}
                            </p>

                            {/* Afficher le compte utilisateur connecté */}
                            <div className="bg-background/50 rounded-lg p-4 space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Votre compte
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Email:</span>
                                        <p className="font-medium">{user?.email || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">ID:</span>
                                        <p className="font-medium font-mono text-xs">{user?.id?.slice(0, 8)}...</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Nom:</span>
                                        <p className="font-medium">{profile?.firstName} {profile?.lastName}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Rôle:</span>
                                        <Badge variant="outline">Parent</Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Informations de debug */}
                            {debugInfo && (
                                <details className="bg-muted/50 rounded-lg p-4">
                                    <summary className="text-xs font-semibold uppercase tracking-wider cursor-pointer mb-2">
                                        Informations techniques (cliquer pour voir)
                                    </summary>
                                    <pre className="text-xs overflow-auto bg-background p-2 rounded">
                                        {JSON.stringify(debugInfo, null, 2)}
                                    </pre>
                                </details>
                            )}

                            {/* Actions suggérées */}
                            <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 space-y-3">
                                <p className="text-sm font-medium text-blue-900">
                                    🔧 Actions pour corriger le problème :
                                </p>
                                <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                                    <li>
                                        Vérifiez que votre compte utilisateur existe dans la table <code>parents</code>
                                        avec le champ <code>user_id</code> rempli
                                    </li>
                                    <li>
                                        Vérifiez qu'une relation existe dans <code>student_parent_relations</code>
                                        entre votre compte parent et l'étudiant
                                    </li>
                                    <li>
                                        Assurez-vous que vous avez le rôle <code>parent</code> dans <code>user_roles</code>
                                    </li>
                                    <li>
                                        <strong>Déconnectez-vous et reconnectez-vous</strong> après avoir
                                        appliqué les corrections
                                    </li>
                                </ol>
                            </div>

                            {/* Lien vers le support */}
                            <div className="flex gap-2">
                                <Button variant="default" asChild>
                                    <a href="/parent">
                                        Retour au tableau de bord
                                    </a>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const selectedStudent = parentData.students.find((s: any) => s.student.id === selectedStudentId)?.student;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
            <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 sm:py-6 space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                            <Clock className="h-5 w-5 sm:h-7 sm:w-7" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900">
                                Assiduité & Présences
                            </h1>
                            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600">
                                Suivi des absences et retards
                            </p>
                        </div>
                    </div>

                    {/* Child Selector */}
                    {parentData.students.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                            {parentData.students.map((relation: any) => (
                                <Button
                                    key={relation.student.id}
                                    variant={selectedStudentId === relation.student.id ? "default" : "outline"}
                                    onClick={() => setSelectedStudentId(relation.student.id)}
                                    className="whitespace-nowrap text-xs sm:text-sm h-8 sm:h-10"
                                >
                                    {relation.student.firstName || relation.student.first_name || "Élève"}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selected Student Info */}
                {selectedStudent && (
                    <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-white border border-border/60 shadow-sm">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-base sm:text-lg">
                            {(selectedStudent.firstName || selectedStudent.first_name || "E")[0]}
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                                {selectedStudent.firstName || selectedStudent.first_name} {selectedStudent.lastName || selectedStudent.last_name}
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

                {/* Filters */}
                <div className="flex justify-end">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-500" />
                        <Select value={periodFilter} onValueChange={setPeriodFilter}>
                            <SelectTrigger className="w-[180px] h-9 text-sm">
                                <SelectValue placeholder="Période" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="30days">30 derniers jours</SelectItem>
                                <SelectItem value="90days">3 derniers mois</SelectItem>
                                <SelectItem value="year">Année scolaire</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 md:grid-cols-4">
                    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-xs font-medium text-gray-600">Taux de présence</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold text-green-700">{attendanceRate}%</div>
                        </CardContent>
                    </Card>

                    <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-xs font-medium text-gray-600">Absences injustifiées</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold text-red-700">{stats.absent}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-xs font-medium text-gray-600">Retards</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold text-orange-700">{stats.late}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-xs font-medium text-gray-600">Absences justifiées</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="text-2xl font-bold text-blue-700">{stats.excused}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Attendance List */}
                <Card className="border-border/60 shadow-sm">
                    <CardHeader className="px-4 py-4 border-b bg-gray-50/50">
                        <CardTitle className="text-base font-semibold">Historique détaillé</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoadingAttendance ? (
                            <div className="p-8 space-y-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        ) : attendanceRecords.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <CheckCircle className="h-12 w-12 text-green-200 mb-3" />
                                <p className="font-medium text-gray-900">Aucune absence ou retard</p>
                                <p className="text-sm text-gray-500">Tout est normal pour cette période.</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {attendanceRecords.map((record: any) => (
                                    <div key={record.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1">
                                                {getStatusIcon(record.status)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    {format(parseISO(record.date), "EEEE d MMMM yyyy", { locale: fr })}
                                                </div>
                                                <div className="text-sm text-gray-500 flex flex-wrap gap-2 mt-0.5">
                                                    {record.startTime && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {record.startTime.substring(0, 5)}
                                                            {record.endTime && ` - ${record.endTime.substring(0, 5)}`}
                                                        </span>
                                                    )}
                                                    {record.subject && (
                                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                                                            {record.subject.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                                            <Badge variant={getStatusBadgeVariant(record.status)}>
                                                {getStatusLabel(record.status)}
                                            </Badge>
                                            {record.justification && (
                                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                                                    Justifié
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Helpers
function getStatusIcon(status: string) {
    switch (status) {
        case 'present': return <CheckCircle className="h-5 w-5 text-green-500" />;
        case 'absent': return <XCircle className="h-5 w-5 text-red-500" />;
        case 'late': return <Clock className="h-5 w-5 text-orange-500" />;
        case 'excused': return <CheckCircle className="h-5 w-5 text-blue-500" />;
        default: return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
}

function getStatusLabel(status: string) {
    switch (status) {
        case 'present': return 'Présent';
        case 'absent': return 'Absent';
        case 'late': return 'En retard';
        case 'excused': return 'Excusé';
        default: return 'Inconnu';
    }
}

function getStatusBadgeVariant(status: string) {
    switch (status) {
        case 'present': return 'default'; // often maps to primary, usually we want green. shadcn default is black/primary.
        case 'absent': return 'destructive';
        case 'late': return 'secondary'; // often orange/yellow custom or grey
        case 'excused': return 'outline';
        default: return 'outline';
    }
}

function AttendanceLoadingSkeleton() {
    return (
        <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col gap-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-96" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
        </div>
    );
}

function NoChildrenMessage() {
    return (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center p-4">
            <div className="rounded-full bg-muted p-4">
                <AlertCircle className="h-8 w-8 md:h-12 md:w-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold">Aucun enfant trouvé</h2>
            <p className="text-muted-foreground">
                Impossible d'afficher les présences car aucun enfant n'est lié à votre compte.
            </p>
        </div>
    );
}
