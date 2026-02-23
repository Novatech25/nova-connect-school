'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Search, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from './SearchableSelect';

interface PaymentsTableProps {
    payments: any[];
    students: any[];
    onViewDetails?: (payment: any) => void;
}

const paymentMethodLabels: Record<string, string> = {
    cash: 'Espèces',
    bank_transfer: 'Virement',
    check: 'Chèque',
    mobile_money: 'Mobile Money',
    card: 'Carte',
    other: 'Autre',
};

const formatCurrency = (value?: number | null) => {
    const safeValue = typeof value === 'number' ? value : 0;
    return `${Math.round(safeValue).toLocaleString('fr-FR')} FCFA`;
};

const formatDate = (value?: string | Date | null) => {
    if (!value) return '--';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('fr-FR');
};

export function PaymentsTable({ payments, students, onViewDetails }: PaymentsTableProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const filteredPayments = useMemo(() => {
        return payments.filter((payment) => {
            const student = students.find(s => s.id === payment.studentId || s.id === payment.student_id);
            const studentName = student ? `${student.firstName} ${student.lastName}`.toLowerCase() : '';
            const matchesSearch = studentName.includes(searchQuery.toLowerCase());

            const matchesMethod = paymentMethodFilter === 'all' || payment.paymentMethod === paymentMethodFilter;

            const paymentDate = new Date(payment.paymentDate || payment.payment_date);
            const matchesDateFrom = !dateFrom || paymentDate >= new Date(dateFrom);
            const matchesDateTo = !dateTo || paymentDate <= new Date(dateTo);

            return matchesSearch && matchesMethod && matchesDateFrom && matchesDateTo;
        });
    }, [payments, students, searchQuery, paymentMethodFilter, dateFrom, dateTo]);

    // Debug logging
    useEffect(() => {
        console.log('💰 PaymentsTable:', {
            receivedPayments: payments.length,
            filteredPayments: filteredPayments.length,
            filters: { searchQuery, paymentMethodFilter, dateFrom, dateTo }
        });
    }, [payments.length, filteredPayments.length, searchQuery, paymentMethodFilter, dateFrom, dateTo]);

    const totalAmount = useMemo(() => {
        return filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    }, [filteredPayments]);

    const exportToCSV = () => {
        const headers = ['Date', 'Élève', 'Montant', 'Méthode', 'Référence'];
        const rows = filteredPayments.map(payment => {
            const student = students.find(s => s.id === payment.studentId || s.id === payment.student_id);
            return [
                formatDate(payment.paymentDate || payment.payment_date),
                student ? `${student.firstName} ${student.lastName}` : 'N/A',
                payment.amount,
                paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod,
                payment.referenceNumber || payment.reference_number || '-',
            ];
        });

        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `paiements-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Liste des Paiements</CardTitle>
                    <Button onClick={exportToCSV} variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Exporter CSV
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="relative col-span-2">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            placeholder="Rechercher un élève..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <SearchableSelect
                        value={paymentMethodFilter}
                        onValueChange={setPaymentMethodFilter}
                        options={[
                            { value: 'all', label: 'Toutes les méthodes' },
                            ...Object.entries(paymentMethodLabels).map(([key, label]) => ({
                                value: key,
                                label: label,
                            })),
                        ]}
                        placeholder="Méthode de paiement..."
                        className="w-[200px]"
                    />

                    <div className="flex gap-2">
                        <Input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            placeholder="Date début"
                            className="flex-1"
                        />
                        <Input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            placeholder="Date fin"
                            className="flex-1"
                        />
                    </div>
                </div>

                {/* Summary */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">
                        {filteredPayments.length} paiement(s)
                    </span>
                    <span className="text-sm font-bold text-blue-900">
                        Total: {formatCurrency(totalAmount)}
                    </span>
                </div>

                {/* Table */}
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Élève</TableHead>
                                <TableHead>Montant</TableHead>
                                <TableHead>Méthode</TableHead>
                                <TableHead>Référence</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPayments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                        Aucun paiement trouvé
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredPayments.map((payment) => {
                                    const student = students.find(s => s.id === payment.studentId || s.id === payment.student_id);
                                    return (
                                        <TableRow key={payment.id}>
                                            <TableCell>{formatDate(payment.paymentDate || payment.payment_date)}</TableCell>
                                            <TableCell>
                                                {student ? `${student.firstName} ${student.lastName}` : 'N/A'}
                                            </TableCell>
                                            <TableCell className="font-medium text-green-600">
                                                {formatCurrency(payment.amount)}
                                            </TableCell>
                                            <TableCell>
                                                {paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600">
                                                {payment.referenceNumber || payment.reference_number || '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onViewDetails?.(payment)}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
