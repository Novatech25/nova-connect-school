"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext, useSchool } from "@novaconnect/data";
import { getSupabaseClient } from "@novaconnect/data/client";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Users,
    TrendingUp,
    AlertCircle,
    CheckCircle,
    Wallet,
    GraduationCap,
    Clock,
    ArrowRight,
    Calendar,
    Bell
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DashboardStats {
    childrenCount: number;
    totalAbsences: number;
    upcomingPayments: number;
    nextPaymentDue?: string;
    lastGrade?: {
        subject: string;
        score: number;
        maxScore: number;
        studentName: string;
    };
    recentActivity: Array<{
        id: string;
        type: 'grade' | 'attendance' | 'payment' | 'info';
        title: string;
        description: string;
        date: string;
        studentName: string;
    }>;
}

export default function ParentDashboard() {
    const { user, profile } = useAuthContext();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        childrenCount: 0,
        totalAbsences: 0,
        upcomingPayments: 0,
        recentActivity: []
    });

    const schoolId = profile?.school_id || profile?.school?.id || (user?.user_metadata as any)?.school_id || '';
    const { school } = useSchool(schoolId);

    const userName =
        (profile?.first_name && profile?.last_name)
            ? `${profile.first_name} ${profile.last_name}`.trim()
            : (profile?.firstName && profile?.lastName)
            ? `${profile.firstName} ${profile.lastName}`.trim()
            : user?.user_metadata?.firstName
            ? `${user.user_metadata.firstName || ''} ${user.user_metadata.lastName || ''}`.trim()
            : user?.email?.split('@')[0] || 'Parent';

    const schoolName = school?.name || profile?.school?.name || '';

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Bonjour';
        if (hour < 18) return 'Bon après-midi';
        return 'Bonsoir';
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                const supabase = getSupabaseClient();
                const { data: { user: authUser } } = await supabase.auth.getUser();

                if (!authUser) {
                    setIsLoading(false);
                    return;
                }

                // 1. Get Parent & Students
                const { data: parent } = await supabase
                    .from("parents")
                    .select(`
                        id,
                        students:student_parent_relations(
                            student:students(
                                id,
                                first_name,
                                last_name,
                                matricule
                            )
                        )
                    `)
                    .eq("user_id", authUser.id)
                    .single();

                if (!parent || !parent.students) {
                    setIsLoading(false);
                    return;
                }

                const students = parent.students.map((rel: any) => rel.student).filter(Boolean);
                const studentIds = students.map((s: any) => s.id);

                if (studentIds.length === 0) {
                    setIsLoading(false);
                    return;
                }

                // 2. Fetch Absences (Last 30 days)
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                
                const { count: absencesCount } = await supabase
                    .from("attendance_records")
                    .select("id", { count: "exact", head: true })
                    .in("student_id", studentIds)
                    .in("status", ["absent", "late"])
                    .gte("date", thirtyDaysAgo.toISOString().split('T')[0]);

                // 3. Fetch Latest Grade
                const { data: latestGrade } = await supabase
                    .from("grades")
                    .select(`
                        score,
                        max_score,
                        created_at,
                        subject:subjects(name),
                        student:students(first_name)
                    `)
                    .in("student_id", studentIds)
                    .eq("status", "published")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single();

                // 4. Fetch Upcoming Payments (Unpaid Fee Schedules)
                const { data: feeSchedules } = await supabase
                    .from("fee_schedules")
                    .select(`
                        id,
                        amount_due,
                        amount_paid,
                        due_date
                    `)
                    .in("student_id", studentIds)
                    .gt("amount_due", supabase.rpc("get_amount_paid_col")) // Hacky way, better to filter in JS for simple logic
                    .gte("due_date", new Date().toISOString().split('T')[0])
                    .order("due_date", { ascending: true });

                // Filter manually for unpaid fees to be safe
                const unpaidFees = feeSchedules?.filter((fee: any) => (fee.amount_due - (fee.amount_paid || 0)) > 0) || [];
                const nextPayment = unpaidFees[0];

                // 5. Construct Recent Activity
                // This is a simplified aggregation. In a real app, you might want a dedicated 'notifications' or 'activity' table/view.
                const activity: DashboardStats['recentActivity'] = [];

                if (latestGrade) {
                    activity.push({
                        id: 'grade-1',
                        type: 'grade',
                        title: 'Nouvelle note',
                        description: `${latestGrade.score}/${latestGrade.max_score} en ${latestGrade.subject?.name}`,
                        date: latestGrade.created_at,
                        studentName: latestGrade.student?.first_name
                    });
                }
                
                // Add next payment if exists
                if (nextPayment) {
                    activity.push({
                        id: 'payment-1',
                        type: 'payment',
                        title: 'Échéance de paiement',
                        description: `Montant restant: ${Math.round(nextPayment.amount_due - (nextPayment.amount_paid || 0)).toLocaleString('fr-FR')} FCFA`,
                        date: nextPayment.due_date,
                        studentName: "Frais scolaires"
                    });
                }

                setStats({
                    childrenCount: students.length,
                    totalAbsences: absencesCount || 0,
                    upcomingPayments: unpaidFees.length,
                    nextPaymentDue: nextPayment ? nextPayment.due_date : undefined,
                    lastGrade: latestGrade ? {
                        subject: latestGrade.subject?.name,
                        score: latestGrade.score,
                        maxScore: latestGrade.max_score,
                        studentName: latestGrade.student?.first_name
                    } : undefined,
                    recentActivity: activity
                });

                setIsLoading(false);

            } catch (err) {
                console.error("Error loading dashboard:", err);
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [user]);

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="space-y-6">
            {/* En-tête */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-indigo-600 uppercase tracking-widest">
                            {getGreeting()}
                        </p>
                        <h1 className="mt-1 text-2xl md:text-3xl font-bold text-slate-900">
                            {userName} 👋
                        </h1>
                        {schoolName && (
                            <p className="mt-1 text-slate-500 text-sm">{schoolName}</p>
                        )}
                    </div>
                    <div className="text-sm text-gray-500 bg-slate-50 px-4 py-2 rounded-lg border shadow-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(), "d MMMM yyyy", { locale: fr })}
                    </div>
                </div>
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {/* Enfants */}
                <Card className="relative overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 to-white hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/parent/children')}>
                    <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-blue-100/50" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-900">Mes enfants</CardTitle>
                        <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">{stats.childrenCount}</div>
                        <p className="text-xs text-blue-600 mt-1">Inscrits cette année</p>
                    </CardContent>
                </Card>

                {/* Dernières notes */}
                <Card className="relative overflow-hidden border-purple-200 bg-gradient-to-br from-purple-50 to-white hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/parent/grades')}>
                    <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-purple-100/50" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-purple-900">Dernière note</CardTitle>
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-700">
                            {stats.lastGrade ? `${stats.lastGrade.score}/${stats.lastGrade.maxScore}` : "--"}
                        </div>
                        <p className="text-xs text-purple-600 mt-1 truncate">
                            {stats.lastGrade ? `${stats.lastGrade.subject} (${stats.lastGrade.studentName})` : "Aucune note récente"}
                        </p>
                    </CardContent>
                </Card>

                {/* Absences ce mois */}
                <Card className="relative overflow-hidden border-orange-200 bg-gradient-to-br from-orange-50 to-white hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/parent/attendance')}>
                    <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-orange-100/50" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-orange-900">Absences / Retards</CardTitle>
                        <Clock className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700">{stats.totalAbsences}</div>
                        <p className="text-xs text-orange-600 mt-1">30 derniers jours</p>
                    </CardContent>
                </Card>

                {/* Paiement */}
                <Card className="relative overflow-hidden border-green-200 bg-gradient-to-br from-green-50 to-white hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/parent/payments')}>
                    <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-green-100/50" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-900">Paiements à venir</CardTitle>
                        <Wallet className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">{stats.upcomingPayments}</div>
                        <p className="text-xs text-green-600 mt-1">
                            {stats.nextPaymentDue 
                                ? `Prochaine: ${format(new Date(stats.nextPaymentDue), "d MMM", { locale: fr })}`
                                : "Tout est à jour"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Actions Rapides */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-border/60 bg-white/80 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Accès Rapide</CardTitle>
                            <CardDescription>Gérez la scolarité de vos enfants en un clic</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <QuickAction 
                                href="/parent/children" 
                                icon={Users} 
                                title="Mes Enfants" 
                                description="Profils, classes et informations"
                                color="bg-blue-100 text-blue-600"
                            />
                            <QuickAction 
                                href="/parent/grades" 
                                icon={GraduationCap} 
                                title="Notes & Bulletins" 
                                description="Résultats et relevés de notes"
                                color="bg-purple-100 text-purple-600"
                            />
                            <QuickAction 
                                href="/parent/attendance" 
                                icon={Clock} 
                                title="Assiduité" 
                                description="Suivi des présences et retards"
                                color="bg-orange-100 text-orange-600"
                            />
                            <QuickAction 
                                href="/parent/payments" 
                                icon={Wallet} 
                                title="Paiements" 
                                description="Frais de scolarité et factures"
                                color="bg-green-100 text-green-600"
                            />
                        </CardContent>
                    </Card>

                    {/* Activité Récente (Placeholder for now, populated with real data if available) */}
                    <Card className="border-border/60 bg-white/80 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg">Activité Récente</CardTitle>
                                <CardDescription>Derniers événements</CardDescription>
                            </div>
                            <Bell className="h-4 w-4 text-gray-400" />
                        </CardHeader>
                        <CardContent>
                            {stats.recentActivity.length > 0 ? (
                                <div className="space-y-4">
                                    {stats.recentActivity.map((activity) => (
                                        <div key={activity.id} className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0">
                                            <div className={cn(
                                                "mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                                                activity.type === 'grade' ? "bg-purple-100 text-purple-600" :
                                                activity.type === 'payment' ? "bg-green-100 text-green-600" :
                                                "bg-blue-100 text-blue-600"
                                            )}>
                                                {activity.type === 'grade' ? <TrendingUp className="h-4 w-4" /> :
                                                 activity.type === 'payment' ? <Wallet className="h-4 w-4" /> :
                                                 <AlertCircle className="h-4 w-4" />}
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <p className="text-sm font-medium leading-none">{activity.title}</p>
                                                <p className="text-sm text-gray-500">{activity.description}</p>
                                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                                    <span>{format(new Date(activity.date), "d MMMM yyyy", { locale: fr })}</span>
                                                    <span>•</span>
                                                    <span>{activity.studentName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    Aucune activité récente à afficher.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Information / Annonces (Static for now) */}
                <div className="space-y-6">
                    <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-md">
                        <CardHeader>
                            <CardTitle className="text-lg">Besoin d'aide ?</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-blue-100 text-sm">
                                Si vous rencontrez des problèmes avec l'application ou si vous avez des questions sur la scolarité de vos enfants, n'hésitez pas à contacter l'administration.
                            </p>
                            <Button variant="secondary" className="w-full text-blue-700 font-medium hover:bg-blue-50">
                                Contacter l'école
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-white/80 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base">Prochains événements</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex gap-3 items-start">
                                    <div className="flex flex-col items-center justify-center bg-gray-100 rounded-lg p-2 min-w-[3.5rem]">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Juin</span>
                                        <span className="text-xl font-bold text-gray-900">15</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Réunion Parents-Profs</p>
                                        <p className="text-xs text-gray-500 mt-0.5">18:00 - Salle polyvalente</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 items-start">
                                    <div className="flex flex-col items-center justify-center bg-gray-100 rounded-lg p-2 min-w-[3.5rem]">
                                        <span className="text-xs font-bold text-gray-500 uppercase">Juin</span>
                                        <span className="text-xl font-bold text-gray-900">22</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Fête de l'école</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Toute la journée</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function QuickAction({ href, icon: Icon, title, description, color }: any) {
    return (
        <a 
            href={href}
            className="flex items-center p-3 rounded-lg border hover:bg-gray-50 hover:border-gray-300 transition-all group"
        >
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 group-hover:text-primary transition-colors">{title}</p>
                <p className="text-xs text-gray-500 truncate">{description}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
        </a>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6 p-4">
            <div className="flex justify-between items-center">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Skeleton className="h-64 w-full rounded-xl" />
                    <Skeleton className="h-48 w-full rounded-xl" />
                </div>
                <Skeleton className="h-96 w-full rounded-xl" />
            </div>
        </div>
    );
}
