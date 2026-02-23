'use client';

import { useState, useRef } from 'react';
import {
  File,
  Upload,
  X,
  FileText,
  IdCard,
  Award,
  HeartPulse,
  GraduationCap,
  User,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useStudentDocumentUpload } from '@novaconnect/data';
import { useToast } from '@/hooks/use-toast';

const DOCUMENT_TYPES = [
  {
    value: 'birth_certificate',
    label: 'Acte de naissance',
    icon: File,
    color: 'text-purple-600 bg-purple-100',
    description: 'Certificat de naissance officiel',
  },
  {
    value: 'id_card',
    label: "Carte d'identité",
    icon: IdCard,
    color: 'text-orange-600 bg-orange-100',
    description: "Carte d'identité nationale",
  },
  {
    value: 'passport',
    label: 'Passeport',
    icon: FileText,
    color: 'text-indigo-600 bg-indigo-100',
    description: 'Passeport valide',
  },
  {
    value: 'medical_certificate',
    label: 'Certificat médical',
    icon: HeartPulse,
    color: 'text-red-600 bg-red-100',
    description: 'Certificat médical récent',
  },
  {
    value: 'transcript',
    label: 'Relevé de notes',
    icon: FileText,
    color: 'text-blue-600 bg-blue-100',
    description: 'Relevé de notes périodique',
  },
  {
    value: 'diploma',
    label: 'Diplôme',
    icon: GraduationCap,
    color: 'text-yellow-600 bg-yellow-100',
    description: 'Diplôme ou certificat',
  },
  {
    value: 'photo',
    label: "Photo d'identité",
    icon: User,
    color: 'text-cyan-600 bg-cyan-100',
    description: "Photo d'identité récente",
  },
  {
    value: 'other',
    label: 'Autre document',
    icon: File,
    color: 'text-gray-600 bg-gray-100',
    description: 'Autre type de document',
  },
];

interface StudentDocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  schoolId: string;
}

export function StudentDocumentUploadDialog({
  open,
  onOpenChange,
  studentId,
  schoolId,
}: StudentDocumentUploadDialogProps) {
  const { toast } = useToast();
  const uploadMutation = useStudentDocumentUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedType, setSelectedType] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const selectedDocumentType = DOCUMENT_TYPES.find((t) => t.value === selectedType);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (PDF, Images)
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
      ];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Erreur',
          description: 'Types de fichiers acceptés: PDF, JPG, PNG',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast({
          title: 'Erreur',
          description: 'La taille du fichier ne doit pas dépasser 10MB',
          variant: 'destructive',
        });
        return;
      }

      setSelectedFile(file);
      if (!title) {
        setTitle(selectedDocumentType?.label || file.name);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedType || !selectedFile || !title) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs obligatoires',
        variant: 'destructive',
      });
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        studentId,
        schoolId,
        documentType: selectedType,
        title,
        description,
        file: selectedFile,
      });

      toast({
        title: 'Succès',
        description: 'Document téléversé avec succès',
      });

      // Reset form
      setSelectedType('');
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de téléverser le document',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Téléverser un document
          </DialogTitle>
          <DialogDescription>
            Sélectionnez le type de document et téléversez votre fichier. Formats acceptés: PDF, JPG, PNG (max 10MB)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Document Type Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Type de document <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DOCUMENT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setSelectedType(type.value)}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                      selectedType === type.value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full ${type.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{type.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{type.description}</div>
                    </div>
                    {selectedType === type.value && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Titre du document <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Acte de naissance - Jean Dupont"
              disabled={!selectedType}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ajoutez une description ou des détails supplémentaires..."
              rows={2}
              disabled={!selectedType}
            />
          </div>

          {/* File Selection */}
          <div className="space-y-2">
            <Label>
              Fichier <span className="text-red-500">*</span>
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              disabled={!selectedType}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedType || uploadMutation.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              {selectedFile ? 'Changer de fichier' : 'Sélectionner un fichier'}
            </Button>

            {/* Selected File Info */}
            {selectedFile && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <File className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{selectedFile.name}</div>
                  <div className="text-xs text-gray-600">{formatFileSize(selectedFile.size)}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  disabled={uploadMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Info Message */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              <p className="font-medium mb-1">Information importante:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Assurez-vous que le document est clair et lisible</li>
                <li>Le fichier sera partagé avec l'administration de l'école</li>
                <li>Vous pourrez supprimer ou remplacer le document à tout moment</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploadMutation.isPending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!selectedType || !selectedFile || !title || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Téléversement...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Téléverser
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
