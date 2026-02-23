'use client';

import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Users, Shuffle } from 'lucide-react';
import Link from 'next/link';

export default function ExamAssignmentsPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const handleAutoAssign = () => {
    // Auto-assign students to centers based on capacity and proximity
    console.log('Auto-assigning students to centers...');
  };

  const handleManualAssign = () => {
    // Open manual assignment dialog
    console.log('Opening manual assignment dialog...');
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
            <h1 className="text-3xl font-bold">Affectation des Élèves</h1>
            <p className="text-muted-foreground">
              Affectation des élèves aux centres d'examen
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAutoAssign}>
            <Shuffle className="mr-2 h-4 w-4" />
            Affectation automatique
          </Button>
          <Button onClick={handleManualAssign}>
            <Users className="mr-2 h-4 w-4" />
            Affectation manuelle
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="text-center py-8 text-muted-foreground">
          Aucune affectation configurée pour le moment
        </div>
      </Card>

      {/* Assignment Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Total élèves</div>
          <div className="text-2xl font-bold">0</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Élèves affectés</div>
          <div className="text-2xl font-bold">0</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Taux d'affectation</div>
          <div className="text-2xl font-bold">0%</div>
        </Card>
      </div>
    </div>
  );
}
