'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuthContext } from '@novaconnect/data';
import { usePlannedSessions } from '@novaconnect/data';
import {
  useCreateLessonLog,
  useUpdateLessonLog,
  useLessonLogByPlannedSession,
  useSchoolSettings
} from '@novaconnect/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, BookOpen, Clock, AlertCircle } from 'lucide-react';
import { format, parse, isBefore, isAfter, subMinutes, addMinutes } from 'date-fns';



interface Class {
  id: string;
  name: string;
}

interface PlannedSession {
  id: string;
  startTime: string;
  endTime: string;
  subjectId: string;
  subject?: {
    name: string;
  };
  classId: string;
  class?: {
    id: string;
    name: string;
  };
}

// Calculer la distance en mètres entre deux coordonnées GPS (formule Haversine)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}



export default function TeacherHomeworkPage() {
  const { user, profile } = useAuthContext();
  const { toast } = useToast();

  // State
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // Form State
  const [theme, setTheme] = useState('');
  const [content, setContent] = useState('');
  const [homework, setHomework] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived IDs
  const teacherId = user?.id || '';
  const schoolId = profile?.schoolId || profile?.school_id || '';

  // Mémoriser les filtres pour éviter les re-renders inutiles mais permettre le rechargement
  const sessionFilters = useMemo(() => ({
    teacherId,
    startDate: selectedDate,
    endDate: selectedDate,
    isCancelled: false,
  }), [teacherId, selectedDate]);

  const { data: schoolSettings } = useSchoolSettings(schoolId);

  // Récupérer TOUTES les sessions du jour pour cet enseignant (sans filtre de classe)
  const { data: allDaySessions = [], isLoading: isLoadingSessions, refetch } = usePlannedSessions(schoolId, sessionFilters);

  // Refetch quand la date change
  useEffect(() => {
    if (schoolId && teacherId && selectedDate) {
      refetch();
    }
  }, [selectedDate, schoolId, teacherId, refetch]);



  // Filtrer les sessions par classe sélectionnée
  const plannedSessions = useMemo(() => {
    if (!selectedClassId) return allDaySessions;
    return (allDaySessions as PlannedSession[]).filter(s => s.classId === selectedClassId);
  }, [allDaySessions, selectedClassId]);

  const { data: existingLog, isLoading: isLoadingLog } = useLessonLogByPlannedSession(selectedSessionId);

  // Mutations
  const createLog = useCreateLessonLog();
  const updateLog = useUpdateLessonLog();

  // Extraire les classes uniques depuis les sessions du jour
  const classes = useMemo(() => {
    const uniqueMap = new Map();
    (allDaySessions as PlannedSession[]).forEach((session) => {
      if (session.class && !uniqueMap.has(session.class.id)) {
        uniqueMap.set(session.class.id, session.class);
      }
    });
    return Array.from(uniqueMap.values());
  }, [allDaySessions]);

  // Set default class or reset if selected class no longer available
  useEffect(() => {
    // Si aucune classe sélectionnée et des classes disponibles, sélectionner la première
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId((classes[0] as Class).id);
    }
    // Si la classe sélectionnée n'existe plus dans les classes disponibles, sélectionner la première
    else if (selectedClassId && classes.length > 0) {
      const classExists = classes.some((c: Class) => c.id === selectedClassId);
      if (!classExists) {
        setSelectedClassId((classes[0] as Class).id);
      }
    }
    // Si aucune classe disponible, réinitialiser
    else if (classes.length === 0) {
      setSelectedClassId('');
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

  // Populate form if log exists
  useEffect(() => {
    if (existingLog) {
      setTheme(existingLog.theme || '');
      setContent(existingLog.content || '');
      setHomework(existingLog.homework || '');
      setDuration(existingLog.durationMinutes || 60);
    } else {
      // Reset form if no log exists for selected session
      setTheme('');
      setContent('');
      setHomework('');
      setDuration(60);
    }
  }, [existingLog, selectedSessionId]);

  // Calculate duration from session time if new log
  useEffect(() => {
    if (!existingLog && selectedSessionId) {
      const session = (plannedSessions as PlannedSession[]).find(s => s.id === selectedSessionId);
      if (session) {
        const start = new Date(`1970-01-01T${session.startTime}`);
        const end = new Date(`1970-01-01T${session.endTime}`);
        const diff = (end.getTime() - start.getTime()) / 60000;
        if (diff > 0) setDuration(diff);
      }
    }
  }, [selectedSessionId, plannedSessions, existingLog]);

  const handleSubmit = async () => {
    if (!selectedClassId || !teacherId || !schoolId || !selectedSessionId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une séance de cours.",
        variant: "destructive"
      });
      return;
    }

    if (!theme.trim() || !content.trim()) {
      toast({
        title: "Erreur",
        description: "Le thème et le contenu sont obligatoires.",
        variant: "destructive"
      });
      return;
    }

    if (theme.trim().length < 3) {
      toast({
        title: "Erreur de validation",
        description: "Le thème doit contenir au moins 3 caractères.",
        variant: "destructive"
      });
      return;
    }

    if (content.trim().length < 10) {
      toast({
        title: "Erreur de validation",
        description: "Le contenu du cours doit être détaillé (au moins 10 caractères).",
        variant: "destructive"
      });
      return;
    }

    const session = (plannedSessions as PlannedSession[]).find(s => s.id === selectedSessionId);
    if (!session) {
      toast({
        title: "Erreur",
        description: "Séance non trouvée.",
        variant: "destructive"
      });
      return;
    }

    // 1. DYNAMIC DATE/TIME VALIDATION
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate !== today) {
      toast({
        title: "Action refusée",
        description: "Vous ne pouvez enregistrer le cahier de texte que pour les séances du jour.",
        variant: "destructive"
      });
      return;
    }

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
          description: "Le délai pour enregistrer ce cahier de texte est dépassé.",
          variant: "destructive"
        });
        return;
      }
    }

    // 2. GPS VALIDATION
    const gpsConfig = schoolSettings?.gps;
    let latitude = 0;
    let longitude = 0;

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

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        const schoolLat = gpsConfig.latitude;
        const schoolLon = gpsConfig.longitude;
        const maxRadius = gpsConfig.radiusMeters || 200;

        const distanceStr = calculateDistance(latitude, longitude, schoolLat, schoolLon);
        
        if (distanceStr > maxRadius) {
           toast({
             title: "Action refusée - Hors de la zone scolaire",
             description: `Vous êtes à ${Math.round(distanceStr)}m de l'école. La limite est de ${maxRadius}m. Veuillez vous rapprocher de l'établissement.`,
             variant: "destructive"
           });
           setIsSubmitting(false);
           return;
        }
      } catch (err: any) {
         toast({
             title: "Géolocalisation requise",
             description: "Nous n'avons pas pu vérifier votre position. Veuillez autoriser l'accès à votre position GPS.",
             variant: "destructive"
         });
         setIsSubmitting(false);
         return;
      }
    } else {
       // Si la validation n'est pas requise, on essaie quand même d'obtenir les coords pour les métadonnées (silencieusement)
       try {
         if (navigator.geolocation) {
           const position = await new Promise<GeolocationPosition>((resolve, reject) => {
             navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
           });
           latitude = position.coords.latitude;
           longitude = position.coords.longitude;
         }
       } catch (e) {
         // Silently fail if not required
       }
    }

    setIsSubmitting(true);
    try {
      if (existingLog) {
        await updateLog.mutateAsync({
          id: existingLog.id,
          theme,
          content,
          homework: homework || null,
          durationMinutes: duration,
          latitude,
          longitude,
        });
        toast({
          title: "Succès",
          description: "Le cahier de texte a été mis à jour.",
        });
      } else {
        await createLog.mutateAsync({
          schoolId,
          plannedSessionId: selectedSessionId,
          teacherId,
          classId: selectedClassId,
          subjectId: session.subjectId,
          sessionDate: selectedDate,
          theme,
          content,
          homework: homework || null,
          durationMinutes: duration,
          latitude,
          longitude,
        });
        toast({
          title: "Succès",
          description: "Le cahier de texte a été enregistré.",
        });
      }

    } catch (error: any) {
      console.error('Lesson log submit error:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer. " + (error.message || ""),
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!profile) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cahier de Texte</h1>
        <p className="mt-2 text-gray-600">
          Remplissez le contenu du cours et les devoirs à faire.
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Sélection de la séance</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="mb-2 block">Classe</Label>
            <SearchableSelect
              options={(classes as Class[]).map((cls) => ({ value: cls.id, label: cls.name }))}
              value={selectedClassId || 'all'}
              onValueChange={(v) => setSelectedClassId(v === 'all' ? '' : v)}
              placeholder="Sélectionner une classe"
              searchPlaceholder="Rechercher une classe..."
              allLabel="Sélectionner une classe"
            />
          </div>

          <div>
            <Label className="mb-2 block">Date</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-2 block">Séance (Cours)</Label>
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
              <p className="text-xs text-red-500 mt-1">
                Aucune séance trouvée pour cette date.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      {selectedSessionId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              {existingLog ? "Modifier le contenu" : "Nouveau contenu"}
            </CardTitle>
            <CardDescription>
              {existingLog ? "Ce cours a déjà été rempli. Vous pouvez modifier les informations ci-dessous." : "Remplissez les informations concernant le déroulement du cours."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoadingLog ? (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Thème / Titre de la leçon <span className="text-red-500">*</span></Label>
                    <Input
                      id="theme"
                      placeholder="Ex: Introduction aux équations du second degré"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Durée effective (minutes) <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="duration"
                        type="number"
                        className="pl-9"
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Contenu du cours / Activités réalisées <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="content"
                    placeholder="Détaillez ici ce qui a été fait durant la séance..."
                    className="min-h-[150px]"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="homework" className="text-blue-700 font-semibold">Devoirs à faire / Travail personnel</Label>
                  <Textarea
                    id="homework"
                    placeholder="Ex: Exercices 1 à 5 page 42 pour le prochain cours..."
                    className="min-h-[100px] border-blue-200 bg-blue-50 focus-visible:ring-blue-500"
                    value={homework}
                    onChange={(e) => setHomework(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Ce travail sera visible par les élèves et les parents dans leur espace.
                  </p>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button size="lg" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {existingLog ? "Mettre à jour" : "Enregistrer"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
