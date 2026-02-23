'use client';

import { useEffect, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { createAcademicYearSchema, type CreateAcademicYearSchema } from "@novaconnect/core/schemas";
import { Loader2 } from "lucide-react";
import { addYears } from "date-fns";

interface AcademicYearFormProps {
  defaultValues?: Partial<CreateAcademicYearSchema>;
  schoolId: string;
  onSubmit: (data: CreateAcademicYearSchema) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

export function AcademicYearForm({
  defaultValues,
  schoolId,
  onSubmit,
  isLoading = false,
  submitLabel = "Enregistrer",
}: AcademicYearFormProps) {
  const toDateInputValue = (value: string | Date | null) => {
    if (!value) return new Date().toISOString().split('T')[0];
    if (value instanceof Date) return value.toISOString().split('T')[0];
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString().split('T')[0];
    return parsed.toISOString().split('T')[0];
  };

  const defaultDates = useMemo(() => {
    const today = new Date();
    return {
      startDate: toDateInputValue(today),
      endDate: toDateInputValue(addYears(today, 1)),
    };
  }, []);
  const defaultStartDate = defaultDates.startDate;
  const defaultEndDate = defaultDates.endDate;

  const form = useForm<CreateAcademicYearSchema>({
    resolver: zodResolver(createAcademicYearSchema),
    defaultValues: {
      name: "",
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      isCurrent: false,
      schoolId: schoolId,
      ...defaultValues,
    },
  });

  useEffect(() => {
    const resolvedStartDate = (defaultValues?.startDate ?? defaultStartDate);
    const resolvedEndDate = (defaultValues?.endDate ?? defaultEndDate);
    form.reset({
      name: defaultValues?.name ?? "",
      startDate: toDateInputValue(resolvedStartDate ?? null),
      endDate: toDateInputValue(resolvedEndDate ?? null),
      isCurrent: defaultValues?.isCurrent ?? false,
      schoolId: schoolId,
    });
  }, [form, defaultValues, schoolId, defaultStartDate, defaultEndDate]);

  const handleSubmit = async (data: CreateAcademicYearSchema) => {
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
              <FormLabel>Nom de l'année scolaire *</FormLabel>
              <FormControl>
                <Input placeholder="2024-2025" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de début *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de fin *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isCurrent"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Année scolaire actuelle</FormLabel>
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
