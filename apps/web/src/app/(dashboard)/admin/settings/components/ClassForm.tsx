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
import { createSchoolClassSchema, type CreateSchoolClassSchema } from "@novaconnect/core/schemas";
import { Loader2 } from "lucide-react";

interface ClassFormProps {
  defaultValues?: Partial<CreateSchoolClassSchema>;
  schoolId: string;
  onSubmit: (data: CreateSchoolClassSchema) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
  levels?: any[];
  academicYears?: any[];
}

export function ClassForm({
  defaultValues,
  schoolId,
  onSubmit,
  isLoading = false,
  submitLabel = "Enregistrer",
  levels = [],
  academicYears = [],
}: ClassFormProps) {
  const form = useForm<CreateSchoolClassSchema>({
    resolver: zodResolver(createSchoolClassSchema),
    defaultValues: {
      name: "",
      code: "",
      schoolId,
      levelId: "",
      academicYearId: "",
      homeroomTeacherId: null,
      roomId: null,
      ...defaultValues,
    },
  });

  useEffect(() => {
    const safeDefaults = defaultValues || {};
    form.register("homeroomTeacherId");
    form.register("roomId");
    form.reset({
      name: safeDefaults.name ?? "",
      code: safeDefaults.code ?? "",
      schoolId,
      levelId: safeDefaults.levelId ?? "",
      academicYearId: safeDefaults.academicYearId ?? "",
      homeroomTeacherId: safeDefaults.homeroomTeacherId ?? null,
      roomId: safeDefaults.roomId ?? null,
      capacity: safeDefaults.capacity ?? undefined,
    });
  }, [form, defaultValues, schoolId]);

  const handleSubmit = async (data: CreateSchoolClassSchema) => {
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
              <FormLabel>Nom de la classe *</FormLabel>
              <FormControl>
                <Input placeholder="6ème A" {...field} />
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
                <Input placeholder="6EMEA" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="levelId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Niveau *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un niveau" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {levels.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        {level.name}
                      </SelectItem>
                    ))}
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
        </div>

        <FormField
          control={form.control}
          name="capacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Capacité</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value === "" ? undefined : parseInt(value, 10));
                  }}
                />
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
