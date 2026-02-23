'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  createScheduleSlotSchema,
  DayOfWeek,
  ScheduleSlot,
  validateScheduleSlot,
} from '@novaconnect/core'
import {
  useCampuses,
  useClasses,
  useRooms,
  useSubjects,
  useUsers,
  useTeacherAssignmentsByTeacher,
} from '@novaconnect/data'
import {
  CalendarDays,
  Clock,
  MapPin,
  GraduationCap,
  Users,
  BookOpen,
  StickyNote,
  AlertCircle
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

interface SlotFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slot: ScheduleSlot | null
  onSubmit: (data: Partial<ScheduleSlot>) => void
  existingSlots: ScheduleSlot[]
  constraints: any[]
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

const NONE_VALUE = '__none__'
const NO_SUBJECT_VALUE = '__no_subjects__'

// Schema for the form UI only (omits backend fields like schoolId/scheduleId)
const formSchema = z.object({
  dayOfWeek: z.enum([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]),
  startTime: z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/, "Format invalide"),
  endTime: z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/, "Format invalide"),
  teacherId: z.string().min(1, "Professeur requis"),
  classId: z.string().min(1, "Classe requise"),
  subjectId: z.string().min(1, "Matière requise"),
  roomId: z.string().optional().nullable(),
  campusId: z.string().optional().nullable(),
  isRecurring: z.boolean().default(false),
  recurrenceEndDate: z.union([z.string(), z.date(), z.null()]).optional(),
  notes: z.string().optional(),
}).refine(
  (data) => {
    if (!data.startTime || !data.endTime) return true;
    const [startH, startM] = data.startTime.split(':').map(Number);
    const [endH, endM] = data.endTime.split(':').map(Number);
    return (endH * 60 + endM) > (startH * 60 + startM);
  },
  { message: "L'heure de fin doit être après l'heure de début", path: ["endTime"] }
);

export default function SlotFormDialog({
  open,
  onOpenChange,
  slot,
  onSubmit,
  existingSlots,
  constraints,
  schoolId,
  academicYearId,
}: SlotFormDialogProps) {
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dayOfWeek: 'monday' as DayOfWeek,
      startTime: '08:00',
      endTime: '09:00',
      teacherId: '',
      classId: '',
      subjectId: '',
      roomId: '',
      campusId: '',
      isRecurring: false,
      recurrenceEndDate: '',
      notes: '',
    },
  })

  const watchedValues = watch()

  // Queries
  const { data: teachersByRole = [] } = useUsers(schoolId, 'teacher')
  const { data: allUsers = [] } = useUsers(schoolId)

  // Combine teachers logic similar to TeacherAssignmentsTab
  const teachers = useMemo(() => {
    if (teachersByRole.length > 0) return teachersByRole
    const metadataTeachers = allUsers.filter((user: any) => {
      // Check metadata role first (as per provided JSON structure)
      const metaRole = user?.raw_user_meta_data?.role || (user?.metadata as any)?.role;
      if (metaRole) {
        const normalized = String(metaRole).toLowerCase();
        if (normalized === 'teacher' || normalized === 'enseignant') return true;
      }

      // Check top-level role
      const role = user?.role
      if (role) {
         const normalized = String(role).toLowerCase()
         if (normalized === 'teacher' || normalized === 'enseignant') return true;
      }
      
      return false;
    })
    return metadataTeachers.length > 0 ? metadataTeachers : allUsers
  }, [teachersByRole, allUsers])

  const { data: allClasses } = useClasses(schoolId, academicYearId)
  const { data: allSubjects } = useSubjects(schoolId)
  const { data: rooms } = useRooms(schoolId)
  const { data: campuses } = useCampuses(schoolId)

  // Teacher Assignments
  const { data: teacherAssignments = [] } = useTeacherAssignmentsByTeacher(
    watchedValues.teacherId || '',
    academicYearId
  )

  // Filter classes based on teacher assignments
  const filteredClasses = useMemo(() => {
    if (!watchedValues.teacherId || !teacherAssignments.length) return allClasses || []
    
    // Get unique class IDs from assignments
    const assignedClassIds = new Set(teacherAssignments.map((ta: any) => ta.classId))
    
    return (allClasses || []).filter((c) => assignedClassIds.has(c.id))
  }, [allClasses, teacherAssignments, watchedValues.teacherId])

  // Filter subjects based on teacher assignments AND selected class
  const filteredSubjects = useMemo(() => {
    // Return empty if no teacher or no assignments
    if (!watchedValues.teacherId || !teacherAssignments.length) return [];
    
    // Filter subjects where the teacher is assigned to the selected class (or any class if none selected)
    const validSubjectIds = new Set<string>();
    
    teacherAssignments.forEach((ta: any) => {
        // Must match teacher
        if (ta.teacherId !== watchedValues.teacherId) return;
        
        // If class is selected, assignment must match class.
        // If no class selected, we include all subjects taught by this teacher
        if (!watchedValues.classId || ta.classId === watchedValues.classId) {
            validSubjectIds.add(ta.subjectId);
        }
    });

    return (allSubjects || []).filter((subject) => validSubjectIds.has(subject.id));
  }, [allSubjects, teacherAssignments, watchedValues.teacherId, watchedValues.classId])

  // Reset form when slot changes
  useEffect(() => {
    // Only reset if slot changes, avoid infinite loop with existingSlots
    if (!open) return; // Don't reset if dialog is closed/closing
    
    if (slot) {
      reset({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        teacherId: slot.teacherId,
        classId: slot.classId,
        subjectId: slot.subjectId,
        roomId: slot.roomId || '',
        campusId: slot.campusId || '',
        isRecurring: slot.isRecurring || false,
        recurrenceEndDate: slot.recurrenceEndDate ? slot.recurrenceEndDate.split('T')[0] : '',
        notes: slot.notes || '',
      })
    } else {
      reset({
        dayOfWeek: 'monday' as DayOfWeek,
        startTime: '08:00',
        endTime: '09:00',
        teacherId: '',
        classId: '',
        subjectId: '',
        roomId: '',
        campusId: '',
        isRecurring: false,
        recurrenceEndDate: '',
        notes: '',
      })
    }
    setValidationErrors([])
  }, [slot, open]) // Removed 'reset' from dependencies as it's stable, and added 'open' to control reset timing

  // Real-time validation
  const [isValidationPending, setIsValidationPending] = useState(false);

  useEffect(() => {
    // Skip if not all required fields are present or dialog is closed
    if (!open) {
      setValidationErrors([]);
      return;
    }
    
    // Check mandatory fields presence first
    if (!watchedValues.teacherId || !watchedValues.classId || !watchedValues.subjectId) {
       // Silent return, don't clear errors if they were set by submit
       return; 
    }

    // Debounce validation to avoid excessive updates
    const timer = setTimeout(() => {
      const tempSlot: ScheduleSlot = {
        id: slot?.id || 'temp',
        scheduleId: '',
        schoolId: '',
        dayOfWeek: watchedValues.dayOfWeek,
        startTime: watchedValues.startTime,
        endTime: watchedValues.endTime,
        teacherId: watchedValues.teacherId,
        classId: watchedValues.classId,
        subjectId: watchedValues.subjectId,
        roomId: watchedValues.roomId || null,
        campusId: watchedValues.campusId || null,
        isRecurring: watchedValues.isRecurring,
        recurrenceEndDate: watchedValues.recurrenceEndDate
          ? new Date(watchedValues.recurrenceEndDate)
          : null,
        notes: watchedValues.notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      }

      const validation = validateScheduleSlot(
        tempSlot,
        existingSlots.filter((s) => s.id !== slot?.id),
        constraints
      )

      if (!validation.isValid) {
        setValidationErrors(validation.violations.map((v) => v.message))
      } else {
        setValidationErrors([])
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [
    open,
    watchedValues.dayOfWeek,
    watchedValues.startTime,
    watchedValues.endTime,
    watchedValues.teacherId,
    watchedValues.classId,
    watchedValues.subjectId,
    watchedValues.roomId,
    watchedValues.campusId,
    watchedValues.isRecurring,
    watchedValues.recurrenceEndDate,
    watchedValues.notes,
    existingSlots,
    constraints,
    slot
  ])

  const handleFormSubmit = (data: any) => {
    console.log("Form validated successfully by Zod", data);
    
    // Force final validation check before submit
    if (validationErrors.length > 0) {
      console.warn("Submit blocked by validation errors:", validationErrors);
      return
    }

    // Double check critical fields
    if (!data.teacherId || !data.classId || !data.subjectId || !data.dayOfWeek || !data.startTime || !data.endTime) {
        console.warn("Submit blocked by missing fields:", data);
        setValidationErrors(["Veuillez remplir tous les champs obligatoires"]);
        return;
    }

    console.log("Submitting form data:", data);

    onSubmit({
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      teacherId: data.teacherId,
      classId: data.classId,
      subjectId: data.subjectId,
      roomId: data.roomId === NONE_VALUE ? null : (data.roomId || null),
      campusId: data.campusId === NONE_VALUE ? null : (data.campusId || null),
      isRecurring: data.isRecurring,
      recurrenceEndDate: data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null,
      notes: data.notes || null,
    })
  }
  
  const handleFormError = (errors: any) => {
      console.error("Zod Validation Errors:", errors);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{slot ? 'Modifier le créneau' : 'Créer un créneau'}</DialogTitle>
          <DialogDescription>Remplissez les informations du créneau horaire.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit, handleFormError)} className="space-y-5">
          {/* Validation errors */}
          {(validationErrors.length > 0 || Object.keys(errors).length > 0) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={`custom-${index}`}>{error}</li>
                  ))}
                  {Object.values(errors).map((error: any, index) => (
                     <li key={`zod-${index}`}>{error.message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex items-center gap-2 p-4 pb-0">
              <Clock className="h-5 w-5 text-primary" />
              <h3 className="font-semibold leading-none tracking-tight">Horaire</h3>
            </div>
            <div className="p-4 grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
              <div className="space-y-2">
                <Label htmlFor="dayOfWeek" className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  <CalendarDays className="h-3 w-3" /> Jour *
                </Label>
                <Controller
                  name="dayOfWeek"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={(value) => field.onChange(value === NONE_VALUE ? '' : value)}
                      value={field.value || NONE_VALUE}
                    >
                      <SelectTrigger id="dayOfWeek" className="h-9">
                        <SelectValue placeholder="Sélectionner un jour" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map((day) => (
                          <SelectItem key={day.value} value={day.value}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime" className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  Début *
                </Label>
                <Controller
                  name="startTime"
                  control={control}
                  render={({ field }) => <Input type="time" className="h-9" {...field} />}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime" className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  Fin *
                </Label>
                <Controller
                  name="endTime"
                  control={control}
                  render={({ field }) => <Input type="time" className="h-9" {...field} />}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex items-center gap-2 p-4 pb-0">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h3 className="font-semibold leading-none tracking-tight">Affectations pédagogiques</h3>
            </div>
            <div className="p-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="teacherId" className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  <Users className="h-3 w-3" /> Professeur *
                </Label>
                <Controller
                  name="teacherId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={(value) => field.onChange(value === NONE_VALUE ? '' : value)}
                      value={field.value || NONE_VALUE}
                    >
                      <SelectTrigger id="teacherId" className="h-9">
                        <SelectValue placeholder="Sélectionner un professeur" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers?.map((teacher) => {
                          // Extract data from raw_user_meta_data if available (Supabase Auth structure)
                          const meta = teacher.raw_user_meta_data || teacher.metadata || {};
                          const firstName = meta.first_name || meta.firstName || teacher.firstName || teacher.first_name;
                          const lastName = meta.last_name || meta.lastName || teacher.lastName || teacher.last_name;
                          
                          const displayName = firstName && lastName
                            ? `${firstName} ${lastName}`
                            : firstName || lastName || teacher.email || 'Professeur sans nom';
                          
                          return (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {displayName}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="classId" className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  <Users className="h-3 w-3" /> Classe *
                </Label>
                <Controller
                  name="classId"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="classId" className="h-9">
                        <SelectValue placeholder="Sélectionner une classe" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredClasses?.map((classItem) => (
                          <SelectItem key={classItem.id} value={classItem.id}>
                            {classItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="subjectId" className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
                  <BookOpen className="h-3 w-3" /> Matière *
                </Label>
                <Controller
                  name="subjectId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!watchedValues.teacherId}
                    >
                      <SelectTrigger id="subjectId" className="h-9">
                        <SelectValue placeholder="Sélectionner une matière" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSubjects.length > 0 ? (
                          filteredSubjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value={NO_SUBJECT_VALUE} disabled>
                            {watchedValues.teacherId
                              ? 'Aucune matière assignée à ce professeur'
                              : "Sélectionnez d'abord un professeur"}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex items-center gap-2 p-4 pb-0">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="font-semibold leading-none tracking-tight">Localisation</h3>
            </div>
            <div className="p-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="roomId" className="text-xs text-muted-foreground uppercase tracking-wide">Salle (optionnel)</Label>
                <Controller
                  name="roomId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={(value) => field.onChange(value === NONE_VALUE ? '' : value)}
                      value={field.value || NONE_VALUE}
                    >
                      <SelectTrigger id="roomId" className="h-9">
                        <SelectValue placeholder="Sélectionner une salle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Pas de salle</SelectItem>
                        {rooms?.map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            {room.name} ({room.capacity} places)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="campusId" className="text-xs text-muted-foreground uppercase tracking-wide">Campus (optionnel)</Label>
                <Controller
                  name="campusId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={(value) => field.onChange(value === NONE_VALUE ? '' : value)}
                      value={field.value || NONE_VALUE}
                    >
                      <SelectTrigger id="campusId" className="h-9">
                        <SelectValue placeholder="Sélectionner un campus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Pas de campus</SelectItem>
                        {campuses?.map((campus) => (
                          <SelectItem key={campus.id} value={campus.id}>
                            {campus.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
             <div className="flex items-center gap-2 p-4 pb-0">
               <StickyNote className="h-5 w-5 text-primary" />
               <h3 className="font-semibold leading-none tracking-tight">Options</h3>
             </div>
             <div className="p-4 space-y-4">
               <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-3 rounded-md">
                <Controller
                  name="isRecurring"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isRecurring"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      <Label htmlFor="isRecurring" className="cursor-pointer">Créneau récurrent</Label>
                      {field.value && (
                        <Badge variant="outline" className="text-xs ml-2 bg-primary/10 text-primary border-primary/20">
                          Actif
                        </Badge>
                      )}
                    </div>
                  )}
                />
              </div>

              {watchedValues.isRecurring && (
                <div className="grid gap-2 md:max-w-xs animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label htmlFor="recurrenceEndDate" className="text-xs text-muted-foreground uppercase tracking-wide">Date de fin de récurrence</Label>
                  <Controller
                    name="recurrenceEndDate"
                    control={control}
                    render={({ field }) => <Input type="date" className="h-9" {...field} />}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-xs text-muted-foreground uppercase tracking-wide">Notes</Label>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <Textarea id="notes" placeholder="Informations complémentaires..." rows={2} className="resize-none" {...field} />
                  )}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isValidationPending}>
              {slot ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
