'use client';

import { useState } from 'react';
import { useExamSessions } from '@novaconnect/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Eye, Calendar, PlayCircle, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function ExamSessionsTable() {
  const [filters, setFilters] = useState<{
    status?: string;
    examType?: string;
    academicYearId?: string;
  }>({});

  const { data: sessions, isLoading } = useExamSessions(filters);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: 'secondary',
      planned: 'default',
      in_progress: 'default',
      completed: 'default',
      cancelled: 'destructive',
    };

    const labels: Record<string, string> = {
      draft: 'Brouillon',
      planned: 'Planifié',
      in_progress: 'En cours',
      completed: 'Terminé',
      cancelled: 'Annulé',
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getExamTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      composition: 'Composition',
      exam: 'Examen',
      final_exam: 'Examen final',
      certification: 'Certification',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filters.status || 'all'}
          onChange={(e) =>
            setFilters({
              ...filters,
              status: e.target.value === 'all' ? undefined : e.target.value,
            })
          }
          className="px-3 py-2 border rounded-md"
        >
          <option value="all">Tous les statuts</option>
          <option value="draft">Brouillon</option>
          <option value="planned">Planifié</option>
          <option value="in_progress">En cours</option>
          <option value="completed">Terminé</option>
          <option value="cancelled">Annulé</option>
        </select>

        <select
          value={filters.examType || 'all'}
          onChange={(e) =>
            setFilters({
              ...filters,
              examType: e.target.value === 'all' ? undefined : e.target.value,
            })
          }
          className="px-3 py-2 border rounded-md"
        >
          <option value="all">Tous les types</option>
          <option value="composition">Composition</option>
          <option value="exam">Examen</option>
          <option value="final_exam">Examen final</option>
          <option value="certification">Certification</option>
        </select>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Période</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                Aucune session d'examen trouvée
              </TableCell>
            </TableRow>
          ) : (
            sessions?.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="font-medium">{session.name}</TableCell>
                <TableCell>{getExamTypeLabel(session.examType)}</TableCell>
                <TableCell>{session.periods?.name || '-'}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>{format(new Date(session.startDate), 'PP', { locale: fr })}</div>
                    <div className="text-muted-foreground">
                      au {format(new Date(session.endDate), 'PP', { locale: fr })}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(session.status)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="mr-2 h-4 w-4" />
                        Voir détails
                      </DropdownMenuItem>
                      {session.status === 'draft' && (
                        <DropdownMenuItem>
                          <Calendar className="mr-2 h-4 w-4" />
                          Planifier
                        </DropdownMenuItem>
                      )}
                      {session.status === 'planned' && (
                        <DropdownMenuItem>
                          <PlayCircle className="mr-2 h-4 w-4" />
                          Démarrer
                        </DropdownMenuItem>
                      )}
                      {session.status === 'in_progress' && (
                        <DropdownMenuItem>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Compléter
                        </DropdownMenuItem>
                      )}
                      {['draft', 'planned'].includes(session.status) && (
                        <DropdownMenuItem className="text-destructive">
                          <XCircle className="mr-2 h-4 w-4" />
                          Annuler
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
