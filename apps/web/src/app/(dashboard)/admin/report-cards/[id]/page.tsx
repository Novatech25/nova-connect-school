'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  useOverridePaymentBlock,
  usePublishReportCard,
  useReportCard,
  useReportCardSignedUrl,
  useReportCardVersions,
  useGenerateReportCard,
} from '@novaconnect/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  CheckCircle, 
  Download, 
  Shield, 
  RefreshCw,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  generated: 'Soumis',
  published: 'Publie',
  archived: 'Archive',
};

export default function ReportCardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('classic');

  const { data: reportCard, isLoading, refetch } = useReportCard(params.id as string);
  const { data: versions } = useReportCardVersions(params.id as string);
  const publishReportCard = usePublishReportCard();
  const overridePaymentBlock = useOverridePaymentBlock();
  const signedUrlMutation = useReportCardSignedUrl();
  const generateReportCard = useGenerateReportCard();

  const handlePublish = async () => {
    if (!reportCard) return;

    try {
      await publishReportCard.mutateAsync({ id: reportCard.id });
      toast({
        title: 'Succes',
        description: 'Bulletin publie avec succes.',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Echec de la publication.',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async () => {
    if (!reportCard?.pdfUrl) return;
    try {
      const result = await signedUrlMutation.mutateAsync(reportCard.id);
      
      // Ajouter un timestamp à l'URL pour éviter le cache navigateur
      const urlWithTimestamp = new URL(result.signedUrl);
      urlWithTimestamp.searchParams.append('_t', Date.now().toString());
      
      window.open(urlWithTimestamp.toString(), '_blank', 'noopener');
      toast({
        title: 'Telechargement pret',
        description: "Le bulletin PDF s'ouvre dans un nouvel onglet.",
      });
    } catch (error: any) {
      toast({
        title: 'Telechargement impossible',
        description: error?.message || 'Le PDF est indisponible pour le moment.',
        variant: 'destructive',
      });
    }
  };

  const handleRegenerate = async () => {
    if (!reportCard) return;
    
    try {
      toast({
        title: 'Regeneration en cours',
        description: 'Veuillez patienter pendant la creation du nouveau bulletin...',
      });
      
      const result = await generateReportCard.mutateAsync({
        studentId: reportCard.studentId,
        periodId: reportCard.periodId,
        regenerate: true, // Force la regeneration
        templateId: selectedTemplate,
      });
      
      console.log('[Regenerate] Result:', result);
      
      // Ouvrir automatiquement le PDF dans un nouvel onglet
      if (result?.signedUrl) {
        const urlWithTimestamp = new URL(result.signedUrl);
        urlWithTimestamp.searchParams.append('_t', Date.now().toString());
        window.open(urlWithTimestamp.toString(), '_blank', 'noopener');
      }
      
      // Rafraichir les donnees pour avoir le nouveau PDF
      await refetch();
      
      setShowRegenerateDialog(false);
      
      // Verifier si c'est une regeneration reelle ou juste un retour de l'existant
      if (result && typeof result === 'object') {
        toast({
          title: 'Succes',
          description: 'Bulletin regenere avec succes. Le PDF s\'ouvre dans un nouvel onglet.',
        });
      }
    } catch (error: any) {
      console.error('[Regenerate] Error:', error);
      
      // Fermer le dialogue meme en cas d'erreur
      setShowRegenerateDialog(false);
      
      toast({
        title: 'Erreur',
        description: error?.message || 'Echec de la regeneration du bulletin.',
        variant: 'destructive',
      });
    }
  };

  const handleOverridePaymentBlock = async () => {
    if (!reportCard || overrideReason.length < 10) {
      toast({
        title: 'Erreur',
        description: 'La raison doit contenir au moins 10 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await overridePaymentBlock.mutateAsync({
        id: reportCard.id,
        reason: overrideReason,
      });

      toast({
        title: 'Succes',
        description: 'Blocage paiement contourne.',
      });

      setShowOverrideDialog(false);
      setOverrideReason('');
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Echec du contournement.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  if (!reportCard) {
    return <div className="text-center py-8">Bulletin non trouve</div>;
  }

  const subjectAverages = reportCard.subjectAverages || [];
  const paymentBadge =
    reportCard.paymentStatus === 'ok'
      ? { variant: 'outline' as const, className: 'border-emerald-500 text-emerald-600', label: 'OK' }
      : reportCard.paymentStatus === 'warning'
        ? { variant: 'outline' as const, className: 'border-amber-500 text-amber-600', label: 'Attention' }
        : { variant: 'destructive' as const, className: undefined, label: 'Bloque' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-start gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-full border bg-muted">
              {reportCard.student?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={reportCard.student.photoUrl}
                  alt="Photo eleve"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                  {(reportCard.student?.firstName?.[0] || '').toUpperCase()}
                  {(reportCard.student?.lastName?.[0] || '').toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bulletin</p>
              <h1 className="text-2xl font-semibold tracking-tight">
                {reportCard.student?.firstName} {reportCard.student?.lastName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {reportCard.class?.name || '-'} - {reportCard.period?.name || '-'} - Matricule: {reportCard.student?.matricule || '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{STATUS_LABELS[reportCard.status] || reportCard.status}</Badge>
          <Badge variant={paymentBadge.variant} className={paymentBadge.className}>
            Paiement: {paymentBadge.label}
          </Badge>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {reportCard.pdfUrl && (
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={signedUrlMutation.isPending}
          >
            <Download className="mr-2 h-4 w-4" />
            {signedUrlMutation.isPending ? 'Preparation...' : 'Telecharger PDF'}
          </Button>
        )}

        {/* Bouton Regenerer */}
        <Button
          variant="outline"
          onClick={() => setShowRegenerateDialog(true)}
          disabled={generateReportCard.isPending}
          className="border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${generateReportCard.isPending ? 'animate-spin' : ''}`} />
          {generateReportCard.isPending ? 'Regeneration...' : 'Regenerer le PDF'}
        </Button>

        {reportCard.status !== 'published' && (
          <Button onClick={handlePublish} disabled={publishReportCard.isPending}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Publier
          </Button>
        )}

        {reportCard.paymentStatus === 'blocked' && !reportCard.paymentStatusOverride && (
          <Button
            variant="outline"
            onClick={() => setShowOverrideDialog(true)}
          >
            <Shield className="mr-2 h-4 w-4" />
            Debloquer
          </Button>
        )}
      </div>

      {/* Info regeneration */}
      {reportCard.generatedAt && (
        <div className="text-sm text-muted-foreground">
          <FileText className="inline h-4 w-4 mr-1" />
          Derniere generation: {new Date(reportCard.generatedAt).toLocaleString('fr-FR')}
          {reportCard.pdfSizeBytes && (
            <span className="ml-2">({(reportCard.pdfSizeBytes / 1024).toFixed(1)} KB)</span>
          )}
        </div>
      )}

      {/* Test bouton pour forcer Edge Function */}
      <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
        <p className="text-sm text-amber-800 font-medium mb-2">Mode test - Forcer Edge Function</p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              toast({ title: 'Test en cours...', description: 'Appel direct Edge Function' });
              const res = await fetch('/api/regenerate-report-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  studentId: reportCard.studentId,
                  periodId: reportCard.periodId,
                }),
              });
              const data = await res.json();
              console.log('[Test Edge Function]', data);
              if (data.success) {
                await refetch();
                toast({ title: 'Succès', description: 'Bulletin régénéré via Edge Function' });
              } else {
                toast({ title: 'Erreur', description: data.error || 'Échec', variant: 'destructive' });
              }
            } catch (e: any) {
              toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
            }
          }}
        >
          🧪 TEST - Regénérer via Edge Function
        </Button>
      </div>

      <Card className="border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-indigo-900">Infos eleve</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs text-indigo-600 font-medium">Nom complet</p>
              <p className="font-semibold text-slate-900">
                {reportCard.student?.firstName} {reportCard.student?.lastName}
              </p>
            </div>
            <div>
              <p className="text-xs text-indigo-600 font-medium">Matricule</p>
              <p className="font-semibold text-slate-900">{reportCard.student?.matricule}</p>
            </div>
            <div>
              <p className="text-xs text-indigo-600 font-medium">Classe</p>
              <p className="font-semibold text-slate-900">{reportCard.class?.name}</p>
            </div>
            <div>
              <p className="text-xs text-indigo-600 font-medium">Periode</p>
              <p className="font-semibold text-slate-900">{reportCard.period?.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-violet-200 bg-gradient-to-br from-white via-indigo-50/30 to-violet-50/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-violet-900">Resultats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-400 p-4 text-center text-white shadow-md">
              <p className="text-xs uppercase tracking-widest text-indigo-100">Moyenne generale</p>
              <p className="text-3xl font-semibold">
                {Number(reportCard.overallAverage).toFixed(2)}/20
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-400 p-4 text-center text-white shadow-md">
              <p className="text-xs uppercase tracking-widest text-emerald-100">Classement</p>
              <p className="text-3xl font-semibold">
                {reportCard.rankInClass || '-'} / {reportCard.classSize || '-'}
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-violet-600 to-violet-500 p-4 text-center text-white shadow-md">
              <p className="text-xs uppercase tracking-widest text-violet-200">Mention</p>
              {reportCard.mention ? (
                <Badge
                  className="mt-2 text-base px-4 py-2 bg-white/20 backdrop-blur-sm hover:bg-white/30"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    color: 'white',
                  }}
                >
                  {reportCard.mention}
                </Badge>
              ) : (
                <p className="text-lg font-semibold text-violet-100">-</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-base font-semibold text-violet-900">Moyennes par matiere</h3>
            <Badge variant="outline" className="text-xs border-violet-300 text-violet-700">
              {subjectAverages.length} matiere{subjectAverages.length > 1 ? 's' : ''}
            </Badge>
          </div>
          {subjectAverages.length === 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Aucune note publiee pour cette periode.
            </div>
          )}
          <div className="mt-3 space-y-2">
            {subjectAverages.map((subject: any) => {
              const hasDetailedGrades = typeof subject.homeworkAverage === 'number' || typeof subject.examAverage === 'number';
              return (
                <div
                  key={subject.subjectId}
                  className="flex flex-col gap-2 rounded-md border border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-violet-50/50 px-4 py-3 hover:from-indigo-50/70 hover:to-violet-50/70 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-medium text-slate-800">{subject.subjectName}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-indigo-600 font-medium whitespace-nowrap">Coef {subject.coefficient}</span>
                      <span className="font-semibold text-violet-700 whitespace-nowrap">{subject.average?.toFixed(2) || '0.00'}/20</span>
                    </div>
                  </div>
                  {hasDetailedGrades && (
                    <div className="flex items-center justify-end gap-3 text-xs text-slate-500 mt-1 border-t border-indigo-50/50 pt-1">
                      {typeof subject.homeworkAverage === 'number' && (
                        <span>Devoirs: <span className="font-medium text-slate-700">{subject.homeworkAverage.toFixed(2)}</span></span>
                      )}
                      {typeof subject.examAverage === 'number' && (
                        <span>Examen: <span className="font-medium text-slate-700">{subject.examAverage.toFixed(2)}</span></span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 shadow-sm">
        <CardHeader>
          <CardTitle className="text-indigo-900">Metadonnees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-indigo-600 font-medium">Statut</p>
              <Badge variant="outline" className="border-indigo-200 text-indigo-700">{STATUS_LABELS[reportCard.status] || reportCard.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-indigo-600 font-medium">Statut paiement</p>
              <Badge variant={paymentBadge.variant} className={paymentBadge.className}>
                {paymentBadge.label}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-indigo-600 font-medium">Genere le</p>
              <p className="text-slate-800">{reportCard.generatedAt ? new Date(reportCard.generatedAt).toLocaleDateString() : '-'}</p>
            </div>
            <div>
              <p className="text-sm text-indigo-600 font-medium">Publie le</p>
              <p className="text-slate-800">{reportCard.publishedAt ? new Date(reportCard.publishedAt).toLocaleDateString() : '-'}</p>
            </div>
          </div>

          {reportCard.paymentStatusOverride && (
            <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">
                Blocage paiement contourne
              </p>
              <p className="text-sm text-amber-700">{reportCard.overrideReason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {versions && versions.length > 0 && (
        <Card className="border border-violet-100 bg-gradient-to-br from-white to-violet-50/30 shadow-sm">
          <CardHeader>
            <CardTitle className="text-violet-900">Historique des versions ({versions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {versions.map((version: any) => (
                <div
                  key={version.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-violet-100 bg-gradient-to-r from-violet-50/50 to-indigo-50/50 px-4 py-3 hover:from-violet-50/70 hover:to-indigo-50/70 transition-colors"
                >
                  <div>
                    <p className="font-medium text-slate-800">Version {version.versionNumber}</p>
                    <p className="text-sm text-violet-600">
                      Moyenne: {version.overallAverage.toFixed(2)}/20 | Rang: {version.rankInClass}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-700">
                      {new Date(version.changedAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-violet-500">
                      Par {version.changedByUser?.firstName} {version.changedByUser?.lastName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de confirmation pour regeneration */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              Regenerer le bulletin
            </DialogTitle>
            <DialogDescription>
              Cette action va creer une nouvelle version du PDF avec le design actuel.
              L&apos;ancienne version sera conservee dans l&apos;historique.
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
            <AlertTriangle className="inline h-4 w-4 mr-1" />
            <strong>Attention:</strong> Si des notes ont ete modifiees depuis la derniere 
            generation, elles seront prises en compte dans le nouveau bulletin.
          </div>

          <div className="py-2">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Choix de la couleur thématique
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { id: 'classic', name: 'Défaut', desc: 'Selon le niveau', bg: 'bg-slate-800' },
                { id: 'blue', name: 'Bleu', bg: 'bg-blue-700' },
                { id: 'green', name: 'Vert', bg: 'bg-emerald-600' },
                { id: 'purple', name: 'Violet', bg: 'bg-purple-700' },
                { id: 'red', name: 'Rouge', bg: 'bg-rose-700' },
                { id: 'orange', name: 'Orange', bg: 'bg-orange-600' },
              ].map(theme => (
                <label key={theme.id} className={`border rounded-lg p-2 cursor-pointer flex flex-col gap-1 transition-all ${selectedTemplate === theme.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 hover:border-primary/50 bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" className="sr-only" name="template_selection" value={theme.id} checked={selectedTemplate === theme.id} onChange={(e) => setSelectedTemplate(e.target.value)} />
                    <div className={`w-4 h-4 rounded-full ${theme.bg} ${selectedTemplate === theme.id ? 'ring-2 ring-offset-2 ring-primary' : ''}`} />
                    <span className="font-semibold text-slate-900 text-xs">{theme.name}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleRegenerate}
              disabled={generateReportCard.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generateReportCard.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Regeneration...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Confirmer la regeneration
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showOverrideDialog && (
        <Card className="border-dashed border-violet-300 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-amber-900">Contournement du blocage paiement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <textarea
                className="w-full rounded-md border border-amber-200 bg-white p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                rows={3}
                placeholder="Raison du contournement (min. 10 caracteres)"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleOverridePaymentBlock} className="bg-amber-600 hover:bg-amber-700 text-white">
                  Confirmer
                </Button>
                <Button variant="outline" onClick={() => setShowOverrideDialog(false)} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                  Annuler
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
