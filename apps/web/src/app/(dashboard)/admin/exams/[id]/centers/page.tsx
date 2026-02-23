'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { useExamCenters, useCreateExamCenter, userQueries } from '@novaconnect/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function ExamCentersPage() {
  const params = useParams();
  const sessionId = params.id as string;

  // Get current user's school_id from context
  const { data: currentUser } = useQuery(userQueries.getCurrent());

  const { data: centers, isLoading } = useExamCenters(sessionId);
  const { mutate: createCenter, isPending } = useCreateExamCenter();

  const handleAddCenter = () => {
    // Open dialog to create a new center
    // This would typically open a dialog similar to CreateExamSessionDialog
    const name = prompt('Nom du centre:');
    if (name && currentUser?.school_id) {
      createCenter({
        exam_session_id: sessionId,
        school_id: currentUser.school_id,
        name,
      });
    } else if (!currentUser?.school_id) {
      alert('Contexte utilisateur non disponible');
    }
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
            <h1 className="text-3xl font-bold">Centres d'Examen</h1>
            <p className="text-muted-foreground">
              Gestion des centres d'examen pour cette session
            </p>
          </div>
        </div>
        <Button onClick={handleAddCenter} disabled={isPending}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un centre
        </Button>
      </div>

      <Card className="p-6">
        {isLoading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : centers && centers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Capacité</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {centers.map((center) => (
                <TableRow key={center.id}>
                  <TableCell className="font-medium">{center.name}</TableCell>
                  <TableCell>
                    {center.code ? <Badge variant="outline">{center.code}</Badge> : '-'}
                  </TableCell>
                  <TableCell>{center.address || '-'}</TableCell>
                  <TableCell>{center.capacity || '-'}</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      Voir détails
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Aucun centre d'examen configuré
          </div>
        )}
      </Card>
    </div>
  );
}
