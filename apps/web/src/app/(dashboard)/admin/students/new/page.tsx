'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  GraduationCap,
  Save,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@novaconnect/data';
import {
  useAcademicYears,
  useClasses,
  useCreateFeeSchedule,
  useCreateFeeType,
  useCreateEnrollment,
  useCreateParent,
  useCreateStudent,
  useCreateStudentParentRelation,
  useDeleteStudentParentRelation,
  useFeeTypes,
  useParentsByStudent,
  useStudentDocuments,
  useLevels,
  useApplyExemption,
  useParentByEmail,
} from '@novaconnect/data';
import {
  createStudentSchema,
  enrollmentStatusSchema,
  genderSchema,
  studentStatusSchema,
  type CreateEnrollment,
  type CreateParent,
  type CreateStudent,
  type Student,
} from '@novaconnect/core/schemas';
import { EnrollmentDialog } from '@/components/admin/students/enrollment-dialog';
import { ParentsDialog } from '@/components/admin/students/parents-dialog';
import { DocumentsDialog } from '@/components/admin/students/documents-dialog';
import { AccountCreationDialog } from '@/components/admin/students/AccountCreationDialog';
import { useQueryClient } from '@tanstack/react-query';

const levelTypeOrder = ['primary', 'middle_school', 'high_school', 'university'] as const;
type LevelTypeKey = typeof levelTypeOrder[number];

const levelTypeLabels: Record<LevelTypeKey, { label: string; description: string }> = {
  primary: { label: 'Primaire', description: 'Cycle elementaire' },
  middle_school: { label: 'College', description: 'Cycle moyen' },
  high_school: { label: 'Lycee', description: 'Cycle secondaire' },
  university: { label: 'Universite', description: 'Cycle superieur' },
};

const emptyStudentId = '00000000-0000-0000-0000-000000000000';

const optionalEmailSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().email().optional()
);

const optionalUrlSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional()
);

const optionalNumberSchema = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.number().nonnegative().optional()
);

const studentFormSchema = createStudentSchema
  .extend({
    email: optionalEmailSchema,
    photoUrl: optionalUrlSchema,
    enrollNow: z.boolean().default(true),
    enrollmentAcademicYearId: z.string().optional(),
    enrollmentClassId: z.string().optional(),
    enrollmentDate: z.coerce.date().optional(),
    enrollmentStatus: enrollmentStatusSchema.optional(),
    isRepeating: z.boolean().optional(),
    enrollmentNotes: z.string().optional(),
    levelId: z.string().optional(),
    addParent: z.boolean().default(false),
    parentFirstName: z.string().optional(),
    parentLastName: z.string().optional(),
    parentPhone: z.string().optional(),
    parentEmail: optionalEmailSchema,
    parentRelationship: z.string().optional(),
    parentAddress: z.string().optional(),
    parentCity: z.string().optional(),
    parentOccupation: z.string().optional(),
    parentWorkplace: z.string().optional(),
    parentIsPrimaryContact: z.boolean().default(true),
    parentIsEmergencyContact: z.boolean().default(false),
    scholarshipType: z.enum(['none', 'full', 'partial']).default('none'),
    scholarshipReason: z.string().optional(),
    annualTuitionAmount: optionalNumberSchema,
    tuitionYear: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.enrollNow && !(data.enrollmentAcademicYearId && data.enrollmentClassId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selectionnez une annee scolaire et une classe.',
        path: ['enrollmentClassId'],
      });
    }

    if (data.enrollNow && (!data.annualTuitionAmount || data.annualTuitionAmount <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indiquez la scolarite annuelle.',
        path: ['annualTuitionAmount'],
      });
    }

    if (data.addParent) {
      if (!data.parentFirstName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Prenom du parent requis.',
          path: ['parentFirstName'],
        });
      }
      if (!data.parentLastName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Nom du parent requis.',
          path: ['parentLastName'],
        });
      }
      if (!data.parentPhone?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Telephone du parent requis.',
          path: ['parentPhone'],
        });
      }
    }
  });

type StudentFormValues = z.infer<typeof studentFormSchema>;

export default function NewStudentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  // Get schoolId with fallbacks
  const schoolId = profile?.school?.id || profile?.school_id || user?.schoolId || (user as any)?.school_id;

  const [createdStudent, setCreatedStudent] = useState<Student | null>(null);
  const [selectedLevelType, setSelectedLevelType] = useState<LevelTypeKey>('primary');
  const [parentsDialogOpen, setParentsDialogOpen] = useState(false);
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);

  const { data: academicYears = [] } = useAcademicYears(schoolId || '');
  const { data: levels = [] } = useLevels(schoolId || '');

  const currentAcademicYear = academicYears.find((year: any) => year.is_current);
  const defaultAcademicYearId = useMemo(
    () => currentAcademicYear?.id,
    [currentAcademicYear]
  ) || undefined;

  const createStudentMutation = useCreateStudent();
  const createEnrollmentMutation = useCreateEnrollment();
  const createParentMutation = useCreateParent();
  const createRelationMutation = useCreateStudentParentRelation();
  const deleteRelationMutation = useDeleteStudentParentRelation();
  const applyExemptionMutation = useApplyExemption();

  const activeStudentId = createdStudent?.id || emptyStudentId;
  const { data: parents = [] } = useParentsByStudent(activeStudentId);
  const { data: documents = [] } = useStudentDocuments(activeStudentId);

  const availableLevelTypes = useMemo(() => {
    return levelTypeOrder.filter((type) =>
      levels.some((level: any) => level.levelType === type)
    );
  }, [levels]);

  const levelOptions = useMemo(() => {
    return levels
      .filter((level: any) => level.levelType === selectedLevelType)
      .sort((a: any, b: any) => a.orderIndex - b.orderIndex);
  }, [levels, selectedLevelType]);

  const levelById = useMemo(() => {
    return new Map(levels.map((level: any) => [level.id, level]));
  }, [levels]);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema) as Resolver<StudentFormValues>,
    defaultValues: {
      schoolId: schoolId || '',
      matricule: '',
      firstName: '',
      lastName: '',
      dateOfBirth: undefined,
      gender: undefined,
      placeOfBirth: '',
      nationality: '',
      address: '',
      city: '',
      phone: '',
      email: '',
      photoUrl: '',
      status: 'active',
      enrollNow: true,
      enrollmentAcademicYearId: defaultAcademicYearId,
      enrollmentClassId: '',
      enrollmentDate: new Date(),
      enrollmentStatus: 'enrolled',
      isRepeating: false,
      enrollmentNotes: '',
      levelId: '',
      addParent: false,
      parentFirstName: '',
      parentLastName: '',
      parentPhone: '',
      parentEmail: '',
      parentRelationship: '',
      parentAddress: '',
      parentCity: '',
      parentOccupation: '',
      parentWorkplace: '',
      parentIsPrimaryContact: true,
      parentIsEmergencyContact: false,
      scholarshipType: 'none',
      scholarshipReason: '',
      annualTuitionAmount: undefined,
      tuitionYear: '',
    },
  });

  const enrollNow = form.watch('enrollNow');
  const addParent = form.watch('addParent');
  const scholarshipType = form.watch('scholarshipType');
  const selectedLevelId = form.watch('levelId');
  const selectedYearId = form.watch('enrollmentAcademicYearId');
  const effectiveAcademicYearId = selectedYearId || defaultAcademicYearId;
  const parentEmail = form.watch('parentEmail');

  const { data: existingParent } = useParentByEmail(schoolId || '', parentEmail || '');

  useEffect(() => {
    if (existingParent) {
      toast({
        title: "Parent existant détecté",
        description: `Nous avons trouvé ${existingParent.firstName} ${existingParent.lastName}. Ce parent sera automatiquement associé.`,
        duration: 5000,
      });
      // Optional: Pre-fill fields for visual confirmation (or lock them)
      form.setValue('parentFirstName', existingParent.firstName);
      form.setValue('parentLastName', existingParent.lastName);
      form.setValue('parentPhone', existingParent.phone);
    }
  }, [existingParent, form, toast]);

  const { data: classes = [] } = useClasses(schoolId || '', effectiveAcademicYearId);

  const filteredClasses = useMemo(() => {
    if (!selectedLevelType) return [];
    const levelIds = new Set(
      levels
        .filter((level: any) => level.levelType === selectedLevelType)
        .map((level: any) => level.id)
    );

    return classes.filter((classItem: any) => {
      if (!levelIds.has(classItem.levelId)) return false;
      if (selectedLevelId && classItem.levelId !== selectedLevelId) return false;
      return true;
    });
  }, [classes, levels, selectedLevelId, selectedLevelType]);

  useEffect(() => {
    if (!schoolId) return;
    form.setValue('schoolId', schoolId);
  }, [schoolId, form]);

  useEffect(() => {
    if (!selectedYearId && currentAcademicYear?.id) {
      form.setValue('enrollmentAcademicYearId', currentAcademicYear.id);
    }
  }, [currentAcademicYear, form, selectedYearId]);

  useEffect(() => {
    const firstType = availableLevelTypes[0];
    if (!firstType) return;

    setSelectedLevelType((prev) =>
      availableLevelTypes.includes(prev) ? prev : firstType
    );
  }, [availableLevelTypes]);

  // Auto-update tuition year when academic year changes
  useEffect(() => {
    if (selectedYearId) {
      const selectedYear = academicYears.find((year: any) => year.id === selectedYearId);
      if (selectedYear?.name) {
        form.setValue('tuitionYear', selectedYear.name);
      }
    }
  }, [selectedYearId, academicYears, form]);

  const handleCreateEnrollment = async (enrollment: CreateEnrollment & { annualTuitionAmount?: number; scholarshipType?: string; scholarshipReason?: string; tuitionYear?: string }) => {
    console.log('🎓 handleCreateEnrollment - Sending enrollment data with tuition fields:', enrollment);

    // Include tuition fields in the enrollment data so the database trigger can create the fee_schedule
    const createdEnrollment = await createEnrollmentMutation.mutateAsync({
      ...enrollment,
      annualTuitionAmount: enrollment.annualTuitionAmount,
      scholarshipType: enrollment.scholarshipType || 'none',
      scholarshipReason: enrollment.scholarshipReason,
      tuitionYear: enrollment.tuitionYear,
    } as any);

    console.log('✅ Enrollment creation result:', createdEnrollment);

    // Show success message
    const annualTuitionAmount = enrollment.annualTuitionAmount;
    if (annualTuitionAmount && annualTuitionAmount > 0) {
      toast({
        title: '✅ Inscription réussie',
        description: `L'élève a été inscrit avec succès.\n\nScolarité: ${Math.round(annualTuitionAmount).toLocaleString('fr-FR')} FCFA`,
      });
    } else {
      toast({
        title: '✅ Inscription réussie',
        description: "L'élève a été inscrit avec succès dans la classe sélectionnée.",
      });
    }

    return createdEnrollment;
  };

  const handleSubmit = async (values: StudentFormValues) => {
    console.log('🚀 Submit button clicked!');
    console.log('Form values:', values);

    if (!schoolId) {
      console.error('❌ No schoolId! User context:', user);
      toast({
        title: 'Erreur',
        description: "École non trouvée. Veuillez vous reconnecter.",
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('📝 Creating student...');
      const {
        enrollNow,
        enrollmentAcademicYearId,
        enrollmentClassId,
        enrollmentDate,
        enrollmentStatus,
        isRepeating,
        enrollmentNotes,
        levelId,
        addParent: addParentNow,
        parentFirstName,
        parentLastName,
        parentPhone,
        parentEmail,
        parentRelationship,
        parentAddress,
        parentCity,
        parentOccupation,
        parentWorkplace,
        parentIsPrimaryContact,
        parentIsEmergencyContact,
        scholarshipType: scholarshipChoice,
        scholarshipReason,
        annualTuitionAmount,
        tuitionYear,
        ...studentData
      } = values;

      // Ensure schoolId is explicitly passed
      const payload = {
        ...studentData,
        school_id: schoolId, // Force school_id from verified context
      };

      console.log('🚀 Creating student with payload:', { ...payload, photo: payload.photoUrl ? 'URL_HIDDEN' : undefined });

      // Auto-generate matricule if empty
      let finalMatricule = studentData.matricule;
      let created = null;

      if (!finalMatricule || finalMatricule.trim() === '') {
        const currentYear = new Date().getFullYear();
        let matriculeNumber = 1;
        let maxRetries = 10;

        // Try to create student with auto-generated matricule, retrying if duplicate
        while (maxRetries > 0 && !created) {
          finalMatricule = `NOVA-${currentYear}-${String(matriculeNumber).padStart(4, '0')}`;
          console.log(`🎫 Attempting matricule: ${finalMatricule} (attempt ${11 - maxRetries}/10)`);

          try {
            created = await createStudentMutation.mutateAsync({
              ...(payload as CreateStudent),
              matricule: finalMatricule,
              schoolId,
            });
            console.log(`✅ Student created with matricule: ${finalMatricule}`);
          } catch (error: any) {
            // Check if error is due to duplicate matricule
            if (error.code === '23505' && error.message.includes('matricule')) {
              console.log(`⚠️ Matricule ${finalMatricule} already exists, trying next number...`);
              matriculeNumber++;
              maxRetries--;
            } else {
              // Different error, rethrow
              throw error;
            }
          }
        }

        if (!created) {
          throw new Error('Unable to generate unique matricule after 10 attempts. Please try again or specify a matricule manually.');
        }
      } else {
        // User provided matricule, try to create directly
        console.log('🎫 Using provided matricule:', finalMatricule);
        created = await createStudentMutation.mutateAsync({
          ...(payload as CreateStudent),
          matricule: finalMatricule,
          schoolId,
        });
      }

      console.log('✅ Student created:', created);
      setCreatedStudent(created);

      setCreatedStudent(created);

      if (enrollNow && enrollmentAcademicYearId && enrollmentClassId) {
        try {
          console.log('📝 Creating enrollment with data:', {
            schoolId,
            studentId: created.id,
            classId: enrollmentClassId,
            academicYearId: enrollmentAcademicYearId,
            enrollmentDate: enrollmentDate || new Date(),
            status: enrollmentStatus || 'enrolled',
          });

          const enrollmentResult = await handleCreateEnrollment({
            schoolId,
            studentId: created.id,
            classId: enrollmentClassId,
            academicYearId: enrollmentAcademicYearId,
            enrollmentDate: enrollmentDate || new Date(),
            status: enrollmentStatus || 'enrolled',
            isRepeating: Boolean(isRepeating),
            notes: enrollmentNotes || undefined,
            annualTuitionAmount: annualTuitionAmount || undefined,
            scholarshipType: scholarshipChoice || 'none',
            tuitionYear: tuitionYear || undefined,
          });

          console.log('✅ Enrollment created successfully:', enrollmentResult);
        } catch (error: any) {
          toast({
            title: '⚠️ Élève créé (inscription échouée)',
            description: error.message || "Impossible d'inscrire cet élève pour le moment.\n\nVeuillez réessayer depuis la page de l'élève.",
            variant: 'destructive',
          });
        }
      }

      if (addParentNow) {
        try {
          let parentIdToLink = '';

          // Check if we should use the existing parent
          if (existingParent && existingParent.email === parentEmail) {
            console.log('🔗 Using existing parent:', existingParent.id);
            parentIdToLink = existingParent.id;
          } else {
            // Create new parent
            const parent = await createParentMutation.mutateAsync({
              schoolId,
              firstName: parentFirstName?.trim() || '',
              lastName: parentLastName?.trim() || '',
              phone: parentPhone?.trim() || '',
              email: parentEmail || undefined,
              relationship: parentRelationship || undefined,
              address: parentAddress || undefined,
              city: parentCity || undefined,
              occupation: parentOccupation || undefined,
              workplace: parentWorkplace || undefined,
              isPrimaryContact: Boolean(parentIsPrimaryContact),
              isEmergencyContact: Boolean(parentIsEmergencyContact),
            });
            parentIdToLink = parent.id;
          }

          await createRelationMutation.mutateAsync({
            schoolId,
            studentId: created.id,
            parentId: parentIdToLink,
            relationship: parentRelationship || undefined,
            isPrimary: Boolean(parentIsPrimaryContact),
          });
        } catch (error: any) {
          toast({
            title: '⚠️ Élève créé (parent non ajouté)',
            description: error.message || "Impossible d'associer le parent à cet élève.\n\nVeuillez réessayer depuis la page de l'élève.",
            variant: 'destructive',
          });
        }
      }

      if (scholarshipChoice !== 'none') {
        try {
          if (!user?.id) {
            throw new Error('Utilisateur non disponible pour valider la bourse.');
          }

          const selectedYear = academicYears.find(
            (year: any) => year.id === (enrollmentAcademicYearId || defaultAcademicYearId)
          );
          const validFromCandidate = selectedYear?.startDate || enrollmentDate || new Date();
          const validFromDate = new Date(validFromCandidate);
          const validUntilDate = selectedYear?.endDate
            ? new Date(selectedYear.endDate)
            : undefined;
          const resolvedValidFrom = Number.isNaN(validFromDate.getTime())
            ? new Date()
            : validFromDate;
          const resolvedValidUntil =
            validUntilDate && !Number.isNaN(validUntilDate.getTime())
              ? validUntilDate
              : undefined;
          const percentage =
            scholarshipChoice === 'full'
              ? 100
              : scholarshipChoice === 'partial'
                ? 50
                : 0;
          const reason =
            scholarshipReason?.trim() ||
            (scholarshipChoice === 'full' ? 'Bourse' : 'Demi-bourse');

          await applyExemptionMutation.mutateAsync({
            schoolId,
            approvedBy: user.id,
            student_id: created.id,
            exemption_type: 'scholarship',
            percentage,
            reason,
            valid_from: resolvedValidFrom,
            valid_until: resolvedValidUntil,
            applies_to_fee_types: [],
            metadata: { scholarshipType: scholarshipChoice },
          });
        } catch (error: any) {
          toast({
            title: '⚠️ Élève créé (bourse non appliquée)',
            description: error.message || "Impossible d'appliquer la bourse automatiquement.\n\nVeuillez l'appliquer manuellement depuis la page des paiements.",
            variant: 'destructive',
          });
        }
      }

      // Invalidate queries to refresh the student list
      console.log('🔄 Invalidating queries...');
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await queryClient.invalidateQueries({ queryKey: ['enrollments'] });

      // Wait a bit for the queries to refetch
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refetch students explicitly
      await queryClient.refetchQueries({ queryKey: ['students'] });

      console.log('✅ Queries invalidated and refetched');

      // Build success message with details
      const studentFullName = `${created.first_name} ${created.last_name}`;
      const matriculeInfo = created.matricule ? `Matricule: ${created.matricule}` : '';

      let successDescription = `${studentFullName} a été ajouté avec succès.`;
      if (matriculeInfo) {
        successDescription += `\n\n${matriculeInfo}`;
      }

      // Check if enrollment was done
      const enrolledClasses = created.enrollments && created.enrollments.length > 0;
      if (enrolledClasses) {
        const enrollmentClass = created.enrollments[0]?.class?.name || 'classe';
        successDescription += `\n\n✓ Inscrit en ${enrollmentClass}`;
      }

      toast({
        title: '✅ Élève créé avec succès',
        description: successDescription,
      });
      console.log('✅ Entire process completed successfully!');
    } catch (error: any) {
      console.error('❌ Error in handleSubmit:', error);

      const errorMessage = error?.message || (typeof error === 'string' ? error : "Une erreur est survenue");
      const errorDetails = error?.payload ? JSON.stringify(error.payload, null, 2) :
        (error?.details ? JSON.stringify(error.details, null, 2) :
          JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

      console.error('Error details:', errorDetails);

      toast({
        title: '❌ Erreur lors de la création',
        description: `${errorMessage}${error.status ? `\n\nCode d'erreur: ${error.status}` : ''}\n\nVeuillez réessayer ou contacter le support si le problème persiste.`,
        variant: 'destructive',
      });
    }
  };

  const handleCreateParent = async (data: CreateParent) => {
    if (!createdStudent || !schoolId) return;

    const parent = await createParentMutation.mutateAsync(data);
    await createRelationMutation.mutateAsync({
      schoolId,
      studentId: createdStudent.id,
      parentId: parent.id,
      relationship: data.relationship,
      isPrimary: Boolean(data.isPrimaryContact),
    });

    toast({
      title: 'Parent ajoute',
      description: 'Le parent a ete associe a cet eleve.',
    });
  };

  const handleDeleteRelation = async (relationId: string) => {
    await deleteRelationMutation.mutateAsync(relationId);
    toast({
      title: 'Relation supprimee',
      description: 'Le parent a ete retire de cet eleve.',
    });
  };

  const handleUploadDocument = async () => {
    await queryClient.invalidateQueries({ queryKey: ['student_documents'] });
  };

  const handleDeleteDocument = async (documentId: string) => {
    const response = await fetch(`/api/student-documents/upload?documentId=${documentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur de suppression');
    }

    await queryClient.invalidateQueries({ queryKey: ['student_documents'] });
    toast({
      title: 'Document supprime',
      description: 'Le document a ete supprime avec succes.',
    });
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Nouvel eleve</h1>
              <p className="text-muted-foreground mt-1">
                Creez une fiche eleve et configurez son inscription.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => router.push('/admin/students')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour a la liste
            </Button>
          </div>
        </div>

        {createdStudent && (
          <Card className="border-emerald-200 bg-emerald-50/60">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Eleve cree avec succes</CardTitle>
                <CardDescription>
                  {createdStudent.firstName} {createdStudent.lastName} est pret pour les prochaines etapes.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setAccountDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Creer comptes utilisateurs
                </Button>
                <Button variant="outline" onClick={() => setParentsDialogOpen(true)}>
                  <Users className="mr-2 h-4 w-4" />
                  Ajouter des parents
                </Button>
                <Button variant="outline" onClick={() => setDocumentsDialogOpen(true)}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Ajouter des documents
                </Button>
                <Button variant="outline" onClick={() => setEnrollmentDialogOpen(true)}>
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Nouvelle inscription
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle>Profil eleve</CardTitle>
                <CardDescription>Informations personnelles et identite.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prenom *</FormLabel>
                        <FormControl>
                          <Input placeholder="Jean" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom *</FormLabel>
                        <FormControl>
                          <Input placeholder="Dupont" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="matricule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Matricule</FormLabel>
                        <FormControl>
                          <Input placeholder="NOVA-2026-0001 (auto si vide)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Genre</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {genderSchema.options.map((gender) => (
                              <SelectItem key={gender} value={gender}>
                                {gender === 'male'
                                  ? 'Masculin'
                                  : gender === 'female'
                                    ? 'Feminin'
                                    : gender === 'other'
                                      ? 'Autre'
                                      : 'Non specifie'}
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
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de naissance *</FormLabel>
                        <FormControl>
                          <input
                            type="date"
                            value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                            max={format(new Date(), 'yyyy-MM-dd')}
                            min="1900-01-01"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="placeOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lieu de naissance</FormLabel>
                        <FormControl>
                          <Input placeholder="Paris" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nationality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nationalite</FormLabel>
                        <FormControl>
                          <Input placeholder="Francaise" {...field} />
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {studentStatusSchema.options.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status === 'active'
                                  ? 'Actif'
                                  : status === 'inactive'
                                    ? 'Inactif'
                                    : status === 'graduated'
                                      ? 'Diplome'
                                      : status === 'transferred'
                                        ? 'Transfere'
                                        : status === 'expelled'
                                          ? 'Exclu'
                                          : 'Suspendu'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle>Coordonnees</CardTitle>
                <CardDescription>Informations de contact de l'eleve.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telephone</FormLabel>
                      <FormControl>
                        <Input placeholder="0612345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="eleve@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Adresse</FormLabel>
                      <FormControl>
                        <Input placeholder="123 rue de la Paix" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville</FormLabel>
                      <FormControl>
                        <Input placeholder="Paris" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle>Parents ou tuteurs</CardTitle>
                <CardDescription>
                  Ajoutez un parent ou tuteur pendant l'inscription.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="addParent"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div>
                        <FormLabel>Ajouter un parent ou tuteur maintenant</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Vous pourrez en ajouter d'autres apres la creation.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {addParent && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="parentFirstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prenom *</FormLabel>
                          <FormControl>
                            <Input placeholder="Marie" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="parentLastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom *</FormLabel>
                          <FormControl>
                            <Input placeholder="Dupont" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="parentRelationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lien de parente</FormLabel>
                          <FormControl>
                            <Input placeholder="Pere, Mere, Tuteur" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="parentPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telephone *</FormLabel>
                          <FormControl>
                            <Input placeholder="0612345678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="parentEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="parent@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="parentOccupation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profession</FormLabel>
                          <FormControl>
                            <Input placeholder="Ingenieur" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="parentWorkplace"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lieu de travail</FormLabel>
                          <FormControl>
                            <Input placeholder="Hopital ou entreprise" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="parentAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adresse</FormLabel>
                          <FormControl>
                            <Input placeholder="123 rue de la Paix" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="parentCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ville</FormLabel>
                          <FormControl>
                            <Input placeholder="Paris" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="parentIsPrimaryContact"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Contact principal</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="parentIsEmergencyContact"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Contact d'urgence</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle>Inscription</CardTitle>
                <CardDescription>
                  Choisissez le cycle, le niveau et la classe.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="enrollNow"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div>
                        <FormLabel>Inscrire cet eleve maintenant</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Desactivez si l'inscription se fera plus tard.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {enrollNow && (
                  <div className="space-y-4">
                    <Tabs
                      value={selectedLevelType}
                      onValueChange={(value) => {
                        const nextValue = value as LevelTypeKey;
                        setSelectedLevelType(nextValue);
                        form.setValue('levelId', '');
                        form.setValue('enrollmentClassId', '');
                      }}
                    >
                      <div className="flex flex-col gap-3">
                        <Label>Cycle</Label>
                        <TabsList className="flex flex-wrap justify-start">
                          {availableLevelTypes.map((type) => (
                            <TabsTrigger key={type} value={type}>
                              {levelTypeLabels[type].label}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        <p className="text-xs text-muted-foreground">
                          {levelTypeLabels[selectedLevelType]?.description}
                        </p>
                      </div>
                    </Tabs>

                    {availableLevelTypes.length === 0 && (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Aucun cycle configure. Ajoutez des niveaux dans les parametres.
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="enrollmentAcademicYearId"
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
                                    {year.is_current ? ' (Actuelle)' : ''}
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
                        name="levelId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Niveau</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                form.setValue('enrollmentClassId', '');
                              }}
                              value={field.value || ''}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selectionner un niveau" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {levelOptions.map((level: any) => (
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
                        name="enrollmentClassId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Classe *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selectionner une classe" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {filteredClasses.map((classItem: any) => {
                                  const level = levelById.get(classItem.levelId);
                                  return (
                                    <SelectItem key={classItem.id} value={classItem.id}>
                                      {classItem.name}
                                      {level ? ` - ${level.name}` : ''}
                                    </SelectItem>
                                  );
                                })}
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
                            <FormLabel>Date d'inscription</FormLabel>
                            <FormControl>
                              <input
                                type="date"
                                value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="enrollmentStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Statut</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
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

                      <FormField
                        control={form.control}
                        name="isRepeating"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel>Redoublant</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="enrollmentNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes d'inscription</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Informations complementaires..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="scholarshipType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bourse</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selectionner" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Aucune</SelectItem>
                                <SelectItem value="full">Boursier/boursiere</SelectItem>
                                <SelectItem value="partial">Demi-boursier(e)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {scholarshipType !== 'none' && (
                        <FormField
                          control={form.control}
                          name="scholarshipReason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Motif</FormLabel>
                              <FormControl>
                                <Input placeholder="Decision de bourse" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="tuitionYear"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Annee de reference (Millésime)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="2024-2025"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                // Auto-format year input (e.g., "2024" becomes "2024-2025")
                                let value = e.target.value;
                                if (/^\d{4}$/.test(value)) {
                                  value = `${value}-${parseInt(value) + 1}`;
                                }
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Annee de reference pour la scolarite (ex: 2024-2025). Si non renseigne, l'annee scolaire selectionnee sera utilisee.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="annualTuitionAmount"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Scolarite annuelle *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="500000.00"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Montant total de la scolarite pour l'annee scolaire. Les deductions (bourses, etc.) seront appliquees automatiquement.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {(scholarshipType !== 'none' || form.watch('annualTuitionAmount')) && (
                      <div className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-sm font-medium text-emerald-900">Resume financier:</p>
                        <div className="mt-2 grid gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Scolarite annuelle:</span>
                            <span className="font-medium">{Math.round(form.watch('annualTuitionAmount') || 0).toLocaleString('fr-FR')} FCFA</span>
                          </div>
                          {scholarshipType === 'full' && (
                            <div className="flex justify-between text-emerald-700">
                              <span>Bourse (100%):</span>
                              <span className="font-medium">-{Math.round((form.watch('annualTuitionAmount') || 0) * 1).toLocaleString('fr-FR')} FCFA</span>
                            </div>
                          )}
                          {scholarshipType === 'partial' && (
                            <div className="flex justify-between text-emerald-700">
                              <span>Demi-bourse (50%):</span>
                              <span className="font-medium">-{Math.round((form.watch('annualTuitionAmount') || 0) * 0.5).toLocaleString('fr-FR')} FCFA</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-emerald-200 pt-2">
                            <span className="font-semibold">Net a payer:</span>
                            <span className="font-bold text-emerald-900">
                              {(
                                (form.watch('annualTuitionAmount') || 0) *
                                (scholarshipType === 'full' ? 0 : scholarshipType === 'partial' ? 0.5 : 1)
                              ).toLocaleString('fr-FR')} FCFA
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {createdStudent && (
                  <Badge variant="secondary">
                    Eleve ajoute: {createdStudent.firstName} {createdStudent.lastName}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => form.reset()}>
                  Reinitialiser
                </Button>
                <Button type="submit" disabled={createStudentMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {createStudentMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </form>
        </Form>

        <ParentsDialog
          key={createdStudent?.id ? `parents-${createdStudent.id}` : 'parents-new'}
          open={parentsDialogOpen}
          onOpenChange={setParentsDialogOpen}
          student={createdStudent}
          parents={parents}
          onCreateParent={handleCreateParent}
          onDeleteRelation={handleDeleteRelation}
        />

        <DocumentsDialog
          key={createdStudent?.id ? `documents-${createdStudent.id}` : 'documents-new'}
          open={documentsDialogOpen}
          onOpenChange={setDocumentsDialogOpen}
          student={createdStudent}
          documents={documents}
          onUpload={handleUploadDocument}
          onDelete={handleDeleteDocument}
        />

        <EnrollmentDialog
          key={createdStudent?.id ? `enrollment-${createdStudent.id}` : 'enrollment-new'}
          open={enrollmentDialogOpen}
          onOpenChange={setEnrollmentDialogOpen}
          student={createdStudent}
          classes={classes}
          academicYears={academicYears}
          onSubmit={handleCreateEnrollment}
        />

        <AccountCreationDialog
          open={accountDialogOpen}
          onOpenChange={setAccountDialogOpen}
          studentData={createdStudent ? {
            id: createdStudent.id,
            firstName: createdStudent.firstName || '',
            lastName: createdStudent.lastName || '',
            email: createdStudent.email || null,
            schoolId: createdStudent.schoolId || schoolId || '',
          } : undefined}
          parentsData={parents.map((parent: any) => ({
            id: parent.id,
            firstName: parent.firstName || '',
            lastName: parent.lastName || '',
            email: parent.email || null,
            schoolId: parent.schoolId || schoolId || '',
          }))}
        />
      </div>
    </div>
  );
}
