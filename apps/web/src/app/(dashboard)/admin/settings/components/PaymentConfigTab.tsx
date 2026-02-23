'use client';

import { useEffect } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Loader2, AlertCircle, CheckCircle, XCircle, Bell, MessageSquare, Smartphone, Mail, Info } from 'lucide-react';
import { useSchoolSettings, useUpdateSchoolSettings } from '@novaconnect/data';
import {
  paymentBlockingConfigSchema,
  type PaymentBlockingConfig,
  paymentRemindersConfigSchema,
  type PaymentRemindersConfig,
} from '@novaconnect/core/schemas';
import { useToast } from '@/hooks/use-toast';

const TEMPLATE_VARIABLES = [
  { key: '{student_name}', label: 'Nom élève' },
  { key: '{amount}', label: 'Montant dû' },
  { key: '{fee_name}', label: 'Type de frais' },
  { key: '{due_date}', label: "Date d'échéance" },
  { key: '{days_overdue}', label: 'Jours de retard' },
  { key: '{school_name}', label: "Nom de l'école" },
];

const CHANNEL_OPTIONS = [
  { value: 'in_app' as const, label: 'In-App', icon: Smartphone, description: 'Notification dans l\'application' },
  { value: 'push' as const, label: 'Push', icon: Bell, description: 'Notification push mobile' },
  { value: 'email' as const, label: 'Email', icon: Mail, description: 'Email aux parents' },
  { value: 'sms' as const, label: 'SMS', icon: MessageSquare, description: 'SMS (coût supplémentaire)' },
];

const DEFAULT_TEMPLATES = {
  first: 'Bonjour {student_name}, ce rappel aimable pour vous informer que vous avez une facture impayée de {amount} pour {fee_name} (échéance: {due_date}). Merci de régulariser votre situation.',
  second: 'RAPPEL: {student_name}, vous avez toujours un paiement en retard de {amount} pour {fee_name}. Échéance dépassée depuis {days_overdue} jours. Veuillez contacter la comptabilité.',
  final: 'DERNIER AVIS: Paiement en retard de {amount} pour {fee_name}. Veuillez régulariser impérativement sous peine de sanctions. Contact: {school_name}.',
};

export function PaymentConfigTab({ schoolId }: { schoolId: string }) {
  const { data: settings, isLoading } = useSchoolSettings(schoolId);
  const updateMutation = useUpdateSchoolSettings();
  const { toast } = useToast();

  // --- Blocking form ---
  const blockingForm = useForm<PaymentBlockingConfig>({
    resolver: zodResolver(paymentBlockingConfigSchema) as any,
    defaultValues: {
      mode: 'WARNING',
      blockBulletins: true,
      blockCertificates: true,
      blockStudentCards: false,
      blockExamAuthorizations: true,
      warningThresholdPercent: 50,
    },
  });

  // --- Reminders form ---
  const remindersForm = useForm<PaymentRemindersConfig>({
    resolver: zodResolver(paymentRemindersConfigSchema) as any,
    defaultValues: {
      enabled: true,
      cooldownDays: 7,
      autoEscalate: true,
      channels: ['in_app', 'push'],
      messageTemplates: DEFAULT_TEMPLATES,
    },
  });

  useEffect(() => {
    if (settings?.paymentBlocking) {
      blockingForm.reset(settings.paymentBlocking);
    }
    if (settings?.paymentReminders) {
      const pr = settings.paymentReminders as any;
      remindersForm.reset({
        ...pr,
        messageTemplates: {
          ...DEFAULT_TEMPLATES,
          ...(pr.messageTemplates || {}),
        },
      });
    }
  }, [settings, blockingForm, remindersForm]);

  const handleBlockingSubmit = async (data: PaymentBlockingConfig) => {
    try {
      await updateMutation.mutateAsync({
        schoolId,
        settings: { paymentBlocking: data },
      });
      toast({ title: "Configuration blocage mise à jour avec succès" });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleRemindersSubmit = async (data: PaymentRemindersConfig) => {
    try {
      await updateMutation.mutateAsync({
        schoolId,
        settings: { paymentReminders: data },
      });
      toast({ title: "Configuration relances mise à jour avec succès" });
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

  const blockingMode = blockingForm.watch('mode');
  const remindersEnabled = remindersForm.watch('enabled');
  const selectedChannels = remindersForm.watch('channels') || [];

  return (
    <div className="space-y-6">
      {/* === SECTION 1: Blocage de documents === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Blocage de documents
          </CardTitle>
          <CardDescription>
            Contrôlez l'accès aux documents en cas d'impayés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...blockingForm}>
            <form onSubmit={blockingForm.handleSubmit(handleBlockingSubmit)} className="space-y-6">
              <FormField
                control={blockingForm.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mode de blocage *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="OK">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            OK - Pas de blocage
                          </div>
                        </SelectItem>
                        <SelectItem value="WARNING">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                            WARNING - Avertissement seulement
                          </div>
                        </SelectItem>
                        <SelectItem value="BLOCKED">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            BLOCKED - Blocage complet
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {blockingMode !== 'OK' && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Documents bloqués</h3>
                    <div className="space-y-3">
                      <FormField
                        control={blockingForm.control}
                        name="blockBulletins"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Bloquer les bulletins</FormLabel>
                              <p className="text-sm text-muted-foreground">Empêche l'accès aux relevés de notes</p>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={blockingForm.control}
                        name="blockCertificates"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Bloquer les certificats</FormLabel>
                              <p className="text-sm text-muted-foreground">Empêche la génération de certificats scolaires</p>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={blockingForm.control}
                        name="blockStudentCards"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Bloquer les cartes étudiantes</FormLabel>
                              <p className="text-sm text-muted-foreground">Empêche la génération de cartes d'étudiant</p>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={blockingForm.control}
                        name="blockExamAuthorizations"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Bloquer les autorisations d'examen</FormLabel>
                              <p className="text-sm text-muted-foreground">Empêche l'inscription aux examens</p>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {blockingMode === 'WARNING' && (
                    <FormField
                      control={blockingForm.control}
                      name="warningThresholdPercent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Seuil d'avertissement (%) *</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" max="100" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">
                            Affiche un avertissement si le paiement est inférieur à ce pourcentage
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => blockingForm.reset()} disabled={updateMutation.isPending}>
                  Réinitialiser
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* === SECTION 2: Relances de paiement === */}
      <Card>
        <Form {...remindersForm}>
          <form onSubmit={remindersForm.handleSubmit(handleRemindersSubmit)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Relances de paiement
              </CardTitle>
              <CardDescription className="mt-1">
                Configurez les notifications envoyées aux parents en cas de retard de paiement.
              </CardDescription>
            </div>
            <FormField
              control={remindersForm.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormLabel className="text-sm font-medium">
                    {field.value ? (
                      <Badge variant="default" className="bg-green-600">Activé</Badge>
                    ) : (
                      <Badge variant="secondary">Désactivé</Badge>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </CardHeader>
        <CardContent>
            <div className="space-y-6">
              {remindersEnabled && (
                <>
                  {/* Paramètres généraux */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={remindersForm.control}
                      name="cooldownDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Délai entre relances (jours)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="30"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 7)}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Nombre de jours minimum entre 2 relances pour la même échéance (anti-spam).
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={remindersForm.control}
                      name="autoEscalate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col justify-center">
                          <div className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Escalade automatique</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Adapte automatiquement la sévérité du message selon le retard :
                                &lt;14j → 1er rappel, 14-29j → 2ème, ≥30j → Dernier avis
                              </p>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Canaux de notification */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Canaux de notification</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {CHANNEL_OPTIONS.map((channel) => {
                        const isSelected = selectedChannels.includes(channel.value);
                        const Icon = channel.icon;
                        return (
                          <button
                            key={channel.value}
                            type="button"
                            onClick={() => {
                              const current = remindersForm.getValues('channels') || [];
                              if (current.includes(channel.value)) {
                                if (current.length > 1) {
                                  remindersForm.setValue(
                                    'channels',
                                    current.filter((c) => c !== channel.value),
                                    { shouldDirty: true }
                                  );
                                }
                              } else {
                                remindersForm.setValue(
                                  'channels',
                                  [...current, channel.value],
                                  { shouldDirty: true }
                                );
                              }
                            }}
                            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <Icon className={`h-5 w-5 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                            <span className="text-xs font-medium">{channel.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Templates de messages */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Templates de messages</h3>
                      <div className="flex flex-wrap gap-1">
                        {TEMPLATE_VARIABLES.map((v) => (
                          <Badge key={v.key} variant="outline" className="text-[10px] font-mono">
                            {v.key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Personnalisez les messages envoyés. Utilisez les variables ci-dessus pour insérer des données dynamiques.
                    </p>

                    <div className="space-y-4">
                      <FormField
                        control={remindersForm.control}
                        name="messageTemplates.first"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">1</span>
                              Premier rappel
                              <Badge variant="secondary" className="text-[10px]">Courtois</Badge>
                            </FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={3} className="text-sm font-mono" placeholder={DEFAULT_TEMPLATES.first} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={remindersForm.control}
                        name="messageTemplates.second"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold">2</span>
                              Deuxième rappel
                              <Badge variant="secondary" className="text-[10px] border-yellow-300 text-yellow-700">Ferme</Badge>
                            </FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={3} className="text-sm font-mono" placeholder={DEFAULT_TEMPLATES.second} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={remindersForm.control}
                        name="messageTemplates.final"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">3</span>
                              Dernier avertissement
                              <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
                            </FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={3} className="text-sm font-mono" placeholder={DEFAULT_TEMPLATES.final} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-blue-700">
                        Les relances sont envoyées depuis la page <strong>Comptabilité → Paiements → Échéances</strong> via le bouton "Relancer les retards".
                        Le comptable choisit le niveau de sévérité ou laisse le système l'auto-déterminer selon le nombre de jours de retard.
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => remindersForm.reset({
                    enabled: true,
                    cooldownDays: 7,
                    autoEscalate: true,
                    channels: ['in_app', 'push'],
                    messageTemplates: DEFAULT_TEMPLATES,
                  })}
                  disabled={updateMutation.isPending}
                >
                  Réinitialiser
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </div>
        </CardContent>
          </form>
        </Form>
      </Card>
    </div>
  );
}
