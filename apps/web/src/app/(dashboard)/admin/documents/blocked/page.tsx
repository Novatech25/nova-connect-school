'use client';

import { useState } from 'react';
import { useBlockedAccessAttempts, useDocumentAccessStats, useCurrentUser, useSchoolSettings } from '@novaconnect/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Info, Settings } from 'lucide-react';
import { OverrideDialog } from './components/OverrideDialog';
import Link from 'next/link';

export default function BlockedDocumentsPage() {
  const { data: currentUser } = useCurrentUser();
  const schoolId = currentUser?.school_id;

  const { data: blockedAttempts, isLoading, error } = useBlockedAccessAttempts(schoolId ?? '');
  const { data: stats } = useDocumentAccessStats(schoolId ?? '');
  const { data: schoolSettings } = useSchoolSettings(schoolId ?? '');

  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  if (isLoading) return <div className="p-6">Chargement...</div>;
  if (error) return <div className="p-6 text-red-600">Erreur: {error.message}</div>;
  if (!schoolId) return <div className="p-6">Impossible de charger les informations de l\'école</div>;

  // Vérifier si le système est configuré
  const paymentBlockingMode = schoolSettings?.paymentBlocking?.mode;
  const isBlockingEnabled = paymentBlockingMode && paymentBlockingMode !== 'OK';
  const isBlockingConfigured = !!schoolSettings?.paymentBlocking;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Documents bloqués</h1>
        <Link href="/admin/settings">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </Button>
        </Link>
      </div>

      {/* Avertissement si le système n'est pas configuré */}
      {!isBlockingConfigured && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800">Système de blocage non configuré</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Le système de blocage de documents basé sur les paiements n&apos;a pas encore été configuré pour cette école.
                Allez dans les <strong>Paramètres</strong> pour activer cette fonctionnalité.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isBlockingEnabled && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-800">Mode: {paymentBlockingMode === 'BLOCKED' ? 'Blocage complet' : 'Avertissement'}</h3>
              <p className="text-sm text-blue-700 mt-1">
                {paymentBlockingMode === 'BLOCKED'
                  ? 'Les documents seront bloqués si les élèves ont des arriérés de paiement.'
                  : 'Les documents resteront accessibles mais un avertissement sera affiché.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total tentatives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalAttempts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Accès bloqués
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.blockedAttempts || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Déblocages admin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.overriddenAccess || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Taux de succès
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.successRate?.toFixed(1) || '0.0'}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blocked Attempts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tentatives d'accès bloquées récentes (Bulletins uniquement)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {blockedAttempts
              ?.filter(attempt => attempt.documentType === 'report_card')
              .map((attempt) => (
              <div
                key={attempt.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="font-medium">
                      {attempt.student?.firstName} {attempt.student?.lastName}
                    </span>
                    <Badge variant="outline">{attempt.student?.matricule}</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    Type: {attempt.documentType} •
                    Utilisateur: {attempt.user?.firstName} {attempt.user?.lastName} •
                    Date: {new Date(attempt.accessedAt).toLocaleString('fr-FR')}
                  </div>
                  {attempt.denialReason && (
                    <div className="text-sm text-red-600 mt-1">
                      {attempt.denialReason}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDocument(attempt)}
                >
                  Débloquer
                </Button>
              </div>
            ))}

            {blockedAttempts?.filter(a => a.documentType === 'report_card').length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p className="font-medium">Aucun accès bloqué récemment</p>
                <p className="text-sm mt-2">
                  {isBlockingEnabled
                    ? 'Les tentatives d\'accès bloqué apparaîtront ici lorsque des utilisateurs essayeront d\'accéder à des documents sans avoir réglé leurs paiements.'
                    : 'Activez le blocage de documents dans les paramètres pour commencer à restreindre l\'accès.'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Override Dialog */}
      {selectedDocument && (
        <OverrideDialog
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}
    </div>
  );
}
