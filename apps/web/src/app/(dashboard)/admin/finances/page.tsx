'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuthContext } from '@novaconnect/data/providers';
import {
    usePayments,
    useFeeSchedules,
    useStudents,
    useClasses,
    useIsSuperAdmin,
} from '@novaconnect/data';
import { getAcademicYearsSecure } from '@/actions/payment-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Users,
    Building2,
    Calendar,
    PieChart,
    BarChart3,
    FileText,
    Wallet
} from 'lucide-react';
import { RevenueChart } from './components/RevenueChart';
import { FeeTypeDistribution } from './components/FeeTypeDistribution';
import { SchoolSelector } from './components/SchoolSelector';
import { PaymentsTable } from './components/PaymentsTable';
import { BudgetManager } from './components/BudgetManager';
import { ReportsGenerator } from './components/ReportsGenerator';
import { SearchableSelect } from './components/SearchableSelect';
import { PaymentDetailsModal } from './components/PaymentDetailsModal';
import { AdvancedAnalytics } from './components/AdvancedAnalytics';

const formatCurrency = (value?: number | null) => {
    const safeValue = typeof value === 'number' ? Math.round(value) : 0;
    return `${safeValue.toLocaleString('fr-FR')} FCFA`;
};

export default function AdminFinancesPage() {
    const { user, profile } = useAuthContext();
    const { data: isSuperAdmin = false } = useIsSuperAdmin();

    const userSchoolId =
        profile?.school?.id ||
        profile?.school_id ||
        (user?.user_metadata as any)?.schoolId ||
        (user?.user_metadata as any)?.school_id;

    const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [selectedPayment, setSelectedPayment] = useState<any | null>(null);

    // Use selected school for super admin, or user's school for regular admin
    const activeSchoolId = isSuperAdmin ? (selectedSchoolId || userSchoolId) : userSchoolId;

    useEffect(() => {
        async function loadYears() {
            if (activeSchoolId) {
                const { data } = await getAcademicYearsSecure(activeSchoolId);
                if (data) setAcademicYears(data);
            }
        }
        loadYears();
    }, [activeSchoolId]);

    const defaultAcademicYearId = useMemo(() => {
        const current = academicYears.find((year: any) => year.isCurrent || year.is_current || year.current);
        return current?.id || academicYears[0]?.id || '';
    }, [academicYears]);

    // Initialize selectedAcademicYearId with default when it loads
    useEffect(() => {
        if (defaultAcademicYearId && !selectedAcademicYearId) {
            setSelectedAcademicYearId(defaultAcademicYearId);
        }
    }, [defaultAcademicYearId, selectedAcademicYearId]);

    const activeAcademicYearId = selectedAcademicYearId || defaultAcademicYearId;

    // Get the selected academic year details for date filtering
    const selectedAcademicYear = useMemo(() => {
        return academicYears.find((year: any) => year.id === activeAcademicYearId);
    }, [academicYears, activeAcademicYearId]);

    // Fetch financial data - get ALL payments without academicYearId filter
    // We'll filter by date range instead
    const { data: allPayments = [] } = usePayments({
        schoolId: activeSchoolId || undefined,
        // Don't filter by academicYearId - we'll filter by date
    } as any);

    const { data: feeSchedules = [] } = useFeeSchedules({
        schoolId: activeSchoolId || undefined,
        academicYearId: activeAcademicYearId || undefined,
    } as any);

    const { data: students = [] } = useStudents(activeSchoolId || '');
    const { data: classes = [] } = useClasses(activeSchoolId || '', activeAcademicYearId || undefined);

    // Filter payments by academic year date range
    const payments = useMemo(() => {
        if (!selectedAcademicYear) return allPayments;

        const startDate = selectedAcademicYear.startDate || selectedAcademicYear.start_date;
        const endDate = selectedAcademicYear.endDate || selectedAcademicYear.end_date;

        if (!startDate || !endDate) return allPayments;

        const start = new Date(startDate);
        const end = new Date(endDate);

        return allPayments.filter((payment: any) => {
            const paymentDate = new Date(payment.paymentDate || payment.payment_date);
            return paymentDate >= start && paymentDate <= end;
        });
    }, [allPayments, selectedAcademicYear]);

    // Calculate payment statistics from real data
    const paymentStats = useMemo(() => {
        // Total collected from payments
        const totalCollected = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

        // Total expected and remaining from fee schedules
        const totalExpected = feeSchedules.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
        const totalPaid = feeSchedules.reduce((sum: number, s: any) => sum + (s.paid_amount || s.paidAmount || 0), 0);
        const totalOutstanding = feeSchedules.reduce((sum: number, s: any) => sum + (s.remaining_amount || s.remainingAmount || 0), 0);

        return {
            totalCollected,
            totalExpected,
            totalOutstanding,
            totalPaid,
        };
    }, [payments, feeSchedules]);

    // Calculate additional stats - filtered by academic year
    const totalStudents = useMemo(() => {
        // Get unique student IDs from payments and fee schedules of the current academic year
        const studentIdsSet = new Set<string>();

        // Add students from payments
        payments.forEach((payment: any) => {
            const studentId = payment.studentId || payment.student_id;
            if (studentId) {
                studentIdsSet.add(studentId);
            }
        });

        // Add students from fee schedules
        feeSchedules.forEach((schedule: any) => {
            const studentId = schedule.studentId || schedule.student_id;
            if (studentId) {
                studentIdsSet.add(studentId);
            }
        });

        // If we found students from financial data, use that count
        // Otherwise try to get from class enrollments
        if (studentIdsSet.size > 0) {
            return studentIdsSet.size;
        }

        // Fallback: Get students from class enrollments
        const studentIdsInClasses = new Set<string>();
        classes.forEach((cls: any) => {
            if (cls.enrollments && Array.isArray(cls.enrollments)) {
                cls.enrollments.forEach((enrollment: any) => {
                    if (enrollment.studentId || enrollment.student_id) {
                        studentIdsInClasses.add(enrollment.studentId || enrollment.student_id);
                    }
                });
            }
        });

        return studentIdsInClasses.size > 0 ? studentIdsInClasses.size : students.length;
    }, [payments, feeSchedules, classes, students]);

    const totalClasses = classes.length;

    const recentPayments = useMemo(() => {
        return payments
            .sort((a: any, b: any) => new Date(b.paymentDate || b.payment_date).getTime() - new Date(a.paymentDate || a.payment_date).getTime())
            .slice(0, 5);
    }, [payments]);

    const collectionRate = useMemo(() => {
        if (!paymentStats?.totalExpected || paymentStats.totalExpected === 0) return 0;
        return (paymentStats.totalCollected / paymentStats.totalExpected) * 100;
    }, [paymentStats]);

    // Debug: Log when data changes
    useEffect(() => {
        const startDate = selectedAcademicYear?.startDate || selectedAcademicYear?.start_date;
        const endDate = selectedAcademicYear?.endDate || selectedAcademicYear?.end_date;

        console.log('📊 Dashboard Data Updated:', {
            academicYear: activeAcademicYearId,
            yearDates: startDate && endDate ? `${startDate} → ${endDate}` : 'N/A',
            totalStudents,
            totalClasses,
            allPaymentsCount: allPayments.length,
            paymentsCount: payments.length,
            recentPaymentsCount: recentPayments.length,
        });
    }, [activeAcademicYearId, selectedAcademicYear, totalStudents, totalClasses, allPayments.length, payments.length, recentPayments.length]);

    if (!activeSchoolId) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-gray-500">Chargement...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Gestion Financière</h1>
                    <p className="text-gray-600 mt-1">
                        {isSuperAdmin ? 'Vue multi-écoles' : 'Vue d\'ensemble et gestion des finances'}
                    </p>
                </div>

                {/* Academic Year Selector */}
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Année Scolaire:</label>
                    <SearchableSelect
                        value={activeAcademicYearId}
                        onValueChange={setSelectedAcademicYearId}
                        options={academicYears.map((year: any) => ({
                            value: year.id,
                            label: year.name,
                        }))}
                        placeholder="Sélectionner une année..."
                        className="w-[250px]"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* School Selector for Super Admin */}
                {isSuperAdmin && (
                    <div className="lg:col-span-1">
                        <SchoolSelector
                            schools={[]} // À implémenter : récupérer la liste des écoles
                            selectedSchoolId={selectedSchoolId}
                            onSchoolChange={setSelectedSchoolId}
                            isSuperAdmin={isSuperAdmin}
                        />
                    </div>
                )}

                {/* Main Content */}
                <div className={isSuperAdmin ? 'lg:col-span-3' : 'lg:col-span-4'}>
                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="dashboard">
                                <BarChart3 className="w-4 h-4 mr-2" />
                                Dashboard
                            </TabsTrigger>
                            <TabsTrigger value="payments">
                                <DollarSign className="w-4 h-4 mr-2" />
                                Paiements
                            </TabsTrigger>
                            <TabsTrigger value="reports">
                                <FileText className="w-4 h-4 mr-2" />
                                Rapports
                            </TabsTrigger>
                            <TabsTrigger value="budget">
                                <Wallet className="w-4 h-4 mr-2" />
                                Budget
                            </TabsTrigger>
                            <TabsTrigger value="analytics">
                                <PieChart className="w-4 h-4 mr-2" />
                                Analyses
                            </TabsTrigger>
                        </TabsList>

                        {/* Dashboard Tab */}
                        <TabsContent value="dashboard" className="space-y-6">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Total Encaissé</CardTitle>
                                        <DollarSign className="h-4 w-4 text-green-600" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-green-600">
                                            {formatCurrency(paymentStats?.totalCollected)}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Paiements reçus</p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Total Attendu</CardTitle>
                                        <TrendingUp className="h-4 w-4 text-blue-600" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-blue-600">
                                            {formatCurrency(paymentStats?.totalExpected)}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Montant total</p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">En Attente</CardTitle>
                                        <TrendingDown className="h-4 w-4 text-orange-600" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-orange-600">
                                            {formatCurrency(paymentStats?.totalOutstanding)}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Reste à percevoir</p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Taux de Recouvrement</CardTitle>
                                        <PieChart className="h-4 w-4 text-purple-600" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-purple-600">
                                            {collectionRate.toFixed(0)}%
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Pourcentage collecté</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <RevenueChart payments={payments} type="bar" />
                                <FeeTypeDistribution schedules={feeSchedules} />
                            </div>

                            {/* Secondary Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Élèves</CardTitle>
                                        <Users className="h-4 w-4 text-gray-600" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{totalStudents}</div>
                                        <p className="text-xs text-gray-500 mt-1">Élèves inscrits</p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Classes</CardTitle>
                                        <Building2 className="h-4 w-4 text-gray-600" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{totalClasses}</div>
                                        <p className="text-xs text-gray-500 mt-1">Classes actives</p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Paiements</CardTitle>
                                        <Calendar className="h-4 w-4 text-gray-600" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{payments.length}</div>
                                        <p className="text-xs text-gray-500 mt-1">Transactions</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Recent Payments */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Paiements Récents</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {recentPayments.length === 0 ? (
                                            <p className="text-center text-gray-500 py-8">Aucun paiement récent</p>
                                        ) : (
                                            recentPayments.map((payment: any) => {
                                                const student = students.find((s: any) => s.id === payment.studentId || s.id === payment.student_id);
                                                return (
                                                    <div
                                                        key={payment.id}
                                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                                                    >
                                                        <div>
                                                            <p className="font-medium">
                                                                {student ? `${student.firstName} ${student.lastName}` : 'N/A'}
                                                            </p>
                                                            <p className="text-sm text-gray-500">
                                                                {new Date(payment.paymentDate || payment.payment_date).toLocaleDateString('fr-FR')}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-bold text-green-600">{formatCurrency(payment.amount)}</p>
                                                            <p className="text-sm text-gray-500">{payment.paymentMethod}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Payments Tab */}
                        <TabsContent value="payments">
                            <PaymentsTable
                                payments={payments}
                                students={students as any[]}
                                onViewDetails={setSelectedPayment}
                            />
                        </TabsContent>

                        {/* Reports Tab */}
                        <TabsContent value="reports">
                            <ReportsGenerator schoolId={activeSchoolId} academicYearId={activeAcademicYearId} />
                        </TabsContent>

                        {/* Budget Tab */}
                        <TabsContent value="budget">
                            <BudgetManager schoolId={activeSchoolId} />
                        </TabsContent>

                        {/* Analytics Tab */}
                        <TabsContent value="analytics" className="space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <RevenueChart payments={payments} type="line" />
                                <AdvancedAnalytics
                                    payments={payments}
                                    students={students as any[]}
                                    feeSchedules={feeSchedules}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Payment Details Modal */}
            <PaymentDetailsModal
                payment={selectedPayment}
                student={selectedPayment ? (students as any[]).find((s: any) => s.id === selectedPayment.studentId || s.id === selectedPayment.student_id) : null}
                onClose={() => setSelectedPayment(null)}
            />
        </div>
    );
}
