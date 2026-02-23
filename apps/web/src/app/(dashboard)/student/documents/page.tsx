'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Download,
  Upload,
  Filter,
  ArrowLeft,
  File,
  Award,
  User,
  HeartPulse,
  GraduationCap,
  IdCard,
  AlertCircle,
  CheckCircle,
  Lock,
  X,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import {
  useAuthContext,
  useStudentDocuments,
  useStudentDocumentDownload,
  useCurrentStudent,
  useEnsureCurrentStudent,
} from '@novaconnect/data';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { StudentDocumentUploadDialog } from '@/components/documents/StudentDocumentUploadDialog';

export default function StudentDocumentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuthContext();

  // Fetch current student data
  const { data: currentStudent } = useCurrentStudent();
  const ensureStudentMutation = useEnsureCurrentStudent();

  // Get the student ID and school ID from current student or profile
  const studentId = currentStudent?.id || profile?.studentId || profile?.student?.id;
  const schoolId = currentStudent?.schoolId || profile?.schoolId || profile?.school?.id || user?.schoolId;

  // Filters
  const [selectedType, setSelectedType] = useState<string>('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch student documents
  const { data: documents = [], isLoading, refetch } = useStudentDocuments(studentId || '');

  // Download mutation
  const downloadMutation = useStudentDocumentDownload();

  // Filter documents
  const filteredDocuments = documents.filter((doc: any) => {
    if (selectedType !== 'all' && doc.documentType !== selectedType) return false;
    return true;
  });

  // Get document icon and color
  const getDocumentInfo = (docType: string) => {
    const types: Record<string, any> = {
      transcript: {
        icon: FileText,
        label: 'Relevé de notes',
        color: 'text-blue-600 bg-blue-100',
        description: 'Relevés de notes périodiques',
      },
      report_card: {
        icon: Award,
        label: 'Bulletin scolaire',
        color: 'text-green-600 bg-green-100',
        description: 'Bulletins scolaires',
      },
      birth_certificate: {
        icon: File,
        label: 'Acte de naissance',
        color: 'text-purple-600 bg-purple-100',
        description: 'Certificat de naissance',
      },
      id_card: {
        icon: IdCard,
        label: "Carte d'identité",
        color: 'text-orange-600 bg-orange-100',
        description: "Carte d'identité nationale",
      },
      passport: {
        icon: FileText,
        label: 'Passeport',
        color: 'text-indigo-600 bg-indigo-100',
        description: 'Passeport',
      },
      medical_certificate: {
        icon: HeartPulse,
        label: 'Certificat médical',
        color: 'text-red-600 bg-red-100',
        description: 'Certificat médical',
      },
      diploma: {
        icon: GraduationCap,
        label: 'Diplôme',
        color: 'text-yellow-600 bg-yellow-100',
        description: 'Diplômes et certificats',
      },
      photo: {
        icon: User,
        label: 'Photo d\'identité',
        color: 'text-cyan-600 bg-cyan-100',
        description: 'Photo d\'identité',
      },
      other: {
        icon: File,
        label: 'Autre document',
        color: 'text-gray-600 bg-gray-100',
        description: 'Autre type de document',
      },
    };

    return types[docType] || types.other;
  };

  // Handle document download
  const handleDownload = async (document: any) => {
    try {
      toast({
        title: 'Téléchargement',
        description: 'Vérification des permissions...',
      });

      const result = await downloadMutation.mutateAsync({
        documentId: document.id,
        studentId: studentId || '',
      });

      // Open the signed URL in a new tab
      window.open(result.signedUrl, '_blank');

      toast({
        title: 'Succès',
        description: 'Document téléchargé avec succès',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de télécharger le document',
        variant: 'destructive',
      });
    }
  };

  // Handle file upload - open dialog
  const handleUploadClick = async () => {
    console.log('📤 Upload clicked - Debug info:', {
      studentId,
      schoolId,
      currentStudent,
      profileSchoolId: profile?.schoolId,
      profileSchool: profile?.school,
      userSchoolId: user?.schoolId,
    });

    if (!schoolId) {
      toast({
        title: 'Erreur',
        description: 'Impossible de déterminer l\'établissement scolaire. Veuillez vous reconnecter.',
        variant: 'destructive',
      });
      return;
    }

    // If no studentId exists, create student record automatically
    if (!studentId) {
      console.log('⚠️ No studentId found, creating student record...');
      try {
        const newStudent = await ensureStudentMutation.mutateAsync();
        console.log('✅ Student created:', newStudent);

        if (!newStudent?.id) {
          throw new Error('Failed to create student record - no ID returned');
        }

        // Show success message and wait a moment for the query to update
        toast({
          title: 'Profil créé',
          description: 'Votre profil étudiant a été créé automatiquement. Vous pouvez maintenant téléverser des documents.',
        });

        // Wait for the query to invalidate and refetch
        setTimeout(() => {
          setUploadDialogOpen(true);
        }, 500);
        return;
      } catch (error: any) {
        console.error('❌ Failed to create student:', error);
        console.error('Error details:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          stack: error?.stack,
        });

        // Format error message
        let errorMessage = 'Impossible de créer votre profil étudiant.';
        if (error?.message) {
          errorMessage += ` ${error.message}`;
        } else if (typeof error === 'string') {
          errorMessage += ` ${error}`;
        } else {
          errorMessage += ' Veuillez contacter l\'administration avec le code erreur: STD-CREATE-001';
        }

        toast({
          title: 'Erreur de création',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }
    }

    setUploadDialogOpen(true);
  };

  // Get unique document types from documents
  const documentTypes = Array.from(new Set(documents.map((d: any) => d.documentType)));

  const userName = user?.user_metadata
    ? `${user.user_metadata.firstName || ''} ${user.user_metadata.lastName || ''}`.trim()
    : profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : user?.email || 'Élève';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/student')}
                className="text-gray-600"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                <FileText className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-gray-900">
                  Documents
                </h1>
                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600">
                  {userName}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUploadClick}
              className="text-xs sm:text-sm"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Téléverser</span>
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-2 sm:gap-3 md:gap-6 grid-cols-2 md:grid-cols-2 xl:grid-cols-4 mb-4 sm:mb-6">
          {/* Total Documents */}
          <Card className="relative overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-blue-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Total documents
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-blue-700 leading-tight">
                {documents.length}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                Document{documents.length > 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          {/* Bulletins */}
          <Card className="relative overflow-hidden border-green-200 bg-gradient-to-br from-green-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-green-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Bulletins
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-green-700 leading-tight">
                {documents.filter((d: any) => ['transcript', 'report_card'].includes(d.documentType)).length}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                Disponibles
              </p>
            </CardContent>
          </Card>

          {/* Certificats */}
          <Card className="relative overflow-hidden border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-purple-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Certificats
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-purple-700 leading-tight">
                {documents.filter((d: any) => ['birth_certificate', 'medical_certificate', 'diploma', 'id_card', 'passport'].includes(d.documentType)).length}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                Administratifs
              </p>
            </CardContent>
          </Card>

          {/* Autres */}
          <Card className="relative overflow-hidden border-orange-200 bg-gradient-to-br from-orange-50 to-white">
            <div className="absolute right-0 top-0 h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-orange-100/50" />
            <CardHeader className="relative flex flex-row items-center justify-between pb-0.5 px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-2 md:pt-6">
              <CardTitle className="text-[9px] sm:text-[10px] md:text-xs font-medium text-gray-600 leading-tight">
                Autres
              </CardTitle>
              <div className="flex h-6 w-6 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                <File className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative px-2 sm:px-4 md:px-6 pb-1.5 sm:pb-2 md:pb-6">
              <div className="text-lg sm:text-xl md:text-3xl font-bold text-orange-700 leading-tight">
                {documents.filter((d: any) => ['photo', 'other'].includes(d.documentType)).length}
              </div>
              <p className="mt-0.5 text-[9px] sm:text-[10px] md:text-xs text-gray-600">
                Documents
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-4 sm:mb-6 border-border/60 bg-white/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {/* Type Filter */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-medium text-gray-700">Type de document</label>
                <SearchableSelect
                  options={documentTypes.map((type) => ({ value: type as string, label: getDocumentInfo(type as string).label }))}
                  value={selectedType}
                  onValueChange={setSelectedType}
                  placeholder="Tous les types"
                  searchPlaceholder="Rechercher un type..."
                  allLabel="Tous les types"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card className="border-border/60 bg-white/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base">
              Mes documents ({filteredDocuments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            {isLoading ? (
              <div className="py-12 text-center text-sm text-gray-500">
                Chargement...
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-gray-500 mb-2">
                  Aucun document disponible
                </p>
                <p className="text-xs text-gray-400">
                  Veuillez contacter l'administration pour obtenir vos documents
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {filteredDocuments.map((document: any) => {
                  const info = getDocumentInfo(document.documentType);
                  const Icon = info.icon;

                  return (
                    <Card
                      key={document.id}
                      className="group hover:shadow-md transition-all border-border/60"
                    >
                      <CardHeader className="pb-2 sm:pb-4 pt-3 sm:pt-6 px-3 sm:px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full ${info.color} flex-shrink-0`}>
                            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                          </div>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">
                            {info.label}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="px-3 sm:px-4 pb-3 sm:pb-6">
                        <h3 className="font-semibold text-gray-900 text-xs sm:text-sm mb-1 truncate">
                          {document.title}
                        </h3>
                        {document.description && (
                          <p className="text-[10px] sm:text-xs text-gray-600 mb-2 line-clamp-2">
                            {document.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 mb-3">
                          <File className="h-3 w-3" />
                          <span className="truncate">{document.fileName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-[10px] sm:text-xs h-7 sm:h-8"
                            onClick={() => handleDownload(document)}
                            disabled={downloadMutation.isPending}
                          >
                            <Download className="mr-1 h-3 w-3 sm:mr-1.5 sm:h-3.5 sm:w-3.5" />
                            Télécharger
                          </Button>
                        </div>
                        <div className="mt-2 pt-2 border-t text-[9px] sm:text-xs text-gray-400">
                          Ajouté {formatDistanceToNow(new Date(document.createdAt || document.uploadedAt), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card className="mt-4 sm:mt-6 border-border/60 bg-gradient-to-br from-blue-50 to-white shadow-sm">
          <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              Informations importantes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="space-y-2 sm:space-y-3 text-[10px] sm:text-xs text-gray-700">
              <div className="flex items-start gap-2">
                <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold">Accès sécurisé:</span> Certains documents peuvent être bloqués si vous avez des arriérés de paiement. Contactez l'administration pour plus d'informations.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold">Documents officiels:</span> Les bulletins scolaires, relevés de notes et certificats sont générés par l'administration.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold">Besoin d'un document?</span> Contactez le secrétariat pour obtenir toute documentation scolaire officielle.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hidden file input for future upload functionality */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
      />

      {/* Upload Dialog */}
      <StudentDocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        studentId={studentId || ''}
        schoolId={schoolId || ''}
      />
    </div>
  );
}
