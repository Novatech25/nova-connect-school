'use client';

import { useState } from 'react';
import { useCalculateRoomAssignments, useSchoolSettings } from '@novaconnect/data';
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
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, parseISO, isAfter, isBefore, isEqual } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calculator, AlertTriangle, CheckCircle2, Info, Loader2, Calendar as CalendarIcon, UploadCloud, Sparkles } from 'lucide-react';

interface CalculateRoomAssignmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  scheduleId?: string;
}

export function CalculateRoomAssignmentsDialog({
  open,
  onOpenChange,
  schoolId,
  scheduleId,
}: CalculateRoomAssignmentsDialogProps) {
  const { toast } = useToast();
  const { data: settings } = useSchoolSettings(schoolId);
  const calculateMutation = useCalculateRoomAssignments();

  const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [autoPublish, setAutoPublish] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);

  const isEnabled = settings?.dynamicRoomAssignment?.enabled;

  const handleCalculate = async () => {
    setDebugError(null);
    let current = parseISO(startDate);
    const end = parseISO(endDate);

    if (isAfter(current, end)) {
      toast({
        title: 'Erreur',
        description: 'La date de fin doit être ultérieure ou égale à la date de début.',
        variant: 'destructive',
      });
      return;
    }

    try {
      let totalCreated = 0;
      let totalUpdated = 0;
      let allInsufficient: any[] = [];
      let errors: string[] = [];
      let successCount = 0;

      while (isBefore(current, end) || isEqual(current, end)) {
        const sessionDate = format(current, 'yyyy-MM-dd');
        console.log('🚀 Calculating for date', { sessionDate });

        try {
          const result = await calculateMutation.mutateAsync({
            schoolId,
            scheduleId,
            sessionDate,
            autoPublish,
          });

          if (result.success) {
            successCount++;
            totalCreated += result.assignmentsCreated;
            totalUpdated += result.assignmentsUpdated;
            if (result.insufficientCapacity) {
              allInsufficient = [...allInsufficient, ...result.insufficientCapacity];
            }
          } else {
            const errorMsg = result.error || result.message || 'Échec inconnu';
            errors.push(`${sessionDate}: ${errorMsg}`);
          }
        } catch (e: any) {
             errors.push(`${sessionDate}: ${e.message || String(e)}`);
        }

        current = addDays(current, 1);
      }

      if (successCount > 0) {
        toast({
          title: 'Calcul terminé',
          description: `${totalCreated} attributions créées, ${totalUpdated} mises à jour pour ${successCount} jour(s).`,
        });

        if (allInsufficient.length > 0) {
          toast({
            title: 'Capacités insuffisantes détectées',
            description: `${allInsufficient.length} créneaux nécessitent une attention particulière.`,
            variant: 'destructive',
          });
        }
      }

      if (errors.length > 0) {
        const errorText = errors.join('\n');
        setDebugError(errorText);
        toast({
          title: 'Erreurs lors du calcul',
          description: 'Certaines dates n\'ont pas pu être traitées.',
          variant: 'destructive',
        });
      }

      if (errors.length === 0 && successCount > 0) {
        onOpenChange(false);
      }
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.error('❌ Exception caught:', error);
      setDebugError(errorMsg);
      toast({
        title: 'Erreur',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] gap-0 p-0 overflow-hidden border-border/50 shadow-2xl rounded-2xl">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 pb-5 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shadow-inner">
                <Calculator className="h-5 w-5" />
              </div>
              <span className="font-semibold tracking-tight">Attribution des salles</span>
            </DialogTitle>
            <DialogDescription className="pt-3 text-sm flex-col">
              Calcule automatiquement la répartition optimale des élèves dans les salles disponibles pour vos séances.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6">
          {!isEnabled ? (
            <Alert variant="destructive" className="border-red-500/20 bg-red-500/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-red-600 dark:text-red-400 font-medium">
                Le module d'attribution automatique des salles n'est pas activé. 
                Veuillez l'activer dans Paramètres → Attrib. Salles.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              {/* Date selection section */}
              <div className="group rounded-xl border border-border/60 bg-muted/10 p-4 transition-all hover:bg-muted/20 hover:border-primary/20 hover:shadow-sm">
                <Label className="flex items-center gap-2 text-sm font-medium mb-3">
                  <CalendarIcon className="h-4 w-4 text-primary/70" />
                  Date cible ou période des cours
                </Label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <Label htmlFor="startDate" className="text-xs text-muted-foreground">Date de début</Label>
                    <Input
                      id="startDate"
                      type="date"
                      className="bg-background border-border/50 focus-visible:ring-primary/20 h-10 transition-all font-medium"
                      value={startDate}
                      onChange={(e) => {
                         setStartDate(e.target.value);
                         if (isAfter(parseISO(e.target.value), parseISO(endDate))) {
                            setEndDate(e.target.value);
                         }
                      }}
                      min={format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <Label htmlFor="endDate" className="text-xs text-muted-foreground">Date de fin</Label>
                    <Input
                      id="endDate"
                      type="date"
                      className="bg-background border-border/50 focus-visible:ring-primary/20 h-10 transition-all font-medium"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                    />
                  </div>
                </div>
                <p className="mt-3 text-[13px] text-muted-foreground flex items-center gap-1.5 px-1">
                  <Info className="h-3.5 w-3.5 text-primary/60" />
                  Calcul prévu du <strong className="font-medium text-foreground mx-1">{format(parseISO(startDate), 'd MMM', { locale: fr })}</strong> au <strong className="font-medium text-foreground mx-1">{format(parseISO(endDate), 'd MMM yyyy', { locale: fr })}</strong>
                </p>
              </div>

              {/* Advanced Options Grid */}
              <div className="grid grid-cols-1 gap-4">
                 {/* Auto publish */}
                 <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 p-4 transition-all hover:bg-muted/20 hover:border-primary/20 hover:shadow-sm">
                   <div className="space-y-1">
                     <Label htmlFor="autoPublish" className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                       <UploadCloud className="h-4 w-4 text-primary/70" />
                       Publication automatique
                     </Label>
                     <p className="text-[13px] text-muted-foreground pl-6">
                       Publier et notifier immédiatement les résultats
                     </p>
                   </div>
                   <Switch
                     id="autoPublish"
                     checked={autoPublish}
                     onCheckedChange={setAutoPublish}
                     className="data-[state=checked]:bg-primary shadow-sm"
                   />
                 </div>
              </div>

              {/* Algo Info & Configuration */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4.5 relative overflow-hidden">
                 <div className="absolute top-2 right-2 p-2 opacity-[0.03] pointer-events-none">
                   <Calculator className="h-32 w-32" />
                 </div>
                 <h4 className="flex items-center gap-2 text-sm font-semibold text-primary mb-3.5">
                   <Sparkles className="h-4 w-4" />
                   Règles du calcul actif
                 </h4>
                 <ul className="space-y-2.5 text-[13px] text-primary/80 relative z-10">
                   <li className="flex items-start gap-2.5">
                     <div className="mt-0.5 rounded-full bg-primary/20 p-0.5">
                       <CheckCircle2 className="h-3 w-3 text-primary" />
                     </div>
                     <span className="leading-snug">Regroupement optimisé par professeur et matière</span>
                   </li>
                   <li className="flex items-start gap-2.5">
                     <div className="mt-0.5 rounded-full bg-primary/20 p-0.5">
                       <CheckCircle2 className="h-3 w-3 text-primary" />
                     </div>
                     <span className="leading-snug">
                        Allocation intelligente avec une marge de sécurité de <strong className="font-medium">{settings?.dynamicRoomAssignment?.capacityMarginPercent ?? 0}%</strong>
                     </span>
                   </li>
                   <li className="flex items-start gap-2.5">
                     <div className="mt-0.5 rounded-full bg-primary/20 p-0.5">
                       <CheckCircle2 className="h-3 w-3 text-primary" />
                     </div>
                     <span className="leading-snug">
                       {settings?.dynamicRoomAssignment?.selectionPriority === 'capacity' 
                         ? 'Priorisation des salles selon leur capacité maximale' 
                         : 'Priorisation par catégories et filières adéquates'}
                     </span>
                   </li>
                 </ul>
              </div>

              {/* Debug Error Display */}
              {debugError && (
                <Alert variant="destructive" className="border-red-500/30 bg-red-500/10 rounded-xl">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold text-sm mb-1">Erreur technique :</p>
                    <p className="text-xs font-mono break-all opacity-80 bg-background/50 p-2 rounded mt-2 border border-red-500/20">{debugError}</p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border/50 bg-muted/20 p-4 sm:px-6">
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="hover:bg-muted/80 rounded-lg">
              Annuler
            </Button>
            {isEnabled && (
              <Button 
                onClick={handleCalculate} 
                disabled={calculateMutation.isPending}
                className="bg-primary hover:bg-primary/95 text-primary-foreground shadow-md hover:shadow-lg transition-all rounded-lg font-medium"
              >
                {calculateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2.5 h-4 w-4 animate-spin" />
                    Calcul en cours...
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    Lancer le calcul
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
