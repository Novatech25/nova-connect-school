'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    TrendingUp,
    TrendingDown,
    Users,
    Calendar,
    CreditCard,
    AlertCircle,
} from 'lucide-react';

interface AdvancedAnalyticsProps {
    payments: any[];
    students: any[];
    feeSchedules: any[];
}

const formatCurrency = (value?: number | null) => {
    const safeValue = typeof value === 'number' ? value : 0;
    return `${Math.round(safeValue).toLocaleString('fr-FR')} FCFA`;
};

export function AdvancedAnalytics({ payments, students, feeSchedules }: AdvancedAnalyticsProps) {
    // Calcul des statistiques avancées
    const analytics = useMemo(() => {
        // Paiement moyen
        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const averagePayment = payments.length > 0 ? totalPaid / payments.length : 0;

        // Taux de paiement par élève
        const studentsWithPayments = new Set(payments.map(p => p.studentId || p.student_id));
        const paymentRate = students.length > 0 ? (studentsWithPayments.size / students.length) * 100 : 0;

        // Analyse par méthode de paiement
        const paymentMethods = payments.reduce((acc: any, p) => {
            const method = p.paymentMethod || p.payment_method || 'unknown';
            acc[method] = (acc[method] || 0) + 1;
            return acc;
        }, {});

        const mostUsedMethod = Object.entries(paymentMethods).sort((a: any, b: any) => b[1] - a[1])[0];

        // Analyse temporelle
        const currentMonth = new Date().getMonth();
        const currentMonthPayments = payments.filter(p => {
            const date = new Date(p.paymentDate || p.payment_date);
            return date.getMonth() === currentMonth;
        });
        const currentMonthTotal = currentMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthPayments = payments.filter(p => {
            const date = new Date(p.paymentDate || p.payment_date);
            return date.getMonth() === lastMonth;
        });
        const lastMonthTotal = lastMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        const monthlyGrowth = lastMonthTotal > 0
            ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
            : 0;

        // Élèves en retard (avec échéanciers mais sans paiements récents)
        const studentsWithSchedules = new Set(feeSchedules.map(s => s.studentId || s.student_id));
        const studentsInArrears = Array.from(studentsWithSchedules).filter(studentId => {
            const studentPayments = payments.filter(p =>
                (p.studentId || p.student_id) === studentId
            );
            const studentSchedules = feeSchedules.filter(s =>
                (s.studentId || s.student_id) === studentId
            );

            const totalPaid = studentPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const totalExpected = studentSchedules.reduce((sum, s) => sum + (s.amount || 0), 0);

            return totalPaid < totalExpected;
        }).length;

        // Taux de recouvrement global
        const totalExpected = feeSchedules.reduce((sum, s) => sum + (s.amount || 0), 0);
        const collectionRate = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;

        return {
            averagePayment,
            paymentRate,
            mostUsedMethod,
            currentMonthTotal,
            lastMonthTotal,
            monthlyGrowth,
            studentsInArrears,
            collectionRate,
        };
    }, [payments, students, feeSchedules]);

    const methodLabels: Record<string, string> = {
        cash: 'Espèces',
        bank_transfer: 'Virement',
        check: 'Chèque',
        mobile_money: 'Mobile Money',
        card: 'Carte',
        other: 'Autre',
    };

    return (
        <div className="space-y-6">
            {/* KPIs principaux */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Paiement moyen */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Paiement Moyen</CardTitle>
                        <CreditCard className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {formatCurrency(analytics.averagePayment)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Par transaction
                        </p>
                    </CardContent>
                </Card>

                {/* Taux de paiement */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Taux de Paiement</CardTitle>
                        <Users className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {analytics.paymentRate.toFixed(1)}%
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Élèves ayant payé
                        </p>
                    </CardContent>
                </Card>

                {/* Croissance mensuelle */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Croissance Mensuelle</CardTitle>
                        {analytics.monthlyGrowth >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${analytics.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {analytics.monthlyGrowth >= 0 ? '+' : ''}{analytics.monthlyGrowth.toFixed(1)}%
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            vs mois dernier
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Statistiques détaillées */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Comparaison mensuelle */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Comparaison Mensuelle
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Mois actuel</span>
                            <span className="font-bold text-green-600">
                                {formatCurrency(analytics.currentMonthTotal)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Mois dernier</span>
                            <span className="font-medium text-gray-700">
                                {formatCurrency(analytics.lastMonthTotal)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-sm font-medium">Variation</span>
                            <span className={`font-bold ${analytics.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {analytics.monthlyGrowth >= 0 ? '+' : ''}{analytics.monthlyGrowth.toFixed(1)}%
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Analyse des retards */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            État des Paiements
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Élèves en retard</span>
                            <span className="font-bold text-orange-600">
                                {analytics.studentsInArrears}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Taux de recouvrement</span>
                            <span className={`font-bold ${analytics.collectionRate >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                                {analytics.collectionRate.toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-sm font-medium">Méthode préférée</span>
                            <span className="font-medium text-blue-600">
                                {analytics.mostUsedMethod ? methodLabels[analytics.mostUsedMethod[0]] || analytics.mostUsedMethod[0] : 'N/A'}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Insights et recommandations */}
            <Card className="border-l-4 border-l-blue-500">
                <CardHeader>
                    <CardTitle className="text-base">💡 Insights & Recommandations</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2 text-sm">
                        {analytics.collectionRate < 70 && (
                            <li className="flex items-start gap-2">
                                <span className="text-orange-500 mt-0.5">⚠️</span>
                                <span>Le taux de recouvrement est faible ({analytics.collectionRate.toFixed(1)}%). Considérez des rappels personnalisés.</span>
                            </li>
                        )}
                        {analytics.studentsInArrears > 0 && (
                            <li className="flex items-start gap-2">
                                <span className="text-orange-500 mt-0.5">📋</span>
                                <span>{analytics.studentsInArrears} élève{analytics.studentsInArrears > 1 ? 's ont' : ' a'} des arriérés de paiement.</span>
                            </li>
                        )}
                        {analytics.monthlyGrowth > 10 && (
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">📈</span>
                                <span>Excellente croissance mensuelle de {analytics.monthlyGrowth.toFixed(1)}% !</span>
                            </li>
                        )}
                        {analytics.paymentRate >= 90 && (
                            <li className="flex items-start gap-2">
                                <span className="text-green-500 mt-0.5">✅</span>
                                <span>Excellent taux de participation aux paiements ({analytics.paymentRate.toFixed(1)}%).</span>
                            </li>
                        )}
                        {!analytics.mostUsedMethod && payments.length === 0 && (
                            <li className="flex items-start gap-2">
                                <span className="text-gray-500 mt-0.5">ℹ️</span>
                                <span>Aucune donnée de paiement disponible pour cette période.</span>
                            </li>
                        )}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
