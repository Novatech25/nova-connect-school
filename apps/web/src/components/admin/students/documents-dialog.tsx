"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useStudentDocumentDownload } from "@novaconnect/data";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Trash2, File, Download, AlertCircle } from "lucide-react";
import {
  createStudentDocumentSchema,
  studentDocumentTypeSchema,
  type Student,
  type StudentDocument,
  type CreateStudentDocument,
} from "@novaconnect/core";
import { useToast } from "@/hooks/use-toast";

interface DocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  documents: StudentDocument[];
  onUpload: (data: CreateStudentDocument) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
}

export function DocumentsDialog({
  open,
  onOpenChange,
  student,
  documents,
  onUpload,
  onDelete,
}: DocumentsDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const downloadMutation = useStudentDocumentDownload();
  const { toast } = useToast();

  const handleDownload = async (document: StudentDocument) => {
    if (!student) return;

    try {
      const result = await downloadMutation.mutateAsync({
        documentId: document.id,
        studentId: student.id,
      });

      // Open the signed URL in a new tab
      window.open(result.signedUrl, '_blank');
    } catch (error: any) {
      toast({
        title: "Erreur de téléchargement",
        description: error.message || "Impossible de télécharger ce document",
        variant: "destructive",
      });
    }
  };

  const form = useForm<CreateStudentDocument>({
    resolver: zodResolver(createStudentDocumentSchema),
    defaultValues: {
      schoolId: student?.schoolId || "",
      studentId: student?.id || "",
      documentType: "other",
      title: "",
      description: "",
      fileUrl: "",
      fileName: "",
      fileSize: 0,
      mimeType: "",
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      form.setValue("fileName", file.name);
      form.setValue("fileSize", file.size);
      form.setValue("mimeType", file.type);
    }
  };

  const handleSubmit = async (data: CreateStudentDocument) => {
    if (!student || !selectedFile) return;

    try {
      setIsSubmitting(true);

      // Create FormData for upload
      const formData = new FormData();
      formData.append("schoolId", data.schoolId);
      formData.append("studentId", data.studentId);
      formData.append("documentType", data.documentType);
      formData.append("title", data.title);
      formData.append("description", data.description || "");
      formData.append("file", selectedFile);

      // Upload via API
      const response = await fetch("/api/student-documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await response.json();
      await onUpload(result);

      form.reset();
      setSelectedFile(null);
    } catch (error) {
      console.error("Error uploading document:", error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      birth_certificate: "Acte de naissance",
      id_card: "Carte d'identité",
      passport: "Passeport",
      medical_certificate: "Certificat médical",
      transcript: "Relevé de notes",
      diploma: "Diplôme",
      photo: "Photo",
      other: "Autre",
    };
    return labels[type] || type;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Documents</DialogTitle>
          <DialogDescription>
            {student
              ? `Gérer les documents de ${student.firstName} ${student.lastName}`
              : "Gérer les documents"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3">
              {documents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun document pour le moment
                </p>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {getDocumentTypeLabel(doc.documentType)}
                          </Badge>
                          {doc.fileSize && (
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(doc.fileSize)}
                            </span>
                          )}
                        </div>
                        {doc.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {doc.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(doc)}
                        disabled={downloadMutation.isPending}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(doc.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="border-t pt-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="documentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de document *</FormLabel>
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
                          {studentDocumentTypeSchema.options.map((type) => (
                            <SelectItem key={type} value={type}>
                              {getDocumentTypeLabel(type)}
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
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre *</FormLabel>
                      <FormControl>
                        <Input placeholder="Document important" {...field} />
                      </FormControl>
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
                        placeholder="Description du document..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fileName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fichier *</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          onChange={handleFileChange}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          className="flex-1"
                        />
                        {selectedFile && (
                          <Badge variant="secondary">
                            {formatFileSize(selectedFile.size)}
                          </Badge>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={isSubmitting || !selectedFile}
                >
                  {isSubmitting ? (
                    "Téléchargement..."
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Téléverser
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
