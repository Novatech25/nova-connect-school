'use client';

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSubjectSchema } from "@novaconnect/core/schemas";
import { z } from "zod";
import { Loader2 } from "lucide-react";

type CreateSubjectSchema = z.infer<typeof createSubjectSchema>;

const NO_LEVEL_VALUE = "__no_level__";

interface SubjectFormProps {
  defaultValues?: Partial<CreateSubjectSchema>;
  schoolId: string;
  levels?: any[];
  categories?: any[];
  onSubmit: (data: CreateSubjectSchema) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function SubjectForm({
  defaultValues,
  schoolId,
  levels = [],
  categories = [],
  onSubmit,
  isLoading = false,
  submitLabel = "Enregistrer",
}: SubjectFormProps) {
  const form = useForm<CreateSubjectSchema>({
    resolver: zodResolver(createSubjectSchema),
    defaultValues: {
      name: "",
      code: "",
      schoolId,
      levelId: null,
      categoryId: null,
      coefficient: 1,
      color: "#3B82F6",
      description: "",
      ...defaultValues,
    } as any,
  });

  useEffect(() => {
    const safeDefaults = defaultValues || {};
    form.reset({
      name: safeDefaults.name ?? "",
      code: safeDefaults.code ?? "",
      schoolId,
      levelId: safeDefaults.levelId ?? null,
      categoryId: safeDefaults.categoryId ?? null,
      coefficient: safeDefaults.coefficient ?? 1,
      color: safeDefaults.color ?? "#3B82F6",
      description: safeDefaults.description ?? "",
    });
  }, [form, defaultValues, schoolId]);

  const handleSubmit = async (data: CreateSubjectSchema) => {
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="schoolId"
          render={({ field }) => (
            <FormItem className="hidden">
              <FormControl>
                <Input type="hidden" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom de la matière *</FormLabel>
                <FormControl>
                  <Input placeholder="Mathématiques" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code *</FormLabel>
                <FormControl>
                  <Input placeholder="MATH" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="levelId"
          render={({ field }) => {
            const value = field.value ?? NO_LEVEL_VALUE;
            return (
              <FormItem>
                <FormLabel>Niveau (optionnel)</FormLabel>
                <Select
                  value={value}
                  onValueChange={(nextValue) =>
                    field.onChange(nextValue === NO_LEVEL_VALUE ? null : nextValue)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner un niveau" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_LEVEL_VALUE}>Tous les niveaux</SelectItem>
                    {levels.map((level: any) => (
                      <SelectItem key={level.id} value={level.id}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => {
            const value = field.value ?? "__no_category__";
            return (
              <FormItem>
                <FormLabel>Unité d'Enseignement (optionnel)</FormLabel>
                <Select
                  value={value}
                  onValueChange={(nextValue) =>
                    field.onChange(nextValue === "__no_category__" ? null : nextValue)
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une UE" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__no_category__">Aucune UE (Matière isolée)</SelectItem>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="coefficient"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Coefficient / Crédits *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0.5}
                    step={0.5}
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
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Couleur</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input type="color" {...field} className="w-20 h-10" />
                  </FormControl>
                  <Input
                    type="text"
                    {...field}
                    placeholder="#3B82F6"
                    className="flex-1"
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Description de la matière..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
  );
}
