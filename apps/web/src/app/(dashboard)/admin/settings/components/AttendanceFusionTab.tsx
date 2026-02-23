'use client';

import { useEffect, useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Info } from 'lucide-react';
import { useSchoolSettings, useUpdateSchoolSettings } from '@novaconnect/data';
import { attendanceFusionConfigSchema, type AttendanceFusionConfig } from '@novaconnect/core/schemas';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AttendanceFusionTab({ schoolId }: { schoolId: string }) {
  const { data: settings, isLoading } = useSchoolSettings(schoolId);
  const updateMutation = useUpdateSchoolSettings();
  const { toast } = useToast();

  const form = useForm<AttendanceFusionConfig>({
    resolver: zodResolver(attendanceFusionConfigSchema),
    defaultValues: {
      enabled: true,
      strategy: 'teacher_priority',
      qrTimeWindowMinutes: 15,
      autoMerge: true,
      notifyOnConflict: true,
    },
  });

  useEffect(() => {
    if (settings?.attendanceFusion) {
      form.reset(settings.attendanceFusion);
    }
  }, [settings, form]);

  const handleSubmit = async (data: AttendanceFusionConfig) => {
    try {
      await updateMutation.mutateAsync({
        schoolId,
        settings: { attendanceFusion: data },
      });
      toast({ title: "Configuration de fusion mise à jour avec succès" });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  const enabled = form.watch('enabled');
  const strategy = form.watch('strategy');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fusion de présence</CardTitle>
          <CardDescription>
            Configuration de la fusion automatique entre les présences manuelles des professeurs et les scans QR codes des élèves
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Enable Fusion */}
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Activer la fusion automatique</FormLabel>
                      <FormDescription>
                        Fusionner automatiquement les présences QR avec les marquages professeurs
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {enabled && (
                <>
                  {/* Strategy Selection */}
                  <FormField
                    control={form.control}
                    name="strategy"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-base">Stratégie de fusion</FormLabel>
                    <FormDescription>
                      Définit comment les conflits entre QR et marquage professeur sont résolus
                    </FormDescription>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="space-y-3"
                      >
                        <div className="flex items-start space-x-3 rounded-lg border p-4">
                          <RadioGroupItem value="teacher_priority" id="teacher_priority" />
                          <div className="flex-1 space-y-1">
                            <Label htmlFor="teacher_priority" className="font-semibold cursor-pointer">
                              Priorité au professeur
                            </Label>
                            <p className="text-sm text-gray-600">
                              Le marquage du professeur écrase toujours le scan QR. Si un QR est scanné après que le professeur a marqué, le scan est rejeté.
                            </p>
                            <p className="text-xs text-gray-500">
                              Recommandé pour: Les écoles où l'enseignant a l'autorité finale
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-3 rounded-lg border p-4">
                          <RadioGroupItem value="qr_priority" id="qr_priority" />
                          <div className="flex-1 space-y-1">
                            <Label htmlFor="qr_priority" className="font-semibold cursor-pointer">
                              Priorité au QR
                            </Label>
                            <p className="text-sm text-gray-600">
                              Le scan QR prévaut s'il est effectué dans la fenêtre de temps. Le professeur peut marquer absent pour écraser le QR.
                            </p>
                            <p className="text-xs text-gray-500">
                              Recommandé pour: Les écoles qui font confiance au QR pour la présence
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-3 rounded-lg border p-4">
                          <RadioGroupItem value="coexist" id="coexist" />
                          <div className="flex-1 space-y-1">
                            <Label htmlFor="coexist" className="font-semibold cursor-pointer">
                              Coexistence
                            </Label>
                            <p className="text-sm text-gray-600">
                              Les deux sources sont conservées. Si elles concordent (même statut), la présence est confirmée. Sinon, le dernier marquage l'emporte.
                            </p>
                            <p className="text-xs text-gray-500">
                              Recommandé pour: Les écoles qui veulent la transparence et une revue manuelle
                            </p>
                          </div>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

                  {/* QR Time Window - only for qr_priority strategy */}
                  {strategy === 'qr_priority' && (
                    <FormField
                      control={form.control}
                      name="qrTimeWindowMinutes"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-base">
                            Fenêtre de temps QR: {field.value} minutes
                          </FormLabel>
                          <FormDescription>
                            Durée pendant laquelle un scan QR est considéré valide après le début de la session
                          </FormDescription>
                          <FormControl>
                            <div className="px-4">
                              <Slider
                                min={[5]}
                                max={[60]}
                                step={5}
                                value={[field.value]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs text-gray-500 mt-2">
                                <span>5 min</span>
                                <span>30 min</span>
                                <span>60 min</span>
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Auto Merge */}
                  <FormField
                    control={form.control}
                    name="autoMerge"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Fusionner automatiquement</FormLabel>
                          <FormDescription>
                            Appliquer la fusion automatiquement. Désactiver pour nécessiter une validation admin.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Notify on Conflict */}
                  <FormField
                    control={form.control}
                    name="notifyOnConflict"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Notifier en cas de conflit</FormLabel>
                          <FormDescription>
                            Envoyer une notification au professeur lorsqu'un conflit de présence est détecté
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            À propos de la fusion de présence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">Statuts d'enregistrement</h4>
            <ul className="space-y-1 text-gray-600">
              <li>• <strong>Auto</strong>: QR scan uniquement (pas d'intervention professeur)</li>
              <li>• <strong>Confirmé</strong>: Les deux sources concordent (professeur et QR d'accord)</li>
              <li>• <strong>Modifié</strong>: Une source a écrasé l'autre (conflit résolu)</li>
              <li>• <strong>Manuel</strong>: Marquage professeur uniquement (pas de QR)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Résolution des conflits</h4>
            <p className="text-gray-600">
              Les conflits peuvent être résolus manuellement depuis la page{" "}
              <a href="/admin/attendance/conflicts" className="text-blue-600 hover:underline">
                Conflits de présence
              </a>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
