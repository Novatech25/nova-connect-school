'use client';

import { useState } from 'react';
import { useTeacherHoursBreakdown } from '@novaconnect/data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download } from 'lucide-react';

interface HoursBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  periodId?: string;
}

export function HoursBreakdownDialog({
  open,
  onOpenChange,
  teacherId,
  periodId,
}: HoursBreakdownDialogProps) {
  const { data: breakdown, isLoading } = useTeacherHoursBreakdown(teacherId, periodId);

  const handleExportCSV = () => {
    if (!breakdown || breakdown.length === 0) return;

    const headers = ['Classe', 'Matière', 'Période', 'Heures', 'Séances', 'Taux', 'Montant'];
    const rows = breakdown.map((item) => [
      item.className,
      item.subjectName,
      item.periodName,
      item.totalHours.toFixed(2),
      item.sessionsCount.toString(),
      Math.round(item.hourlyRate).toLocaleString('fr-FR'),
      Math.round(item.amount).toLocaleString('fr-FR'),
    ]);

    // Calculate totals
    const totalHours = breakdown.reduce((sum, item) => sum + item.totalHours, 0);
    const totalSessions = breakdown.reduce((sum, item) => sum + item.sessionsCount, 0);
    const totalAmount = breakdown.reduce((sum, item) => sum + item.amount, 0);

    rows.push([]);
    rows.push(['TOTAL', '', '', totalHours.toFixed(2), totalSessions.toString(), '', Math.round(totalAmount).toLocaleString('fr-FR')]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `breakdown_heures_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Détail des heures par classe et matière</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : breakdown && breakdown.length > 0 ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleExportCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Classe</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Matière</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Période</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Heures</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Séances</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Taux (FCFA)</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Montant (FCFA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {breakdown.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{item.className}</td>
                      <td className="px-4 py-3 text-sm">{item.subjectName}</td>
                      <td className="px-4 py-3 text-sm">{item.periodName}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono">{item.totalHours.toFixed(2)}h</td>
                      <td className="px-4 py-3 text-sm text-right">{item.sessionsCount}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono">{Math.round(item.hourlyRate).toLocaleString('fr-FR')}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono font-semibold">{Math.round(item.amount).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-semibold">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm">TOTAL</td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      {breakdown.reduce((sum, item) => sum + item.totalHours, 0).toFixed(2)}h
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {breakdown.reduce((sum, item) => sum + item.sessionsCount, 0)}
                    </td>
                    <td></td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      {Math.round(breakdown.reduce((sum, item) => sum + item.amount, 0)).toLocaleString('fr-FR')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Aucune donnée de breakdown disponible
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
