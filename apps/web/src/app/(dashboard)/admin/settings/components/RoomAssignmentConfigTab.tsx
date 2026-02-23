'use client';

import { useState, useEffect } from 'react';
import { useSchoolSettings, useUpdateSchoolSettings } from '@novaconnect/data';
import type { DynamicRoomAssignmentConfig } from '@novaconnect/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Bell, 
  Settings2, 
  Users, 
  AlertTriangle,
  CheckCircle2,
  Info
} from 'lucide-react';

interface RoomAssignmentConfigTabProps {
  schoolId: string;
}

const defaultConfig: DynamicRoomAssignmentConfig = {
  enabled: false,
  selectionPriority: 'capacity',
  capacityMarginPercent: 10,
  conflictResolution: 'largest_room',
  notificationWindows: {
    firstNotificationMinutes: 60,
    reminderNotificationMinutes: 15,
  },
  notificationChannels: {
    inApp: true,
    push: true,
    email: false,
    sms: false,
  },
  includeFloorPlan: false,
  autoRecalculateOnChange: true,
};

export function RoomAssignmentConfigTab({ schoolId }: RoomAssignmentConfigTabProps) {
  const { toast } = useToast();
  const { data: settings, isLoading } = useSchoolSettings(schoolId);
  const updateSettings = useUpdateSchoolSettings();
  
  const [config, setConfig] = useState<DynamicRoomAssignmentConfig>(defaultConfig);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing configuration
  useEffect(() => {
    if (settings?.dynamicRoomAssignment) {
      setConfig({
        ...defaultConfig,
        ...settings.dynamicRoomAssignment,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        schoolId,
        settings: {
          dynamicRoomAssignment: config,
        },
      });
      
      setHasChanges(false);
      toast({
        title: 'Configuration sauvegardée',
        description: 'Les paramètres d\'attribution des salles ont été mis à jour.',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de sauvegarder la configuration',
        variant: 'destructive',
      });
    }
  };

  const updateConfig = (updates: Partial<DynamicRoomAssignmentConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const updateNotificationChannels = (channel: keyof typeof config.notificationChannels, value: boolean) => {
    setConfig((prev) => ({
      ...prev,
      notificationChannels: {
        ...prev.notificationChannels,
        [channel]: value,
      },
    }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Activation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Attribution automatique des salles</CardTitle>
                <CardDescription>
                  Activez le système pour répartir automatiquement les élèves dans les salles selon les effectifs
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => updateConfig({ enabled: checked })}
            />
          </div>
        </CardHeader>
        
        {!config.enabled && (
          <CardContent>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Activez cette fonctionnalité pour calculer automatiquement les attributions de salles 
                en fonction des effectifs de classe et des capacités des salles disponibles.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {config.enabled && (
        <>
          {/* Configuration générale */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Settings2 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle>Paramètres généraux</CardTitle>
                  <CardDescription>
                    Configurez les règles d'attribution des salles
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Priorité de sélection */}
              <div className="space-y-3">
                <Label>Priorité de sélection des salles</Label>
                <RadioGroup
                  value={config.selectionPriority}
                  onValueChange={(value: 'capacity' | 'size_category') => 
                    updateConfig({ selectionPriority: value })
                  }
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2 rounded-lg border p-4">
                    <RadioGroupItem value="capacity" id="capacity" />
                    <Label htmlFor="capacity" className="cursor-pointer">
                      <div className="font-medium">Capacité maximale</div>
                      <div className="text-sm text-muted-foreground">
                        Choisir la salle avec la plus grande capacité disponible
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg border p-4">
                    <RadioGroupItem value="size_category" id="size_category" />
                    <Label htmlFor="size_category" className="cursor-pointer">
                      <div className="font-medium">Catégorie de taille</div>
                      <div className="text-sm text-muted-foreground">
                        Privilégier la catégorie (très grande → petite)
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Marge de capacité */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Marge de capacité</Label>
                  <span className="text-sm font-medium">{config.capacityMarginPercent}%</span>
                </div>
                <Slider
                  value={[config.capacityMarginPercent]}
                  onValueChange={([value]) => updateConfig({ capacityMarginPercent: value })}
                  min={0}
                  max={100}
                  step={5}
                />
                <p className="text-sm text-muted-foreground">
                  Pourcentage supplémentaire ajouté à l'effectif pour déterminer la capacité requise. 
                  Ex: 20% pour une classe de 50 élèves = recherche d'une salle pour 60 personnes.
                </p>
              </div>

              {/* Résolution des conflits */}
              <div className="space-y-3">
                <Label>En cas de capacité insuffisante</Label>
                <RadioGroup
                  value={config.conflictResolution}
                  onValueChange={(value: 'largest_room' | 'split_classes' | 'manual_fallback') => 
                    updateConfig({ conflictResolution: value })
                  }
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-2 rounded-lg border p-4">
                    <RadioGroupItem value="largest_room" id="largest_room" />
                    <Label htmlFor="largest_room" className="cursor-pointer">
                      <div className="font-medium">Utiliser la plus grande salle disponible</div>
                      <div className="text-sm text-muted-foreground">
                        Même si la capacité est insuffisante, avec alerte
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg border p-4">
                    <RadioGroupItem value="manual_fallback" id="manual_fallback" />
                    <Label htmlFor="manual_fallback" className="cursor-pointer">
                      <div className="font-medium">Attribution manuelle requise</div>
                      <div className="text-sm text-muted-foreground">
                        Laisser l'administrateur choisir la salle
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <Bell className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>
                    Configurez quand et comment envoyer les notifications
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Fenêtres de notification */}
              <div className="space-y-4">
                <Label>Délais de notification avant le cours</Label>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Premier rappel</Label>
                      <span className="text-sm font-medium">
                        {config.notificationWindows.firstNotificationMinutes} min
                      </span>
                    </div>
                    <Slider
                      value={[config.notificationWindows.firstNotificationMinutes]}
                      onValueChange={([value]) => 
                        updateConfig({
                          notificationWindows: {
                            ...config.notificationWindows,
                            firstNotificationMinutes: value,
                          },
                        })
                      }
                      min={15}
                      max={180}
                      step={15}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Rappel final</Label>
                      <span className="text-sm font-medium">
                        {config.notificationWindows.reminderNotificationMinutes} min
                      </span>
                    </div>
                    <Slider
                      value={[config.notificationWindows.reminderNotificationMinutes]}
                      onValueChange={([value]) => 
                        updateConfig({
                          notificationWindows: {
                            ...config.notificationWindows,
                            reminderNotificationMinutes: value,
                          },
                        })
                      }
                      min={5}
                      max={30}
                      step={5}
                    />
                  </div>
                </div>
              </div>

              {/* Canaux de notification */}
              <div className="space-y-3">
                <Label>Canaux de notification</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start space-x-3 rounded-lg border p-4">
                    <Checkbox
                      id="inApp"
                      checked={config.notificationChannels.inApp}
                      onCheckedChange={(checked) => 
                        updateNotificationChannels('inApp', checked as boolean)
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="inApp" className="cursor-pointer font-medium">
                        Notifications in-app
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Affichées dans l'application
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border p-4">
                    <Checkbox
                      id="push"
                      checked={config.notificationChannels.push}
                      onCheckedChange={(checked) => 
                        updateNotificationChannels('push', checked as boolean)
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="push" className="cursor-pointer font-medium">
                        Push mobile
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Nécessite FCM configuré
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border p-4">
                    <Checkbox
                      id="email"
                      checked={config.notificationChannels.email}
                      onCheckedChange={(checked) => 
                        updateNotificationChannels('email', checked as boolean)
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="email" className="cursor-pointer font-medium">
                        Email
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Nécessite Resend configuré (premier rappel uniquement)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border p-4">
                    <Checkbox
                      id="sms"
                      checked={config.notificationChannels.sms}
                      onCheckedChange={(checked) => 
                        updateNotificationChannels('sms', checked as boolean)
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="sms" className="cursor-pointer font-medium">
                        SMS
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Nécessite Twilio configuré (premier rappel uniquement)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Options avancées */}
              <div className="space-y-3">
                <Label>Options avancées</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="floorPlan" className="cursor-pointer">Inclure le plan d'accès</Label>
                      <p className="text-xs text-muted-foreground">
                        Ajouter une référence au plan dans les notifications
                      </p>
                    </div>
                    <Switch
                      id="floorPlan"
                      checked={config.includeFloorPlan}
                      onCheckedChange={(checked) => updateConfig({ includeFloorPlan: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoRecalc" className="cursor-pointer">Recalcul automatique</Label>
                      <p className="text-xs text-muted-foreground">
                        Recalculer si l'emploi du temps est modifié
                      </p>
                    </div>
                    <Switch
                      id="autoRecalc"
                      checked={config.autoRecalculateOnChange}
                      onCheckedChange={(checked) => updateConfig({ autoRecalculateOnChange: checked })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Résumé */}
          <Card className="bg-muted/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <CardTitle className="text-base">Résumé de la configuration</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priorité:</span>
                  <span className="font-medium">
                    {config.selectionPriority === 'capacity' ? 'Capacité maximale' : 'Catégorie de taille'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Marge de capacité:</span>
                  <span className="font-medium">{config.capacityMarginPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Notifications:</span>
                  <span className="font-medium">
                    {Object.entries(config.notificationChannels)
                      .filter(([, v]) => v)
                      .map(([k]) => k === 'inApp' ? 'In-app' : k === 'push' ? 'Push' : k === 'email' ? 'Email' : 'SMS')
                      .join(', ') || 'Aucun'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rappels:</span>
                  <span className="font-medium">
                    T-{config.notificationWindows.firstNotificationMinutes}min, T-{config.notificationWindows.reminderNotificationMinutes}min
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4">
        {hasChanges && (
          <Button
            variant="outline"
            onClick={() => {
              setConfig(settings?.dynamicRoomAssignment || defaultConfig);
              setHasChanges(false);
            }}
          >
            Annuler
          </Button>
        )}
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || updateSettings.isPending}
        >
          {updateSettings.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </div>
    </div>
  );
}
