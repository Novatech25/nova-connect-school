'use client';

import { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, GraduationCap, School, Award } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createGradingSystemSchema, type CreateGradingSystemSchema, systemTypeEnum } from "@novaconnect/core/schemas";
import { useLevels } from "@novaconnect/data";

interface GradingSystemFormProps {
  defaultValues: Partial<CreateGradingSystemSchema>;
  onSubmit: (data: CreateGradingSystemSchema) => Promise<void>;
  isLoading: boolean;
  submitLabel: string;
  schoolId: string;
}

// Extended schema with level selection
const formSchema = createGradingSystemSchema.extend({
  applyToAllLevels: z.boolean().default(false),
});

export function GradingSystemForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Enregistrer",
  schoolId,
}: GradingSystemFormProps) {
  const { data: levels = [] } = useLevels(schoolId);
  const [systemType, setSystemType] = useState<z.infer<typeof systemTypeEnum>>(
    defaultValues.systemType || "points_0_20"
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      systemType: "points_0_20",
      maxScore: 20,
      minPassingScore: 10,
      passingGrade: "10",
      isLevelSpecific: true,
      isDefault: false,
      isActive: true,
      gradeScaleConfig: {
        A: { min: 16, max: 20, label: "Excellent", mention: "Très Bien", gpa: 4.0 },
        B: { min: 14, max: 16, label: "Très Bien", mention: "Bien", gpa: 3.0 },
        C: { min: 12, max: 14, label: "Bien", mention: "Assez Bien", gpa: 2.0 },
        D: { min: 10, max: 12, label: "Assez Bien", mention: "Passable", gpa: 1.0 },
        F: { min: 0, max: 10, label: "Insuffisant", mention: "Doit redoubler", gpa: 0 },
      },
      ...defaultValues,
    },
  });

  const selectedSystemType = form.watch("systemType");
  const isLevelSpecific = form.watch("isLevelSpecific");
  const applyToAllLevels = form.watch("applyToAllLevels");

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    await onSubmit({
      ...data,
      levelId: data.applyToAllLevels ? undefined : data.levelId,
    });
  };

  const handleQuickSetup = (type: 'primary' | 'secondary' | 'university' | 'vocational') => {
    const configs = {
      primary: {
        systemType: 'points_0_10' as const,
        maxScore: 10,
        minPassingScore: 5,
        passingGrade: '5',
        gradeScaleConfig: {
          TB: { min: 9, max: 10, label: 'Très Bien' },
          B: { min: 8, max: 9, label: 'Bien' },
          AB: { min: 7, max: 8, label: 'Assez Bien' },
          PP: { min: 6, max: 7, label: 'Peut mieux faire' },
          F: { min: 0, max: 6, label: 'Doit améliorer' },
        },
      },
      secondary: {
        systemType: 'points_0_20' as const,
        maxScore: 20,
        minPassingScore: 10,
        passingGrade: '10',
        gradeScaleConfig: {
          A: { min: 16, max: 20, label: 'Excellent', mention: 'Très Bien', gpa: 4.0 },
          B: { min: 14, max: 16, label: 'Très Bien', mention: 'Bien', gpa: 3.0 },
          C: { min: 12, max: 14, label: 'Bien', mention: 'Assez Bien', gpa: 2.0 },
          D: { min: 10, max: 12, label: 'Assez Bien', mention: 'Passable', gpa: 1.0 },
          F: { min: 0, max: 10, label: 'Insuffisant', mention: 'Doit redoubler', gpa: 0 },
        },
      },
      university: {
        systemType: 'credits_ects' as const,
        maxScore: 20,
        minPassingScore: 10,
        maxGpa: 4.0,
        totalCreditsRequired: 60,
        minCreditsToPass: 36,
        passingGrade: '2.0',
        gradeScaleConfig: {
          A: { min: 16, max: 20, label: 'Excellent', gpa: 4.0, credits: true },
          B: { min: 14, max: 16, label: 'Très Bien', gpa: 3.0, credits: true },
          C: { min: 12, max: 14, label: 'Bien', gpa: 2.0, credits: true },
          D: { min: 10, max: 12, label: 'Assez Bien', gpa: 1.0, credits: false },
          F: { min: 0, max: 10, label: 'Insuffisant', gpa: 0, credits: false },
        },
      },
      vocational: {
        systemType: 'credits_skills' as const,
        maxScore: 20,
        minPassingScore: 10,
        totalCreditsRequired: 120,
        minCreditsToPass: 84,
        gradeScaleConfig: {
          excellent: { min: 16, max: 20, skills: 'mastered' },
          good: { min: 12, max: 16, skills: 'acquired' },
          satisfactory: { min: 10, max: 12, skills: 'basic' },
          needs_improvement: { min: 0, max: 10, skills: 'not_acquired' },
        },
      },
    };

    const config = configs[type];
    form.reset({
      ...defaultValues,
      ...config,
      schoolId,
    });
    setSystemType(config.systemType);
  };

  return (
    <div className="space-y-6">
      {/* Quick Setup Templates */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Configuration Rapide
          </CardTitle>
          <CardDescription>
            Utilisez un modèle préconfiguré pour votre type d'établissement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleQuickSetup('primary')}
              className="hover:border-green-500 hover:text-green-700"
            >
              <School className="mr-2 h-4 w-4" />
              Primaire (0-10)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleQuickSetup('secondary')}
              className="hover:border-blue-500 hover:text-blue-700"
            >
              <School className="mr-2 h-4 w-4" />
              Collège (0-20)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleQuickSetup('university')}
              className="hover:border-purple-500 hover:text-purple-700"
            >
              <Award className="mr-2 h-4 w-4" />
              Université (ECTS)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleQuickSetup('vocational')}
              className="hover:border-orange-500 hover:text-orange-700"
            >
              <School className="mr-2 h-4 w-4" />
              Formation Pro
            </Button>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informations de base</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du système *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Barème Primaire 0-10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="systemType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de système *</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value);
                      setSystemType(value as any);
                    }} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="points_0_10">Points (0-10) - Primaire</SelectItem>
                        <SelectItem value="points_0_20">Points (0-20) - Secondaire</SelectItem>
                        <SelectItem value="credits_ects">Crédits ECTS - Université</SelectItem>
                        <SelectItem value="grade_points">Grade Points (GPA) - Université US</SelectItem>
                        <SelectItem value="credits_skills">Compétences - Formation Pro</SelectItem>
                        <SelectItem value="pass_fail">Réussite/Échec</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="maxScore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note max *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minPassingScore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note de passage *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="passingGrade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note de passage (texte)</FormLabel>
                    <FormControl>
                      <Input placeholder="10" {...field} />
                    </FormControl>
                    <FormDescription>
                      Représentation textuelle de la note de passage (ex: "10", "5", "2.0")
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Level Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Application du système</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="isLevelSpecific"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Spécifique à un niveau</FormLabel>
                      <FormDescription className="text-xs">
                        Cochez cette case pour appliquer ce système à un niveau spécifique
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

              {isLevelSpecific && (
                <>
                  <FormField
                    control={form.control}
                    name="applyToAllLevels"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Appliquer à tous les niveaux</FormLabel>
                          <FormDescription className="text-xs">
                            Cochez pour appliquer ce système à tous les niveaux de l'école
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

                  {!applyToAllLevels && (
                    <FormField
                      control={form.control}
                      name="levelId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Niveau concerné *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un niveau" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {levels.map((level: any) => (
                                <SelectItem key={level.id} value={level.id}>
                                  {level.name} ({level.levelType})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}

              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Système par défaut</FormLabel>
                      <FormDescription className="text-xs">
                        Cochez si c'est le système principal de l'école
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
            </CardContent>
          </Card>

          {/* University/Vocational Settings */}
          {(selectedSystemType === 'credits_ects' ||
            selectedSystemType === 'grade_points' ||
            selectedSystemType === 'credits_skills') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Paramètres Universitaires / Formation Pro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedSystemType === 'grade_points' && (
                  <FormField
                    control={form.control}
                    name="maxGpa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GPA Maximum</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="4.0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Échelle GPA (ex: 4.0, 5.0, 10.0)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {(selectedSystemType === 'credits_ects' ||
                  selectedSystemType === 'credits_skills') && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="totalCreditsRequired"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Crédits requis (total)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="60"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            Total des crédits pour valider l'année
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="minCreditsToPass"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Crédits min pour passer</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="36"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            {`60% de ${form.watch('totalCreditsRequired')} = ${Math.round((form.watch('totalCreditsRequired') || 60) * 0.6)}`}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Grade Scale Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration des mentions</CardTitle>
              <CardDescription>
                Définissez les mentions et leurs seuils (optionnel)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="gradeScaleConfig"
                render={({ field }) => (
                  <FormItem>
                    <div className="space-y-4">
                      <FormLabel>Mentions configurées</FormLabel>
                      <div className="rounded-lg border p-4 space-y-3">
                        {Object.entries(field.value || {}).map(([key, config]: any) => (
                          <div key={key} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium">{key}</div>
                              <div className="text-sm text-muted-foreground">
                                {config.min} - {config.max}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="text-sm">{config.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {config.mention || '-'}
                              </div>
                            </div>
                            {config.gpa !== undefined && (
                              <div className="text-sm">
                                GPA: {config.gpa}
                              </div>
                            )}
                            {config.credits !== undefined && (
                              <div className="text-sm">
                                Crédits: {config.credits ? 'Oui' : 'Non'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <FormDescription>
                        Les mentions sont générées automatiquement selon le type de système choisi.
                        Vous pouvez les personnaliser en mode avancé.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              disabled={isLoading}
            >
              Réinitialiser
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
