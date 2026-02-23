'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuthContext } from '@novaconnect/data';
import { useTeacherAssignmentsByTeacher } from '@novaconnect/data';
import { useEnrollmentsByClass } from '@novaconnect/data';
import { useCreateAttendanceSession, useCreateBulkAttendanceRecords } from '@novaconnect/data';
import { usePlannedSessions } from '@novaconnect/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, UserCheck, UserX, Clock, AlertCircle, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format, parse, isBefore, isAfter, subMinutes, addMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSchoolSettings } from '@novaconnect/data';

interface Student {
  firstName: string;
  lastName: string;
  matricule: string;
}

interface EnrollmentWithStudent {
  id: string;
  studentId: string;
  student: Student;
}

interface Class {
  id: string;
  name: string;
}

interface PlannedSession {
  id: string;
  startTime: string;
  endTime: string;
  subject?: {
    name: string;
  };
}

// Helper to calculate distance between two coordinates in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) *
    Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export default function TeacherAttendancePage() {
  const { user, profile } = useAuthContext();
  const { toast } = useToast();

  // State
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
  const [justifications, setJustifications] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Justification Modal State
  const [isJustificationOpen, setIsJustificationOpen] = useState(false);
  const [studentToJustify, setStudentToJustify] = useState<string | null>(null);
  const [tempJustification, setTempJustification] = useState('');

  // Derived IDs
  const teacherId = user?.id || '';

  // Load assignments to get schoolId
  const { data: assignments = [], isLoading: isLoadingAssignments } = useTeacherAssignmentsByTeacher(teacherId);

  // Get schoolId from user or from first assignment
  const schoolId = user?.user_metadata?.school_id ||
    (user as any)?.school_id ||
    profile?.schoolId ||
    profile?.school_id ||
    (assignments.length > 0 ? (assignments[0] as any)?.schoolId || (assignments[0] as any)?.school_id : '') ||
    '';

  // Queries
  const { data: enrollments = [], isLoading: isLoadingStudents } = useEnrollmentsByClass(selectedClassId, {
    enabled: !!selectedClassId, // Only run when classId is valid
  });

  const { data: plannedSessions = [], isLoading: isLoadingSessions } = usePlannedSessions(schoolId, {
    teacherId,
    classId: selectedClassId,
    startDate: selectedDate,
    endDate: selectedDate,
    isCancelled: false,
  });

  const { data: schoolSettings } = useSchoolSettings(schoolId);

  // DEBUG: Log pour comprendre pourquoi aucune session n'est trouvée
  useEffect(() => {
    console.log('[TeacherAttendance] Query params:', {
      schoolId,
      teacherId,
      selectedClassId,
      selectedDate,
      isCancelled: false,
    });
    console.log('[TeacherAttendance] Planned sessions returned:', plannedSessions);
    console.log('[TeacherAttendance] Number of sessions:', plannedSessions.length);
    console.log('[TeacherAttendance] Enrollments loaded:', enrollments);
    console.log('[TeacherAttendance] Number of enrollments:', enrollments.length);
    console.log('[TeacherAttendance] Loading states:', {
      isLoadingSessions,
      isLoadingStudents,
    });
  }, [schoolId, teacherId, selectedClassId, selectedDate, plannedSessions, enrollments, isLoadingSessions, isLoadingStudents]);

  // Mutations
  const createSession = useCreateAttendanceSession();
  const createRecords = useCreateBulkAttendanceRecords();

  // Unique classes from assignments
  const classes = useMemo(() => {
    const uniqueMap = new Map();
    assignments.forEach((assignment: any) => {
      if (assignment.class && !uniqueMap.has(assignment.class.id)) {
        uniqueMap.set(assignment.class.id, assignment.class);
      }
    });
    return Array.from(uniqueMap.values());
  }, [assignments]);

  // Set default class
  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId((classes[0] as Class).id);
    }
  }, [classes, selectedClassId]);

  // Reset session when class or date changes
  useEffect(() => {
    setSelectedSessionId('');
  }, [selectedClassId, selectedDate]);

  // Auto-select session if only one exists
  useEffect(() => {
    if (plannedSessions.length === 1 && !selectedSessionId) {
      setSelectedSessionId((plannedSessions[0] as PlannedSession).id);
    }
  }, [plannedSessions, selectedSessionId]);

  // Initialize attendance data when enrollments load
  useEffect(() => {
    if (enrollments.length > 0) {
      const initialData: Record<string, string> = {};
      (enrollments as EnrollmentWithStudent[]).forEach((enrollment) => {
        initialData[enrollment.studentId] = 'present';
      });
      setAttendanceData(initialData);
    }
  }, [enrollments]);

  // Handlers
  const handleStatusChange = (studentId: string, status: string) => {
    if (status === 'excused') {
      setStudentToJustify(studentId);
      setTempJustification(justifications[studentId] || '');
      setIsJustificationOpen(true);
    } else {
      setAttendanceData(prev => ({ ...prev, [studentId]: status }));
      // Clear justification if status changes from excused
      if (justifications[studentId]) {
        const newJustifications = { ...justifications };
        delete newJustifications[studentId];
        setJustifications(newJustifications);
      }
    }
  };

  const saveJustification = () => {
    if (studentToJustify) {
      if (!tempJustification.trim()) {
        toast({
          title: "Erreur",
          description: "Une justification est requise pour le statut 'Excusé'.",
          variant: "destructive"
        });
        return;
      }
      setAttendanceData(prev => ({ ...prev, [studentToJustify]: 'excused' }));
      setJustifications(prev => ({ ...prev, [studentToJustify]: tempJustification }));
      setIsJustificationOpen(false);
      setStudentToJustify(null);
      setTempJustification('');
    }
  };

  const handleMarkAll = (status: string) => {
    const newData: Record<string, string> = {};
    (enrollments as EnrollmentWithStudent[]).forEach((enrollment) => {
      newData[enrollment.studentId] = status;
    });
    setAttendanceData(newData);
    // If marking all as present/absent/late, clear all justifications
    if (status !== 'excused') {
      setJustifications({});
    }
  };

  const handleSubmit = async () => {
    if (!selectedClassId || !teacherId || !schoolId || !selectedSessionId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une séance de cours.",
        variant: "destructive"
      });
      return;
    }

    // 1. DYNAMIC DATE/TIME VALIDATION
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate !== today) {
      toast({
        title: "Action refusée",
        description: "Vous ne pouvez faire l'appel que pour la date d'aujourd'hui.",
        variant: "destructive"
      });
      return;
    }

    const session = plannedSessions.find((s: any) => s.id === selectedSessionId) as PlannedSession | undefined;
    if (session) {
      const now = new Date();
      // Parse session times today
      const sessionStart = parse(session.startTime, 'HH:mm:ss', now);
      const sessionEnd = parse(session.endTime, 'HH:mm:ss', now);
      
      // Allow 15 mins before start, and 2 hours after end limit
      const minAllowedTime = subMinutes(sessionStart, 15);
      const maxAllowedTime = addMinutes(sessionEnd, 120);

      if (isBefore(now, minAllowedTime)) {
        toast({
          title: "Action refusée",
          description: "La séance n'a pas encore commencé.",
          variant: "destructive"
        });
        return;
      }
      if (isAfter(now, maxAllowedTime)) {
         toast({
          title: "Action refusée",
          description: "Le délai pour faire l'appel de cette séance est dépassé.",
          variant: "destructive"
        });
        return;
      }
    }

    // 2. GPS VALIDATION
    const gpsConfig = schoolSettings?.gps;
    if (gpsConfig && gpsConfig.latitude && gpsConfig.longitude && schoolSettings?.qrAttendance?.requireGpsValidation !== false) {
      try {
        setIsSubmitting(true);
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("La géolocalisation n'est pas supportée par votre navigateur."));
          } else {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
               enableHighAccuracy: true,
               timeout: 10000,
               maximumAge: 0
            });
          }
        });

        const teacherLat = position.coords.latitude;
        const teacherLon = position.coords.longitude;
        const schoolLat = gpsConfig.latitude;
        const schoolLon = gpsConfig.longitude;
        const maxRadius = gpsConfig.radiusMeters || 200;

        const distanceStr = calculateDistance(teacherLat, teacherLon, schoolLat, schoolLon);
        
        if (distanceStr > maxRadius) {
           toast({
             title: "Action refusée - Hors de la zone scolaire",
             description: `Vous êtes à ${Math.round(distanceStr)}m de l'école. La limite est de ${maxRadius}m. Veuillez vous rapprocher de l'établissement pour faire l'appel.`,
             variant: "destructive"
           });
           setIsSubmitting(false);
           return;
        }

      } catch (err: any) {
         toast({
             title: "Géolocalisation requise",
             description: "Nous n'avons pas pu vérifier votre position. Veuillez autoriser l'accès à votre position GPS pour marquer l'appel.",
             variant: "destructive"
         });
         setIsSubmitting(false);
         return;
      }
    }

    setIsSubmitting(true);
    try {
      const attendanceSession = await createSession.mutateAsync({
        schoolId,
        teacherId,
        classId: selectedClassId,
        sessionDate: selectedDate,
        plannedSessionId: selectedSessionId,
        notes: "Saisie manuelle professeur",
      });

      // 2. Create Records
      const records = (enrollments as EnrollmentWithStudent[]).map((enrollment) => ({
        attendanceSessionId: attendanceSession.id,
        schoolId,
        studentId: enrollment.studentId,
        status: attendanceData[enrollment.studentId] as any,
        source: 'teacher_manual' as const,
        justification: attendanceData[enrollment.studentId] === 'excused' ? justifications[enrollment.studentId] : null,
        comment: null,
      }));

      await createRecords.mutateAsync(records);

      toast({
        title: "Succès",
        description: "L'appel a été enregistré avec succès.",
      });

      // Reset or redirect? For now stay on page
    } catch (error: any) {
      console.error('Attendance submit error:', error);
      
      let errorMsg = "Une erreur inconnue s'est produite.";
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
         errorMsg = error;
      } else if (error && typeof error === 'object' && error.message) {
         errorMsg = error.message;
      }

      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer l'appel. " + errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!profile) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const selectedStudentName = studentToJustify
    ? (enrollments as EnrollmentWithStudent[]).find((e) => e.studentId === studentToJustify)?.student
      ? `${(enrollments as EnrollmentWithStudent[]).find((e) => e.studentId === studentToJustify)?.student.firstName} ${(enrollments as EnrollmentWithStudent[]).find((e) => e.studentId === studentToJustify)?.student.lastName}`
      : 'l\'élève'
    : '';

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      <div className="space-y-1 sm:space-y-2">
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900">
          Appel / Présences
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Enregistrez la présence des élèves pour vos cours.
        </p>
      </div>

      {/* Controls */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg md:text-xl">Configuration de la séance</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-4 sm:p-6">
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-medium block text-gray-700">Classe</label>
            <SearchableSelect
              options={(classes as Class[]).map((cls) => ({ value: cls.id, label: cls.name }))}
              value={selectedClassId || 'all'}
              onValueChange={(v) => setSelectedClassId(v === 'all' ? '' : v)}
              placeholder="Sélectionner une classe"
              searchPlaceholder="Rechercher une classe..."
              allLabel="Sélectionner une classe"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-medium block text-gray-700">Date</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 sm:h-10 text-sm"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <label className="text-xs sm:text-sm font-medium block text-gray-700">Séance (Cours)</label>
            <SearchableSelect
              options={(plannedSessions as PlannedSession[]).map((session) => ({
                value: session.id,
                label: `${session.startTime.slice(0, 5)} - ${session.endTime.slice(0, 5)}${session.subject?.name ? ` (${session.subject.name})` : ''}`
              }))}
              value={selectedSessionId || 'all'}
              onValueChange={(v) => setSelectedSessionId(v === 'all' ? '' : v)}
              placeholder={isLoadingSessions ? "Chargement..." : "Sélectionner un cours"}
              searchPlaceholder="Rechercher un cours..."
              allLabel="Sélectionner un cours"
              emptyMessage="Aucun cours planifié ce jour"
            />
            {!selectedSessionId && plannedSessions.length === 0 && !isLoadingSessions && selectedClassId && (
              <p className="text-xs sm:text-sm text-red-500 mt-1">
                Aucune séance trouvée. Vous ne pouvez pas faire l'appel sans séance planifiée.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Student List */}
      {selectedClassId && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-6">
            <div className="space-y-1">
              <CardTitle className="text-base sm:text-lg md:text-xl">Liste des élèves ({enrollments.length})</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Cochez le statut pour chaque élève</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleMarkAll('present')} className="text-xs sm:text-sm h-8 sm:h-9">
                Tous Présents
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            {isLoadingStudents ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin" /></div>
            ) : enrollments.length === 0 ? (
              <p className="text-center text-sm sm:text-base text-gray-500 py-6 sm:py-8">Aucun élève trouvé dans cette classe.</p>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {(enrollments as EnrollmentWithStudent[]).map((enrollment) => (
                  <div key={enrollment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-slate-50 gap-3 sm:gap-4 transition-colors">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-700 font-bold shrink-0 text-sm sm:text-base">
                        {enrollment.student?.firstName?.[0] || 'E'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base truncate">{enrollment.student?.firstName} {enrollment.student?.lastName}</p>
                        <p className="text-xs sm:text-sm text-gray-500">{enrollment.student?.matricule}</p>
                        {attendanceData[enrollment.studentId] === 'excused' && justifications[enrollment.studentId] && (
                          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1 line-clamp-2">
                            <FileText className="h-3 w-3 shrink-0" />
                            <span className="truncate">{justifications[enrollment.studentId]}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2">
                      <StatusButton
                        status="present"
                        current={attendanceData[enrollment.studentId]}
                        onClick={() => handleStatusChange(enrollment.studentId, 'present')}
                        icon={<UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                        label="Présent"
                        color="bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                        activeColor="ring-2 ring-green-500 ring-offset-1"
                      />
                      <StatusButton
                        status="absent"
                        current={attendanceData[enrollment.studentId]}
                        onClick={() => handleStatusChange(enrollment.studentId, 'absent')}
                        icon={<UserX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                        label="Absent"
                        color="bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
                        activeColor="ring-2 ring-red-500 ring-offset-1"
                      />
                      <StatusButton
                        status="late"
                        current={attendanceData[enrollment.studentId]}
                        onClick={() => handleStatusChange(enrollment.studentId, 'late')}
                        icon={<Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                        label="Retard"
                        color="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200"
                        activeColor="ring-2 ring-orange-500 ring-offset-1"
                      />
                      <StatusButton
                        status="excused"
                        current={attendanceData[enrollment.studentId]}
                        onClick={() => handleStatusChange(enrollment.studentId, 'excused')}
                        icon={<AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                        label="Excusé"
                        color="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
                        activeColor="ring-2 ring-blue-500 ring-offset-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <div className="p-4 sm:p-6 border-t bg-gray-50 flex justify-end">
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting || enrollments.length === 0 || !selectedSessionId}
              className="w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              <span className="hidden sm:inline">Enregistrer l'appel</span>
              <span className="sm:hidden">Enregistrer</span>
            </Button>
          </div>
        </Card>
      )}

      <Dialog open={isJustificationOpen} onOpenChange={setIsJustificationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justification de l'absence</DialogTitle>
            <DialogDescription>
              Veuillez indiquer le motif pour {selectedStudentName}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="justification" className="mb-2 block">Motif / Justification</Label>
            <Textarea
              id="justification"
              value={tempJustification}
              onChange={(e) => setTempJustification(e.target.value)}
              placeholder="Ex: Maladie, Rendez-vous médical..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsJustificationOpen(false)}>Annuler</Button>
            <Button onClick={saveJustification}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusButton({ status, current, onClick, icon, label, color, activeColor }: any) {
  const isSelected = current === status;
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md border text-xs sm:text-sm font-medium transition-all
        ${color}
        ${isSelected ? activeColor : 'opacity-70 hover:opacity-100'}
      `}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}