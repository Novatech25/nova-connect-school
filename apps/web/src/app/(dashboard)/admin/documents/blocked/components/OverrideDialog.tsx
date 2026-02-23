'use client';

import { useState } from 'react';
import { useOverridePaymentBlock } from '@novaconnect/data';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface OverrideDialogProps {
  document: any;
  onClose: () => void;
}

export function OverrideDialog({ document, onClose }: OverrideDialogProps) {
  const [reason, setReason] = useState('');
  const { mutate: override, isPending } = useOverridePaymentBlock();
  const { toast } = useToast();

  const handleOverride = () => {
    if (!reason || reason.trim().length < 10) {
      toast({
        title: 'Erreur',
        description: 'La justification doit contenir au moins 10 caractères',
        variant: 'destructive',
      });
      return;
    }

    override(
      { id: document.documentId, reason },
      {
        onSuccess: () => {
          toast({
            title: 'Succès',
            description: 'Le document a été débloqué',
          });
          onClose();
        },
        onError: (error: any) => {
          toast({
            title: 'Erreur',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Débloquer l'accès au bulletin</DialogTitle>
          <DialogDescription>
            Vous êtes sur le point de débloquer l'accès à ce bulletin malgré les arriérés de paiement.
            Cette action sera enregistrée dans l'audit log.
            <br /><br />
            <strong>Note:</strong> Le déblocage n'est actuellement disponible que pour les bulletins scolaires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm">
              <strong>Élève:</strong> {document.student?.firstName} {document.student?.lastName}
            </p>
            <p className="text-sm">
              <strong>Type de document:</strong> {document.documentType}
            </p>
            <p className="text-sm">
              <strong>Statut de paiement:</strong>{' '}
              <span className="text-red-600 font-medium">{document.paymentStatus}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Justification du déblocage <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Expliquez pourquoi vous débloquez ce document (minimum 10 caractères)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-gray-500">
              Cette justification sera enregistrée et visible dans l'audit log.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={handleOverride} disabled={isPending}>
            {isPending ? 'Déblocage...' : 'Débloquer le document'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
