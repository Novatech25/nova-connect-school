'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, GraduationCap, Loader2, Plus, Save } from 'lucide-react';
import {
  useAcademicYears,
  useClasses,
  useCreateEnrollment,
  useEnrollmentsByStudent,
  useStudent,
  useUpdateEnrollment,
  useApplyExemption,
} from '@novaconnect/data';
import { useAuthContext } from '@novaconnect/data/providers';
import { enrollmentStatusSchema, type CreateEnrollment } from '@novaconnect/core';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { EnrollmentDialog } from '@/components/admin/students/enrollment-dialog';

interface PageProps {
  params: Promise<{ id: string }>;
}

const enrollmentEditSchema = z.object({
  id: z.string().uuid(),
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  enrollmentDate: z.coerce.date(),
  status: enrollmentStatusSchema.default('enrolled'),
  isRepeating: z.boolean().default(false),
  notes: z.string().optional(),
});

type EnrollmentEditValues = z.infer<typeof enrollmentEditSchema>;

export default function StudentEnrollmentPage({ params }: PageProps) {
  const { id: studentId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, user } = useAuthContext();
  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    user?.schoolId ||
    (user as any)?.school_id ||
    '';

  const { data: student, isLoading: isStudentLoading } = useStudent(studentId);
  const { data: enrollments = [], isLoading: isEnrollmentsLoading } = useEnrollmentsByStudent(studentId);
  const { data: academicYears = [] } = useAcademicYears(schoolId);
  const { data: classes = [] } = useClasses(schoolId);

  const updateEnrollmentMutation = useUpdateEnrollment();
  const createEnrollmentMutation = useCreateEnrollment();
  const applyExemptionMutation = useApplyExemption();

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const selectedEnrollment = useMemo(() => {
    if (!enrollments || enrollments.length === 0) return null;
    if (selectedEnrollmentId) {
      return enrollments.find((enrollment: any) => enrollment.id === selectedEnrollmentId) || enrollments[0];
    }
    return enrollments[0];
  }, [enrollments, selectedEnrollmentId]);

  useEffect(() => {
    if (!selectedEnrollment && enrollments.length > 0) {
      setSelectedEnrollmentId(enrollments[0].id);
    }
  }, [selectedEnrollment, enrollments]);

  const form = useForm<EnrollmentEditValues>({
    resolver: zodResolver(enrollmentEditSchema),
    defaultValues: {
      id: '',
      academicYearId: '',
      classId: '',
      enrollmentDate: new Date(),
      status: 'enrolled',
      isRepeating: false,
      notes: '',
    },
  });

  useEffect(() => {
    if (!selectedEnrollment) return;
    form.reset({
      id: selectedEnrollment.id,
      academicYearId: selectedEnrollment.academicYearId || '',
      classId: selectedEnrollment.classId || '',
      enrollmentDate: selectedEnrollment.enrollmentDate
        ? new Date(selectedEnrollment.enrollmentDate as any)
        : new Date(),
      status: selectedEnrollment.status || 'enrolled',
      isRepeating: Boolean(selectedEnrollment.isRepeating),
      notes: selectedEnrollment.notes || '',
    });
  }, [selectedEnrollment, form]);

  const handleUpdate = async (values: EnrollmentEditValues) => {
    if (!selectedEnrollment) return;

    try {
      await updateEnrollmentMutation.mutateAsync({
        id: selectedEnrollment.id,
        academicYearId: values.academicYearId,
        classId: values.classId,
        enrollmentDate: values.enrollmentDate,
        status: values.status,
        isRepeating: values.isRepeating,
        notes: values.notes || undefined,
      });
      await queryClient.invalidateQueries({
        queryKey: ['enrollments', 'student', studentId],
      });
      toast({
        title: 'Inscription mise a jour',
        description: "L'inscription de l'eleve a ete mise a jour.",
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error?.message || "Impossible de mettre a jour l'inscription.",
        variant: 'destructive',
      });
    }
  };

  const handleCreateEnrollment = async (data: any) => {
    try {
      const created = await createEnrollmentMutation.mutateAsync({
        ...data,
      });

      // Handle Scholarship Application if selected
      if (data.scholarshipType && data.scholarshipType !== 'none') {
        if (!user?.id) {
            throw new Error('Utilisateur non disponible pour valider la bourse.');
        }

        const selectedYear = academicYears.find((year: any) => year.id === data.academicYearId);
        const validFromCandidate = selectedYear?.startDate || data.enrollmentDate || new Date();
        const validFromDate = new Date(validFromCandidate);
        const validUntilDate = selectedYear?.endDate ? new Date(selectedYear.endDate) : undefined;
        
        const resolvedValidFrom = Number.isNaN(validFromDate.getTime()) ? new Date() : validFromDate;
        const resolvedValidUntil = validUntilDate && !Number.isNaN(validUntilDate.getTime()) ? validUntilDate : undefined;
        
        const percentage = data.scholarshipType === 'full' ? 100 : data.scholarshipType === 'partial' ? 50 : 0;
        const reason = data.scholarshipReason?.trim() || (data.scholarshipType === 'full' ? 'Bourse' : 'Demi-bourse');

        await applyExemptionMutation.mutateAsync({
            schoolId,
            approvedBy: user.id,
            student_id: studentId,
            exemption_type: 'scholarship',
            percentage,
            reason,
            valid_from: resolvedValidFrom,
            valid_until: resolvedValidUntil,
            applies_to_fee_types: [],
            metadata: { scholarshipType: data.scholarshipType },
        });
      }

      await queryClient.invalidateQueries({
        queryKey: ['enrollments', 'student', studentId],
      });
      
      let msg = "L'eleve a ete inscrit avec succes.";
      if (data.annualTuitionAmount && data.annualTuitionAmount > 0) {
        msg += `\nScolarite générée: ${Math.round(data.annualTuitionAmount).toLocaleString('fr-FR')} FCFA`;
      }

      toast({
        title: 'Inscription creee',
        description: msg,
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || "Erreur lors de l'inscription.",
        variant: 'destructive',
      });
    }
  };

  if (isStudentLoading || isEnrollmentsLoading) {
    return (
      <div className="min-h-full flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-full flex items-center justify-center py-16">
        <p className="text-muted-foreground">Eleve introuvable.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Inscription</h1>
              <p className="text-muted-foreground mt-1">
                {student.firstName} {student.lastName}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/admin/students/${student.id}/edit`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle inscription
            </Button>
          </div>
        </div>

        <Card className="border-border/60 bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle>Historique des inscriptions</CardTitle>
            <CardDescription>Selectionnez une inscription pour la modifier.</CardDescription>
          </CardHeader>
          <CardContent>
            {enrollments.length === 0 ? (
              <p className="text-muted-foreground">Aucune inscription.</p>
            ) : (
              <div className="space-y-3">
                {enrollments.map((enrollment: any) => (
                  <button
                    key={enrollment.id}
                    type="button"
                    className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                      enrollment.id === selectedEnrollment?.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border/70 bg-white'
                    }`}
                    onClick={() => setSelectedEnrollmentId(enrollment.id)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {enrollment.class?.name || 'Classe'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {enrollment.academicYear?.name || 'Annee scolaire'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{enrollment.status || 'enrolled'}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {enrollment.enrollmentDate
                            ? format(new Date(enrollment.enrollmentDate as any), 'dd/MM/yyyy')
                            : '--'}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedEnrollment && (
          <Card className="border-border/60 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle>Modifier l'inscription</CardTitle>
              <CardDescription>Mettre a jour la classe, l'annee et le statut.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="id"
                    render={({ field }) => (
                      <FormItem className="hidden">
                        <FormControl>
                          <Input type="hidden" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="academicYearId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Annee scolaire *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {academicYears.map((year: any) => (
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

                    <FormField
                      control={form.control}
                      name="classId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Classe *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {classes.map((classItem: any) => (
                                <SelectItem key={classItem.id} value={classItem.id}>
                                  {classItem.name}
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
                      name="enrollmentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date d'inscription *</FormLabel>
                          <FormControl>
                            <input
                              type="date"
                              value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                              onChange={(e) =>
                                field.onChange(e.target.value ? new Date(e.target.value) : null)
                              }
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                            />
                          </FormControl>
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
                          <Select onValueChange={field.onChange} value={field.value || 'enrolled'}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selectionner" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {enrollmentStatusSchema.options.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status === 'enrolled'
                                    ? 'Inscrit'
                                    : status === 'pending'
                                      ? 'En attente'
                                      : status === 'withdrawn'
                                        ? 'Retire'
                                        : 'Termine'}
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
                      <FormItem className="flex items-center gap-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>Redoublant</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Notes d'inscription..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center justify-end">
                    <Button type="submit" disabled={updateEnrollmentMutation.isPending}>
                      {updateEnrollmentMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {updateEnrollmentMutation.isPending ? 'Mise a jour...' : 'Enregistrer'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        <EnrollmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          student={student}
          classes={classes}
          academicYears={academicYears}
          onSubmit={handleCreateEnrollment}
        />
      </div>
    </div>
  );
}
