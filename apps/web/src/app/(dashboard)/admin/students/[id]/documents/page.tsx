'use client';

import { use, useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  Loader2,
  Upload,
  Trash2,
  Download,
  Image as ImageIcon,
  File,
  Eye,
  X,
  Filter,
  Search,
  FilePlus,
  AlertCircle,
} from 'lucide-react';
import {
  useStudent,
  useStudentDocuments,
  useStudentDocumentDownload,
  getSupabaseClient,
  useSupabaseClient,
} from '@novaconnect/data';
import { useAuthContext } from '@novaconnect/data';
import {
  createStudentDocumentSchema,
  studentDocumentTypeSchema,
  type CreateStudentDocument,
} from '@novaconnect/core';
import { z } from 'zod';

// Schéma allégé pour le formulaire (schoolId et studentId validés manuellement dans handleUpload)
const formSchema = createStudentDocumentSchema.extend({
  schoolId: z.string(),
  studentId: z.string(),
});
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PageProps {
  params: Promise<{ id: string }>;
}

const documentTypeLabels: Record<string, string> = {
  birth_certificate: 'Acte de naissance',
  id_card: "Carte d'identité",
  passport: 'Passeport',
  medical_certificate: 'Certificat médical',
  transcript: 'Relevé de notes',
  diploma: 'Diplôme',
  photo: 'Photo',
  other: 'Autre',
};

const documentTypeColors: Record<string, string> = {
  birth_certificate: 'bg-blue-100 text-blue-800',
  id_card: 'bg-green-100 text-green-800',
  passport: 'bg-purple-100 text-purple-800',
  medical_certificate: 'bg-red-100 text-red-800',
  transcript: 'bg-yellow-100 text-yellow-800',
  diploma: 'bg-indigo-100 text-indigo-800',
  photo: 'bg-pink-100 text-pink-800',
  other: 'bg-gray-100 text-gray-800',
};

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith('image/')) return ImageIcon;
  if (mimeType?.includes('pdf')) return FileText;
  return File;
}

function getFileExtension(filename: string) {
  return filename?.split('.').pop()?.toUpperCase() || '';
}

export default function StudentDocumentsPage({ params }: PageProps) {
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
  const { data: documents = [], isLoading: isDocumentsLoading } = useStudentDocuments(studentId);
  const downloadMutation = useStudentDocumentDownload();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<CreateStudentDocument>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      schoolId,
      studentId,
      documentType: 'other',
      title: '',
      description: '',
      fileUrl: '',
      fileName: '',
      fileSize: 0,
      mimeType: '',
    },
  });

  // Mettre à jour schoolId et studentId dans le formulaire
  useEffect(() => {
    if (schoolId) {
      form.setValue('schoolId', schoolId);
    }
    if (studentId) {
      form.setValue('studentId', studentId);
    }
    console.log('Form values updated:', { schoolId, studentId, values: form.getValues() });
  }, [schoolId, studentId, form]);

  const handleFileChange = (file: File | null) => {
    if (file) {
      setSelectedFile(file);
      form.setValue('fileName', file.name);
      form.setValue('fileSize', file.size);
      form.setValue('mimeType', file.type);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUpload = async (data: CreateStudentDocument) => {
    console.log('=== handleUpload called ===', { data, hasSelectedFile: !!selectedFile, schoolId, studentId });
    
    if (!student || !selectedFile) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un fichier',
        variant: 'destructive',
      });
      return;
    }

    if (!schoolId) {
      toast({
        title: 'Erreur',
        description: 'École non identifiée. Veuillez réessayer.',
        variant: 'destructive',
      });
      return;
    }

    console.log('All validations passed, starting upload...');
    setIsUploading(true);
    try {
      // Récupérer la session pour l'authentification
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const formData = new FormData();
      formData.append('schoolId', schoolId);
      formData.append('studentId', studentId);
      formData.append('documentType', data.documentType);
      formData.append('title', data.title);
      formData.append('description', data.description || '');
      formData.append('file', selectedFile);

      const response = await fetch('/api/student-documents/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      await queryClient.invalidateQueries({ queryKey: ['student_documents', studentId] });
      setSelectedFile(null);
      setPreviewUrl(null);
      form.reset();
      
      toast({
        title: 'Document ajouté',
        description: 'Le document a été enregistré avec succès.',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error?.message || "Impossible d'ajouter le document.",
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Supprimer ce document ?')) return;

    try {
      const response = await fetch(`/api/student-documents/upload?documentId=${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur de suppression');
      }

      await queryClient.invalidateQueries({ queryKey: ['student_documents', studentId] });
      toast({
        title: 'Document supprimé',
        description: 'Le document a été supprimé.',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error?.message || 'Erreur lors de la suppression',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (document: any) => {
    if (!student) return;
    try {
      const result = await downloadMutation.mutateAsync({
        documentId: document.id,
        studentId: student.id,
      });
      window.open(result.signedUrl, '_blank');
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error?.message || 'Impossible de télécharger ce document.',
        variant: 'destructive',
      });
    }
  };

  const handleView = (doc: any) => {
    setViewingDoc(doc);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '-';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  const getPublicUrl = useCallback((filePath: string) => {
    if (!filePath) return '';
    if (filePath.startsWith('http')) return filePath;
    
    const supabase = getSupabaseClient();
    const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
    return data.publicUrl;
  }, []);

  const filteredDocuments = documents.filter((doc: any) => {
    const matchesType = filterType === 'all' || doc.documentType === filterType;
    const matchesSearch =
      searchQuery === '' ||
      doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const processedDocuments = useMemo(() => {
    return filteredDocuments.map((doc: any) => ({
      ...doc,
      fileUrl: doc.fileUrl || doc.file_url ? getPublicUrl(doc.fileUrl || doc.file_url) : null,
    }));
  }, [filteredDocuments, getPublicUrl]);

  const documentsByType = documents.reduce((acc: any, doc: any) => {
    const type = doc.documentType || 'other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  if (isStudentLoading || isDocumentsLoading) {
    return (
      <div className="min-h-full flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-full flex items-center justify-center py-16">
        <p className="text-muted-foreground">Élève introuvable.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
              <p className="text-muted-foreground mt-1">
                {student.firstName} {student.lastName} • {documents.length} document{documents.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push(`/admin/students/${student.id}/edit`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{documents.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {Object.entries(documentsByType).slice(0, 3).map(([type, count]: [string, any]) => (
            <Card key={type} className="bg-white/80">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${documentTypeColors[type]?.split(' ')[0] || 'bg-gray-100'}`}>
                    <File className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{documentTypeLabels[type]}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="list">Liste</TabsTrigger>
            <TabsTrigger value="upload">Ajouter</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Documents</CardTitle>
                    <CardDescription>Gérer les documents</CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full sm:w-[200px]"
                    />
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filtrer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        {studentDocumentTypeSchema.options.map((type) => (
                          <SelectItem key={type} value={type}>
                            {documentTypeLabels[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {processedDocuments.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {searchQuery || filterType !== 'all'
                        ? 'Aucun document trouvé'
                        : 'Aucun document'}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-3">
                      {processedDocuments.map((doc: any) => {
                        const FileIcon = getFileIcon(doc.mimeType);
                        const isImage = doc.mimeType?.startsWith('image/');
                        return (
                          <div
                            key={doc.id}
                            className="flex items-start justify-between gap-4 rounded-xl border p-4 hover:bg-muted/50"
                          >
                            <div className="flex items-start gap-4 flex-1">
                              <div className="flex-shrink-0">
                                {isImage && doc.fileUrl ? (
                                  <img src={doc.fileUrl} alt={doc.title} className="w-12 h-12 rounded-lg object-cover" />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <FileIcon className="h-6 w-6 text-primary" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{doc.title}</p>
                                  <Badge variant="outline" className={documentTypeColors[doc.documentType] || ''}>
                                    {documentTypeLabels[doc.documentType]}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {doc.fileName} • {formatFileSize(doc.fileSize)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {isImage && (
                                <Button variant="ghost" size="icon" onClick={() => handleView(doc)}>
                                  <Eye className="h-4 w-4 text-blue-500" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}>
                                <Download className="h-4 w-4 text-green-500" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upload" className="mt-6">
            <Card className="border-border/60 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle>Ajouter un document</CardTitle>
                <CardDescription>Importer un fichier</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleUpload)} className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="documentType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {studentDocumentTypeSchema.options.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {documentTypeLabels[type]}
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
                              <Input placeholder="Titre du document" {...field} />
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
                            <Textarea placeholder="Description optionnelle" {...field} />
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
                            <div>
                              <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className={`
                                  relative border-2 border-dashed rounded-xl p-8 text-center transition-all
                                  ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                                  ${selectedFile ? 'bg-muted/50' : ''}
                                `}
                              >
                                <input
                                  type="file"
                                  accept="application/pdf,image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    handleFileChange(file);
                                    field.onChange(file?.name || '');
                                  }}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                
                                {selectedFile ? (
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedFile(null);
                                        setPreviewUrl(null);
                                        field.onChange('');
                                      }}
                                      className="absolute -top-2 -right-2 p-1 bg-destructive text-white rounded-full hover:bg-destructive/90 z-10"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                    
                                    {previewUrl ? (
                                      <img src={previewUrl} alt="Preview" className="w-32 h-32 mx-auto rounded-lg object-cover" />
                                    ) : (
                                      <div className="w-16 h-16 mx-auto rounded-lg bg-primary/10 flex items-center justify-center">
                                        <FileText className="h-8 w-8 text-primary" />
                                      </div>
                                    )}
                                    <p className="mt-3 font-medium">{selectedFile.name}</p>
                                    <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                                  </div>
                                ) : (
                                  <div>
                                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                                    <p className="font-medium">Glissez-déposez ou cliquez</p>
                                    <p className="text-sm text-muted-foreground">PDF, Images jusqu&apos;à 10 Mo</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Affichage des erreurs de validation */}
                    {Object.keys(form.formState.errors).length > 0 && (
                      <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                        <p className="font-medium">Erreurs de validation :</p>
                        <ul className="list-disc list-inside">
                          {Object.entries(form.formState.errors).map(([key, error]) => (
                            <li key={key}>{key}: {error?.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl(null);
                          form.reset();
                        }}
                        disabled={isUploading}
                      >
                        Réinitialiser
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={!selectedFile || isUploading || !schoolId}
                        onClick={() => console.log('Button clicked!', { selectedFile: !!selectedFile, isUploading, schoolId, formErrors: form.formState.errors })}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Envoi...
                          </>
                        ) : (
                          <>
                            <FilePlus className="mr-2 h-4 w-4" />
                            Ajouter
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!viewingDoc} onOpenChange={() => setViewingDoc(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{viewingDoc?.title}</DialogTitle>
            </DialogHeader>
            {viewingDoc?.fileUrl && (
              <img src={viewingDoc.fileUrl} alt={viewingDoc.title} className="max-w-full max-h-[60vh] mx-auto" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
