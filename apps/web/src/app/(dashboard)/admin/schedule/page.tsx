'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  DayOfWeek,
  ScheduleConstraint,
  ScheduleSlot,
  validateScheduleSlot,
} from '@novaconnect/core'
import {
  scheduleQueries,
  useAcademicYears,
  useAuthContext,
  useDeleteSchedule,
  useDuplicateSchedule,
  usePlannedSessions,
  usePublishSchedule,
  useScheduleConstraints,
  useSchedules,
} from '@novaconnect/data'
import { useQuery } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  CalendarDays,
  Copy,
  Download,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { CreateScheduleDialog } from './components/CreateScheduleDialog'
import { EditScheduleDialog } from './components/EditScheduleDialog'
import { CalculateRoomAssignmentsDialog } from './components/CalculateRoomAssignmentsDialog'

const DAYS: { value: DayOfWeek | 'all'; label: string; short: string }[] = [
  { value: 'all', label: 'Tous', short: 'Tous' },
  { value: 'monday', label: 'Lundi', short: 'Lun' },
  { value: 'tuesday', label: 'Mardi', short: 'Mar' },
  { value: 'wednesday', label: 'Mercredi', short: 'Mer' },
  { value: 'thursday', label: 'Jeudi', short: 'Jeu' },
  { value: 'friday', label: 'Vendredi', short: 'Ven' },
  { value: 'saturday', label: 'Samedi', short: 'Sam' },
]

function getDayLabel(day?: string) {
  const match = DAYS.find((d) => d.value === day)
  return match?.label || day || '-'
}

function buildConflicts(slots: ScheduleSlot[], constraints: ScheduleConstraint[]) {
  const map = new Map<string, string[]>()
  if (!slots.length || !constraints.length) return map
  slots.forEach((slot) => {
    const result = validateScheduleSlot(slot, slots, constraints)
    if (!result.isValid) {
      map.set(
        slot.id,
        result.violations.map((v) => v.message)
      )
    }
  })
  return map
}

function formatSlotTime(slot: ScheduleSlot) {
  return `${slot.startTime} - ${slot.endTime}`
}

export default function ScheduleManagementPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { profile, user } = useAuthContext()
  const schoolId =
    profile?.school?.id || profile?.school_id || user?.schoolId || (user as any)?.school_id

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [calculateDialogOpen, setCalculateDialogOpen] = useState(false)
  const [scheduleToEdit, setScheduleToEdit] = useState<{
    id: string
    name: string
    description?: string
  } | null>(null)
  const [scheduleToDelete, setScheduleToDelete] = useState<{
    id: string
    name: string
    status?: string
    slotsCount?: number
  } | null>(null)

  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('')
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>('monday')
  const [selectedClassId, setSelectedClassId] = useState<string>('all')
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: academicYears = [] } = useAcademicYears(schoolId || '')

  const { data: schedules = [], isLoading: isLoadingSchedules } = useSchedules(
    schoolId || '',
    selectedYear && selectedYear !== 'all' ? selectedYear : undefined,
    undefined
  )

  useEffect(() => {
    if (!selectedYear && academicYears.length > 0) {
      const current = academicYears.find((y: any) => y.is_current || y.isCurrent)
      setSelectedYear(current?.id || academicYears[0].id)
    }
  }, [academicYears, selectedYear])

  useEffect(() => {
    if (!schedules.length) {
      setSelectedScheduleId('')
      return
    }
    // Only set if not already set or invalid
    if (!selectedScheduleId || !schedules.some((s: any) => s.id === selectedScheduleId)) {
      const published = schedules.find((s: any) => s.status === 'published')
      setSelectedScheduleId(published?.id || schedules[0].id)
    }
  }, [schedules, selectedScheduleId])

  // Ensure scheduleQuery is always called but respect enabled flag
  const scheduleQuery = useQuery({
    ...scheduleQueries.getWithSlots(selectedScheduleId),
    enabled: Boolean(selectedScheduleId),
  })

  const scheduleData = scheduleQuery.data as any
  const schedule = scheduleData?.schedule || scheduleData
  const slots: ScheduleSlot[] = scheduleData?.slots || []

  const { data: constraints = [] } = useScheduleConstraints(schoolId || '', true)
  const conflicts = useMemo(() => buildConflicts(slots, constraints), [slots, constraints])

  const uniqueClasses = useMemo(() => {
    const map = new Map<string, any>()
    slots.forEach((slot: any) => {
      if (slot.class?.id && !map.has(slot.class.id)) {
        map.set(slot.class.id, slot.class)
      }
    })
    return Array.from(map.values())
  }, [slots])

  const uniqueTeachers = useMemo(() => {
    const map = new Map<string, any>()
    slots.forEach((slot: any) => {
      if (slot.teacher?.id && !map.has(slot.teacher.id)) {
        map.set(slot.teacher.id, slot.teacher)
      }
    })
    return Array.from(map.values())
  }, [slots])

  const uniqueSubjects = useMemo(() => {
    const map = new Map<string, any>()
    slots.forEach((slot: any) => {
      if (slot.subject?.id && !map.has(slot.subject.id)) {
        map.set(slot.subject.id, slot.subject)
      }
    })
    return Array.from(map.values())
  }, [slots])

  const uniqueRooms = useMemo(() => {
    const map = new Map<string, any>()
    slots.forEach((slot: any) => {
      if (slot.room?.id && !map.has(slot.room.id)) {
        map.set(slot.room.id, slot.room)
      }
    })
    return Array.from(map.values())
  }, [slots])

  const filteredSlots = useMemo(() => {
    return slots.filter((slot: any) => {
      if (selectedDay !== 'all' && slot.dayOfWeek !== selectedDay) return false
      if (selectedClassId !== 'all' && slot.class?.id !== selectedClassId) return false
      if (selectedTeacherId !== 'all' && slot.teacher?.id !== selectedTeacherId) return false
      if (selectedSubjectId !== 'all' && slot.subject?.id !== selectedSubjectId) return false
      if (selectedRoomId !== 'all' && slot.room?.id !== selectedRoomId) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const match =
          slot.class?.name?.toLowerCase().includes(query) ||
          slot.teacher?.firstName?.toLowerCase().includes(query) ||
          slot.teacher?.lastName?.toLowerCase().includes(query) ||
          slot.subject?.name?.toLowerCase().includes(query) ||
          slot.room?.name?.toLowerCase().includes(query) ||
          slot.dayOfWeek?.toLowerCase().includes(query) ||
          slot.startTime?.toLowerCase().includes(query) ||
          slot.endTime?.toLowerCase().includes(query)
        if (!match) return false
      }
      return true
    })
  }, [
    slots,
    selectedDay,
    selectedClassId,
    selectedTeacherId,
    selectedSubjectId,
    selectedRoomId,
    searchQuery,
  ])

  const today = new Date()
  const startDate = format(today, 'yyyy-MM-dd')
  const endDate = format(addDays(today, 7), 'yyyy-MM-dd')

  const { data: upcomingSessions = [] } = usePlannedSessions(schoolId || '', {
    startDate,
    endDate,
    classId: selectedClassId !== 'all' ? selectedClassId : undefined,
    isCancelled: false,
  })

  const duplicateScheduleMutation = useDuplicateSchedule()
  const deleteScheduleMutation = useDeleteSchedule()
  const publishScheduleMutation = usePublishSchedule()

  const handleDuplicate = async (scheduleId: string, name: string) => {
    try {
      await duplicateScheduleMutation.mutateAsync({
        id: scheduleId,
        newName: `${name} (copie)`,
      })
      toast({
        title: 'EDT dupliqué',
        description: "L'emploi du temps a été dupliqué avec succès.",
      })
    } catch (error: any) {
      toast({
        title: 'Erreur lors de la duplication',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleDelete = (scheduleItem: any) => {
    setScheduleToDelete({
      id: scheduleItem.id,
      name: scheduleItem.name,
      status: scheduleItem.status,
      slotsCount: scheduleItem.slotsCount || 0,
    })
  }

  const confirmDelete = async () => {
    if (!scheduleToDelete) return
    try {
      await deleteScheduleMutation.mutateAsync(scheduleToDelete.id)
      toast({
        title: 'EDT supprimé',
        description: `L'emploi du temps "${scheduleToDelete.name}" a été supprimé avec succès.`,
      })
      setScheduleToDelete(null)
    } catch (error: any) {
      toast({
        title: 'Erreur lors de la suppression',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handlePublish = async () => {
    if (!schedule?.id) return
    try {
      const result = await publishScheduleMutation.mutateAsync({
        scheduleId: schedule.id,
        notifyUsers: true,
      })
      toast({
        title: 'Publication réussie',
        description: `${result.sessionsCreated || 0} sessions créées.`,
      })
    } catch (error: any) {
      toast({
        title: 'Erreur de publication',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const getStatusBadge = (status?: string) => {
    const variants: Record<string, any> = {
      draft: 'secondary',
      published: 'default',
      archived: 'outline',
    }

    const labels: Record<string, string> = {
      draft: 'Brouillon',
      published: 'Publié',
      archived: 'Archivé',
    }

    return (
      <Badge variant={variants[status || 'draft'] || 'secondary'}>
        {labels[status || 'draft'] || status}
      </Badge>
    )
  }

  const openEditDialog = (schedule: any) => {
    setScheduleToEdit({
      id: schedule.id,
      name: schedule.name,
      description: schedule.description,
    })
    setEditDialogOpen(true)
  }

  if (!schoolId) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle>École non identifiée</CardTitle>
            <CardDescription>
              Veuillez vous reconnecter ou contacter un administrateur. (User ID: {user?.id}, Profile School ID: {profile?.school?.id || profile?.school_id})
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Emploi du temps - Vue globale</h1>
          <p className="text-muted-foreground">
            Toutes les classes, tous les professeurs, un seul tableau de bord.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setCalculateDialogOpen(true)}>
            <Calculator className="mr-2 h-4 w-4" />
            Attrib. Salles
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/imports/schedules')}>
            <Upload className="mr-2 h-4 w-4" />
            Importer
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open('/docs/imports/templates/schedules-template.csv', '_blank')}
          >
            <Download className="mr-2 h-4 w-4" />
            Modèle CSV
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Créer un EDT
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Sélection et filtres
          </CardTitle>
          <CardDescription>
            Choisissez l'année, l'emploi du temps et filtrez les créneaux.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Années scolaires</Label>
              <SearchableSelect
                options={academicYears.map((y: any) => ({ value: y.id, label: y.name }))}
                value={selectedYear || ''}
                onValueChange={setSelectedYear}
                placeholder="Toutes les années"
                searchPlaceholder="Rechercher une année..."
                allLabel="Toutes les années"
              />
            </div>

            <div className="space-y-2">
              <Label>Emploi du temps</Label>
              <SearchableSelect
                options={schedules.map((s: any) => ({ value: s.id, label: s.name }))}
                value={selectedScheduleId || ''}
                onValueChange={setSelectedScheduleId}
                placeholder="Sélectionner un EDT"
                searchPlaceholder="Rechercher un EDT..."
              />
            </div>

            <div className="space-y-2">
              <Label>Classe</Label>
              <SearchableSelect
                options={uniqueClasses.map((c: any) => ({ value: c.id, label: c.name }))}
                value={selectedClassId}
                onValueChange={setSelectedClassId}
                placeholder="Toutes les classes"
                searchPlaceholder="Rechercher une classe..."
                allLabel="Toutes les classes"
              />
            </div>

            <div className="space-y-2">
              <Label>Recherche</Label>
              <Input
                placeholder="Matiere, prof, salle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Professeur</Label>
              <SearchableSelect
                options={uniqueTeachers.map((t: any) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
                value={selectedTeacherId}
                onValueChange={setSelectedTeacherId}
                placeholder="Tous les profs"
                searchPlaceholder="Rechercher un professeur..."
                allLabel="Tous les profs"
              />
            </div>

            <div className="space-y-2">
              <Label>Matière</Label>
              <SearchableSelect
                options={uniqueSubjects.map((s: any) => ({ value: s.id, label: s.name }))}
                value={selectedSubjectId}
                onValueChange={setSelectedSubjectId}
                placeholder="Toutes les matières"
                searchPlaceholder="Rechercher une matière..."
                allLabel="Toutes les matières"
              />
            </div>

            <div className="space-y-2">
              <Label>Salle</Label>
              <SearchableSelect
                options={uniqueRooms.map((r: any) => ({ value: r.id, label: r.name }))}
                value={selectedRoomId}
                onValueChange={setSelectedRoomId}
                placeholder="Toutes les salles"
                searchPlaceholder="Rechercher une salle..."
                allLabel="Toutes les salles"
              />
            </div>

            <div className="space-y-2">
              <Label>Jour</Label>
              <Select
                value={selectedDay}
                onValueChange={(value) => setSelectedDay(value as DayOfWeek | 'all')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les jours" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Créneaux</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{slots.length}</div>
            <p className="text-xs text-muted-foreground">sur l'EDT sélectionné</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{uniqueClasses.length}</div>
            <p className="text-xs text-muted-foreground">classes actives</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Professeurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{uniqueTeachers.length}</div>
            <p className="text-xs text-muted-foreground">enseignants impliqués</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Conflits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-600">{conflicts.size}</div>
            <p className="text-xs text-muted-foreground">à résoudre</p>
          </CardContent>
        </Card>
      </div>

      {conflicts.size > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col gap-3 py-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-semibold">Conflits détectés</span>
            </div>
            <p className="text-sm text-red-700">
              Des conflits ont été détectés dans les créneaux. Veuillez corriger avant publication.
            </p>
            <div>
              <Button
                variant="outline"
                onClick={() => schedule?.id && router.push(`/admin/schedule/${schedule.id}`)}
              >
                Résoudre dans l'EDT
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Aperçu de l'EDT
            </CardTitle>
            <CardDescription>{schedule?.name || 'Aucun EDT sélectionné'}</CardDescription>
          </div>
          {schedule && (
            <div className="flex items-center gap-2">
              {getStatusBadge(schedule.status)}
              <Badge variant="outline">v{schedule.version}</Badge>
              <Button
                variant="outline"
                onClick={() => router.push(`/admin/schedule/${schedule.id}`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Voir / Éditer
              </Button>
              <Button
                onClick={handlePublish}
                disabled={publishScheduleMutation.isPending || schedule.status === 'published'}
              >
                Publier
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {scheduleQuery.isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Chargement...</div>
          ) : !schedule ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucun emploi du temps disponible pour cette année.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {DAYS.filter((d) => d.value !== 'all').map((day) => (
                  <Button
                    key={day.value}
                    variant={selectedDay === day.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedDay(day.value as DayOfWeek)}
                  >
                    {day.short}
                  </Button>
                ))}
                <Button
                  variant={selectedDay === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDay('all')}
                >
                  Tous
                </Button>
              </div>

              {filteredSlots.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground">
                  Aucun créneau ne correspond aux filtres.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {filteredSlots
                    .sort((a, b) =>
                      `${a.dayOfWeek}-${a.startTime}`.localeCompare(`${b.dayOfWeek}-${b.startTime}`)
                    )
                    .map((slot: any) => (
                      <div key={slot.id} className="rounded-lg border bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">
                            {getDayLabel(slot.dayOfWeek)} • {formatSlotTime(slot)}
                          </p>
                          {conflicts.has(slot.id) && <Badge variant="destructive">Conflit</Badge>}
                        </div>
                        <p className="mt-2 text-base font-semibold">{slot.subject?.name || '-'}</p>
                        <div className="mt-2 text-sm text-muted-foreground">
                          Classe: {slot.class?.name || '-'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Prof: {slot.teacher?.firstName || ''} {slot.teacher?.lastName || ''}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Salle: {slot.room?.name || '-'}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prochaines séances (7 jours)</CardTitle>
          <CardDescription>Sessions générées après publication</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingSessions.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">Aucune séance planifiée.</div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {upcomingSessions.slice(0, 10).map((session: any) => (
                <div key={session.id} className="rounded-lg border bg-white p-4">
                  <div className="text-sm font-semibold">
                    {format(new Date(session.sessionDate), 'EEEE d MMM', { locale: fr })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {session.startTime} - {session.endTime}
                  </div>
                  <div className="mt-2 text-base font-semibold">{session.subject?.name || '-'}</div>
                  <div className="text-sm text-muted-foreground">
                    Classe: {session.class?.name || '-'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Prof: {session.teacher?.firstName || ''} {session.teacher?.lastName || ''}
                  </div>
                  {session.room?.name && (
                    <div className="text-sm text-muted-foreground">Salle: {session.room.name}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste complète des créneaux</CardTitle>
          <CardDescription>
            Tous les champs attendus par le modèle CSV (classe, matière, prof, jour, heure, salle)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jour</TableHead>
                <TableHead>Heure</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Matière</TableHead>
                <TableHead>Professeur</TableHead>
                <TableHead>Salle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSlots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucun créneau à afficher
                  </TableCell>
                </TableRow>
              ) : (
                filteredSlots
                  .sort((a, b) =>
                    `${a.dayOfWeek}-${a.startTime}`.localeCompare(`${b.dayOfWeek}-${b.startTime}`)
                  )
                  .map((slot: any) => (
                    <TableRow key={slot.id}>
                      <TableCell>{getDayLabel(slot.dayOfWeek)}</TableCell>
                      <TableCell>{formatSlotTime(slot)}</TableCell>
                      <TableCell>{slot.class?.name || '-'}</TableCell>
                      <TableCell>{slot.subject?.name || '-'}</TableCell>
                      <TableCell>
                        {slot.teacher?.firstName || ''} {slot.teacher?.lastName || ''}
                      </TableCell>
                      <TableCell>{slot.room?.name || '-'}</TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des emplois du temps</CardTitle>
          <CardDescription>
            Gestion des versions (création, duplication, suppression)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Année scolaire</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Publication</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingSchedules ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : schedules.length > 0 ? (
                schedules.map((scheduleItem: any) => (
                  <TableRow key={scheduleItem.id}>
                    <TableCell className="font-medium">{scheduleItem.name}</TableCell>
                    <TableCell>{scheduleItem.academicYear?.name || '-'}</TableCell>
                    <TableCell>{getStatusBadge(scheduleItem.status)}</TableCell>
                    <TableCell>v{scheduleItem.version}</TableCell>
                    <TableCell>
                      {scheduleItem.publishedAt
                        ? format(new Date(scheduleItem.publishedAt), 'PPP', { locale: fr })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/admin/schedule/${scheduleItem.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Voir/éditer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(scheduleItem)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Renommer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(scheduleItem.id, scheduleItem.name)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(scheduleItem)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucun emploi du temps trouvé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateScheduleDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />

      {scheduleToEdit && (
        <EditScheduleDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          schedule={scheduleToEdit}
        />
      )}

      {/* Dialog de confirmation de suppression */}
      <AlertDialog
        open={!!scheduleToDelete}
        onOpenChange={(open) => !open && setScheduleToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-center">
              Supprimer cet emploi du temps ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Vous êtes sur le point de supprimer l'emploi du temps{' '}
              <span className="font-semibold text-foreground">
                &laquo;&nbsp;{scheduleToDelete?.name}&nbsp;&raquo;
              </span>
              . Cette action est irréversible et supprimera tous les créneaux associés.
            </AlertDialogDescription>
            {scheduleToDelete?.status === 'published' && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <strong>Attention :</strong> Cet emploi du temps est actuellement publié.
                Sa suppression retirera toutes les séances planifiées associées.
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel disabled={deleteScheduleMutation.isPending}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
              disabled={deleteScheduleMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteScheduleMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CalculateRoomAssignmentsDialog
        open={calculateDialogOpen}
        onOpenChange={setCalculateDialogOpen}
        schoolId={schoolId || ''}
      />
    </div>
  )
}
