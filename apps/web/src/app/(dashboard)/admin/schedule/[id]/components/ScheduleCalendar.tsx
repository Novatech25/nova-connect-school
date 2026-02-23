'use client'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  DayOfWeek,
  ScheduleConstraint,
  ScheduleSlot,
  validateScheduleSlot,
} from '@novaconnect/core'
import {
  useAuthContext,
  useCreateScheduleSlot,
  useDeleteScheduleSlot,
  useScheduleWithSlots,
  useUpdateScheduleSlot,
} from '@novaconnect/data'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import ConflictAlert from './ConflictAlert'
import SlotFormDialog from './SlotFormDialog'
import TimeGrid from './TimeGrid'

interface ScheduleCalendarProps {
  scheduleId: string
  initialSlots: ScheduleSlot[]
  constraints: ScheduleConstraint[]
  schoolId: string
  academicYearId?: string
}

export default function ScheduleCalendar({
  scheduleId,
  initialSlots,
  constraints,
  schoolId: schoolIdProp,
  academicYearId,
}: ScheduleCalendarProps) {
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

  const [activeSlot, setActiveSlot] = useState<ScheduleSlot | null>(null)
  const [conflicts, setConflicts] = useState<Map<string, string[]>>(new Map())
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null)

  // Queries
  const { refetch } = useScheduleWithSlots(scheduleId)

  // Mutations
  const createSlotMutation = useCreateScheduleSlot()
  const updateSlotMutation = useUpdateScheduleSlot()
  const deleteSlotMutation = useDeleteScheduleSlot()

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Real-time validation
  useEffect(() => {
    const newConflicts = new Map<string, string[]>()
    slots.forEach((slot) => {
      const result = validateScheduleSlot(slot, slots, constraints)
      if (!result.isValid) {
        newConflicts.set(
          slot.id,
          result.violations.map((v) => v.message)
        )
      }
    })
    setConflicts(newConflicts)
  }, [slots, constraints])

  const handleDragStart = (event: DragStartEvent) => {
    const slot = slots.find((s) => s.id === event.active.id)
    if (slot) {
      setActiveSlot(slot)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveSlot(null)

    if (!over) return

    // Extract day and time from drop zone
    const [day, time] = over.id.toString().split('-')

    const slot = slots.find((s) => s.id === active.id)
    if (!slot) return

    // Calculate duration from existing slot
    const [startHour, startMin] = slot.startTime.split(':').map(Number)
    const [endHour, endMin] = slot.endTime.split(':').map(Number)
    const durationMinutes = endHour * 60 + endMin - (startHour * 60 + startMin)

    const startTime = time
    const endTime = calculateEndTime(time, durationMinutes)

    // Create updated slot
    const updatedSlot: Partial<ScheduleSlot> = {
      dayOfWeek: day as DayOfWeek,
      startTime,
      endTime,
    }

    // Validate before updating
    const validation = validateScheduleSlot(
      { ...slot, ...updatedSlot } as ScheduleSlot,
      slots,
      constraints
    )
    if (!validation.isValid) {
      toast({
        title: 'Conflit détecté',
        description: validation.violations[0].message,
        variant: 'destructive',
      })
      return
    }

    try {
      await updateSlotMutation.mutateAsync({
        id: slot.id,
        ...updatedSlot,
      })

      // Update local state
      setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, ...updatedSlot } : s)))

      toast({
        title: 'Créneau déplacé',
        description: 'Le créneau a été déplacé avec succès.',
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleCreateSlot = async (slotData: Partial<ScheduleSlot>) => {
    try {
      console.log('[handleCreateSlot] Starting with data:', slotData);

      // Ensure required fields are present and not empty/null
      const requiredFields = [
        'dayOfWeek',
        'startTime',
        'endTime',
        'teacherId',
        'classId',
        'subjectId',
      ]

      const missingFields = requiredFields.filter(
        field => !slotData[field as keyof ScheduleSlot]
      );

      if (missingFields.length > 0) {
        throw new Error(`Champs manquants: ${missingFields.join(', ')}`);
      }

      console.log('[handleCreateSlot] scheduleId:', scheduleId);
      console.log('[handleCreateSlot] schoolId:', schoolId);

      const dataToSend = {
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
      };

      console.log('[handleCreateSlot] Sending to mutation:', dataToSend);
      const newSlot = await createSlotMutation.mutateAsync(dataToSend);
      console.log('[handleCreateSlot] Mutation success:', newSlot);

      // Refetch from server to ensure we have the complete object with ID
      await refetch()

      // Optimistic update (optional if refetch is fast enough)
      // setSlots((prev) => [...prev, newSlot]);

      setFormDialogOpen(false)

      toast({
        title: 'Créneau créé',
        description: 'Le créneau a été créé avec succès.',
      })
    } catch (error: any) {
      console.error('[handleCreateSlot] Full error object:', error);
      console.error('[handleCreateSlot] Error type:', typeof error);
      console.error('[handleCreateSlot] Error keys:', Object.keys(error));
      console.error('[handleCreateSlot] Error message:', error?.message);
      console.error('[handleCreateSlot] Error stringified:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

      const errorMessage =
        error?.message ||
        error?.error?.message ||
        'Une erreur est survenue lors de la création du créneau. Vérifiez la console pour plus de détails.';

      toast({
        title: 'Erreur',
        description: errorMessage,
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

  const totalConflicts = useMemo(() => {
    return conflicts.size
  }, [conflicts])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Calendrier hebdomadaire</h2>
          <p className="text-sm text-muted-foreground">
            Glissez-déposez les créneaux pour les réorganiser
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingSlot(null)
            setFormDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un créneau
        </Button>
      </div>

      {/* Conflict Alert */}
      {totalConflicts > 0 && <ConflictAlert conflicts={conflicts} slots={slots} />}

      {/* Calendar */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <TimeGrid
          slots={slots}
          conflicts={conflicts}
          onEditSlot={(slot) => {
            setEditingSlot(slot)
            setFormDialogOpen(true)
          }}
          onDeleteSlot={handleDeleteSlot}
        />
        <DragOverlay>
          {activeSlot && (
            <div className="rotate-3 opacity-80">
              <div className="rounded-lg border-2 border-primary bg-primary/10 p-4">
                <div className="font-semibold">Slot en déplacement</div>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

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

// Helper function to calculate end time
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor(totalMinutes / 60)
  const endMinutes = totalMinutes % 60
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
}
