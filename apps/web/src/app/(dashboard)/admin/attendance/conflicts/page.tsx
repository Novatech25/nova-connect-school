'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle2, Clock, User } from 'lucide-react';
import { useAuthContext } from '@novaconnect/data';
import { useConflictingRecords, useMergeAttendanceRecord } from '@novaconnect/data';
import { ConflictResolutionDialog } from './components/ConflictResolutionDialog';
import { formatDate } from '@/lib/utils';

type RecordStatus = 'auto' | 'confirmed' | 'overridden' | 'manual';

const recordStatusConfig: Record<RecordStatus, { label: string; color: string; icon: any }> = {
  auto: { label: 'QR Scan', color: 'bg-blue-100 text-blue-800', icon: Clock },
  confirmed: { label: 'Confirmé', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  overridden: { label: 'Modifié', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  manual: { label: 'Manuel', color: 'bg-gray-100 text-gray-800', icon: User },
};

const statusLabel: Record<string, string> = {
  present: 'Présent',
  absent: 'Absent',
  late: 'Retard',
  excused: 'Excusé',
};

export default function AttendanceConflictsPage() {
  const { profile, user } = useAuthContext();
  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    user?.schoolId ||
    (user as any)?.school_id;
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [dateFilter, setDateFilter] = useState('');

  const { data: conflicts, isLoading, refetch } = useConflictingRecords(
    schoolId || '',
    dateFilter ? { startDate: dateFilter } : undefined
  );

  const mergeMutation = useMergeAttendanceRecord();

  if (!schoolId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Conflits de présence</h1>
        <Card className="p-6">
          <p className="text-red-600">Impossible de charger l'ID de l'école</p>
        </Card>
      </div>
    );
  }

  const handleResolve = async (data: any) => {
    try {
      await mergeMutation.mutateAsync({
        attendanceRecordId: selectedRecord.id,
        ...data,
      });
      setShowResolveDialog(false);
      setSelectedRecord(null);
      refetch();
    } catch (error) {
      console.error('Error resolving conflict:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Conflits de présence</h1>
          <p className="text-gray-600 mt-2">
            Résolvez les conflits entre les présences QR et les marquages professeurs
          </p>
        </div>
        {conflicts && conflicts.length > 0 && (
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {conflicts.length} conflit{conflicts.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Filtrer par date</label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                placeholder="YYYY-MM-DD"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setDateFilter('');
                refetch();
              }}
            >
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conflicts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Enregistrements en conflit</CardTitle>
          <CardDescription>
            Ces enregistrements ont des sources contradictoires qui nécessitent une résolution
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !conflicts || conflicts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-semibold">Aucun conflit détecté</p>
              <p className="text-sm mt-2">Tous les enregistrements de présence sont cohérents</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Classe</th>
                    <th className="text-left py-3 px-4 font-semibold">Élève</th>
                    <th className="text-left py-3 px-4 font-semibold">Source Originale</th>
                    <th className="text-left py-3 px-4 font-semibold">Statut Originale</th>
                    <th className="text-left py-3 px-4 font-semibold">Source Finale</th>
                    <th className="text-left py-3 px-4 font-semibold">Statut Finale</th>
                    <th className="text-left py-3 px-4 font-semibold">État</th>
                    <th className="text-right py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {conflicts.map((record: any) => {
                    const StatusIcon = recordStatusConfig[record.recordStatus || 'manual'].icon;
                    return (
                      <tr key={record.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          {formatDate(record.attendanceSession?.session_date)}
                        </td>
                        <td className="py-3 px-4">
                          {record.attendanceSession?.class?.name || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">
                            {record.student?.first_name} {record.student?.last_name}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {record.originalSource === 'qr_scan' ? 'QR Scan' : 'Manuel'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {statusLabel[record.metadata?.previousStatus] || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {record.source === 'qr_scan' ? 'QR Scan' : 'Manuel'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {statusLabel[record.status]}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={recordStatusConfig[record.recordStatus || 'manual'].color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {recordStatusConfig[record.recordStatus || 'manual'].label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedRecord(record);
                              setShowResolveDialog(true);
                            }}
                          >
                            Résoudre
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolution Dialog */}
      {showResolveDialog && selectedRecord && (
        <ConflictResolutionDialog
          record={selectedRecord}
          open={showResolveDialog}
          onOpenChange={setShowResolveDialog}
          onResolve={handleResolve}
          isLoading={mergeMutation.isPending}
        />
      )}
    </div>
  );
}





