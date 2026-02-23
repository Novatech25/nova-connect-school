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
import { createSubjectSchema, type CreateSubjectSchema } from "@novaconnect/core/schemas";
import { Loader2 } from "lucide-react";

const NO_LEVEL_VALUE = "__no_level__";

interface SubjectFormProps {
  defaultValues?: Partial<CreateSubjectSchema>;
  schoolId: string;
  levels?: any[];
  onSubmit: (data: CreateSubjectSchema) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function SubjectForm({
  defaultValues,
  schoolId,
  levels = [],
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
      color: "#3B82F6",
      description: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    const safeDefaults = defaultValues || {};
    form.reset({
      name: safeDefaults.name ?? "",
      code: safeDefaults.code ?? "",
      schoolId,
      levelId: safeDefaults.levelId ?? null,
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
