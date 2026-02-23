'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth, useStudentCard, useGenerateStudentCardPdf, useRevokeStudentCard, useOverrideCardPaymentStatus } from '@novaconnect/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Download, RefreshCw, AlertTriangle, CheckCircle, XCircle, Settings } from 'lucide-react';
import { format } from 'date-fns';

export default function StudentCardDetailsPage() {
  const params = useParams();
  const cardId = params.id as string;
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: card, isLoading } = useStudentCard(cardId);
  const generatePdf = useGenerateStudentCardPdf();
  const revokeCard = useRevokeStudentCard();
  const overridePayment = useOverrideCardPaymentStatus();

  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

  const handleDownload = async () => {
    if (!card) return;

    try {
      const result = await generatePdf.mutateAsync({
        studentId: card.studentId,
        regenerate: false,
      });

      if (result.signedUrl) {
        window.open(result.signedUrl, '_blank');
      }

      toast({
        title: 'Téléchargement',
        description: 'Carte téléchargée avec succès',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Échec du téléchargement',
        variant: 'destructive',
      });
    }
  };

  const handleRegenerate = async () => {
    if (!card) return;

    try {
      const result = await generatePdf.mutateAsync({
        studentId: card.studentId,
        templateId: card.templateId || undefined,
        regenerate: true,
      });

      if (result.signedUrl) {
        window.open(result.signedUrl, '_blank');
      }

      toast({
        title: 'Carte régénérée',
        description: 'La carte a été régénérée avec succès',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Échec de la régénération',
        variant: 'destructive',
      });
    }
  };

  const handleRevoke = async () => {
    if (!card || !revokeReason.trim()) {
      toast({
        title: 'Erreur',
        description: 'Veuillez fournir une raison',
        variant: 'destructive',
      });
      return;
    }

    try {
      await revokeCard.mutateAsync({
        cardId: card.id,
        reason: revokeReason,
      });

      toast({
        title: 'Carte révoquée',
        description: 'La carte a été révoquée avec succès',
      });

      setRevokeDialogOpen(false);
      setRevokeReason('');
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Échec de la révocation',
        variant: 'destructive',
      });
    }
  };

  const handleOverridePaymentStatus = async (override: boolean, reason?: string) => {
    if (!card) return;

    try {
      await overridePayment.mutateAsync({
        cardId: card.id,
        override,
        reason,
      });

      toast({
        title: 'Statut de paiement modifié',
        description: 'Le statut de paiement a été modifié avec succès',
      });

      setOverrideDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Échec de la modification',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-muted-foreground">Carte non trouvée</div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      expired: 'secondary',
      revoked: 'destructive',
      lost: 'outline',
    };

    const labels: Record<string, string> = {
      active: 'Active',
      expired: 'Expirée',
      revoked: 'Révoquée',
      lost: 'Perdue',
    };

    return (
      <Badge variant={variants[status] || 'default'} className="text-sm">
        {labels[status] || status}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string, override: boolean) => {
    if (override) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="outline">Override</Badge>
          {card.overrideReason && (
            <span className="text-sm text-muted-foreground">({card.overrideReason})</span>
          )}
        </div>
      );
    }

    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      ok: 'default',
      warning: 'secondary',
      blocked: 'destructive',
    };

    const labels: Record<string, string> = {
      ok: 'OK',
      warning: 'Attention',
      blocked: 'Bloqué',
    };

    return (
      <Badge variant={variants[status] || 'default'} className="text-sm">
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Détails de la Carte</h1>
          <p className="text-muted-foreground">
            Carte #{card.card_number}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={!card.pdfUrl || card.status === 'revoked'}
          >
            <Download className="mr-2 h-4 w-4" />
            Télécharger PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={card.status !== 'active'}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Régénérer
          </Button>
          <Button
            variant="destructive"
            onClick={() => setRevokeDialogOpen(true)}
            disabled={card.status === 'revoked'}
          >
            Révoquer
          </Button>
        </div>
      </div>

      {/* Student Information */}
      <Card>
        <CardHeader>
          <CardTitle>Informations de l'élève</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {card.student?.photo_url && (
              <img
                src={card.student.photo_url}
                alt={card.student.first_name}
                className="w-24 h-24 rounded-full object-cover"
              />
            )}
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">
                {card.student?.first_name} {card.student?.last_name}
              </h3>
              <p className="text-muted-foreground">Matricule: {card.student?.matricule || 'N/A'}</p>
              <p className="text-muted-foreground">Classe: {card.student?.classes?.name || 'N/A'}</p>
              {card.student?.campuses && (
                <p className="text-muted-foreground">Campus: {card.student.campuses.name}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations de la carte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Numéro de carte</span>
              <span className="font-mono font-semibold">{card.card_number}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Statut</span>
              {getStatusBadge(card.status)}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Date d'émission</span>
              <span>{format(new Date(card.issue_date), 'dd/MM/yyyy')}</span>
            </div>
            {card.expiry_date && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Date d'expiration</span>
                <span>{format(new Date(card.expiry_date), 'dd/MM/yyyy')}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Modèle</span>
              <span>{card.template?.name || 'Défaut'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Générée le</span>
              <span>{card.generated_at ? format(new Date(card.generated_at), 'dd/MM/yyyy HH:mm') : 'N/A'}</span>
            </div>
            {card.generated_by_user && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Générée par</span>
                <span>{card.generated_by_user.first_name} {card.generated_by_user.last_name}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Statut de paiement</CardTitle>
              {!card.payment_status_override && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOverrideDialogOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Statut</span>
              {getPaymentStatusBadge(card.payment_status, card.payment_status_override)}
            </div>
            {card.payment_status_override && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Override par</span>
                  <span>{card.override_by_user?.first_name} {card.override_by_user?.last_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Raison</span>
                  <span className="text-right max-w-[60%]">{card.overrideReason || 'N/A'}</span>
                </div>
              </>
            )}
            <div className="pt-4 border-t">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  {card.payment_status === 'ok' && !card.payment_status_override
                    ? 'Aucun arriéré de paiement. Accès autorisé.'
                    : card.payment_status === 'warning' && !card.payment_status_override
                    ? 'Arriéré de paiement modéré. Accès autorisé mais surveillance requise.'
                    : card.payment_status === 'blocked' && !card.payment_status_override
                    ? 'Arriéré de paiement important. Accès bloqué.'
                    : 'Statut de paiement manuel override par administrateur.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PDF Preview */}
      {card.pdfUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Aperçu de la carte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-[1.586/1] border rounded-lg flex items-center justify-center bg-muted/20">
              <p className="text-muted-foreground">Aperçu PDF non disponible</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revocation Details */}
      {card.status === 'revoked' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Détails de la révocation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Date de révocation</span>
              <span>{card.revoked_at ? format(new Date(card.revoked_at), 'dd/MM/yyyy HH:mm') : 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Révoquée par</span>
              <span>{card.revoked_by_user?.first_name} {card.revoked_by_user?.last_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">Raison</span>
              <span className="text-right max-w-[60%]">{card.revocationReason || 'N/A'}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revoke Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Révoquer la carte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="revokeReason">Raison de la révocation</Label>
              <Textarea
                id="revokeReason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Ex: Carte perdue, élève parti, etc."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleRevoke}>
                Confirmer la révocation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Override Payment Status Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le statut de paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <p>
                Actuellement: {card.payment_status_override ? 'Override activé' : `Statut automatique: ${card.payment_status}`}
              </p>
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleOverridePaymentStatus(true, 'Accès manuel accordé')}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Activer l'override (accès autorisé)
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleOverridePaymentStatus(false)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Désactiver l'override (retour au statut automatique)
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setOverrideDialogOpen(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
