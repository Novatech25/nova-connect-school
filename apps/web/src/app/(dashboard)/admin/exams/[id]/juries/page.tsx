'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useExamJuries, useCreateExamJury, userQueries } from '@novaconnect/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function ExamJuriesPage() {
  const params = useParams();
  const sessionId = params.id as string;

  // Get current user's school_id from context
  const { data: currentUser } = useQuery(userQueries.getCurrent());

  const { data: juries, isLoading } = useExamJuries(sessionId);
  const { mutate: createJury, isPending } = useCreateExamJury();

  const handleAddJury = () => {
    const name = prompt('Nom du jury:');
    if (name && currentUser?.school_id) {
      createJury({
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
            <h1 className="text-3xl font-bold">Jurys d'Examen</h1>
            <p className="text-muted-foreground">
              Gestion des jurys pour cette session d'examen
            </p>
          </div>
        </div>
        <Button onClick={handleAddJury} disabled={isPending}>
          <Plus className="mr-2 h-4 w-4" />
          Créer un jury
        </Button>
      </div>

      <Card className="p-6">
        {isLoading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : juries && juries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Président</TableHead>
                <TableHead>Membres</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {juries.map((jury) => (
                <TableRow key={jury.id}>
                  <TableCell className="font-medium">{jury.name}</TableCell>
                  <TableCell>
                    {jury.president_id ? (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>Président assigné</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Non assigné</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{jury.member_ids?.length || 0} membre(s)</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span>{jury.class_ids?.length || 0} classe(s)</span>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      Gérer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Aucun jury configuré pour cette session
          </div>
        )}
      </Card>
    </div>
  );
}
