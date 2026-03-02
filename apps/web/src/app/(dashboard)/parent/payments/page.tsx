"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@novaconnect/data/providers";
import { getSupabaseClient } from "@novaconnect/data/client";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
    Wallet,
    CreditCard,
    History,
    AlertCircle,
    RefreshCw,
    Download,
    CheckCircle,
    Clock,
    ArrowRight,
    FileText,
    DollarSign,
    Calendar as CalendarIcon,
    ChevronDown,
    Filter
} from "lucide-react";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { generatePaymentReceiptPDF } from "@/lib/paymentReceiptPdf";

// Types
interface Student {
    id: string;
    school_id?: string;
    schoolId?: string;
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

import { getStudentPaymentsSecure, getStudentFeeSchedulesSecure, getAcademicYearsSecure } from "@/actions/payment-actions";

export default function PaymentsPage() {
    const router = useRouter();
    const { user, profile } = useAuthContext();
    const { toast } = useToast();
    const [parentData, setParentData] = useState<ParentData | null>(null);
    const [isLoadingParent, setIsLoadingParent] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<any>(null);
    
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    
    const [feeSchedules, setFeeSchedules] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoadingFees, setIsLoadingFees] = useState(false);
    const [isLoadingPayments, setIsLoadingPayments] = useState(false);

    // Filters
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [selectedType, setSelectedType] = useState<string>("all");
    const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("all");
    const [academicYearsList, setAcademicYearsList] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [periodFilter, setPeriodFilter] = useState<string>("all");
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // --- Data Fetching (Parent & Children) ---
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
            setDebugInfo((prev: any) => ({ ...prev, parentError: parentError.message, parentCode: parentError.code }));
            if (parentError.code === 'PGRST116') {
              setParentData(null);
            } else {
              throw parentError;
            }
          } else {
            setDebugInfo((prev: any) => ({ ...prev, parentFound: true, studentsCount: parent?.students?.length || 0 }));
    
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
          setIsLoadingParent(false);
        }
      };

    useEffect(() => {
        fetchChildren();
    }, []);

    useEffect(() => {
        if (parentData?.students && parentData.students.length > 0 && !selectedStudentId) {
            setSelectedStudentId(parentData.students[0].student.id);
        }
    }, [parentData, selectedStudentId]);

    // --- Derived Data ---
    const selectedStudent = parentData?.students.find((s: any) => s.student.id === selectedStudentId)?.student;

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
        const schoolId = selectedStudent?.school_id || selectedStudent?.schoolId;
        const fetchYears = async () => {
            if (schoolId) {
                const { data: years } = await getAcademicYearsSecure(schoolId);
                if (years) setAcademicYearsList(years);
            }
        };
        fetchYears();
    }, [selectedStudent]);

    // --- Manual Data Fetching for Payments & Fees ---
    useEffect(() => {
        const fetchFinancialData = async () => {
            if (!selectedStudentId) return;

            // 1. Fetch Fee Schedules using Server Action (bypasses RLS)
            // Pass undefined for academicYearId to fetch ALL years, allowing client-side filtering
            setIsLoadingFees(true);
            try {
                const { data, error } = await getStudentFeeSchedulesSecure(selectedStudentId, undefined);
                
                if (error) {
                    console.error("Error fetching fee schedules (secure):", error);
                    setFeeSchedules([]);
                } else {
                    setFeeSchedules(data || []);
                }
            } catch (err) {
                console.error("Error fetching fee schedules:", err);
            } finally {
                setIsLoadingFees(false);
            }

            // 2. Fetch Payments using Server Action (bypasses RLS)
            setIsLoadingPayments(true);
            try {
                const { data, error } = await getStudentPaymentsSecure(selectedStudentId);

                if (error) {
                    console.error("Error fetching payments (secure):", error);
                    setPayments([]);
                } else {
                    setPayments(data || []);
                }
            } catch (err) {
                console.error("Error fetching payments:", err);
            } finally {
                setIsLoadingPayments(false);
            }
        };

        fetchFinancialData();
    }, [selectedStudentId]);

    // --- Helpers & Calculations ---
    
    // Filter raw data based on selectedAcademicYear BEFORE calculations
    const activeFeeSchedules = feeSchedules.filter(f => selectedAcademicYear === "all" || f.academic_year_id === selectedAcademicYear);
    const activePayments = payments.filter(p => {
        if (selectedAcademicYear === "all") return true;
        // Check direct property or nested property from linked fee schedule
        const paymentYearId = p.academic_year_id || p.fee_schedule?.academic_year_id;
        return paymentYearId === selectedAcademicYear;
    });

    // Use 'amount' for the total fee amount (as per schema) instead of 'amount_due' which might be ambiguous
    const totalDue = activeFeeSchedules.reduce((acc: number, fee: any) => acc + (fee.amount || 0), 0);
    
    // Calculate total paid from PAYMENTS
    const totalPaid = activePayments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0); 
    
    // Reste à payer = Total Frais - Total Payé
    // Si totalPaid dépasse totalDue (avance), on affiche 0
    const remainingBalance = Math.max(0, totalDue - totalPaid);

    // Prochaine échéance : 
    // On trie les frais par date d'échéance et on "consomme" le crédit de paiement
    const sortedFees = [...activeFeeSchedules].sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    
    let paidCredit = totalPaid;
    let nextPayment = null;

    for (const fee of sortedFees) {
        const feeAmount = fee.amount || 0; // Use 'amount' here too
        
        // Si le crédit de paiement couvre ce frais
        if (paidCredit >= feeAmount) {
            paidCredit -= feeAmount; 
        } else {
            // Ce frais n'est pas (ou pas entièrement) couvert
            nextPayment = {
                ...fee,
                // Le montant dû pour ce frais spécifique est (Montant Total du Frais - Ce qu'on a pu payer dessus avec le crédit restant)
                remaining_to_pay: feeAmount - paidCredit 
            };
            break; 
        }
    }

    const displayedPayments = activePayments.filter((p: any) => {
        const pDateStr = p.payment_date || p.created_at;
        if (!pDateStr) return false;
        
        const pDate = new Date(pDateStr);
        if (selectedDate) {
            if (format(pDate, 'yyyy-MM-dd') !== format(selectedDate, 'yyyy-MM-dd')) return false;
        } else if (periodFilter !== "all") {
            const end = new Date();
            let start = new Date();
            if (periodFilter === "30days") start.setDate(end.getDate() - 30);
            else if (periodFilter === "90days") start.setDate(end.getDate() - 90);
            else if (periodFilter === "year") start.setFullYear(end.getFullYear() - 1);
            
            start.setHours(0,0,0,0);
            if (pDate < start) return false;
        }
        return true;
    });

    // Filtered Fees Logic for display (needs to be consistent with above)
    // We can't easily inject "virtual status" into the filtered list without complex logic.
    // For now, let's keep the list display based on the raw data, but maybe update the "status" badge visually if we want.
    // But the "Prochaine échéance" card needs to be accurate.

    // Filtered Fees
    const filteredFees = activeFeeSchedules.filter((fee: any) => {
        if (selectedStatus !== "all") {
            const paid = fee.amount_paid || 0;
            const due = fee.amount_due || 0;
            const remaining = due - paid;
            const status = remaining <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
            if (selectedStatus === "paid" && status !== "paid") return false;
            if (selectedStatus === "unpaid" && status !== "unpaid") return false;
            if (selectedStatus === "partial" && status !== "partial") return false;
            if (selectedStatus === "overdue") {
                const isOverdue = new Date(fee.due_date) < new Date() && status !== "paid";
                if (!isOverdue) return false;
            }
        }
        if (selectedType !== "all" && fee.fee_type?.id !== selectedType) return false;
        return true;
    });

    // Unique Fee Types for Filter
    const feeTypes = Array.from(new Set(feeSchedules.map((f: any) => JSON.stringify(f.fee_type)))).map((s: any) => JSON.parse(s)).filter(Boolean);

    // Use fetched academic years or fallback to enrollments
    const displayedAcademicYears = academicYearsList.length > 0 ? academicYearsList : (selectedStudent?.enrollments?.map((e: any) => e.academic_year).filter(Boolean) || []);
    const uniqueAcademicYears = Array.from(new Set(displayedAcademicYears.map((y: any) => y.id)))
        .map(id => displayedAcademicYears.find((y: any) => y.id === id));

    const handleDownloadReceipt = async (payment: any) => {
        if (downloadingId === payment.id) return;
        setDownloadingId(payment.id);
        try {
            await generatePaymentReceiptPDF({
                payment,
                student: {
                    first_name: selectedStudent?.firstName || selectedStudent?.first_name,
                    last_name: selectedStudent?.lastName || selectedStudent?.last_name,
                    matricule: selectedStudent?.matricule,
                    enrollments: selectedStudent?.enrollments,
                },
                school: selectedStudent?.school || undefined,
                totalDue,
                totalPaid,
            });
        } catch (err) {
            console.error('Erreur génération PDF:', err);
            toast({
                title: 'Erreur',
                description: 'Impossible de générer le reçu PDF.',
                variant: 'destructive',
            });
        } finally {
            setDownloadingId(null);
        }
    };

    const handlePayNow = () => {
        router.push("/parent/mobile-money");
    };

    // --- Render Loading ---
    if (isLoadingParent) {
        return <PaymentsLoadingSkeleton />;
    }

    // --- Render Error/Empty ---
    if (error || !parentData?.students || parentData.students.length === 0) {
        return <ErrorState error={error} debugInfo={debugInfo} fetchChildren={fetchChildren} />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
            <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 sm:py-6 space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                            <Wallet className="h-5 w-5 sm:h-7 sm:w-7" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900">
                                Paiements & Factures
                            </h1>
                            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600">
                                Gérez les frais de scolarité et consultez l'historique
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
                                        variant={selectedStudentId === relation.student.id ? "default" : "outline"}
                                        onClick={() => setSelectedStudentId(relation.student.id)}
                                        className="whitespace-nowrap text-xs sm:text-sm h-8 sm:h-10"
                                    >
                                        {relation.student.firstName || relation.student.first_name || "Élève"}
                                    </Button>
                                ))}
                            </div>
                        )}
                        <Button onClick={handlePayNow} className="hidden sm:flex shadow-sm">
                            <CreditCard className="mr-2 h-4 w-4" />
                            Payer maintenant
                        </Button>
                    </div>
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

                {/* Stats Cards */}
                <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-3">
                    {/* Reste à payer */}
                    <Card className="relative overflow-hidden border-orange-200 bg-gradient-to-br from-orange-50 to-white">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600">Reste à payer</CardTitle>
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-700">
                                {Math.round(remainingBalance).toLocaleString('fr-FR')} FCFA
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Solde actuel à régler
                            </p>
                        </CardContent>
                    </Card>

                    {/* Total payé */}
                    <Card className="relative overflow-hidden border-green-200 bg-gradient-to-br from-green-50 to-white">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600">Total payé</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-700">
                                {Math.round(totalPaid).toLocaleString('fr-FR')} FCFA
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Depuis le début de l'année
                            </p>
                        </CardContent>
                    </Card>

                    {/* Prochaine échéance */}
                    <Card className="relative overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600">Prochaine échéance</CardTitle>
                            <CalendarIcon className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold text-blue-700 truncate">
                                {nextPayment 
                                    ? format(new Date(nextPayment.due_date), "d MMMM yyyy", { locale: fr })
                                    : "Aucune"}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {nextPayment 
                                    ? `${(nextPayment.remaining_to_pay ?? (nextPayment.amount_due - (nextPayment.amount_paid || 0))).toLocaleString('fr-FR')} FCFA` 
                                    : "Tout est à jour"}
                            </p>
                        </CardContent>
                    </Card>
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
                        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                            <div className="space-y-1.5 sm:space-y-2">
                                <label className="text-xs font-medium text-gray-700">Statut</label>
                                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9">
                                        <SelectValue placeholder="Tous les statuts" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous les statuts</SelectItem>
                                        <SelectItem value="paid">Payé</SelectItem>
                                        <SelectItem value="partial">Partiel</SelectItem>
                                        <SelectItem value="unpaid">Impayé</SelectItem>
                                        <SelectItem value="overdue">En retard</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <label className="text-xs font-medium text-gray-700">Type de frais</label>
                                <Select value={selectedType} onValueChange={setSelectedType}>
                                    <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9">
                                        <SelectValue placeholder="Tous les types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous les types</SelectItem>
                                        {feeTypes.map((type: any) => (
                                            <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <label className="text-xs font-medium text-gray-700">Année scolaire</label>
                                <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                                    <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9">
                                        <SelectValue placeholder="Toutes les années" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Toutes les années</SelectItem>
                                        {uniqueAcademicYears.map((year: any) => (
                                            <SelectItem key={year.id} value={year.id}>{year.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <label className="text-xs font-medium text-gray-700">Période (Histo.)</label>
                                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                                    <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-9">
                                        <SelectValue placeholder="Période" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Toutes les dates</SelectItem>
                                        <SelectItem value="30days">30 derniers jours</SelectItem>
                                        <SelectItem value="90days">90 derniers jours</SelectItem>
                                        <SelectItem value="year">12 derniers mois</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <label className="text-xs font-medium text-gray-700">Date (Histo.)</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal text-xs sm:text-sm h-8 sm:h-9",
                                                !selectedDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: fr }) : "Date exacte"}
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
                                        {selectedDate && (
                                            <div className="p-2 border-t border-border/60">
                                                <Button 
                                                    variant="ghost" 
                                                    className="w-full text-xs h-8" 
                                                    onClick={() => setSelectedDate(undefined)}
                                                >
                                                    Effacer la date
                                                </Button>
                                            </div>
                                        )}
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabs Content */}
                <Tabs defaultValue="schedule" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                        <TabsTrigger value="schedule">Échéancier</TabsTrigger>
                        <TabsTrigger value="history">Historique</TabsTrigger>
                    </TabsList>

                    {/* Échéancier Tab */}
                    <TabsContent value="schedule" className="space-y-4">
                        <Card className="border-border/60 bg-white/80 shadow-sm">
                            <CardHeader>
                                <CardTitle>Frais de scolarité</CardTitle>
                                <CardDescription>Détail des frais à payer pour l'année en cours</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoadingFees ? (
                                    <div className="space-y-3">
                                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                                    </div>
                                ) : filteredFees.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        Aucun frais trouvé avec ces filtres.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredFees.map((fee: any) => {
                                            const due = fee.amount || 0;
                                            // Pour l'affichage individuel dans la liste, on doit être prudent.
                                            // Si on utilise la logique globale (paidCredit), on risque d'afficher des statuts incohérents si l'ordre n'est pas le même.
                                            // Mais ici on veut juste afficher le montant total du frais.
                                            // Et le "Reste" individuel. 
                                            // Si on a fee.paid_amount fiable en base, on l'utilise. Sinon on estime.
                                            // Le comptable voit "Reste: 775 000". Donc fee.remaining_amount existe peut-être ?
                                            // D'après le schéma, remaining_amount existe. Utilisons-le s'il est > 0, sinon calculons.
                                            const paid = fee.paid_amount ?? fee.amount_paid ?? 0;
                                            const remaining = fee.remaining_amount ?? (due - paid);
                                            
                                            const status = remaining <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
                                            const isOverdue = new Date(fee.due_date) < new Date() && status !== "paid";

                                            return (
                                                <div key={fee.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors gap-4">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-gray-900">{fee.fee_type?.name || "Frais scolarité"}</span>
                                                            {isOverdue && <Badge variant="destructive" className="text-[10px]">En retard</Badge>}
                                                        </div>
                                                        <div className="text-sm text-gray-500 flex items-center gap-2">
                                                            <Clock className="h-3 w-3" />
                                                            Échéance: {format(new Date(fee.due_date), "d MMMM yyyy", { locale: fr })}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                                                        <div className="text-right">
                                                            <div className="font-bold text-gray-900">{Math.round(due).toLocaleString('fr-FR')} FCFA</div>
                                                            <div className="text-xs text-gray-500">
                                                                Reste: <span className={remaining > 0 ? "text-orange-600 font-medium" : "text-green-600"}>{Math.round(remaining).toLocaleString('fr-FR')} FCFA</span>
                                                            </div>
                                                        </div>
                                                        <Badge variant={status === "paid" ? "default" : status === "partial" ? "secondary" : "outline"} className={
                                                            status === "paid" ? "bg-green-100 text-green-700 hover:bg-green-200 border-green-200" : 
                                                            status === "partial" ? "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200" : ""
                                                        }>
                                                            {status === "paid" ? "Payé" : status === "partial" ? "Partiel" : "Impayé"}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="border-t bg-gray-50/50 p-4">
                                <Button className="w-full sm:w-auto ml-auto" onClick={handlePayNow}>
                                    Payer les frais
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    {/* Historique Tab */}
                    <TabsContent value="history" className="space-y-4">
                        <Card className="border-border/60 bg-white/80 shadow-sm">
                            <CardHeader>
                                <CardTitle>Historique des paiements</CardTitle>
                                <CardDescription>Tous les règlements effectués</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoadingPayments ? (
                                    <div className="space-y-3">
                                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                                    </div>
                                ) : displayedPayments.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        Aucun paiement enregistré pour cette période.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {displayedPayments.map((payment: any) => (
                                            <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors gap-4">
                                                <div className="space-y-1">
                                                    <div className="font-medium text-gray-900">
                                                        Paiement #{payment.receipt_number || payment.id.slice(0, 8)}
                                                    </div>
                                                    <div className="text-sm text-gray-500 flex items-center gap-2">
                                                        <CalendarIcon className="h-3 w-3" />
                                                        {format(new Date(payment.payment_date || payment.created_at), "d MMMM yyyy", { locale: fr })}
                                                        <span className="text-gray-300">•</span>
                                                        {payment.payment_method === "CASH" ? "Espèces" : 
                                                         payment.payment_method === "MOBILE_MONEY" ? "Mobile Money" : 
                                                         payment.payment_method === "BANK_TRANSFER" ? "Virement" : payment.payment_method}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                                                    <div className="text-right">
                                                        <div className="font-bold text-green-700">+{Math.round(payment.amount).toLocaleString('fr-FR')} FCFA</div>
                                                        <div className="text-xs text-gray-500">Validé</div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDownloadReceipt(payment)}>
                                                        <Download className="h-4 w-4 text-gray-500" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

function PaymentsLoadingSkeleton() {
    return (
        <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
            </div>
            <Skeleton className="h-96 w-full rounded-xl" />
        </div>
    );
}

function ErrorState({ error, debugInfo, fetchChildren }: any) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Paiements</h1>
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
                            {error ? "Erreur de chargement" : "Aucun enfant associé"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm md:text-base text-muted-foreground">{error || "Il semble qu'aucun élève ne soit associé à votre compte parent."}</p>
                        {debugInfo && (
                            <details className="bg-muted/50 rounded-lg p-4">
                                <summary className="text-xs font-semibold uppercase tracking-wider cursor-pointer mb-2">Informations techniques</summary>
                                <pre className="text-xs overflow-auto bg-background p-2 rounded">{JSON.stringify(debugInfo, null, 2)}</pre>
                            </details>
                        )}
                        <Button variant="default" asChild>
                            <a href="/parent">Retour au tableau de bord</a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
