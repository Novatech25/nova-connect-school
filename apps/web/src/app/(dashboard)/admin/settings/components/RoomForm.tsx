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
import { createRoomSchema, type CreateRoomSchema, roomTypeSchema } from "@novaconnect/core/schemas";
import { Loader2 } from "lucide-react";

interface RoomFormProps {
  defaultValues?: Partial<CreateRoomSchema>;
  schoolId: string;
  onSubmit: (data: CreateRoomSchema) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
  campuses?: any[];
}

export function RoomForm({
  defaultValues,
  schoolId,
  onSubmit,
  isLoading = false,
  submitLabel = "Enregistrer",
  campuses = [],
}: RoomFormProps) {
  const form = useForm<CreateRoomSchema>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: "",
      roomType: "classroom",
      capacity: 30,
      schoolId,
      campusId: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    const safeDefaults = defaultValues || {};
    form.reset({
      name: safeDefaults.name ?? "",
      roomType: safeDefaults.roomType ?? "classroom",
      capacity: safeDefaults.capacity ?? 30,
      schoolId,
      campusId: safeDefaults.campusId ?? "",
    });
  }, [form, defaultValues, schoolId]);

  const handleSubmit = async (data: CreateRoomSchema) => {
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
              <FormLabel>Nom de la salle *</FormLabel>
              <FormControl>
                <Input placeholder="Salle 101" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="roomType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de salle *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="classroom">Salle de classe</SelectItem>
                    <SelectItem value="lab">Laboratoire</SelectItem>
                    <SelectItem value="amphitheater">Amphithéâtre</SelectItem>
                    <SelectItem value="library">Bibliothèque</SelectItem>
                    <SelectItem value="gym">Gymnase</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacité</FormLabel>
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
          name="campusId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campus *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un campus" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {campuses.map((campus) => (
                    <SelectItem key={campus.id} value={campus.id}>
                      {campus.name}
                    </SelectItem>
                  ))}
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
