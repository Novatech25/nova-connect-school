'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Legend,
    Tooltip,
} from 'recharts';

interface FeeTypeDistributionProps {
    schedules: any[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function FeeTypeDistribution({ schedules }: FeeTypeDistributionProps) {
    const distributionData = useMemo(() => {
        const dataMap = new Map<string, number>();

        schedules.forEach((schedule: any) => {
            const feeTypeName = schedule.feeType?.name || schedule.fee_type?.name || 'Autre';
            const amount = schedule.amount || 0;

            dataMap.set(feeTypeName, (dataMap.get(feeTypeName) || 0) + amount);
        });

        return Array.from(dataMap.entries()).map(([name, value]) => ({
            name,
            value,
        })).sort((a, b) => b.value - a.value);
    }, [schedules]);

    const formatCurrency = (value: number) => {
        return `${Math.round(value).toLocaleString('fr-FR')} FCFA`;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Répartition par Type de Frais</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                        <Pie
                            data={distributionData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => `${entry.name}: ${((entry.value / distributionData.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(1)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {distributionData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value: number | undefined) => value ? formatCurrency(value) : '0 FCFA'} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
