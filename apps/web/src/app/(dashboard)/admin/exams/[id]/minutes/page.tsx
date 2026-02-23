'use client';

import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Plus, FileText, Download, Signature, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useExamMinutes, useCreateExamMinute, useGenerateExamMinutePDF } from '@novaconnect/data';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ExamMinutesPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const { data: minutes, isLoading } = useExamMinutes(sessionId);
  const { mutate: generatePDF, isPending: isGenerating } = useGenerateExamMinutePDF();

  const handleGeneratePDF = (minuteId: string) => {
    generatePDF(minuteId);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: 'secondary',
      validated: 'default',
      signed: 'default',
      archived: 'outline',
    };

    const labels: Record<string, string> = {
      draft: 'Brouillon',
      validated: 'Validé',
      signed: 'Signé',
      archived: 'Archivé',
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getMinuteTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      session: 'Session',
      deliberation: 'Délibération',
      final: 'Final',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/admin/exams/${sessionId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Procès-Verbaux</h1>
            <p className="text-muted-foreground">
              Gestion des procès-verbaux d'examen
            </p>
          </div>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau PV
        </Button>
      </div>

      <Card className="p-6">
        {isLoading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : minutes && minutes.length > 0 ? (
          <div className="space-y-4">
            {minutes.map((minute) => (
              <div
                key={minute.id}
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{minute.title}</h3>
                      <Badge variant="outline">{getMinuteTypeLabel(minute.minute_type)}</Badge>
                      {getStatusBadge(minute.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Créé le {format(new Date(minute.created_at), 'PPp', { locale: fr })}
                    </p>
                  </div>
                </div>

                {/* Signatures */}
                {minute.signatures && minute.signatures.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Signatures:</div>
                    <div className="space-y-1">
                      {minute.signatures.map((sig: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <Signature className="h-4 w-4" />
                          <span>{sig.role || 'Signataire'}</span>
                          {sig.signed_at ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-muted-foreground">(En attente)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {minute.status === 'draft' && (
                    <Button size="sm" variant="outline">
                      Éditer
                    </Button>
                  )}

                  {minute.status === 'draft' && (
                    <Button
                      size="sm"
                      onClick={() => handleGeneratePDF(minute.id)}
                      disabled={isGenerating}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Valider et générer PDF
                    </Button>
                  )}

                  {minute.status === 'validated' && (
                    <Button size="sm" variant="outline">
                      <Signature className="mr-2 h-4 w-4" />
                      Signer
                    </Button>
                  )}

                  {minute.pdf_url && (
                    <Button size="sm" variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger PDF
                    </Button>
                  )}

                  <Button size="sm" variant="outline">
                    <FileText className="mr-2 h-4 w-4" />
                    Voir le contenu
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Aucun procès-verbal créé
          </div>
        )}
      </Card>
    </div>
  );
}
