'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DayOfWeek } from '@novaconnect/core'
import {
  plannedSessionQueries,
  scheduleConstraintQueries,
  useCurrentAcademicYear,
  useScheduleVersions,
  useScheduleWithSlots,
  useSchool,
  useUsers,
} from '@novaconnect/data'
import { useQuery } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft, History, Pencil, Upload, FileDown, Calculator } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import ConstraintsPanel from './components/ConstraintsPanel'
import { EditScheduleDialog } from '../components/EditScheduleDialog'
import PublishDialog from './components/PublishDialog'
import ScheduleCalendar from './components/ScheduleCalendar'
import ScheduleStats from './components/ScheduleStats'
import SlotsTable from './components/SlotsTable'
import VersionHistory from './components/VersionHistory'
import { generateSchedulePdf } from '@/lib/pdf/schedule-pdf'
import { PdfExportDialog } from './components/PdfExportDialog'
import type { PdfColorTheme } from '@/lib/pdf/schedule-pdf'
import { RoomAssignmentsTab } from '../components/RoomAssignmentsTab'
import { CalculateRoomAssignmentsDialog } from '../components/CalculateRoomAssignmentsDialog'

export default function ScheduleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const scheduleId = params.id as string

  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [selectedSessionDay, setSelectedSessionDay] = useState<DayOfWeek | 'all'>('all')
  const [selectedSessionClass, setSelectedSessionClass] = useState<string>('all')
  const [calculateDialogOpen, setCalculateDialogOpen] = useState(false)

  // Queries
  const { data: scheduleData, isLoading } = useScheduleWithSlots(scheduleId)
  const { data: versions } = useScheduleVersions(scheduleId)

  // Fetch constraints and teachers once we have the schoolId
  const schoolId = scheduleData?.schoolId || ''
  const { school } = useSchool(schoolId)
  const { data: currentYear } = useCurrentAcademicYear(schoolId)
  const { data: teachers } = useUsers(schoolId)
  
  const constraintsQuery = useQuery({
    ...scheduleConstraintQueries.getAll(schoolId || '', true),
    enabled: Boolean(schoolId),
  })
  const constraints = constraintsQuery.data || []

  const today = new Date()
  const startDate = format(today, 'yyyy-MM-dd')
  const endDate = format(addDays(today, 7), 'yyyy-MM-dd')
  const schedule = scheduleData
  const slots = scheduleData?.slots || []
  const academicYearId = schedule?.academicYearId || schedule?.academicYear?.id

  const plannedSessionsQuery = useQuery({
    ...plannedSessionQueries.getAll(schoolId, {
      startDate: '2000-01-01', // Fetch all future sessions basically
      endDate: '2100-01-01',
      isCancelled: false,
    }),
    enabled: Boolean(schoolId) && schedule?.status === 'published',
  })

  const classOptions = useMemo(() => {
    const map = new Map<string, any>()
    slots?.forEach((slot: any) => {
      if (slot.class?.id && !map.has(slot.class.id)) {
        map.set(slot.class.id, slot.class)
      }
    })
    return Array.from(map.values())
  }, [slots])

  const scheduleSessions = useMemo(() => {
    const allSessions = (plannedSessionsQuery.data as any[]) || []
    if (!schedule?.id) return []
    return allSessions.filter((session) => session.scheduleSlot?.scheduleId === schedule.id)
  }, [plannedSessionsQuery.data, schedule?.id])

  const filteredSessions = useMemo(() => {
    return scheduleSessions.filter((session: any) => {
      if (selectedSessionDay !== 'all' && session.scheduleSlot?.dayOfWeek !== selectedSessionDay) {
        return false
      }
      if (selectedSessionClass !== 'all' && session.class?.id !== selectedSessionClass) {
        return false
      }
      return true
    })
  }, [scheduleSessions, selectedSessionDay, selectedSessionClass])

  const handlePublish = () => {
    setPublishDialogOpen(true)
  }

  const handlePdfConfirm = async (colorTheme: PdfColorTheme) => {
    if (!schedule) return;
    setIsGeneratingPdf(true);
    try {
      const pdfData = {
        name: schedule.name,
        description: schedule.description || '',
        slots: slots.map((s: any) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          subject: s.subject,
          teacher: s.teacher,
          room: s.room,
          class: s.class,
        }))
      };
      const academicYearName = schedule.academic_year?.name || currentYear?.name || '';
      await generateSchedulePdf(pdfData, school, academicYearName, teachers || [], colorTheme);
    } finally {
      setIsGeneratingPdf(false);
      setPdfDialogOpen(false);
    }
  };

  if (isLoading) {
    return <div>Chargement...</div>
  }

  if (!scheduleData || !schedule) {
    return <div>Emploi du temps non trouvé</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin/schedule')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{schedule.name}</h1>
              <Button variant="ghost" size="icon" onClick={() => setEditDialogOpen(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            <Badge variant={schedule.status === 'published' ? 'default' : 'secondary'}>
              {schedule.status === 'draft'
                ? 'Brouillon'
                : schedule.status === 'published'
                  ? 'Publié'
                  : 'Archivé'}
            </Badge>
          </div>
          {schedule.description && <p className="text-muted-foreground">{schedule.description}</p>}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Version v{schedule.version}</span>
            {schedule.publishedAt && (
              <span>Publié le {new Date(schedule.publishedAt).toLocaleDateString('fr-FR')}</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPdfDialogOpen(true)}>
            <FileDown className="mr-2 h-4 w-4" />
            Télécharger PDF
          </Button>
          <Button variant="outline" onClick={() => setHistoryDialogOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            Historique
          </Button>
          <Button variant="outline" onClick={() => setCalculateDialogOpen(true)}>
            <Calculator className="mr-2 h-4 w-4" />
            Attrib. Salles
          </Button>
          <Button
            variant="default"
            onClick={handlePublish}
            disabled={false}
          >
            <Upload className="mr-2 h-4 w-4" />
            {schedule.status === 'published' ? 'Republier' : 'Publier'}
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar">Calendrier</TabsTrigger>
          <TabsTrigger value="slots">Créneaux</TabsTrigger>
          <TabsTrigger value="sessions">Seances</TabsTrigger>
          <TabsTrigger value="room-assignments">Attrib. Salles</TabsTrigger>
          <TabsTrigger value="constraints">Contraintes</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <ScheduleCalendar
            scheduleId={scheduleId}
            initialSlots={slots || []}
            constraints={constraints}
            schoolId={schoolId}
            academicYearId={academicYearId}
          />
        </TabsContent>

        <TabsContent value="slots" className="space-y-4">
          <SlotsTable
            scheduleId={scheduleId}
            initialSlots={slots || []}
            constraints={constraints}
            schoolId={schoolId}
            academicYearId={academicYearId}
          />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Prochaines seances</h2>
              <p className="text-sm text-muted-foreground">
                Seances generees sur les 7 prochains jours apres publication.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm text-muted-foreground">
                {filteredSessions.length} seance(s)
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              ['all', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as Array<
                DayOfWeek | 'all'
              >
            ).map((day) => (
              <Button
                key={day}
                size="sm"
                variant={selectedSessionDay === day ? 'default' : 'outline'}
                onClick={() => setSelectedSessionDay(day)}
              >
                {day === 'all'
                  ? 'Tous'
                  : day === 'monday'
                    ? 'Lun'
                    : day === 'tuesday'
                      ? 'Mar'
                      : day === 'wednesday'
                        ? 'Mer'
                        : day === 'thursday'
                          ? 'Jeu'
                          : day === 'friday'
                            ? 'Ven'
                            : 'Sam'}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px]">
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedSessionClass}
                onChange={(event) => setSelectedSessionClass(event.target.value)}
              >
                <option value="all">Toutes les classes</option>
                {classOptions.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {schedule.status !== 'published' ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground bg-muted/20">
              <div className="flex flex-col items-center gap-2">
                <p className="font-semibold text-lg">Emploi du temps non publié</p>
                <p>Les séances ne sont générées qu'une fois l'emploi du temps publié.</p>
                <Button 
                    variant="outline" 
                    onClick={handlePublish}
                    className="mt-4"
                >
                    <Upload className="mr-2 h-4 w-4" />
                    Publier l'emploi du temps
                </Button>
              </div>
            </div>
          ) : plannedSessionsQuery.isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Chargement des seances...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              Aucune seance planifiee pour cette periode.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {filteredSessions.map((session: any) => (
                <div key={session.id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      {format(new Date(session.sessionDate), 'EEEE d MMM', { locale: fr })}
                    </div>
                    <Badge variant="outline">
                      {session.startTime} - {session.endTime}
                    </Badge>
                  </div>
                  <div className="mt-2 text-base font-semibold">{session.subject?.name || '-'}</div>
                  <div className="text-sm text-muted-foreground">
                    Classe: {session.class?.name || '-'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Prof:{' '}
                    {((): string => {
                      const t = session.teacher
                      if (!t) return 'Professeur inconnu'
                      const meta = t.raw_user_meta_data || (t as any).metadata || {}
                      const firstName =
                        meta.first_name || meta.firstName || t.firstName || (t as any).first_name
                      const lastName =
                        meta.last_name || meta.lastName || t.lastName || (t as any).last_name

                      if (firstName && lastName) return `${firstName} ${lastName}`
                      return firstName || lastName || t.email || 'Professeur sans nom'
                    })()}
                  </div>
                  {session.room?.name && (
                    <div className="text-sm text-muted-foreground">Salle: {session.room.name}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="room-assignments" className="space-y-4">
          <RoomAssignmentsTab schoolId={schoolId} scheduleId={scheduleId} />
        </TabsContent>

        <TabsContent value="constraints" className="space-y-4">
          <ConstraintsPanel schoolId={schoolId} constraints={constraints} />
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <ScheduleStats scheduleId={scheduleId} slots={slots || []} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EditScheduleDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        schedule={{
          id: schedule.id,
          name: schedule.name,
          description: schedule.description,
        }}
      />
      <PublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        scheduleId={scheduleId}
        scheduleName={schedule.name}
        constraints={constraints}
      />

      <VersionHistory
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        scheduleId={scheduleId}
        versions={versions || []}
      />

      <PdfExportDialog
        open={pdfDialogOpen}
        onOpenChange={setPdfDialogOpen}
        onConfirm={handlePdfConfirm}
        isGenerating={isGeneratingPdf}
      />

      <CalculateRoomAssignmentsDialog
        open={calculateDialogOpen}
        onOpenChange={setCalculateDialogOpen}
        schoolId={schoolId}
        scheduleId={scheduleId}
      />
    </div>
  )
}
