'use client';

import { useState, useRef, useEffect } from 'react';
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
  Info,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  useGrades,
  useReportCards,
  usePeriods,
  useSchool,
  useSchoolSettings,
} from '@novaconnect/data';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { StudentDocumentUploadDialog } from '@/components/documents/StudentDocumentUploadDialog';
import { generateTranscriptPdf } from '@/lib/pdf/transcriptPdf';
import { generateReportCardPdf } from '@/lib/pdf/reportCardPdf';
import { generateEnrollmentCertificatePdf } from '@/lib/pdf/enrollmentCertificatePdf';
import { generateProceedingsPdf } from '@/lib/pdf/proceedingsPdf';
import { getStudentFeeSchedulesSecure, getStudentPaymentsSecure, getStudentProfileSecure, getAcademicYearsSecure } from "@/actions/payment-actions";

export default function StudentDocumentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuthContext();

  // Fetch current student data
  const { data: currentStudent } = useCurrentStudent();
  const ensureStudentMutation = useEnsureCurrentStudent();

  // Get the student ID and school ID from current student or profile
  const studentId = currentStudent?.id || profile?.studentId || profile?.student?.id;
  const schoolId = currentStudent?.school_id || profile?.schoolId || profile?.school?.id || (user as any)?.schoolId;

  // Filters
  const [selectedType, setSelectedType] = useState<string>('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advanced Academic & Financial States
  const [academicYearsList, setAcademicYearsList] = useState<any[]>([]);
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [feeSchedules, setFeeSchedules] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [isFinanciallyUpToDate, setIsFinanciallyUpToDate] = useState<boolean>(true);
  const [totalPaidAmount, setTotalPaidAmount] = useState<number>(0);
  const [totalPastDueAmount, setTotalPastDueAmount] = useState<number>(0);
  const [isFinancialsLoading, setIsFinancialsLoading] = useState<boolean>(true);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  useEffect(() => {
    const loadFinancialsAndProfile = async () => {
      if (!user?.id) return;
      setIsFinancialsLoading(true);
      try {
        const { data: stdProfile } = await getStudentProfileSecure(user.id);
        if (stdProfile) {
          setStudentProfile(stdProfile);
          if (stdProfile.school_id) {
            const { data: years } = await getAcademicYearsSecure(stdProfile.school_id);
            if (years) {
               setAcademicYearsList(years);
               const current = years.find((y: any) => y.current || y.is_current || y.isCurrent);
               if (current) setSelectedAcademicYearId(current.id);
               else if (years.length > 0) setSelectedAcademicYearId(years[0].id);
            }
          }

          // Fetch fees & payments
          const [feesRes, paymentsRes] = await Promise.all([
            getStudentFeeSchedulesSecure(stdProfile.id, undefined),
            getStudentPaymentsSecure(stdProfile.id)
          ]);
          
          const loadedFees = feesRes.data || [];
          const loadedPayments = paymentsRes.data || [];
          
          setFeeSchedules(loadedFees);
          setPaymentsList(loadedPayments);

          // Calculate if up to date
          const totalPaid = loadedPayments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
          
          // Only sum fees that are PAST due date
          const now = new Date();
          const pastDueFees = loadedFees.filter((f: any) => new Date(f.due_date) <= now);
          const totalPastDue = pastDueFees.reduce((acc: number, f: any) => acc + (f.amount || 0), 0);

          setTotalPaidAmount(totalPaid);
          setTotalPastDueAmount(totalPastDue);
          setIsFinanciallyUpToDate(totalPaid >= totalPastDue);
        }
      } catch (err) {
        console.error("Erreur chargement paiements", err);
      } finally {
        setIsFinancialsLoading(false);
      }
    };
    loadFinancialsAndProfile();
  }, [user?.id]);

  // Fetch student documents
  const { data: documents = [], isLoading } = useStudentDocuments(studentId || '');
  
  // Fetch academic data for PDFs
  const effectiveSchoolId = schoolId || studentProfile?.school_id;
  const effectiveStudentId = studentId || studentProfile?.id;
  
  const { school: schoolInfo } = useSchool(effectiveSchoolId || '');
  const { data: schoolSettings } = useSchoolSettings(effectiveSchoolId || '');

  // Logique du blocage lié aux paramètres d'école
  const paymentBlocking = schoolSettings?.paymentBlocking || {
    mode: 'BLOCKED',
    blockBulletins: true,
    blockCertificates: true,
    blockStudentCards: false,
    blockExamAuthorizations: true,
    warningThresholdPercent: 50,
  };

  const hasArrears = totalPaidAmount < totalPastDueAmount;
  const paymentProgress = totalPastDueAmount > 0 ? (totalPaidAmount / totalPastDueAmount) * 100 : 100;

  let isBlockedGlobal = false;
  let showPaymentWarning = false;

  if (hasArrears && paymentBlocking.mode !== 'OK') {
    if (paymentBlocking.mode === 'BLOCKED') {
      isBlockedGlobal = true;
    } else if (paymentBlocking.mode === 'WARNING') {
      if (paymentProgress < (paymentBlocking.warningThresholdPercent || 0)) {
        showPaymentWarning = true;
      }
    }
  }

  const blockBulletins = isBlockedGlobal && paymentBlocking.blockBulletins;
  const blockCertificates = isBlockedGlobal && paymentBlocking.blockCertificates;
  
  const { data: periodsData = [] } = usePeriods(effectiveSchoolId || '', selectedAcademicYearId || undefined);
  const { data: publishedGrades = [] } = useGrades(effectiveSchoolId || '', {
    studentId: effectiveStudentId,
    status: 'published',
  });
  const { data: reportCards = [] } = useReportCards(effectiveSchoolId || '', {
    studentId: effectiveStudentId,
    academicYearId: selectedAcademicYearId || undefined,
  });

  const handleGenerateTranscript = async () => {
    if (!selectedPeriodId) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner une période.', variant: 'destructive' });
      return;
    }
    const period = periodsData.find((p: any) => p.id === selectedPeriodId);
    if (!period) return;
    const academicYear = academicYearsList.find(y => y.id === selectedAcademicYearId);

    const gradesForPeriod = publishedGrades.filter((g: any) => g.period?.id === selectedPeriodId);
    if (gradesForPeriod.length === 0) {
      toast({ title: 'Avis', description: 'Aucune note publiée disponible pour cette période.' });
      return;
    }

    setIsGeneratingPdf(true);
    try {
       await generateTranscriptPdf({
         student: studentProfile,
         school: schoolInfo || studentProfile?.school || profile?.school,
         grades: gradesForPeriod,
         period,
         academicYear
       });
       toast({ title: 'Succès', description: 'Le relevé de notes a été téléchargé !' });
    } catch (e) {
       toast({ title: 'Erreur', description: 'Echec de génération PDF.', variant: 'destructive' });
    } finally {
       setIsGeneratingPdf(false);
    }
  };

  const handleGenerateReportCard = async () => {
    if (!selectedPeriodId) {
       toast({ title: 'Erreur', description: 'Veuillez sélectionner une période.', variant: 'destructive' });
       return;
    }
    const period = periodsData.find((p: any) => p.id === selectedPeriodId);
    const academicYear = academicYearsList.find(y => y.id === selectedAcademicYearId);

    const rc = reportCards.find((r: any) => r.periodId === selectedPeriodId && (r.status === 'published' || r.status === 'generated'));
    if (!rc) {
       toast({ title: 'Avis', description: 'Aucun bulletin provisoire ou final disponible pour cette période.' });
       return;
    }
    if (rc.paymentStatus === 'blocked' && !rc.paymentStatusOverride && !isFinanciallyUpToDate) {
       toast({ title: 'Bloqué', description: 'L\'accès à ce bulletin est bloqué en raison du paiement.', variant: 'destructive' });
       return;
    }

    setIsGeneratingPdf(true);
    try {
       await generateReportCardPdf({
         student: studentProfile,
         school: schoolInfo || studentProfile?.school || profile?.school,
         reportCard: rc,
         period,
         academicYear
       });
       toast({ title: 'Succès', description: 'Le bulletin a été téléchargé !' });
    } catch (e) {
       toast({ title: 'Erreur', description: 'Echec de génération PDF.', variant: 'destructive' });
    } finally {
       setIsGeneratingPdf(false);
    }
  };

  const handleGenerateCertificate = async () => {
    const academicYear = academicYearsList.find(y => y.id === selectedAcademicYearId);
    if (!academicYear) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner une année académique.', variant: 'destructive' });
      return;
    }

    setIsGeneratingPdf(true);
    try {
       await generateEnrollmentCertificatePdf({
         student: studentProfile,
         school: schoolInfo || studentProfile?.school || profile?.school,
         academicYear,
         enrollment: studentProfile?.enrollments?.[0]
       });
       toast({ title: 'Succès', description: 'Le certificat a été téléchargé !' });
    } catch (e) {
       toast({ title: 'Erreur', description: 'Echec de génération PDF.', variant: 'destructive' });
    } finally {
       setIsGeneratingPdf(false);
    }
  };

  const handleGenerateProceedings = async () => {
    const academicYear = academicYearsList.find(y => y.id === selectedAcademicYearId);
    if (!academicYear) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner une année académique.', variant: 'destructive' });
      return;
    }

    // Pass all report cards for the selected year
    const yearlyCards = reportCards.filter((rc: any) => rc.academicYearId === selectedAcademicYearId && (rc.status === 'published' || rc.status === 'generated'));

    setIsGeneratingPdf(true);
    try {
       await generateProceedingsPdf({
         student: studentProfile,
         school: schoolInfo || studentProfile?.school || profile?.school,
         academicYear,
         enrollment: studentProfile?.enrollments?.[0],
         allReportCards: yearlyCards
       });
       toast({ title: 'Succès', description: 'Le Procès Verbal a été téléchargé !' });
    } catch (e) {
       toast({ title: 'Erreur', description: 'Echec de génération PDF.', variant: 'destructive' });
    } finally {
       setIsGeneratingPdf(false);
    }
  };

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
              Filtres (Documents importés)
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

        {/* Academic Documents Generation Area */}
        <Card className="mb-4 sm:mb-6 border-blue-200 bg-blue-50/50 shadow-sm">
           <CardHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-blue-800">
                <GraduationCap className="h-5 w-5" />
                Dossier Périodique Numérique (Génération PDF)
              </CardTitle>
              {!isFinancialsLoading && (isBlockedGlobal || showPaymentWarning) && (
                 <Badge variant={isBlockedGlobal ? "destructive" : "secondary"} className={cn("flex items-center gap-1", !isBlockedGlobal && "bg-yellow-100 text-yellow-800 hover:bg-yellow-200")}>
                   {isBlockedGlobal ? <Lock className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />} 
                   {isBlockedGlobal ? "Bloqué: Arriérés" : "Avertissement: Arriérés"}
                 </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-end mb-4">
               <div className="space-y-1.5 sm:space-y-2">
                 <label className="text-xs font-medium text-gray-700">Année Académique</label>
                 <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
                   <SelectTrigger className="bg-white">
                     <SelectValue placeholder="Année académique" />
                   </SelectTrigger>
                   <SelectContent>
                      {academicYearsList.map(y => (
                        <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                      ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-1.5 sm:space-y-2">
                 <label className="text-xs font-medium text-gray-700">Période (Semestre/Trimestre)</label>
                 <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                   <SelectTrigger className="bg-white">
                     <SelectValue placeholder="Sélect. une période" />
                   </SelectTrigger>
                   <SelectContent>
                      {periodsData.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                   </SelectContent>
                 </Select>
               </div>
               
               <Button 
                onClick={handleGenerateTranscript}
                disabled={blockBulletins || isGeneratingPdf || !selectedPeriodId} 
                className={cn("bg-blue-600 hover:bg-blue-700", blockBulletins && 'opacity-50')}
               >
                 {isGeneratingPdf ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                 Relevé de Notes
               </Button>
               <Button 
                onClick={handleGenerateReportCard}
                disabled={blockBulletins || isGeneratingPdf || !selectedPeriodId} 
                className={cn("bg-emerald-600 hover:bg-emerald-700", blockBulletins && 'opacity-50')}
               >
                 {isGeneratingPdf ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                 Bulletin Provisoire
               </Button>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-end mt-4 pt-4 border-t border-blue-200/50">
               <div className="col-span-1 lg:col-span-2">
                 <p className="text-xs text-blue-800/70 mb-2">Documents de fin d'année ou attestations (Basés sur l'année sélectionnée)</p>
               </div>
               <Button 
                onClick={handleGenerateCertificate}
                disabled={blockCertificates || isGeneratingPdf} 
                variant="outline"
                className={cn("border-blue-300 text-blue-700 bg-white hover:bg-blue-50", blockCertificates && 'opacity-50')}
               >
                 {isGeneratingPdf ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                 Certificat de scolarité
               </Button>
               <Button 
                onClick={handleGenerateProceedings}
                disabled={blockCertificates || isGeneratingPdf} 
                variant="outline"
                className={cn("border-purple-300 text-purple-700 bg-white hover:bg-purple-50", blockCertificates && 'opacity-50')}
               >
                 {isGeneratingPdf ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                 Procès Verbal (Annuel/Moyenne)
               </Button>
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
