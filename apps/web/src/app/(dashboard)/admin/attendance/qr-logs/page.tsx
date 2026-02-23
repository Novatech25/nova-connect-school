'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Download, Search, Filter, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useSchoolScanLogs, useQrScanStats, useUserSchoolId } from '@novaconnect/data';
import { DatePickerWithRange } from '@/components/ui/date-picker';
import { addDays, format } from 'date-fns';

export default function QrLogsPage() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: addDays(new Date(), -7),
    to: new Date(),
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get current user's school ID from auth context
  const { data: schoolId, isLoading: schoolLoading } = useUserSchoolId();

  // Fetch scan logs
  const { data: logs, isLoading } = useSchoolScanLogs(
    schoolId || '', // Use real school ID from context
    {
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
      status: statusFilter === 'all' ? undefined : statusFilter,
    }
  );

  // Fetch statistics
  const { data: stats } = useQrScanStats(
    schoolId || '',
    dateRange.from.toISOString(),
    dateRange.to.toISOString()
  );

  if (schoolLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="p-6">
        <p className="text-red-600">Impossible de charger l'ID de l'école. Veuillez vous reconnecter.</p>
      </div>
    );
  }

  // Filter logs by search query
  const filteredLogs = logs?.filter((log) =>
    log.student_id.includes(searchQuery) ||
    log.error_message?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Export to CSV
  const handleExport = () => {
    const headers = ['Date/Heure', 'Étudiant ID', 'Statut', 'Latitude', 'Longitude', 'Message'];
    const rows = filteredLogs.map((log) => [
      new Date(log.scanned_at).toLocaleString('fr-FR'),
      log.student_id,
      log.scan_status,
      log.latitude?.toString() || 'N/A',
      log.longitude?.toString() || 'N/A',
      log.error_message || 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-scans-${format(dateRange.from, 'yyyy-MM-dd')}-${format(dateRange.to, 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'expired_qr':
      case 'invalid_signature':
      case 'rate_limited':
      case 'duplicate_scan':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'out_of_range':
      case 'wrong_class':
      case 'wrong_time':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'success':
        return 'default';
      case 'expired_qr':
      case 'invalid_signature':
      case 'rate_limited':
      case 'duplicate_scan':
        return 'destructive';
      case 'out_of_range':
      case 'wrong_class':
      case 'wrong_time':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Logs de Scan QR</h1>
          <p className="text-muted-foreground mt-1">
            Historique et monitoring des tentatives de scan QR Code
          </p>
        </div>
        <Button onClick={handleExport} disabled={filteredLogs.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Scans</p>
                <p className="text-3xl font-bold mt-2">{stats?.total || 0}</p>
              </div>
              <History className="h-10 w-10 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Succès</p>
                <p className="text-3xl font-bold mt-2 text-green-600">{stats?.success || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.total ? Math.round((stats.success / stats.total) * 100) : 0}% de réussite
                </p>
              </div>
              <CheckCircle className="h-10 w-10 text-green-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Échecs</p>
                <p className="text-3xl font-bold mt-2 text-red-600">
                  {(stats?.expired_qr || 0) +
                   (stats?.invalid_signature || 0) +
                   (stats?.out_of_range || 0) +
                   (stats?.wrong_class || 0) +
                   (stats?.wrong_time || 0) +
                   (stats?.rate_limited || 0) +
                   (stats?.duplicate_scan || 0)}
                </p>
              </div>
              <XCircle className="h-10 w-10 text-red-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tentatives Frauduleuses</p>
                <p className="text-3xl font-bold mt-2 text-orange-600">
                  {(stats?.invalid_signature || 0) +
                   (stats?.rate_limited || 0) +
                   (stats?.out_of_range || 0)}
                </p>
              </div>
              <AlertCircle className="h-10 w-10 text-orange-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <DatePickerWithRange date={dateRange} onChange={setDateRange} />
            </div>

            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="success">Succès</SelectItem>
                  <SelectItem value="expired_qr">QR expiré</SelectItem>
                  <SelectItem value="invalid_signature">Signature invalide</SelectItem>
                  <SelectItem value="out_of_range">Hors zone</SelectItem>
                  <SelectItem value="wrong_class">Mauvaise classe</SelectItem>
                  <SelectItem value="wrong_time">Mauvais horaire</SelectItem>
                  <SelectItem value="rate_limited">Rate limit</SelectItem>
                  <SelectItem value="duplicate_scan">Scan duplicate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (étudiant, message...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des Scans
            <Badge variant="secondary">{filteredLogs.length} entrées</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement des logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun scan trouvé pour cette période
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Heure</TableHead>
                    <TableHead>Étudiant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {new Date(log.scanned_at).toLocaleString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            #{log.student_id.slice(0, 8)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.scan_status)}
                          <Badge variant={getStatusVariant(log.scan_status)}>
                            {log.scan_status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.latitude && log.longitude ? (
                          <a
                            href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm"
                          >
                            {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {log.error_message || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Breakdown */}
      {stats && stats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Répartition des Erreurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.expired_qr > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">QR expiré</span>
                  <Badge variant="destructive">{stats.expired_qr}</Badge>
                </div>
              )}
              {stats.invalid_signature > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Signature invalide</span>
                  <Badge variant="destructive">{stats.invalid_signature}</Badge>
                </div>
              )}
              {stats.out_of_range > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Hors zone GPS</span>
                  <Badge variant="secondary">{stats.out_of_range}</Badge>
                </div>
              )}
              {stats.wrong_class > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Mauvaise classe</span>
                  <Badge variant="secondary">{stats.wrong_class}</Badge>
                </div>
              )}
              {stats.wrong_time > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Mauvais horaire</span>
                  <Badge variant="secondary">{stats.wrong_time}</Badge>
                </div>
              )}
              {stats.rate_limited > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Rate limit dépassé</span>
                  <Badge variant="destructive">{stats.rate_limited}</Badge>
                </div>
              )}
              {stats.duplicate_scan > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Scan duplicate</span>
                  <Badge variant="secondary">{stats.duplicate_scan}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
