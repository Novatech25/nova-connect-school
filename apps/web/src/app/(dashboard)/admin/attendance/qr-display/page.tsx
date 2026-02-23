'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { QrCode, Clock, RefreshCw, Loader2, Users, CheckCircle, XCircle } from 'lucide-react';
import { useGenerateQrCode, useSchoolScanLogs, useClasses, useDeactivateQrCode, useUserSchoolId } from '@novaconnect/data';
import QRCode from 'react-qr-code';
import { useToast } from '@/hooks/use-toast';

export default function QrDisplayPage() {
  const [selectedType, setSelectedType] = useState<'school_global' | 'class_specific'>('school_global');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrCodeId, setQrCodeId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  const generateMutation = useGenerateQrCode();
  const deactivateMutation = useDeactivateQrCode();
  const { toast } = useToast();

  // Get current user's school ID from auth context
  const { data: schoolId, isLoading: schoolLoading } = useUserSchoolId();

  // Fetch classes for dropdown
  const { data: classes, isLoading: classesLoading } = useClasses();

  // Fetch recent scan logs (real-time)
  const { data: scanLogs, refetch: refetchLogs } = useSchoolScanLogs(
    schoolId || '', // Use real school ID from context
    {
      startDate: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // Last 15 minutes
    }
  );

  // Countdown timer for QR expiration
  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date();
      const remaining = expiresAt.getTime() - now.getTime();

      if (remaining <= 0) {
        setTimeRemaining(0);
        // Auto-refresh QR when expired
        if (schoolId) handleGenerate();
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, schoolId]);

  // Real-time updates for scan logs
  useEffect(() => {
    const interval = setInterval(() => {
      refetchLogs();
    }, 5000); // Refetch every 5 seconds

    return () => clearInterval(interval);
  }, [refetchLogs]);

  const handleGenerate = async () => {
    if (!schoolId) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger l\'ID de l\'école',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await generateMutation.mutateAsync({
        schoolId,
        codeType: selectedType,
        classId: selectedType === 'class_specific' ? selectedClassId : undefined,
      });

      setQrData(result.qrData);
      setQrCodeId(result.qrCodeId);
      setExpiresAt(new Date(result.expiresAt));

      toast({
        title: 'QR Code généré avec succès',
        description: `Expire dans ${result.rotationIntervalMinutes} minutes`,
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la génération du QR Code',
        variant: 'destructive',
      });
    }
  };

  const handleDeactivate = async () => {
    if (!qrCodeId) return;

    try {
      await deactivateMutation.mutateAsync(qrCodeId);
      setQrData(null);
      setQrCodeId(null);
      setExpiresAt(null);
      setTimeRemaining(0);
      toast({ title: 'QR Code désactivé' });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la désactivation',
        variant: 'destructive',
      });
    }
  };

  if (schoolLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const successCount = scanLogs?.filter(log => log.scan_status === 'success').length || 0;
  const failedCount = scanLogs?.filter(log => log.scan_status !== 'success').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Affichage QR Code</h1>
          <p className="text-muted-foreground mt-1">
            Générez et affichez des QR codes pour la présence des étudiants
          </p>
        </div>
      </div>

      {/* QR Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Configuration du QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type de QR Code</label>
              <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="school_global">Global (toute l'école)</SelectItem>
                  <SelectItem value="class_specific">Par classe</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedType === 'class_specific' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Classe</label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger disabled={classesLoading}>
                    <SelectValue placeholder={classesLoading ? 'Chargement...' : 'Sélectionner une classe'} />
                  </SelectTrigger>
                  <SelectContent>
                    {classes?.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleGenerate}
              disabled={!schoolId || generateMutation.isPending || (selectedType === 'class_specific' && !selectedClassId)}
              className="flex-1"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <QrCode className="mr-2 h-4 w-4" />
                  Générer QR Code
                </>
              )}
            </Button>

            {qrData && (
              <Button onClick={handleDeactivate} variant="outline">
                <XCircle className="mr-2 h-4 w-4" />
                Désactiver
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* QR Code Display */}
      {qrData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>QR Code Actif</span>
              <Badge variant="outline" className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                {formatTime(timeRemaining)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center space-y-6">
              {/* QR Code */}
              <div className="bg-white p-8 rounded-lg shadow-lg">
                <QRCode
                  value={qrData}
                  size={300}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Info */}
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Ce QR code expire automatiquement dans{' '}
                  <span className="font-semibold">{formatTime(timeRemaining)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Les étudiants peuvent scanner ce QR pour enregistrer leur présence
                </p>
              </div>

              {/* Auto-refresh indicator */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4" />
                <span>Rotation automatique à l'expiration</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Scans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Scans Récents
            <Badge variant="secondary">{scanLogs?.length || 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">{successCount}</p>
                <p className="text-sm text-muted-foreground">Succès</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <XCircle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-600">{failedCount}</p>
                <p className="text-sm text-muted-foreground">Échecs</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-600">{scanLogs?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </div>

          {/* Scans List */}
          {scanLogs && scanLogs.length > 0 ? (
            <div className="space-y-2">
              {scanLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {log.scan_status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium">
                        Étudiant #{log.student_id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.scanned_at).toLocaleTimeString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={log.scan_status === 'success' ? 'default' : 'destructive'}
                  >
                    {log.scan_status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun scan pour le moment
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
