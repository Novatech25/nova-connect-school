'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { ScheduleSlot } from '@novaconnect/core';

interface ConflictAlertProps {
  conflicts: Map<string, string[]>;
  slots: ScheduleSlot[];
}

export default function ConflictAlert({ conflicts, slots }: ConflictAlertProps) {
  if (conflicts.size === 0) {
    return null;
  }

  // Group conflicts by type
  const conflictsByType = new Map<string, ScheduleSlot[]>();
  conflicts.forEach((messages, slotId) => {
    const slot = slots.find((s) => s.id === slotId);
    if (slot) {
      messages.forEach((message) => {
        if (!conflictsByType.has(message)) {
          conflictsByType.set(message, []);
        }
        conflictsByType.get(message)!.push(slot);
      });
    }
  });

  const totalConflicts = conflicts.size;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>Conflits détectés</span>
        <Badge variant="destructive">{totalConflicts} créneau{totalConflicts > 1 ? 'x' : ''}</Badge>
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-3 mt-2">
          <p className="text-sm">
            Des conflits ont été détectés dans l'emploi du temps. Veuillez les résoudre avant publication.
          </p>

          <div className="space-y-2">
            {Array.from(conflictsByType.entries()).map(([message, slots], index) => (
              <div key={index} className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium">{message}</p>
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot) => (
                        <Badge key={slot.id} variant="outline" className="text-xs">
                          {slot.day_of_week} {slot.start_time}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm">
              Ignorer les avertissements
            </Button>
            <Button variant="default" size="sm">
              Résoudre automatiquement
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
