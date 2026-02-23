'use client';

import { useTeacherAssignments } from '@novaconnect/data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreVertical } from 'lucide-react';

interface AssignmentsListProps {
  teacherId: string;
  schoolId: string;
}

export function AssignmentsList({ teacherId, schoolId }: AssignmentsListProps) {
  const { data: assignments, isLoading, error } = useTeacherAssignments(teacherId);

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Erreur: {error.message}</div>;
  }

  if (!assignments || assignments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          Aucun devoir créé. Commencez par créer votre premier devoir.
        </p>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Créer un devoir
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {assignments.map((assignment) => (
        <div
          key={assignment.id}
          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg">{assignment.title}</h3>
              <Badge variant={
                assignment.status === 'published' ? 'default' :
                assignment.status === 'draft' ? 'secondary' :
                assignment.status === 'closed' ? 'destructive' : 'outline'
              }>
                {assignment.status === 'published' ? 'Publié' :
                 assignment.status === 'draft' ? 'Brouillon' :
                 assignment.status === 'closed' ? 'Fermé' : 'Archivé'}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Classe: {assignment.class.name}</span>
              <span>Matière: {assignment.subject.name}</span>
              <span>Deadline: {new Date(assignment.dueDate).toLocaleDateString('fr-FR')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-4">
              <div className="text-sm font-medium">
                {assignment._count.submissions} soumissions
              </div>
              <div className="text-xs text-muted-foreground">
                {assignment._count.gradedSubmissions} notées
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

import { Plus } from 'lucide-react';
