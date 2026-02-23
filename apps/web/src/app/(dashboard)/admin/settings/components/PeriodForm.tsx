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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPeriodSchema, type CreatePeriodSchema, periodTypeSchema } from "@novaconnect/core/schemas";
import { Loader2 } from "lucide-react";
import { addDays } from "date-fns";

interface PeriodFormProps {
  defaultValues?: Partial<CreatePeriodSchema>;
  schoolId: string;
  onSubmit: (data: CreatePeriodSchema) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
  academicYears?: any[];
}

export function PeriodForm({
  defaultValues,
  schoolId,
  onSubmit,
  isLoading = false,
  submitLabel = "Enregistrer",
  academicYears = [],
}: PeriodFormProps) {
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
      endDate: toDateInputValue(addDays(today, 1)),
    };
  }, []);
  const defaultStartDate = defaultDates.startDate;
  const defaultEndDate = defaultDates.endDate;

  const form = useForm<CreatePeriodSchema>({
    resolver: zodResolver(createPeriodSchema),
    defaultValues: {
      name: "",
      periodType: "trimester",
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      schoolId,
      academicYearId: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    const safeDefaults = defaultValues || {};
    const resolvedStartDate = safeDefaults.startDate ?? defaultStartDate;
    const resolvedEndDate = safeDefaults.endDate ?? defaultEndDate;
    form.reset({
      name: safeDefaults.name ?? "",
      periodType: safeDefaults.periodType ?? "trimester",
      startDate: toDateInputValue(resolvedStartDate ?? null),
      endDate: toDateInputValue(resolvedEndDate ?? null),
      schoolId,
      academicYearId: safeDefaults.academicYearId ?? "",
      orderIndex: safeDefaults.orderIndex ?? 0,
      weight: safeDefaults.weight ?? 1,
    });
  }, [form, defaultValues, schoolId, defaultStartDate, defaultEndDate]);

  const handleSubmit = async (data: CreatePeriodSchema) => {
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
              <FormLabel>Nom de la période *</FormLabel>
              <FormControl>
                <Input placeholder="1er Trimestre" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="periodType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type de période *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="trimester">Trimestre</SelectItem>
                  <SelectItem value="semester">Semestre</SelectItem>
                  <SelectItem value="composition">Composition</SelectItem>
                  <SelectItem value="exam">Examen</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="academicYearId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Année scolaire *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une année" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {academicYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
