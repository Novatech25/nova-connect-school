'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

interface RevenueChartProps {
    payments: any[];
    type?: 'line' | 'bar';
}

export function RevenueChart({ payments, type = 'bar' }: RevenueChartProps) {
    const monthlyData = useMemo(() => {
        const dataMap = new Map<string, { collected: number; expected: number }>();

        // Initialize last 12 months
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.push(key);
            dataMap.set(key, { collected: 0, expected: 0 });
        }

        // Aggregate payments by month
        payments.forEach((payment: any) => {
            const date = new Date(payment.paymentDate || payment.payment_date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (dataMap.has(key)) {
                const current = dataMap.get(key)!;
                current.collected += payment.amount || 0;
                dataMap.set(key, current);
            }
        });

        // Convert to array
        return months.map(month => {
            const [year, monthNum] = month.split('-');
            const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('fr-FR', { month: 'short' });
            const data = dataMap.get(month)!;

            return {
                month: monthName,
                Encaissé: data.collected,
                Attendu: data.expected || data.collected * 1.2, // Mock expected data
            };
        });
    }, [payments]);

    const formatCurrency = (value: number) => {
        return `${(value / 1000).toFixed(0)}k`;
    };

    const ChartComponent = type === 'line' ? LineChart : BarChart;
    const DataComponent = type === 'line' ? Line : Bar;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Évolution des Revenus (12 derniers mois)</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                    <ChartComponent data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={formatCurrency} />
                        <Tooltip
                            formatter={(value: number) => [`${Math.round(value).toLocaleString('fr-FR')} FCFA`, '']}
                        />
                        <Legend />
                        {type === 'line' ? (
                            <>
                                <Line
                                    type="monotone"
                                    dataKey="Encaissé"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="Attendu"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={{ r: 4 }}
                                />
                            </>
                        ) : (
                            <>
                                <Bar dataKey="Encaissé" fill="#10b981" />
                                <Bar dataKey="Attendu" fill="#3b82f6" opacity={0.6} />
                            </>
                        )}
                    </ChartComponent>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
