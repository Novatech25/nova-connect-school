'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { DayOfWeek, ScheduleConstraint, ScheduleSlot } from '@novaconnect/core'
import {
  useAuthContext,
  useClasses,
  useCreateScheduleSlot,
  useDeleteScheduleSlot,
  useRooms,
  useScheduleWithSlots,
  useSubjects,
  useUpdateScheduleSlot,
  useUsers,
} from '@novaconnect/data'
import { Edit, Filter, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import SlotFormDialog from './SlotFormDialog'

interface SlotsTableProps {
  scheduleId: string
  initialSlots: ScheduleSlot[]
  constraints: ScheduleConstraint[]
  schoolId: string
  academicYearId?: string
}

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Lundi' },
  { value: 'tuesday', label: 'Mardi' },
  { value: 'wednesday', label: 'Mercredi' },
  { value: 'thursday', label: 'Jeudi' },
  { value: 'friday', label: 'Vendredi' },
  { value: 'saturday', label: 'Samedi' },
]

export default function SlotsTable({
  scheduleId,
  initialSlots,
  constraints,
  schoolId: schoolIdProp,
  academicYearId,
}: SlotsTableProps) {
  const { toast } = useToast()
  const { profile, user } = useAuthContext()
  const schoolId =
    schoolIdProp ||
    profile?.school?.id ||
    profile?.school_id ||
    user?.schoolId ||
    (user as any)?.school_id ||
    ''
  // State
  const [slots, setSlots] = useState<ScheduleSlot[]>(initialSlots)
  // Sync slots with initialSlots when they change (e.g. after refetch)
  useEffect(() => {
    if (initialSlots) {
      setSlots(initialSlots)
    }
  }, [initialSlots])

  const [searchQuery, setSearchQuery] = useState('')
  const [filterDay, setFilterDay] = useState<string>('all')
  const [filterTeacher, setFilterTeacher] = useState<string>('all')
  const [filterClass, setFilterClass] = useState<string>('all')
  const [filterSubject, setFilterSubject] = useState<string>('all')
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null)

  // Queries
  const { refetch } = useScheduleWithSlots(scheduleId)

  // Mutations
  const createSlotMutation = useCreateScheduleSlot()
  const updateSlotMutation = useUpdateScheduleSlot()
  const deleteSlotMutation = useDeleteScheduleSlot()

  // Queries for reference data
  const { data: teachers } = useUsers(schoolId)
  const { data: classes } = useClasses(schoolId, academicYearId)
  const { data: subjects } = useSubjects(schoolId)
  const { data: rooms } = useRooms(schoolId)

  // Helper to get display name
  const getTeacherName = (t: any) => {
    if (!t) return 'Inconnu'
    const meta = t.raw_user_meta_data || (t as any).metadata || {}
    const firstName = meta.first_name || meta.firstName || t.firstName || (t as any).first_name
    const lastName = meta.last_name || meta.lastName || t.lastName || (t as any).last_name
    
    if (firstName && lastName) return `${firstName} ${lastName}`
    return firstName || lastName || t.email || 'Professeur sans nom'
  }

  // Filtered slots
  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      // Search query
      if (searchQuery) {
        const teacher = teachers?.find((t) => t.id === slot.teacherId)
        const classItem = classes?.find((c) => c.id === slot.classId)
        const subject = subjects?.find((s) => s.id === slot.subjectId)
        const room = rooms?.find((r) => r.id === slot.roomId)

        const searchLower = searchQuery.toLowerCase()
        const teacherName = getTeacherName(teacher).toLowerCase()
        
        const matchesSearch =
          teacherName.includes(searchLower) ||
          classItem?.name.toLowerCase().includes(searchLower) ||
          subject?.name.toLowerCase().includes(searchLower) ||
          room?.name.toLowerCase().includes(searchLower) ||
          slot.dayOfWeek.toLowerCase().includes(searchLower)

        if (!matchesSearch) return false
      }

      // Day filter
      if (filterDay !== 'all' && slot.dayOfWeek !== filterDay) return false

      // Teacher filter
      if (filterTeacher !== 'all' && slot.teacherId !== filterTeacher) return false

      // Class filter
      if (filterClass !== 'all' && slot.classId !== filterClass) return false

      // Subject filter
      if (filterSubject !== 'all' && slot.subjectId !== filterSubject) return false

      return true
    })
  }, [
    slots,
    searchQuery,
    filterDay,
    filterTeacher,
    filterClass,
    filterSubject,
    teachers,
    classes,
    subjects,
    rooms,
  ])

  // Get unique values for filters
  const uniqueTeachers = useMemo(() => {
    const teacherIds = Array.from(new Set(slots.map((s) => s.teacherId)))
    return teacherIds.map((id) => teachers?.find((t) => t.id === id)).filter((t) => t)
  }, [slots, teachers])

  const uniqueClasses = useMemo(() => {
    const classIds = Array.from(new Set(slots.map((s) => s.classId)))
    return classIds.map((id) => classes?.find((c) => c.id === id)).filter((c) => c)
  }, [slots, classes])

  const uniqueSubjects = useMemo(() => {
    const subjectIds = Array.from(new Set(slots.map((s) => s.subjectId)))
    return subjectIds.map((id) => subjects?.find((s) => s.id === id)).filter((s) => s)
  }, [slots, subjects])

  const handleCreateSlot = async (slotData: Partial<ScheduleSlot>) => {
    try {
      const newSlot = await createSlotMutation.mutateAsync({
        scheduleId,
        schoolId,
        dayOfWeek: slotData.dayOfWeek!,
        startTime: slotData.startTime!,
        endTime: slotData.endTime!,
        teacherId: slotData.teacherId!,
        classId: slotData.classId!,
        subjectId: slotData.subjectId!,
        roomId: slotData.roomId || null,
        campusId: slotData.campusId || null,
        isRecurring: slotData.isRecurring || false,
        recurrenceEndDate: slotData.recurrenceEndDate || null,
        notes: slotData.notes || null,
      })

      setSlots((prev) => [...prev, newSlot])
      setFormDialogOpen(false)

      toast({
        title: 'Créneau créé',
        description: 'Le créneau a été créé avec succès.',
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleUpdateSlot = async (slotData: Partial<ScheduleSlot>) => {
    if (!editingSlot) return

    try {
      await updateSlotMutation.mutateAsync({
        id: editingSlot.id,
        ...slotData,
      })

      setSlots((prev) => prev.map((s) => (s.id === editingSlot.id ? { ...s, ...slotData } : s)))

      setFormDialogOpen(false)
      setEditingSlot(null)

      toast({
        title: 'Créneau mis à jour',
        description: 'Le créneau a été mis à jour avec succès.',
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce créneau ?')) {
      return
    }

    try {
      await deleteSlotMutation.mutateAsync(slotId)

      setSlots((prev) => prev.filter((s) => s.id !== slotId))

      toast({
        title: 'Créneau supprimé',
        description: 'Le créneau a été supprimé avec succès.',
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilterDay('all')
    setFilterTeacher('all')
    setFilterClass('all')
    setFilterSubject('all')
  }

  const hasActiveFilters =
    searchQuery ||
    filterDay !== 'all' ||
    filterTeacher !== 'all' ||
    filterClass !== 'all' ||
    filterSubject !== 'all'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Vue tabulaire des créneaux</h2>
          <p className="text-sm text-muted-foreground">
            Gestion des créneaux horaires avec filtres et actions
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingSlot(null)
            setFormDialogOpen(true)
          }}
        >
          Ajouter un créneau
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par professeur, classe, matière, salle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Day filter */}
              <Select value={filterDay} onValueChange={setFilterDay}>
                <SelectTrigger>
                  <SelectValue placeholder="Jour" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les jours</SelectItem>
                  {DAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Teacher filter */}
              <Select value={filterTeacher} onValueChange={setFilterTeacher}>
                <SelectTrigger>
                  <SelectValue placeholder="Professeur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les professeurs</SelectItem>
                  {uniqueTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {getTeacherName(teacher)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Class filter */}
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Classe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes</SelectItem>
                  {uniqueClasses.map((classItem) => (
                    <SelectItem key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Subject filter */}
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Matière" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les matières</SelectItem>
                  {uniqueSubjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear filters button */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Effacer les filtres
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jour / Heure</TableHead>
                <TableHead>Professeur</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Matière</TableHead>
                <TableHead>Salle</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSlots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {hasActiveFilters
                      ? 'Aucun créneau trouvé avec les filtres appliqués'
                      : 'Aucun créneau. Créez votre premier créneau pour commencer.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSlots.map((slot) => {
                  const teacher = teachers?.find((t) => t.id === slot.teacherId)
                  const classItem = classes?.find((c) => c.id === slot.classId)
                  const subject = subjects?.find((s) => s.id === slot.subjectId)
                  const room = rooms?.find((r) => r.id === slot.roomId)
                  const dayLabel =
                    DAYS.find((d) => d.value === slot.dayOfWeek)?.label || slot.dayOfWeek

                  return (
                    <TableRow key={slot.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{dayLabel}</div>
                          <div className="text-sm text-muted-foreground">
                            {slot.startTime} - {slot.endTime}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {teacher ? (
                          <div>
                            <div className="font-medium">{getTeacherName(teacher)}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Inconnu</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {classItem ? (
                          <Badge variant="outline">{classItem.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">Inconnue</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {subject ? (
                          <div className="text-sm">{subject.name}</div>
                        ) : (
                          <span className="text-muted-foreground">Inconnue</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {room ? (
                          <div className="text-sm">
                            {room.name}
                            {room.capacity && (
                              <span className="text-muted-foreground"> ({room.capacity})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingSlot(slot)
                              setFormDialogOpen(true)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSlot(slot.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <SlotFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        slot={editingSlot}
        onSubmit={editingSlot ? handleUpdateSlot : handleCreateSlot}
        existingSlots={slots}
        constraints={constraints}
        schoolId={schoolId}
        academicYearId={academicYearId}
      />
    </div>
  )
}
