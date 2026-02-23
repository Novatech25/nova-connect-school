'use client';

import { useState, useMemo } from 'react';
import { 
  useAuthContext, 
  useStudents, 
  usePeriods, 
  useGenerateReportCard,
  useReportCards 
} from '@novaconnect/data';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, RefreshCw, AlertTriangle, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type GenerateDialogProps = {
  schoolId?: string;
  academicYearId?: string;
};

export function GenerateDialog({ schoolId, academicYearId }: GenerateDialogProps) {
  const { profile, user } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const { toast } = useToast();

  const resolvedSchoolId =
    schoolId ||
    profile?.school?.id ||
    profile?.school_id ||
    user?.schoolId ||
    (user as any)?.school_id ||
    '';
  const resolvedAcademicYearId = academicYearId || user?.academicYearId || '';

  const { data: students } = useStudents(resolvedSchoolId);
  const { data: periods } = usePeriods(resolvedSchoolId, resolvedAcademicYearId);
  const { data: existingReportCards } = useReportCards(resolvedSchoolId);
  
  const generateReportCard = useGenerateReportCard();

  // Verifier si un bulletin existe deja pour cette combinaison
  const existingReportCard = useMemo(() => {
    if (!selectedStudent || !selectedPeriod) return null;
    return existingReportCards?.find(
      card => card.studentId === selectedStudent && card.periodId === selectedPeriod
    );
  }, [existingReportCards, selectedStudent, selectedPeriod]);

  const handleGenerate = async (forceRegenerate = false) => {
    if (!selectedStudent || !selectedPeriod) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un élève et une période.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await generateReportCard.mutateAsync({
        studentId: selectedStudent,
        periodId: selectedPeriod,
        regenerate: forceRegenerate,
      });

      toast({
        title: forceRegenerate ? 'Bulletin régénéré' : 'Bulletin généré',
        description: forceRegenerate 
          ? 'Le bulletin a été recréé avec succès. Le PDF s\'ouvre dans un nouvel onglet.' 
          : 'Bulletin généré avec succès. Le PDF s\'ouvre dans un nouvel onglet.',
      });

      // Ouvrir automatiquement le PDF dans un nouvel onglet
      if (result?.signedUrl) {
        const urlWithTimestamp = new URL(result.signedUrl);
        urlWithTimestamp.searchParams.append('_t', Date.now().toString());
        window.open(urlWithTimestamp.toString(), '_blank', 'noopener');
      }

      const subjectAverages = Array.isArray(result?.subjectAverages)
        ? result.subjectAverages
        : typeof result?.subjectAverages === 'string'
          ? JSON.parse(result.subjectAverages || '[]')
          : [];

      if (subjectAverages.length === 0) {
        toast({
          title: 'Aucune note publiee',
          description: 'Ce bulletin ne contient pas de notes publiees pour la periode choisie.',
        });
      }

      setOpen(false);
      setSelectedStudent('');
      setSelectedPeriod('');
    } catch (error: any) {
      const errorMessage =
        error?.context?.message ||
        error?.message ||
        'Échec de la génération du bulletin.';
      toast({
        title: 'Erreur',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const selectedStudentData = students?.find((s: any) => s.id === selectedStudent);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Générer un bulletin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Générer un bulletin scolaire</DialogTitle>
          <DialogDescription>
            Sélectionnez un élève et une période pour générer son bulletin.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="student" className="text-sm font-medium">
              Élève
            </label>
            <Select
              value={selectedStudent}
              onValueChange={setSelectedStudent}
              disabled={!students || students.length === 0}
            >
              <SelectTrigger id="student">
                <SelectValue placeholder={students?.length ? 'Sélectionner un élève' : 'Chargement...'} />
              </SelectTrigger>
              <SelectContent>
                {students?.map((student: any) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.firstName} {student.lastName} ({student.matricule || 'N/A'})
                  </SelectItem>
                ))}
                {students?.length === 0 && (
                  <SelectItem value="__empty_students__" disabled>
                    Aucun élève disponible
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label htmlFor="period" className="text-sm font-medium">
              Période
            </label>
            <Select
              value={selectedPeriod}
              onValueChange={setSelectedPeriod}
              disabled={!periods || periods.length === 0}
            >
              <SelectTrigger id="period">
                <SelectValue placeholder={periods?.length ? 'Sélectionner une période' : 'Chargement...'} />
              </SelectTrigger>
              <SelectContent>
                {periods?.map((period: any) => (
                  <SelectItem key={period.id} value={period.id}>
                    {period.name}
                  </SelectItem>
                ))}
                {periods?.length === 0 && (
                  <SelectItem value="__empty_periods__" disabled>
                    Aucune période disponible
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Alerte si bulletin existe deja */}
          {existingReportCard && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">Un bulletin existe déjà</p>
                    <p className="text-sm">
                      Généré le: {existingReportCard.generatedAt 
                        ? new Date(existingReportCard.generatedAt).toLocaleDateString('fr-FR')
                        : 'Date inconnue'}
                    </p>
                    <p className="text-sm">
                      Statut: {existingReportCard.status}
                    </p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          
          {existingReportCard ? (
            // Si existe deja, proposer de regenerer
            <Button
              onClick={() => handleGenerate(true)}
              disabled={!selectedStudent || !selectedPeriod || generateReportCard.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {generateReportCard.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Régénération...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Régénérer le bulletin
                </>
              )}
            </Button>
          ) : (
            // Sinon bouton normal
            <Button
              onClick={() => handleGenerate(false)}
              disabled={!selectedStudent || !selectedPeriod || generateReportCard.isPending}
            >
              {generateReportCard.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Générer
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
