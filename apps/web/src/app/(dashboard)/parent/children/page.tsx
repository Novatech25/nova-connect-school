"use client";

import { useState, useEffect } from "react";
import { useAuthContext } from "@novaconnect/data/providers";
import { getSupabaseClient } from "@novaconnect/data/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
  Skeleton,
} from "@novaconnect/ui";
import {
  Calendar,
  User,
  BookOpen,
  GraduationCap,
  ArrowRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
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

export default function MyChildrenPage() {
  const { user, profile } = useAuthContext();
  const [parentData, setParentData] = useState<ParentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const fetchChildren = async () => {
    setIsLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      const supabase = getSupabaseClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setError("Utilisateur non connecté");
        setIsLoading(false);
        return;
      }

      console.log('[ParentChildren] Auth user:', authUser.id, authUser.email);
      setDebugInfo(prev => ({ ...prev, authUserId: authUser.id, authUserEmail: authUser.email }));

      // Requête directe pour récupérer le parent avec les étudiants
      // Note: Simplification pour éviter l'erreur "more than one relationship"
      // avec les étudiants qui ont plusieurs inscriptions
      // On récupère d'abord le parent avec les étudiants SANS les inscriptions imbriquées
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

      console.log('[ParentChildren] Parent query result:', parent, parentError);

      if (parentError) {
        setDebugInfo(prev => ({ ...prev, parentError: parentError.message, parentCode: parentError.code, details: parentError }));

        if (parentError.code === 'PGRST116') {
          // Aucun parent trouvé
          console.log('[ParentChildren] No parent found for user:', authUser.id);
          setParentData(null);
        } else {
          console.error('[ParentChildren] Error fetching parent:', parentError);
          throw parentError;
        }
      } else {
        console.log('[ParentChildren] Parent found:', parent);
        setDebugInfo(prev => ({ ...prev, parentFound: true, parentId: parent?.id, studentsCount: parent?.students?.length || 0 }));

        // Récupérer les inscriptions pour tous les étudiants séparément
        if (parent?.students && parent.students.length > 0) {
          const studentIds = parent.students.map((rel: any) => rel.student.id);

          console.log('[ParentChildren] Fetching enrollments for student IDs:', studentIds);

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
            console.error('[ParentChildren] Error fetching enrollments:', enrollmentsError);
            console.error('[ParentChildren] Error details:', {
              message: enrollmentsError.message,
              code: enrollmentsError.code,
              details: enrollmentsError.details,
              hint: enrollmentsError.hint,
            });
            
            // Fallback: Afficher les enfants même si la récupération des inscriptions échoue
            console.log('[ParentChildren] Using fallback data (students without enrollments)');
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
            console.log('[ParentChildren] Enrollments fetched:', enrollments);

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

      setIsLoading(false);
    } catch (err: any) {
      console.error("Error fetching children:", err);
      setError(err.message || JSON.stringify(err) || "Impossible de charger les informations");
      setDebugInfo(prev => ({ ...prev, fetchError: err.message, errorStack: err.stack }));
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChildren();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Afficher les erreurs avec informations de debug
  if (error || !parentData?.students || parentData.students.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Header avec bouton de rafraîchissement */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Mes Enfants
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Suivez la scolarité de vos enfants
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                <User className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900">
                  Mes Enfants
                </h1>
                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600">
                  Suivez la scolarité de vos enfants et accédez à leurs informations
                </p>
              </div>
            </div>
            <Button onClick={fetchChildren} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Rafraîchir
            </Button>
          </div>
        </div>

        {/* Children Grid */}
        <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {parentData.students.map((relation: any) => {
            const student = relation.student;
            const enrollment = student.enrollments?.[0];
            const className = enrollment?.class?.name || "Non inscrit";
            const academicYear = enrollment?.academic_year?.name || "N/A";

            return (
              <Card key={student.id} className="overflow-hidden flex flex-col h-full transition-all hover:shadow-xl border-border/60 bg-white">
                {/* Header avec photo */}
                <div className="h-28 sm:h-32 bg-gradient-to-r from-primary/10 via-primary/5 to-blue-50/30 relative">
                  <div className="absolute -bottom-10 sm:-bottom-12 left-4 sm:left-6 border-4 border-background rounded-full overflow-hidden bg-white shadow-lg">
                    {student.photoUrl ? (
                      <img
                        src={student.photoUrl}
                        alt={`${student.firstName} ${student.lastName}`}
                        className="h-16 w-16 sm:h-20 sm:w-20 object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 sm:h-20 sm:w-20 flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                        <User className="h-8 w-8 sm:h-10 sm:w-10" />
                      </div>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex gap-2">
                    <Badge
                      variant={student.status === 'active' ? "default" : "secondary"}
                      className="text-xs shadow-sm"
                    >
                      {student.status === 'active' ? 'Actif' : student.status}
                    </Badge>
                    {relation.relationship && (
                      <Badge variant="outline" className="text-xs bg-white/80 backdrop-blur-sm">
                        {relation.relationship}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Body */}
                <CardHeader className="pt-10 sm:pt-12 pb-3 sm:pb-4">
                  <CardTitle className="text-base sm:text-lg font-bold line-clamp-1">
                    {student.firstName} {student.lastName}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1.5 text-sm">
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span className="line-clamp-1">{className}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 sm:space-y-4 flex-1">
                  {/* Informations */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div className="bg-muted/30 rounded-lg p-2 sm:p-2.5">
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Matricule
                      </p>
                      <p className="font-mono font-semibold text-xs sm:text-sm">
                        {student.matricule || "N/A"}
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2 sm:p-2.5">
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Année
                      </p>
                      <p className="font-semibold text-xs sm:text-sm line-clamp-1">
                        {academicYear}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="w-full justify-between group hover:bg-primary/5 hover:border-primary/20"
                      asChild
                    >
                      <a href={`/parent/children/${student.id}/grades`}>
                        <span className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span>Notes & Bulletins</span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
                      </a>
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-between group hover:bg-primary/5 hover:border-primary/20"
                      asChild
                    >
                      <a href={`/parent/children/${student.id}/schedule`}>
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span>Emploi du temps</span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
