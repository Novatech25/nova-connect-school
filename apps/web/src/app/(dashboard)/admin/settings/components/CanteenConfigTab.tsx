'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UtensilsCrossed,
  Loader2,
  Plus,
  Trash2,
  Clock,
  DollarSign,
  ShieldAlert,
  Bell,
  Users,
  X,
} from 'lucide-react';
import { useSchoolSettings, useUpdateSchoolSettings } from '@novaconnect/data';
import { canteenConfigSchema, type CanteenConfig } from '@novaconnect/core/schemas';
import { useToast } from '@/hooks/use-toast';

const defaultCanteenConfig: CanteenConfig = {
  enabled: false,
  serviceMode: 'self_service',
  mealServices: [
    { name: 'Petit-déjeuner', enabled: false, startTime: '07:00', endTime: '08:30', defaultPrice: 0 },
    { name: 'Déjeuner', enabled: true, startTime: '12:00', endTime: '13:30', defaultPrice: 0 },
    { name: 'Goûter', enabled: false, startTime: '16:00', endTime: '16:30', defaultPrice: 0 },
  ],
  currency: 'XAF',
  defaultMealPrice: 500,
  staffDiscountPercent: 0,
  scholarshipDiscountPercent: 0,
  trackAllergies: false,
  availableDiets: ['Végétarien', 'Halal', 'Sans gluten', 'Sans lactose'],
  maxCapacity: 200,
  slotDurationMinutes: 30,
  allowSecondServing: false,
  notifyParentsOnAbsence: false,
  notifyLowBalance: false,
  lowBalanceThreshold: 1000,
};

export function CanteenConfigTab({ schoolId }: { schoolId: string }) {
  const { data: settings, isLoading } = useSchoolSettings(schoolId);
  const updateMutation = useUpdateSchoolSettings();
  const { toast } = useToast();
  const [newDiet, setNewDiet] = useState('');

  const form = useForm<CanteenConfig>({
    resolver: zodResolver(canteenConfigSchema),
    defaultValues: defaultCanteenConfig,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'mealServices',
  });

  useEffect(() => {
    if (settings?.canteen) {
      form.reset({ ...defaultCanteenConfig, ...settings.canteen });
    }
  }, [settings, form]);

  const handleSubmit = async (data: CanteenConfig) => {
    try {
      await updateMutation.mutateAsync({
        schoolId,
        settings: { canteen: data },
      });
      toast({ title: 'Configuration cantine mise à jour avec succès' });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
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
  const trackAllergies = form.watch('trackAllergies');
  const notifyLowBalance = form.watch('notifyLowBalance');
  const diets = form.watch('availableDiets') || [];

  const addDiet = () => {
    const val = newDiet.trim();
    if (val && !diets.includes(val)) {
      form.setValue('availableDiets', [...diets, val]);
      setNewDiet('');
    }
  };

  const removeDiet = (idx: number) => {
    form.setValue(
      'availableDiets',
      diets.filter((_, i) => i !== idx)
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* ── Activation ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              Configuration de la cantine
            </CardTitle>
            <CardDescription>
              Activez et configurez le service de restauration scolaire.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel className="text-base">Activer la cantine</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Active le module de gestion de cantine pour votre école
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {enabled && (
              <FormField
                control={form.control}
                name="serviceMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mode de service</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="self_service">Self-service</SelectItem>
                        <SelectItem value="preorder">Pré-commande</SelectItem>
                        <SelectItem value="mixed">Mixte</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {enabled && (
          <>
            {/* ── Services de repas ── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5" />
                  Services de repas
                </CardTitle>
                <CardDescription>
                  Configurez les différents services de repas proposés.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid gap-4 rounded-lg border p-4 sm:grid-cols-[1fr,auto,1fr,1fr,1fr,auto]"
                  >
                    <FormField
                      control={form.control}
                      name={`mealServices.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Nom</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Service" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`mealServices.${index}.enabled`}
                      render={({ field }) => (
                        <FormItem className="flex flex-col items-center justify-end">
                          <FormLabel className="text-xs">Actif</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`mealServices.${index}.startTime`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Début</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`mealServices.${index}.endTime`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Fin</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`mealServices.${index}.defaultPrice`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Prix</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      name: '',
                      enabled: true,
                      startTime: '12:00',
                      endTime: '13:00',
                      defaultPrice: 0,
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter un service
                </Button>
              </CardContent>
            </Card>

            {/* ── Tarification ── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="h-5 w-5" />
                  Tarification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Devise</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="XAF">XAF (Franc CFA)</SelectItem>
                            <SelectItem value="XOF">XOF (Franc CFA BCEAO)</SelectItem>
                            <SelectItem value="EUR">EUR (Euro)</SelectItem>
                            <SelectItem value="USD">USD (Dollar US)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="defaultMealPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prix par défaut du repas</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="staffDiscountPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Réduction personnel (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="scholarshipDiscountPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Réduction boursiers (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Allergies & Régimes ── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldAlert className="h-5 w-5" />
                  Allergies & régimes alimentaires
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="trackAllergies"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel className="text-base">Suivi des allergies</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Permet de renseigner les allergies et restrictions alimentaires des élèves
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {trackAllergies && (
                  <div>
                    <FormLabel>Régimes disponibles</FormLabel>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {diets.map((diet, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 pr-1">
                          {diet}
                          <button
                            type="button"
                            onClick={() => removeDiet(i)}
                            className="ml-1 rounded-full p-0.5 hover:bg-slate-300"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Input
                        placeholder="Nouveau régime..."
                        value={newDiet}
                        onChange={(e) => setNewDiet(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addDiet();
                          }
                        }}
                        className="max-w-xs"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={addDiet}>
                        <Plus className="mr-1 h-4 w-4" />
                        Ajouter
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Capacité & Créneaux ── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Capacité & créneaux
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="maxCapacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacité max (places)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slotDurationMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Durée créneau (min)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="5"
                            max="120"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allowSecondServing"
                    render={({ field }) => (
                      <FormItem className="flex flex-col justify-end">
                        <div className="flex items-center gap-3 rounded-lg border p-3">
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">2e service autorisé</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Notifications ── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="notifyParentsOnAbsence"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel className="text-base">Notifier les parents en cas d'absence</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Envoyer une notification aux parents si l'élève n'a pas mangé
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notifyLowBalance"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel className="text-base">Alerte solde bas</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Notifier quand le solde cantine d'un élève est faible
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {notifyLowBalance && (
                  <FormField
                    control={form.control}
                    name="lowBalanceThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seuil d'alerte (montant)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Une notification sera envoyée si le solde tombe sous ce montant
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Actions ── */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={updateMutation.isPending}
          >
            Réinitialiser
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </form>
    </Form>
  );
}
