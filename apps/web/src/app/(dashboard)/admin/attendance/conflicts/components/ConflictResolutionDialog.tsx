'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { mergeAttendanceRecordSchema } from '@novaconnect/core';

const statusLabel: Record<string, string> = {
  present: 'Présent',
  absent: 'Absent',
  late: 'Retard',
  excused: 'Excusé',
};

interface ConflictResolutionDialogProps {
  record: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (data: any) => void;
  isLoading?: boolean;
}

export function ConflictResolutionDialog({
  record,
  open,
  onOpenChange,
  onResolve,
  isLoading = false,
}: ConflictResolutionDialogProps) {
  const form = useForm({
    resolver: zodResolver(mergeAttendanceRecordSchema),
    defaultValues: {
      newStatus: record.status,
      recordStatus: 'confirmed' as const,
      justification: record.justification || '',
      comment: '',
    },
  });

  const newStatus = form.watch('newStatus');

  const handleSubmit = (data: any) => {
    onResolve(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Résoudre le conflit de présence</DialogTitle>
          <DialogDescription>
            Révision et résolution manuelle du conflit pour {record.student?.first_name} {record.student?.last_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Conflict Summary */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-xs text-gray-500">Source Originale</Label>
              <div className="mt-1">
                <Badge variant="outline">
                  {record.originalSource === 'qr_scan' ? 'QR Scan' : 'Manuel'}
                </Badge>
                <span className="ml-2 font-medium">
                  {statusLabel[record.metadata?.previousStatus] || '-'}
                </span>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Source Actuelle</Label>
              <div className="mt-1">
                <Badge variant="outline">
                  {record.source === 'qr_scan' ? 'QR Scan' : 'Manuel'}
                </Badge>
                <span className="ml-2 font-medium">{statusLabel[record.status]}</span>
              </div>
            </div>
          </div>

          {/* Status Selection */}
          <div className="space-y-3">
            <Label>Statut final</Label>
            <RadioGroup
              value={form.watch('newStatus')}
              onValueChange={(value) => form.setValue('newStatus', value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="present" id="present" />
                <Label htmlFor="present" className="font-normal cursor-pointer">
                  Présent
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="absent" id="absent" />
                <Label htmlFor="absent" className="font-normal cursor-pointer">
                  Absent
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="late" id="late" />
                <Label htmlFor="late" className="font-normal cursor-pointer">
                  Retard
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excused" id="excused" />
                <Label htmlFor="excused" className="font-normal cursor-pointer">
                  Excusé
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Record Status */}
          <div className="space-y-3">
            <Label>Type d'enregistrement</Label>
            <RadioGroup
              value={form.watch('recordStatus')}
              onValueChange={(value) => form.setValue('recordStatus', value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="confirmed" id="confirmed" />
                <Label htmlFor="confirmed" className="font-normal cursor-pointer">
                  Confirmé - Les sources sont maintenant d'accord
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="overridden" id="overridden" />
                <Label htmlFor="overridden" className="font-normal cursor-pointer">
                  Modifié - Une source a remplacé l'autre
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Justification - only for excused */}
          {newStatus === 'excused' && (
            <div className="space-y-2">
              <Label htmlFor="justification">Justification <span className="text-red-500">*</span></Label>
              <Textarea
                id="justification"
                placeholder="Raison de l'absence excusée..."
                value={form.watch('justification')}
                onChange={(e) => form.setValue('justification', e.target.value)}
                rows={3}
              />
              {form.formState.errors.justification && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.justification.message}
                </p>
              )}
            </div>
          )}

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Commentaire (optionnel)</Label>
            <Textarea
              id="comment"
              placeholder="Ajouter un commentaire sur cette résolution..."
              value={form.watch('comment')}
              onChange={(e) => form.setValue('comment', e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={form.handleSubmit(handleSubmit)}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmer la résolution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
