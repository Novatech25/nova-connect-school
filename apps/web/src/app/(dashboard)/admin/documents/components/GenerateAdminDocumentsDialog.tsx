'use client';

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  usePeriods,
  useSchool,
  useSchoolSettings,
  useGrades,
  useReportCards,
} from "@novaconnect/data";
import {
  getStudentFeeSchedulesSecure,
  getStudentPaymentsSecure,
  getStudentProfileByIdSecure,
  getAcademicYearsSecure
} from "@/actions/payment-actions";

import { generateTranscriptPdf } from "@/lib/pdf/transcriptPdf";
import { generateReportCardPdf } from "@/lib/pdf/reportCardPdf";
import { generateEnrollmentCertificatePdf } from "@/lib/pdf/enrollmentCertificatePdf";
import { generateProceedingsPdf } from "@/lib/pdf/proceedingsPdf";
import { Download, GraduationCap, AlertCircle, Lock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface GenerateAdminDocumentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  schoolId: string;
}

export function GenerateAdminDocumentsDialog({
  isOpen,
  onClose,
  studentId,
  schoolId,
}: GenerateAdminDocumentsDialogProps) {
  const { toast } = useToast();

  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [academicYearsList, setAcademicYearsList] = useState<any[]>([]);
  const [feeSchedules, setFeeSchedules] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  
  const [totalPaidAmount, setTotalPaidAmount] = useState<number>(0);
  const [totalPastDueAmount, setTotalPastDueAmount] = useState<number>(0);
  const [isFinancialsLoading, setIsFinancialsLoading] = useState<boolean>(true);
  
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const { school: schoolInfo } = useSchool(isOpen ? (schoolId || "") : "");
  const { data: schoolSettings } = useSchoolSettings(isOpen ? (schoolId || "") : "");
  const { data: periodsData = [] } = usePeriods(isOpen ? (schoolId || "") : "", selectedAcademicYearId || undefined);
  
  const { data: publishedGrades = [] } = useGrades(isOpen ? (schoolId || "") : "", {
    academicYearId: selectedAcademicYearId || undefined,
    periodId: selectedPeriodId || undefined,
    studentId: isOpen ? (studentId || undefined) : undefined,
  });

  const { data: reportCards = [] } = useReportCards(isOpen ? (schoolId || "") : "", {
    academicYearId: selectedAcademicYearId || undefined,
    periodId: selectedPeriodId || undefined,
    studentId: isOpen ? (studentId || undefined) : undefined,
  });
  
  const { data: yearReportCards = [] } = useReportCards(isOpen ? (schoolId || "") : "", {
    academicYearId: selectedAcademicYearId || undefined,
    studentId: isOpen ? (studentId || undefined) : undefined,
  });

  useEffect(() => {
    const loadFinancialsAndProfile = async () => {
      if (!isOpen || !studentId) {
          setIsFinancialsLoading(false);
          return;
      }
      
      setIsFinancialsLoading(true);
      
      try {
        const { data: stdProfile } = await getStudentProfileByIdSecure(studentId);
        if (stdProfile) {
          setStudentProfile(stdProfile);
          const { data: years } = await getAcademicYearsSecure(schoolId || "");
          if (years && years.length > 0) {
            setAcademicYearsList(years);
            const current = years.find((y: any) => y.current || y.is_current || y.isCurrent);
            if (current) {
                setSelectedAcademicYearId(current.id);
            } else {
                setSelectedAcademicYearId(years[0].id);
            }
          }
        }

        const [feesRes, paymentsRes] = await Promise.all([
          getStudentFeeSchedulesSecure(studentId, undefined),
          getStudentPaymentsSecure(studentId)
        ]);
        
        const loadedFees = feesRes.data || [];
        const loadedPayments = paymentsRes.data || [];
        
        setFeeSchedules(loadedFees);
        setPaymentsList(loadedPayments);

        const totalPaid = loadedPayments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
        const now = new Date();
        const pastDueFees = loadedFees.filter((f: any) => new Date(f.due_date) <= now);
        const totalPastDue = pastDueFees.reduce((acc: number, f: any) => acc + (f.amount || 0), 0);

        setTotalPaidAmount(totalPaid);
        setTotalPastDueAmount(totalPastDue);

      } catch (err) {
        console.error("Erreur chargement paiements", err);
      } finally {
        setIsFinancialsLoading(false);
      }
    };
    
    loadFinancialsAndProfile();
    
    return () => {
        // Reset when closed
        if(!isOpen) {
            setStudentProfile(null);
            setSelectedAcademicYearId('');
            setSelectedPeriodId('');
            setAcademicYearsList([]);
            setFeeSchedules([]);
            setPaymentsList([]);
            setIsFinancialsLoading(true);
        }
    }
  }, [isOpen, studentId, schoolId]);

  // Set default period when periodsData loads
  useEffect(() => {
    if (periodsData && (periodsData as any[]).length > 0 && !selectedPeriodId) {
      setSelectedPeriodId((periodsData as any[])[0].id);
    }
  }, [periodsData, selectedPeriodId]);

  // Logique du blocage lié aux paramètres d'école
  const paymentBlocking: any = schoolSettings?.paymentBlocking || {
    mode: 'WARNING',
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

  const handleGenerateTranscript = async () => {
    if (!studentProfile || !selectedAcademicYearId || !selectedPeriodId) return;
    setIsGeneratingPdf(true);
    try {
      const academicYear = academicYearsList.find(y => y.id === selectedAcademicYearId);
      const period = periodsData.find((p: any) => p.id === selectedPeriodId);
      const enrollment = studentProfile.enrollments?.find((e: any) => e.academic_year_id === selectedAcademicYearId);

      const data = {
        student: studentProfile,
        school: schoolInfo,
        academicYear,
        period,
        enrollment,
        grades: publishedGrades,
        feeSchedules,
        payments: paymentsList
      };

      await generateTranscriptPdf(data);
      toast({ title: 'Succès', description: 'Relevé de notes généré avec succès' });
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la génération du PDF', variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGenerateReportCard = async () => {
    if (!studentProfile || !selectedAcademicYearId || !selectedPeriodId) return;
    setIsGeneratingPdf(true);
    try {
      const academicYear = academicYearsList.find(y => y.id === selectedAcademicYearId);
      const period = periodsData.find((p: any) => p.id === selectedPeriodId);
      const enrollment = studentProfile.enrollments?.find((e: any) => e.academic_year_id === selectedAcademicYearId);
      
      const filteredReportCards = reportCards.filter((rc: any) => (rc.status === 'published' || rc.status === 'generated'));
      if (!filteredReportCards || filteredReportCards.length === 0) {
        toast({ title: 'Indisponible', description: 'Aucun bulletin existant pour cette période', variant: 'destructive' });
        setIsGeneratingPdf(false);
        return;
      }

      const reportCard = filteredReportCards[0];
      const data = {
        student: studentProfile,
        school: schoolInfo,
        academicYear,
        period,
        enrollment,
        reportCard,
        feeSchedules,
        payments: paymentsList
      };

      await generateReportCardPdf(data);
      toast({ title: 'Succès', description: 'Bulletin généré avec succès' });
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la génération du bulletin', variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGenerateCertificate = async () => {
    if (!studentProfile || !selectedAcademicYearId) return;
    setIsGeneratingPdf(true);
    try {
      const academicYear = academicYearsList.find(y => y.id === selectedAcademicYearId);
      const enrollment = studentProfile.enrollments?.find((e: any) => e.academic_year_id === selectedAcademicYearId || e.academicYearId === selectedAcademicYearId);
      
      const data = {
        student: studentProfile,
        school: schoolInfo,
        academicYear,
        enrollment
      };
      await generateEnrollmentCertificatePdf(data);
      toast({ title: 'Succès', description: 'Certificat généré avec succès' });
    } catch (err) {
      toast({ title: 'Erreur', description: 'Erreur lors de la génération du certificat', variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGenerateProceedings = async () => {
    if (!studentProfile || !selectedAcademicYearId) return;
    setIsGeneratingPdf(true);
    try {
      const academicYear = academicYearsList.find(y => y.id === selectedAcademicYearId);
      const enrollment = studentProfile.enrollments?.find((e: any) => e.academic_year_id === selectedAcademicYearId || e.academicYearId === selectedAcademicYearId);
      
      const filteredYearCards = yearReportCards.filter((rc: any) => (rc.status === 'published' || rc.status === 'generated'));
      
      const data = {
        student: studentProfile,
        school: schoolInfo,
        academicYear,
        enrollment,
        allReportCards: filteredYearCards
      };
      await generateProceedingsPdf(data);
      toast({ title: 'Succès', description: 'Procès Verbal généré avec succès' });
    } catch (err) {
      toast({ title: 'Erreur', description: 'Erreur lors de la génération du PV', variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-blue-800">
            <GraduationCap className="h-6 w-6" />
            Documents Scolaires 
          </DialogTitle>
          <DialogDescription>
            {studentProfile && `Générez les attestations et relevés pour ${studentProfile.firstName || studentProfile.first_name} ${studentProfile.lastName || studentProfile.last_name}`}
            <br/>
            Matricule : {studentProfile?.matricule || 'N/A'}
          </DialogDescription>
        </DialogHeader>

        {isFinancialsLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center">
             <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Analyse financière en cours...
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            
            {/* Financial Status Banner */}
            {(isBlockedGlobal || showPaymentWarning) && (
                <div className={cn("p-4 rounded-md flex items-start gap-3", isBlockedGlobal ? "bg-red-50 text-red-900 border border-red-200" : "bg-yellow-50 text-yellow-900 border border-yellow-200")}>
                    {isBlockedGlobal ? <Lock className="h-5 w-5 text-red-600 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />}
                    <div>
                        <h4 className="font-semibold text-sm">
                            {isBlockedGlobal ? "Arriérés critiques (Téléchargement bloqué côté élève)" : "Avertissement : Arriérés de paiement signalés"}
                        </h4>
                        <p className="text-xs mt-1 opacity-80">
                            Montant dû (échéances passées) : {totalPastDueAmount} 
                            <br/>Montant payé : {totalPaidAmount}
                        </p>
                        {isBlockedGlobal && (
                          <p className="text-xs mt-2 italic text-red-700/80">
                            * En tant qu'administrateur, vous avez le pouvoir de contourner ce blocage et d'imprimer ces documents si nécessaire.
                          </p>
                        )}
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full space-y-2">
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
              <div className="w-full space-y-2">
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
            </div>

            <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-semibold text-blue-900">1. Relevés Périodiques</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button 
                        onClick={handleGenerateTranscript}
                        disabled={isGeneratingPdf || !selectedPeriodId} 
                        className="bg-blue-600 hover:bg-blue-700 w-full justify-start"
                    >
                        {isGeneratingPdf ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Relevé de Notes Périodique
                    </Button>
                    <Button 
                        onClick={handleGenerateReportCard}
                        disabled={isGeneratingPdf || !selectedPeriodId} 
                        className="bg-emerald-600 hover:bg-emerald-700 w-full justify-start"
                    >
                        {isGeneratingPdf ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Bulletin Périodique
                    </Button>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-semibold text-blue-900">2. Attestations Annuelles</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button 
                        onClick={handleGenerateCertificate}
                        disabled={isGeneratingPdf || !selectedAcademicYearId} 
                        variant="outline"
                        className="border-blue-300 text-blue-700 bg-white w-full justify-start hover:bg-blue-50"
                    >
                        {isGeneratingPdf ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Certificat de Scolarité
                    </Button>
                    <Button 
                        onClick={handleGenerateProceedings}
                        disabled={isGeneratingPdf || !selectedAcademicYearId} 
                        variant="outline"
                        className="border-purple-300 text-purple-700 bg-white w-full justify-start hover:bg-purple-50"
                    >
                        {isGeneratingPdf ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Procès Verbal (Annuel)
                    </Button>
                </div>
            </div>
            
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
