'use client';

import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, PlayCircle, CheckCircle, Send, FileText } from 'lucide-react';
import Link from 'next/link';
import { useExamDeliberations, useCalculateExamResults, usePublishExamResults } from '@novaconnect/data';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ExamDeliberationsPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const { data: deliberations, isLoading } = useExamDeliberations(sessionId);
  const { mutate: calculateResults, isPending: isCalculating } = useCalculateExamResults();
  const { mutate: publishResults, isPending: isPublishing } = usePublishExamResults();

  const handleCalculateResults = (deliberationId: string) => {
    calculateResults(deliberationId);
  };

  const handlePublishResults = (deliberationId: string) => {
    if (confirm('Êtes-vous sûr de vouloir publier les résultats ?')) {
      publishResults(deliberationId);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: 'secondary',
      in_progress: 'default',
      completed: 'default',
      published: 'default',
    };

    const labels: Record<string, string> = {
      pending: 'En attente',
      in_progress: 'En cours',
      completed: 'Terminé',
      published: 'Publié',
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
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
            <h1 className="text-3xl font-bold">Délibérations</h1>
            <p className="text-muted-foreground">
              Gestion des délibérations et résultats
            </p>
          </div>
        </div>
      </div>

      <Card className="p-6">
        {isLoading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : deliberations && deliberations.length > 0 ? (
          <div className="space-y-4">
            {deliberations.map((deliberation) => (
              <div
                key={deliberation.id}
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {deliberation.exam_juries?.name || 'Jury non assigné'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {deliberation.classes?.name || 'Classe non assignée'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(deliberation.deliberation_date), 'PP', { locale: fr })}
                    </p>
                  </div>
                  <div>{getStatusBadge(deliberation.status)}</div>
                </div>

                {/* Statistics */}
                {deliberation.status !== 'pending' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Total élèves</div>
                      <div className="text-2xl font-bold">{deliberation.total_students}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Admis</div>
                      <div className="text-2xl font-bold text-green-600">
                        {deliberation.passed_students}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Refusés</div>
                      <div className="text-2xl font-bold text-red-600">
                        {deliberation.failed_students}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {deliberation.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => handleCalculateResults(deliberation.id)}
                      disabled={isCalculating}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Démarrer la délibération
                    </Button>
                  )}

                  {deliberation.status === 'in_progress' && (
                    <Button
                      size="sm"
                      onClick={() => handleCalculateResults(deliberation.id)}
                      disabled={isCalculating}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Calculer les résultats
                    </Button>
                  )}

                  {deliberation.status === 'completed' && (
                    <Button
                      size="sm"
                      onClick={() => handlePublishResults(deliberation.id)}
                      disabled={isPublishing}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Publier les résultats
                    </Button>
                  )}

                  {deliberation.status === 'completed' && (
                    <Button size="sm" variant="outline">
                      <FileText className="mr-2 h-4 w-4" />
                      Générer le PV
                    </Button>
                  )}

                  <Button size="sm" variant="outline">
                    Voir les détails
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Aucune délibération planifiée
          </div>
        )}
      </Card>
    </div>
  );
}
