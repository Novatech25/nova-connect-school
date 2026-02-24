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
    Calendar,
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
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { generatePaymentReceiptPDF } from "@/lib/paymentReceiptPdf";

import { getStudentPaymentsSecure, getStudentFeeSchedulesSecure, getStudentProfileSecure, getAcademicYearsSecure } from "@/actions/payment-actions";

export default function StudentPaymentsPage() {
    const router = useRouter();
    const { user } = useAuthContext();
    const { toast } = useToast();

    const [student, setStudent] = useState<any>(null);
    const [isLoadingStudent, setIsLoadingStudent] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<any>(null);

    const [feeSchedules, setFeeSchedules] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoadingFees, setIsLoadingFees] = useState(false);
    const [isLoadingPayments, setIsLoadingPayments] = useState(false);

    // Filters
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [selectedType, setSelectedType] = useState<string>("all");
    const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("all");
    const [academicYearsList, setAcademicYearsList] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(''); // filtre par date spécifique
    const [downloadingId, setDownloadingId] = useState<string | null>(null); // ID du reçu en cours de téléchargement

    // --- 1. Fetch Student Profile ---
    const fetchStudentProfile = async () => {
        setIsLoadingStudent(true);
        setError(null);
        setDebugInfo(null);

        try {
            const supabase = getSupabaseClient();

            // Get current auth user if not provided by context
            let authUserId = user?.id;
            if (!authUserId) {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                authUserId = authUser?.id;
            }

            if (!authUserId) {
                setError("Utilisateur non connecté");
                setIsLoadingStudent(false);
                return;
            }

            setDebugInfo((prev: any) => ({ ...prev, authUserId }));

            // Fetch student linked to this user (using Secure Server Action to avoid Ambiguous Embedding / RLS)
            const { data: studentData, error: studentError, code } = await getStudentProfileSecure(authUserId);

            if (studentError) {
                setDebugInfo((prev: any) => ({ ...prev, studentError: studentError, studentCode: code }));
                if (code === 'PGRST116') {
                    setError("Aucun profil étudiant associé à ce compte.");
                } else {
                    // Don't throw, just set error
                    setError("Erreur lors du chargement du profil étudiant.");
                    console.error("Secure fetch error:", studentError);
                }
            } else {
                // Sort enrollments to get the latest one
                if (studentData.enrollments && studentData.enrollments.length > 0) {
                    studentData.enrollments.sort((a: any, b: any) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    );
                    // Initialize academic year filter with current one
                    const currentYearId = studentData.enrollments[0].academic_year_id;
                    if (currentYearId) {
                        setSelectedAcademicYear(currentYearId);
                    }
                }
                setStudent(studentData);
            }
        } catch (err: any) {
            console.error("Error fetching student:", err);
            setError(err.message || "Impossible de charger le profil étudiant");
        } finally {
            setIsLoadingStudent(false);
        }
    };

    useEffect(() => {
        fetchStudentProfile();
    }, []);

    // --- 2. Fetch Financial Data (Secure) ---
    // Fetch ALL data (undefined academicYearId) to allow client-side filtering
    useEffect(() => {
        const fetchFinancialData = async () => {
            if (!student?.id) return;

            // Fetch Academic Years
            if (student.school_id) {
                const { data: years } = await getAcademicYearsSecure(student.school_id);
                if (years) setAcademicYearsList(years);
            }

            // Fetch Fee Schedules
            setIsLoadingFees(true);
            try {
                const { data, error } = await getStudentFeeSchedulesSecure(student.id, undefined);

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

            // Fetch Payments
            setIsLoadingPayments(true);
            try {
                const { data, error } = await getStudentPaymentsSecure(student.id);

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

        if (student) {
            fetchFinancialData();
        }
    }, [student]);

    // --- 3. Calculations (Same logic as Parent Page) ---

    // Filter raw data based on selectedAcademicYear BEFORE calculations
    // This ensures "Total Due" and "Total Paid" reflect the selected year
    const activeFeeSchedules = feeSchedules.filter(f => selectedAcademicYear === "all" || f.academic_year_id === selectedAcademicYear);
    const activePayments = payments.filter(p => {
        if (selectedAcademicYear !== "all") {
            const paymentYearId = p.academic_year_id || p.fee_schedule?.academic_year_id;
            if (paymentYearId !== selectedAcademicYear) return false;
        }
        // Filtre par date spécifique (payment_date ou created_at)
        if (selectedDate) {
            const payDate = (p.payment_date || p.created_at || '').split('T')[0];
            if (payDate !== selectedDate) return false;
        }
        return true;
    });

    // Use 'amount' for the total fee amount (as per schema)
    const totalDue = activeFeeSchedules.reduce((acc: number, fee: any) => acc + (fee.amount || 0), 0);

    // Calculate total paid from PAYMENTS
    const totalPaid = activePayments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);

    // Reste à payer
    const remainingBalance = Math.max(0, totalDue - totalPaid);

    // Prochaine échéance & Status Logic
    const sortedFees = [...activeFeeSchedules].sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    let paidCredit = totalPaid;
    let nextPayment = null;

    for (const fee of sortedFees) {
        const feeAmount = fee.amount || 0;

        if (paidCredit >= feeAmount) {
            paidCredit -= feeAmount;
        } else {
            nextPayment = {
                ...fee,
                remaining_to_pay: feeAmount - paidCredit
            };
            break;
        }
    }

    // Filtered Fees Logic (for display list)
    const filteredFees = activeFeeSchedules.filter((fee: any) => {
        if (selectedStatus !== "all") {
            const isOverdue = new Date(fee.due_date) < new Date();
            if (selectedStatus === "overdue" && !isOverdue) return false;
        }
        if (selectedType !== "all" && fee.fee_type?.id !== selectedType) return false;
        // Filtre par date d'échéance spécifique
        if (selectedDate) {
            const dueDate = (fee.due_date || '').split('T')[0];
            if (dueDate !== selectedDate) return false;
        }
        return true;
    });

    // Unique Fee Types
    const feeTypes = Array.from(new Set(feeSchedules.map((f: any) => JSON.stringify(f.fee_type)))).map((s: any) => JSON.parse(s)).filter(Boolean);

    // Use fetched academic years or fallback to enrollments
    const displayedAcademicYears = academicYearsList.length > 0 ? academicYearsList : (student?.enrollments?.map((e: any) => e.academic_year).filter(Boolean) || []);
    const uniqueAcademicYears = Array.from(new Set(displayedAcademicYears.map((y: any) => y.id)))
        .map(id => displayedAcademicYears.find((y: any) => y.id === id));

    const handleDownloadReceipt = async (payment: any) => {
        if (downloadingId === payment.id) return;
        setDownloadingId(payment.id);
        try {
            await generatePaymentReceiptPDF({
                payment,
                student: {
                    first_name: student.first_name,
                    last_name: student.last_name,
                    matricule: student.matricule,
                    enrollments: student.enrollments,
                },
                school: student.school || undefined,
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
        router.push("/student/mobile-money"); // Adjusted route for student
    };

    // --- Render ---

    if (isLoadingStudent) {
        return <PaymentsLoadingSkeleton />;
    }

    if (error || !student) {
        return <ErrorState error={error} debugInfo={debugInfo} retry={fetchStudentProfile} />;
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
                                Consultez votre historique et vos échéances
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button onClick={handlePayNow} className="hidden sm:flex shadow-sm">
                            <CreditCard className="mr-2 h-4 w-4" />
                            Payer maintenant
                        </Button>
                    </div>
                </div>

                {/* Student Info (Self) */}
                <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-white border border-border/60 shadow-sm">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-base sm:text-lg">
                        {(student.first_name || "E")[0]}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                            {student.first_name} {student.last_name}
                        </h3>
                        <div className="text-xs sm:text-sm text-gray-500 flex items-center gap-2">
                            <span className="hidden sm:inline">Matricule:</span> {student.matricule}
                            {student.enrollments?.[0]?.class?.name && (
                                <>
                                    <span className="text-gray-300">•</span>
                                    <Badge variant="secondary" className="text-[10px] sm:text-xs">
                                        {student.enrollments[0].class.name}
                                    </Badge>
                                </>
                            )}
                        </div>
                    </div>
                </div>

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
                            <Calendar className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold text-blue-700 truncate">
                                {nextPayment
                                    ? format(new Date(nextPayment.due_date), "d MMMM yyyy", { locale: fr })
                                    : "Aucune"}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {nextPayment
                                    ? `${Math.round(nextPayment.remaining_to_pay ?? 0).toLocaleString('fr-FR')} FCFA`
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
                        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                                <SearchableSelect
                                    options={feeTypes.map((type: any) => ({ value: type.id, label: type.name }))}
                                    value={selectedType}
                                    onValueChange={setSelectedType}
                                    placeholder="Tous les types"
                                    searchPlaceholder="Rechercher un type..."
                                    allLabel="Tous les types"
                                />
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                                <label className="text-xs font-medium text-gray-700">Année scolaire</label>
                                <SearchableSelect
                                    options={uniqueAcademicYears.map((year: any) => ({ value: year.id, label: year.name }))}
                                    value={selectedAcademicYear}
                                    onValueChange={setSelectedAcademicYear}
                                    placeholder="Toutes les années"
                                    searchPlaceholder="Rechercher une année..."
                                    allLabel="Toutes les années"
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

                                            // Simple display logic for list items
                                            // We don't have per-fee paid amount in the raw data easily without re-running the allocation logic per item or storing it.
                                            // For display simplicity in the list, we can just show the Due Amount and the Due Date.
                                            // Or we can try to show if it's "past due".

                                            const isOverdue = new Date(fee.due_date) < new Date();

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
                                                        </div>
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
                                ) : activePayments.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        Aucun paiement enregistré.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {activePayments.map((payment: any) => (
                                            <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors gap-4">
                                                <div className="space-y-1">
                                                    <div className="font-medium text-gray-900">
                                                        Paiement #{payment.receipt_number || payment.id.slice(0, 8)}
                                                    </div>
                                                    <div className="text-sm text-gray-500 flex items-center gap-2">
                                                        <Calendar className="h-3 w-3" />
                                                        {format(new Date(payment.payment_date || payment.created_at), "d MMMM yyyy", { locale: fr })}
                                                        <span className="text-gray-300">•</span>
                                                        {payment.payment_method === "CASH" ? "Espèces" :
                                                            payment.payment_method === "MOBILE_MONEY" ? "Mobile Money" :
                                                                payment.payment_method === "BANK_TRANSFER" ? "Virement" : payment.payment_method}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                                                    <div className="text-right">
                                                        <div className="font-bold text-green-700">+{Math.round(payment.amount).toLocaleString('fr-FR')} FCFA</div>
                                                        <div className="text-xs text-gray-500">Validé</div>
                                                    </div>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="flex items-center gap-1.5 text-xs"
                                                        disabled={downloadingId === payment.id}
                                                        onClick={() => handleDownloadReceipt(payment)}
                                                    >
                                                        {downloadingId === payment.id ? (
                                                            <>
                                                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                                <span className="hidden sm:inline">Génération...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Download className="h-3.5 w-3.5 text-gray-700" />
                                                                <span className="hidden sm:inline">Reçu PDF</span>
                                                            </>
                                                        )}
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

function ErrorState({ error, debugInfo, retry }: any) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Paiements</h1>
                    </div>
                    <Button onClick={retry} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Rafraîchir
                    </Button>
                </div>
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            {error || "Erreur de chargement"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm md:text-base text-muted-foreground">{error}</p>
                        {debugInfo && (
                            <details className="bg-muted/50 rounded-lg p-4">
                                <summary className="text-xs font-semibold uppercase tracking-wider cursor-pointer mb-2">Informations techniques</summary>
                                <pre className="text-xs overflow-auto bg-background p-2 rounded">{JSON.stringify(debugInfo, null, 2)}</pre>
                            </details>
                        )}
                        <Button variant="default" asChild>
                            <a href="/student">Retour au tableau de bord</a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
