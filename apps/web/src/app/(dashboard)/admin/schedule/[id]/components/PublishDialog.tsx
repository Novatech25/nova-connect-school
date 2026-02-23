'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { ScheduleConstraint, validateSchedule } from '@novaconnect/core'
import { usePublishSchedule, useScheduleWithSlots } from '@novaconnect/data'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  scheduleName: string
  constraints: ScheduleConstraint[]
}

export default function PublishDialog({
  open,
  onOpenChange,
  scheduleId,
  scheduleName,
  constraints,
}: Readonly<PublishDialogProps>) {
  const { toast } = useToast()
  const [notifyUsers, setNotifyUsers] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)

  const { data: scheduleData } = useScheduleWithSlots(scheduleId)
  const publishMutation = usePublishSchedule()

  const slots = scheduleData?.slots || []

  // Validate schedule
  const validation = validateSchedule(scheduleId, slots, constraints)
  const hasErrors = validation.violations.some((v) => v.severity === 'error')

  const handlePublish = async () => {
    if (hasErrors) {
      toast({
        title: 'Erreur de validation',
        description: 'Veuillez corriger les erreurs avant de publier.',
        variant: 'destructive',
      })
      return
    }

    setIsPublishing(true)

    try {
      await publishMutation.mutateAsync({
        scheduleId,
        notifyUsers,
      })

      toast({
        title: 'Emploi du temps publié',
        description: `L'emploi du temps a été publié avec succès.${notifyUsers ? ' Les utilisateurs ont été notifiés.' : ''
          }`,
      })

      onOpenChange(false)
    } catch (error: any) {
      console.error('Erreur publication:', error)
      toast({
        title: 'Erreur lors de la publication',
        description:
          error.message || "Une erreur est survenue lors de la publication.",
        variant: 'destructive',
      })
    } finally {
      setIsPublishing(false)
    }
  }

  // Calculate constraint stats
  const errorCount = validation.violations.filter(
    (v) => v.severity === 'error'
  ).length
  const warningCount = validation.violations.filter(
    (v) => v.severity === 'warning'
  ).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Publier l'emploi du temps</DialogTitle>
          <DialogDescription>
            Vous êtes sur le point de publier l'emploi du temps &quot;
            <span className="font-medium text-foreground">{scheduleName}</span>&quot;.
            Cette action rendra l'emploi du temps visible pour tous les
            enseignants et étudiants concernés.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Validation Status */}
          <div className={`p-4 rounded-lg border ${hasErrors ? 'bg-destructive/10 border-destructive/20' : 'bg-muted/50 border-border'}`}>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              {hasErrors ? (
                <>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Problèmes détectés
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Validation réussie
                </>
              )}
            </h4>

            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Badge variant={errorCount > 0 ? "destructive" : "outline"}>
                  {errorCount}
                </Badge>
                <span className="text-muted-foreground">Erreurs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant={warningCount > 0 ? "secondary" : "outline"} className={warningCount > 0 ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : ""}>
                  {warningCount}
                </Badge>
                <span className="text-muted-foreground">Avertissements</span>
              </div>
            </div>

            {hasErrors ? (
              <p className="text-xs text-destructive mt-2">
                Vous ne pouvez pas publier tant qu&apos;il y a des erreurs bloquantes.
              </p>
            ) : (
              <p className="text-xs text-green-600 mt-2">
                Aucun conflit détecté. L&apos;emploi du temps est prêt à être publié.
              </p>
            )}
          </div>

          {/* Notification option */}
          <div className="flex items-center space-x-2 rounded-lg border p-4">
            <Checkbox
              id="notify"
              checked={notifyUsers}
              onCheckedChange={(checked: boolean) => setNotifyUsers(checked)}
            />
            <label
              htmlFor="notify"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Notifier les utilisateurs (professeurs, élèves, parents)
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
            Annuler
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isPublishing}
            variant={hasErrors ? 'destructive' : 'default'}
          >
            {isPublishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publication en cours...
              </>
            ) : hasErrors ? (
              'Corriger les erreurs'
            ) : (
              'Confirmer la publication'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
