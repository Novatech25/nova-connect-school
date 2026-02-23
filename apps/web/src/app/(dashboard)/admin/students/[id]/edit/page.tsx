
'use client';

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  ArrowLeft,
  Save,
  Users,
  FileText,
  GraduationCap,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createStudentSchema,
  enrollmentStatusSchema,
  genderSchema,
  studentStatusSchema,
  type CreateEnrollment,
} from "@novaconnect/core";
import {
  useAcademicYears,
  useClasses,
  useCreateEnrollment,
  useCreateParent,
  useCreateStudentParentRelation,
  useDeleteStudentParentRelation,
  useEnrollmentsByStudent,
  useParentsByStudent,
  useStudent,
  useStudentDocuments,
  useUpdateEnrollment,
  useUpdateStudent,
} from "@novaconnect/data";
import { useAuthContext } from "@novaconnect/data/providers";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ParentsDialog } from "@/components/admin/students/parents-dialog";
import { DocumentsDialog } from "@/components/admin/students/documents-dialog";
import { EnrollmentDialog } from "@/components/admin/students/enrollment-dialog";

const optionalEmailSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().email().optional()
);

const optionalUrlSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional()
);

const studentEditSchema = createStudentSchema.extend({
  email: optionalEmailSchema,
  photoUrl: optionalUrlSchema,
});

type StudentEditValues = z.infer<typeof studentEditSchema>;

const enrollmentEditSchema = z.object({
  id: z.string().uuid(),
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  enrollmentDate: z.coerce.date(),
  status: enrollmentStatusSchema.default("enrolled"),
  isRepeating: z.boolean().default(false),
  notes: z.string().optional(),
});

type EnrollmentEditValues = z.infer<typeof enrollmentEditSchema>;

export default function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, user } = useAuthContext();
  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    user?.schoolId ||
    (user as any)?.school_id ||
    "";

  const { id: studentId } = use(params);

  const { data: student, isLoading: isStudentLoading } = useStudent(studentId);
  const { data: enrollments = [] } = useEnrollmentsByStudent(studentId);
  const { data: parents = [] } = useParentsByStudent(studentId);
  const { data: documents = [] } = useStudentDocuments(studentId);
  const { data: academicYears = [] } = useAcademicYears(schoolId);
  const { data: classes = [] } = useClasses(schoolId);

  const updateStudentMutation = useUpdateStudent();
  const updateEnrollmentMutation = useUpdateEnrollment();
  const createEnrollmentMutation = useCreateEnrollment();
  const createParentMutation = useCreateParent();
  const createRelationMutation = useCreateStudentParentRelation();
  const deleteRelationMutation = useDeleteStudentParentRelation();

  const [parentsDialogOpen, setParentsDialogOpen] = useState(false);
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const currentEnrollment = useMemo(
    () => (enrollments.length > 0 ? enrollments[0] : null),
    [enrollments]
  );

  const form = useForm<StudentEditValues>({
    resolver: zodResolver(studentEditSchema),
    defaultValues: {
      schoolId: schoolId,
      matricule: "",
      firstName: "",
      lastName: "",
      dateOfBirth: undefined,
      gender: undefined,
      placeOfBirth: "",
      nationality: "",
      address: "",
      city: "",
      phone: "",
      email: "",
      status: "active",
      photoUrl: "",
    },
  });

  const enrollmentForm = useForm<EnrollmentEditValues>({
    resolver: zodResolver(enrollmentEditSchema),
    defaultValues: {
      id: "",
      academicYearId: "",
      classId: "",
      enrollmentDate: new Date(),
      status: "enrolled",
      isRepeating: false,
      notes: "",
    },
  });
  useEffect(() => {
    if (!student) return;
    const dateOfBirth = student.dateOfBirth
      ? new Date(student.dateOfBirth as any)
      : undefined;
    form.reset({
      schoolId: student.schoolId || schoolId,
      matricule: student.matricule || "",
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      dateOfBirth,
      gender: student.gender || undefined,
      placeOfBirth: student.placeOfBirth || "",
      nationality: student.nationality || "",
      address: student.address || "",
      city: student.city || "",
      phone: student.phone || "",
      email: student.email || "",
      status: student.status || "active",
      photoUrl: student.photoUrl || "",
    });
    setPhotoPreview(student.photoUrl || null);
  }, [student, schoolId, form]);

  useEffect(() => {
    if (!currentEnrollment) return;
    enrollmentForm.reset({
      id: currentEnrollment.id,
      academicYearId: currentEnrollment.academicYearId || "",
      classId: currentEnrollment.classId || "",
      enrollmentDate: currentEnrollment.enrollmentDate
        ? new Date(currentEnrollment.enrollmentDate as any)
        : new Date(),
      status: currentEnrollment.status || "enrolled",
      isRepeating: Boolean(currentEnrollment.isRepeating),
      notes: currentEnrollment.notes || "",
    });
  }, [currentEnrollment, enrollmentForm]);

  const handleStudentSubmit = async (values: StudentEditValues) => {
    if (!student) return;

    try {
      const { schoolId: _schoolId, ...updates } = values;
      await updateStudentMutation.mutateAsync({
        id: student.id,
        ...updates,
        photoUrl: photoPreview || updates.photoUrl || undefined,
      });
      toast({
        title: "Eleve mis a jour",
        description: "Les informations de l'eleve ont ete enregistrees.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de mettre a jour l'eleve.",
        variant: "destructive",
      });
    }
  };

  const handleEnrollmentSubmit = async (values: EnrollmentEditValues) => {
    if (!currentEnrollment) return;

    try {
      await updateEnrollmentMutation.mutateAsync({
        id: currentEnrollment.id,
        academicYearId: values.academicYearId,
        classId: values.classId,
        enrollmentDate: values.enrollmentDate,
        status: values.status,
        isRepeating: values.isRepeating,
        notes: values.notes || undefined,
      });
      await queryClient.invalidateQueries({
        queryKey: ["enrollments", "student", studentId],
      });
      toast({
        title: "Inscription mise a jour",
        description: "La classe et le statut ont ete mis a jour.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de mettre a jour l'inscription.",
        variant: "destructive",
      });
    }
  };

  const handleCreateEnrollment = async (data: CreateEnrollment) => {
    if (!student) return;
    await createEnrollmentMutation.mutateAsync(data);
    await queryClient.invalidateQueries({
      queryKey: ["enrollments", "student", studentId],
    });
    toast({
      title: "Inscription creee",
      description: "L'eleve a ete inscrit avec succes.",
    });
  };

  const handleCreateParent = async (data: any) => {
    if (!student) return;

    const parent = await createParentMutation.mutateAsync({
      ...data,
      schoolId,
    });

    await createRelationMutation.mutateAsync({
      schoolId,
      studentId: student.id,
      parentId: parent.id,
      relationship: data.relationship,
      isPrimary: Boolean(data.isPrimaryContact),
    });

    toast({
      title: "Parent ajoute",
      description: "Le parent a ete associe a cet eleve.",
    });
  };

  const handleDeleteRelation = async (relationId: string) => {
    await deleteRelationMutation.mutateAsync(relationId);
    toast({
      title: "Relation supprimee",
      description: "Le parent a ete retire de cet eleve.",
    });
  };

  const handleUploadDocument = async () => {
    await queryClient.invalidateQueries({ queryKey: ["student_documents"] });
  };

  const handleDeleteDocument = async (documentId: string) => {
    const response = await fetch(
      `/api/student-documents/upload?documentId=${documentId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur de suppression");
    }

    await queryClient.invalidateQueries({ queryKey: ["student_documents"] });
    toast({
      title: "Document supprime",
      description: "Le document a ete supprime avec succes.",
    });
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !student) return;

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/students/${student.id}/photo`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const { photoUrl } = await response.json();
      setPhotoPreview(photoUrl);
      form.setValue("photoUrl", photoUrl);
      toast({
        title: "Photo mise a jour",
        description: "La photo de l'eleve a ete enregistree.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible d'envoyer la photo.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!student) return;

    try {
      await fetch(`/api/students/${student.id}/photo`, {
        method: "DELETE",
      });
      setPhotoPreview(null);
      form.setValue("photoUrl", "");
      toast({
        title: "Photo supprimee",
        description: "La photo a ete retiree.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de supprimer la photo.",
        variant: "destructive",
      });
    }
  };

  if (isStudentLoading) {
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
              <h1 className="text-3xl font-semibold tracking-tight">
                Modifier {student.firstName} {student.lastName}
              </h1>
              <p className="text-muted-foreground mt-1">
                Mettez a jour les informations de l'eleve et son inscription.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/admin/students")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour a la liste
            </Button>
            <Button variant="outline" onClick={() => setParentsDialogOpen(true)}>
              <Users className="mr-2 h-4 w-4" />
              Parents
            </Button>
            <Button variant="outline" onClick={() => setDocumentsDialogOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Documents
            </Button>
          </div>
        </div>

        <Card className="border-border/60 bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle>Photo</CardTitle>
            <CardDescription>Mettre a jour la photo de l'eleve.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
            <Avatar className="h-20 w-20">
              <AvatarImage src={photoPreview || undefined} />
              <AvatarFallback className="text-lg">
                {student.firstName?.[0]}
                {student.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-sm text-muted-foreground">
              Formats acceptes: JPG, PNG, WebP (max 5MB).
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploadingPhoto}
                onClick={() => document.getElementById("photo-upload-edit")?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploadingPhoto ? "Envoi..." : photoPreview ? "Changer" : "Ajouter"}
              </Button>
              {photoPreview && (
                <Button type="button" variant="outline" size="sm" onClick={handlePhotoDelete}>
                  <X className="h-4 w-4" />
                </Button>
              )}
              <input
                id="photo-upload-edit"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
          </CardContent>
        </Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleStudentSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="schoolId"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormControl>
                    <Input type="hidden" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle>Profil eleve</CardTitle>
                <CardDescription>Informations personnelles et statut.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
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
                        <Input placeholder="NOVA-2026-0001" {...field} />
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
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selectionner" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {genderSchema.options.map((gender) => (
                            <SelectItem key={gender} value={gender}>
                              {gender === "male"
                                ? "Masculin"
                                : gender === "female"
                                  ? "Feminin"
                                  : gender === "other"
                                    ? "Autre"
                                    : "Non specifie"}
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
                          value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? new Date(e.target.value) : null)
                          }
                          max={format(new Date(), "yyyy-MM-dd")}
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
                        <Input placeholder="Nouakchott" {...field} />
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
                        <Input placeholder="Mauritanienne" {...field} />
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
                      <Select onValueChange={field.onChange} value={field.value || "active"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selectionner" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {studentStatusSchema.options.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status === "active"
                                ? "Actif"
                                : status === "inactive"
                                  ? "Inactif"
                                  : status === "graduated"
                                    ? "Diplome"
                                    : status === "transferred"
                                      ? "Transfere"
                                      : status === "expelled"
                                        ? "Exclu"
                                        : "Suspendu"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                        <Input placeholder="Nouakchott" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">ID: {student.id}</Badge>
                {student.matricule && <Badge variant="outline">Matricule: {student.matricule}</Badge>}
              </div>
              <Button type="submit" disabled={updateStudentMutation.isPending}>
                {updateStudentMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {updateStudentMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
        <Card className="border-border/60 bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle>Inscription</CardTitle>
            <CardDescription>Modifier la classe, l'annee et le statut.</CardDescription>
          </CardHeader>
          <CardContent>
            {currentEnrollment ? (
              <Form {...enrollmentForm}>
                <form
                  onSubmit={enrollmentForm.handleSubmit(handleEnrollmentSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={enrollmentForm.control}
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
                      control={enrollmentForm.control}
                      name="academicYearId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Annee scolaire *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selectionner" />
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

                    <FormField
                      control={enrollmentForm.control}
                      name="classId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Classe *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
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
                      control={enrollmentForm.control}
                      name="enrollmentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date d'inscription *</FormLabel>
                          <FormControl>
                            <input
                              type="date"
                              value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
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
                      control={enrollmentForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Statut</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "enrolled"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selectionner" />
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
                                        ? "Retire"
                                        : "Termine"}
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
                    control={enrollmentForm.control}
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
                    control={enrollmentForm.control}
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

                  <div className="flex items-center justify-between gap-3">
                    <Button type="button" variant="outline" onClick={() => setEnrollmentDialogOpen(true)}>
                      Nouvelle inscription
                    </Button>
                    <Button type="submit" disabled={updateEnrollmentMutation.isPending}>
                      {updateEnrollmentMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {updateEnrollmentMutation.isPending ? "Mise a jour..." : "Mettre a jour"}
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Aucun enregistrement d'inscription pour cet eleve.
                </p>
                <Button variant="outline" onClick={() => setEnrollmentDialogOpen(true)}>
                  Creer une inscription
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <ParentsDialog
          key={student?.id ? `parents-${student.id}` : "parents-edit"}
          open={parentsDialogOpen}
          onOpenChange={setParentsDialogOpen}
          student={student}
          parents={parents}
          onCreateParent={handleCreateParent}
          onDeleteRelation={handleDeleteRelation}
        />

        <DocumentsDialog
          key={student?.id ? `documents-${student.id}` : "documents-edit"}
          open={documentsDialogOpen}
          onOpenChange={setDocumentsDialogOpen}
          student={student}
          documents={documents}
          onUpload={handleUploadDocument}
          onDelete={handleDeleteDocument}
        />

        <EnrollmentDialog
          key={student?.id ? `enrollment-${student.id}` : "enrollment-edit"}
          open={enrollmentDialogOpen}
          onOpenChange={setEnrollmentDialogOpen}
          student={student}
          classes={classes}
          academicYears={academicYears}
          onSubmit={handleCreateEnrollment}
        />
      </div>
    </div>
  );
}
