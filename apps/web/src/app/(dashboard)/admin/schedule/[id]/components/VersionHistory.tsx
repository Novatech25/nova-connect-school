'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Eye, Copy, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDuplicateSchedule } from '@novaconnect/data';
import { ScheduleVersion } from '@novaconnect/core';

interface VersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: string;
  versions: ScheduleVersion[];
}

export default function VersionHistory({
  open,
  onOpenChange,
  scheduleId,
  versions,
}: VersionHistoryProps) {
  const { toast } = useToast();
  const [selectedVersion, setSelectedVersion] = useState<ScheduleVersion | null>(null);
  const [showSnapshot, setShowSnapshot] = useState(false);

  const duplicateScheduleMutation = useDuplicateSchedule();

  const handleDuplicate = async (version: ScheduleVersion) => {
    try {
      await duplicateScheduleMutation.mutateAsync(scheduleId);

      toast({
        title: 'Version dupliquée',
        description: 'Un nouvel EDT brouillon a été créé à partir de cette version.',
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erreur lors de la duplication',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleViewSnapshot = (version: ScheduleVersion) => {
    setSelectedVersion(version);
    setShowSnapshot(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historique des versions</DialogTitle>
            <DialogDescription>
              Consultez l&apos;historique des publications de cet emploi du temps.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Publié par</TableHead>
                  <TableHead>Créneaux</TableHead>
                  <TableHead>Séances générées</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Aucune version publiée pour le moment
                    </TableCell>
                  </TableRow>
                ) : (
                  versions.map((version) => (
                    <TableRow key={version.id}>
                      <TableCell className="font-medium">
                        v{version.version_number}
                      </TableCell>
                      <TableCell>
                        {version.published_at
                          ? format(new Date(version.published_at), 'PPP p', { locale: fr })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {version.published_by_user?.first_name || version.published_by_user?.last_name
                          ? `${version.published_by_user?.first_name || ''} ${version.published_by_user?.last_name || ''}`.trim()
                          : 'Système'}
                      </TableCell>
                      <TableCell>{version.slots_count ?? '-'}</TableCell>
                      <TableCell>{version.sessions_created ?? '-'}</TableCell>
                      <TableCell>
                        <Badge variant="default">Publiée</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewSnapshot(version)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(version)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Snapshot Dialog */}
      <Dialog open={showSnapshot} onOpenChange={setShowSnapshot}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Snapshot v{selectedVersion?.version_number}</DialogTitle>
            <DialogDescription>
              {selectedVersion && selectedVersion.published_at
                ? format(new Date(selectedVersion.published_at), 'PPP p', { locale: fr })
                : '-'}
            </DialogDescription>
          </DialogHeader>

          {selectedVersion?.snapshot && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <h3 className="font-semibold mb-2">Résumé</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Version :</span>{' '}
                    <span className="font-medium">v{selectedVersion.version_number}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Publié le :</span>{' '}
                    <span className="font-medium">
                      {selectedVersion.published_at
                        ? format(new Date(selectedVersion.published_at), 'PPP', { locale: fr })
                        : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Créneaux :</span>{' '}
                    <span className="font-medium">{selectedVersion.slots_count ?? '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Séances générées :</span>{' '}
                    <span className="font-medium">{selectedVersion.sessions_created ?? '-'}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-background p-4">
                <h3 className="font-semibold mb-2">Données du snapshot</h3>
                <pre className="text-xs overflow-auto max-h-96 bg-muted p-4 rounded">
                  {JSON.stringify(selectedVersion.snapshot, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
