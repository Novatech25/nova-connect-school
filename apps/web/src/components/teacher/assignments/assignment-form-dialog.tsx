'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/components/dialog';
import { Button } from '@shared/ui/components/button';
import { Input } from '@shared/ui/components/input';
import { Textarea } from '@shared/ui/components/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/components/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@shared/ui/components/form';
import { createAssignmentSchema, type CreateAssignmentInput } from '@core/schemas/elearning';
import { useCreateAssignment, usePublishAssignment } from '@novaconnect/data';
import { uploadAssignmentFile, validateAssignmentFile } from '@novaconnect/data/helpers/elearningStorage';
import { assignmentFileQueries } from '@novaconnect/data/queries/elearning';
import { useToast } from '@shared/ui/hooks/use-toast';

interface AssignmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  schoolId: string;
  classes: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string }>;
}

export function AssignmentFormDialog({
  open,
  onOpenChange,
  teacherId,
  schoolId,
  classes,
  subjects,
}: AssignmentFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const form = useForm<CreateAssignmentInput>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: {
      schoolId,
      teacherId,
      classId: '',
      subjectId: '',
      title: '',
      description: '',
      instructions: '',
      dueDate: '',
      maxScore: 20,
      allowLateSubmission: false,
    },
  });

  const createMutation = useCreateAssignment();
  const publishMutation = usePublishAssignment();

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Validate all files
    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      const validation = validateAssignmentFile(file);

      if (!validation.valid) {
        toast({
          variant: 'destructive',
          title: 'Erreur de validation',
          description: `${file.name}: ${validation.error}`,
        });
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setUploadedFiles([...uploadedFiles, ...validFiles]);
      toast({
        title: 'Fichiers ajoutés',
        description: `${validFiles.length} fichier(s) ajouté(s) aux fichiers joints.`,
      });
    }
  };

  const onSubmit = async (data: CreateAssignmentInput, publish: boolean = false) => {
    setIsSubmitting(true);

    try {
      // Create assignment
      const assignment = await createMutation.mutateAsync(data);

      // Upload files if any
      if (uploadedFiles.length > 0) {
        try {
          const uploadPromises = uploadedFiles.map(async (file) => {
            // Upload to storage
            const { path } = await uploadAssignmentFile(schoolId, assignment.id, file);

            // Save metadata to database
            await assignmentFileQueries.upload({
              assignmentId: assignment.id,
              schoolId,
              fileName: file.name,
              filePath: path,
              fileSize: file.size,
              mimeType: file.type,
              uploadedBy: teacherId,
            });
          });

          await Promise.all(uploadPromises);
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          toast({
            variant: 'destructive',
            title: 'Erreur de téléchargement',
            description: 'Le devoir a été créé mais certains fichiers n\'ont pas pu être téléchargés.',
          });
        }
      }

      // Publish if requested
      if (publish) {
        await publishMutation.mutateAsync(assignment.id);
      }

      toast({
        title: 'Succès',
        description: publish
          ? 'Le devoir a été créé et publié.'
          : 'Le devoir a été créé en tant que brouillon.',
      });

      form.reset();
      setUploadedFiles([]);
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de créer le devoir.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un nouveau devoir</DialogTitle>
          <DialogDescription>
            Créez un devoir pour vos élèves. Vous pouvez le publier immédiatement ou l'enregistrer comme brouillon.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre</FormLabel>
                  <FormControl>
                    <Input placeholder="Titre du devoir" {...field} />
                  </FormControl>
                  <FormDescription>
                    Un titre court et descriptif pour le devoir
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="classId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classe</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une classe" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
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
                name="subjectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matière</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une matière" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description du devoir..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Décrivez le devoir en détail
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Consignes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Consignes spécifiques pour la réalisation du devoir..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date limite</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note maximale</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="allowLateSubmission"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Autoriser les dépôts en retard</FormLabel>
                    <FormDescription>
                      Les élèves pourront soumettre après la date limite
                    </FormDescription>
                  </div>
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Fichiers joints</FormLabel>
              <Input
                type="file"
                onChange={(e) => handleFileUpload(e.target.files)}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                multiple
              />
              {uploadedFiles.length > 0 && (
                <div className="space-y-1">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="text-sm text-muted-foreground">
                      📎 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="outline"
            onClick={() => form.handleSubmit((data) => onSubmit(data, false))()}
            disabled={isSubmitting}
          >
            Enregistrer brouillon
          </Button>
          <Button
            onClick={() => form.handleSubmit((data) => onSubmit(data, true))()}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Publication...' : 'Publier'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AssignmentFormDialog;
