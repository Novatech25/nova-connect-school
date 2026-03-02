"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  CalendarIcon, 
  BookOpen, 
  GraduationCap, 
  Coins, 
  Receipt,
  Info
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  createEnrollmentSchema,
  type Student,
  type CreateEnrollment,
  enrollmentStatusSchema,
} from "@novaconnect/core";

const extendedEnrollmentSchema = createEnrollmentSchema.extend({
  annualTuitionAmount: z.coerce.number().optional(),
  scholarshipType: z.enum(["none", "full", "partial"]).default("none"),
  scholarshipReason: z.string().optional(),
  tuitionYear: z.string().optional(),
});

type ExtendedEnrollment = z.infer<typeof extendedEnrollmentSchema>;

interface EnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  classes: Array<{ id: string; name: string }>;
  academicYears: Array<{ id: string; name: string }>;
  onSubmit: (data: ExtendedEnrollment) => Promise<void>;
}

export function EnrollmentDialog({
  open,
  onOpenChange,
  student,
  classes,
  academicYears,
  onSubmit,
}: EnrollmentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ExtendedEnrollment>({
    resolver: zodResolver(extendedEnrollmentSchema),
    defaultValues: {
      schoolId: student?.schoolId || "",
      studentId: student?.id || "",
      classId: "",
      academicYearId: "",
      enrollmentDate: new Date(),
      status: "enrolled",
      isRepeating: false,
      scholarshipType: "none",
      tuitionYear: "",
    },
  });

  const scholarshipType = form.watch("scholarshipType");
  const annualTuitionAmount = form.watch("annualTuitionAmount");

  const handleSubmit = async (data: ExtendedEnrollment) => {
    if (!student) return;

    try {
      setIsSubmitting(true);
      await onSubmit(data);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating enrollment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="bg-slate-50 border-b px-6 py-4">
          <DialogTitle className="text-xl flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Inscrire l'élève
          </DialogTitle>
          <DialogDescription className="mt-1.5">
            {student
              ? <span className="font-medium text-slate-700">{student.firstName} {student.lastName}</span>
              : "Inscrire l'élève"}
            {" - Renseignez la classe, l'année et la facturation."}
          </DialogDescription>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col max-h-[80vh]"
          >
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Section Académique */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b pb-2">
                  <BookOpen className="h-4 w-4 text-slate-500" />
                  Informations Académiques
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="academicYearId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Année scolaire *</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={academicYears.map((year) => ({
                              label: year.name,
                              value: year.id,
                            }))}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Sélectionner une année..."
                            searchPlaceholder="Rechercher..."
                            emptyMessage="Aucune année trouvée."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="classId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Classe *</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={classes.map((c) => ({
                              label: c.name,
                              value: c.id,
                            }))}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Sélectionner une classe..."
                            searchPlaceholder="Rechercher..."
                            emptyMessage="Aucune classe trouvée."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="enrollmentDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date d'inscription *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "dd/MM/yyyy", { locale: fr })
                                ) : (
                                  <span>Choisir une date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {enrollmentStatusSchema.options.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status === "enrolled"
                                  ? "Inscrit"
                                  : status === "pending"
                                  ? "En attente"
                                  : status === "withdrawn"
                                  ? "Retiré"
                                  : "Terminé"}
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
                  name="isRepeating"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-0.5 leading-none">
                        <FormLabel className="text-sm cursor-pointer">Redoublant</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Cochez si l'élève redouble cette année
                          </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {/* Section Facturation */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 border-b border-emerald-100 pb-2">
                  <Receipt className="h-4 w-4 text-emerald-600" />
                  Scolarité & Facturation
                </div>
                
                <div className="bg-gradient-to-br from-emerald-50/50 to-white border border-emerald-100/60 rounded-xl p-4 sm:p-5 shadow-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  
                    <FormField
                      control={form.control}
                      name="annualTuitionAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scolarité annuelle</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Ex: 500000"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="scholarshipType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bourse</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Aucune</SelectItem>
                              <SelectItem value="full">Boursier(e)</SelectItem>
                              <SelectItem value="partial">Demi-boursier(e)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {scholarshipType !== "none" && (
                      <FormField
                        control={form.control}
                        name="scholarshipReason"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Motif de la bourse</FormLabel>
                            <FormControl>
                              <Input placeholder="Décision de bourse..." {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="tuitionYear"
                      render={({ field }) => (
                        <FormItem className={cn("sm:col-span-2", scholarshipType !== "none" ? "sm:col-span-1" : "")}>
                           <FormLabel className="flex items-center gap-1.5">
                             Année de référence (Millésime)
                             <Info className="h-3 w-3 text-muted-foreground" />
                           </FormLabel>
                           <FormControl>
                             <Input
                               className="bg-white/60 focus:bg-white transition-colors"
                               placeholder="ex: 2024-2025"
                               {...field}
                               value={field.value || ""}
                               onChange={(e) => {
                                 let v = e.target.value;
                                 if (/^\d{4}$/.test(v)) v = `${v}-${parseInt(v) + 1}`;
                                 field.onChange(v);
                               }}
                             />
                           </FormControl>
                           <p className="text-[11px] text-muted-foreground">Ex: 2024-2025 (Automatique si vide)</p>
                           <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t px-6 py-4 flex items-center justify-end gap-3 mt-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Inscription..." : "Valider l'inscription"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
