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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLevelSchema, type CreateLevelSchema, levelTypeSchema } from "@novaconnect/core/schemas";
import { Loader2 } from "lucide-react";

interface LevelFormProps {
  defaultValues?: Partial<CreateLevelSchema>;
  schoolId: string;
  onSubmit: (data: CreateLevelSchema) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function LevelForm({
  defaultValues,
  schoolId,
  onSubmit,
  isLoading = false,
  submitLabel = "Enregistrer",
}: LevelFormProps) {
  const form = useForm<CreateLevelSchema>({
    resolver: zodResolver(createLevelSchema),
    defaultValues: {
      name: "",
      code: "",
      levelType: "primary",
      orderIndex: 0,
      schoolId,
      ...defaultValues,
    },
  });

  useEffect(() => {
    const safeDefaults = defaultValues || {};
    form.reset({
      name: safeDefaults.name ?? "",
      code: safeDefaults.code ?? "",
      levelType: safeDefaults.levelType ?? "primary",
      orderIndex: safeDefaults.orderIndex ?? 0,
      schoolId,
    });
  }, [form, defaultValues, schoolId]);

  const handleSubmit = async (data: CreateLevelSchema) => {
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
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom du niveau *</FormLabel>
              <FormControl>
                <Input placeholder="6ème année" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code *</FormLabel>
                <FormControl>
                  <Input placeholder="6EME" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="orderIndex"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ordre *</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="levelType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type de niveau *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="primary">Primaire</SelectItem>
                  <SelectItem value="middle_school">Collège</SelectItem>
                  <SelectItem value="high_school">Lycée</SelectItem>
                  <SelectItem value="university">Université</SelectItem>
                </SelectContent>
              </Select>
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
