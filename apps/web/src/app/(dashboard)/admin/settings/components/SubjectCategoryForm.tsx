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
import { createSubjectCategorySchema } from "@novaconnect/core/schemas";
import { z } from "zod";
import { Loader2 } from "lucide-react";

type CreateSubjectCategorySchema = z.infer<typeof createSubjectCategorySchema>;

interface SubjectCategoryFormProps {
  defaultValues?: Partial<CreateSubjectCategorySchema>;
  schoolId: string;
  onSubmit: (data: CreateSubjectCategorySchema) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function SubjectCategoryForm({
  defaultValues,
  schoolId,
  onSubmit,
  isLoading = false,
  submitLabel = "Enregistrer",
}: SubjectCategoryFormProps) {
  const form = useForm<CreateSubjectCategorySchema>({
    resolver: zodResolver(createSubjectCategorySchema),
    defaultValues: {
      name: "",
      code: "",
      schoolId,
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
      color: safeDefaults.color ?? "#3B82F6",
      description: safeDefaults.description ?? "",
    } as any);
  }, [form, defaultValues, schoolId]);

  const handleSubmit = async (data: CreateSubjectCategorySchema) => {
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
                <FormLabel>Nom de l'UE *</FormLabel>
                <FormControl>
                  <Input placeholder="Sciences Administratives" {...field} />
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
                <FormLabel>Code (optionnel)</FormLabel>
                <FormControl>
                  <Input placeholder="SA1" {...field} value={field.value || ''} />
                </FormControl>
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
                <Textarea placeholder="Description de l'UE..." {...field} value={field.value || ''} />
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
                  <Input type="color" {...field} className="w-20 h-10" value={field.value || '#3B82F6'} />
                </FormControl>
                <Input
                  type="text"
                  {...field}
                  placeholder="#3B82F6"
                  className="flex-1"
                  value={field.value || ''}
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
