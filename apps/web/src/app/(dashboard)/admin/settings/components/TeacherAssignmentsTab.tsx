'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  getSupabaseClient,
  useAcademicYears,
  useClasses,
  useCreateBulkTeacherAssignments,
  useDeleteTeacherAssignment,
  useSubjects,
  useTeacherAssignmentsByTeacher,
  useUsers,
} from '@novaconnect/data'
import { CheckSquare, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export function TeacherAssignmentsTab({ schoolId }: { schoolId: string }) {
  const [selectedTeacher, setSelectedTeacher] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set())
  const [initialAssignments, setInitialAssignments] = useState<Map<string, string>>(new Map()) // Key -> ID
  const [hourlyRate, setHourlyRate] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [classFilter, setClassFilter] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const NO_TEACHER_VALUE = '__no_teachers__'

  const { data: teachersByRole = [], isLoading: teachersLoading } = useUsers(schoolId, 'teacher')
  const { data: allUsers = [], isLoading: allUsersLoading } = useUsers(schoolId)
  const { data: years, isLoading: yearsLoading } = useAcademicYears(schoolId)
  const { data: classes, isLoading: classesLoading } = useClasses(schoolId, selectedYear)
  const { data: subjects, isLoading: subjectsLoading } = useSubjects(schoolId)

  const { data: existingAssignments, isLoading: assignmentsLoading } =
    useTeacherAssignmentsByTeacher(
      selectedTeacher === NO_TEACHER_VALUE ? '' : selectedTeacher,
      selectedYear
    )

  const createBulkMutation = useCreateBulkTeacherAssignments()
  const deleteMutation = useDeleteTeacherAssignment()
  const { toast } = useToast()

  // Load existing assignments when fetched
  useEffect(() => {
    if (existingAssignments) {
      const newSelected = new Set<string>()
      const newInitial = new Map<string, string>()

      existingAssignments.forEach((assignment: any) => {
        const key = `${assignment.classId}::${assignment.subjectId}`
        newSelected.add(key)
        newInitial.set(key, assignment.id)
      })

      setSelectedAssignments(newSelected)
      setInitialAssignments(newInitial)

      // Pre-fill hourly rate from first existing assignment
      const firstWithRate = (existingAssignments as any[]).find((a: any) => a.hourlyRate != null)
      if (firstWithRate) {
        setHourlyRate(String(firstWithRate.hourlyRate))
      }
    }
  }, [existingAssignments])

  const teachers = useMemo(() => {
    if (teachersByRole.length > 0) return teachersByRole
    const metadataTeachers = allUsers.filter((user: any) => {
      const role = (user?.metadata as any)?.role || user?.role
      if (!role) return false
      const normalized = String(role).toLowerCase()
      return normalized === 'teacher' || normalized === 'enseignant'
    })
    return metadataTeachers.length > 0 ? metadataTeachers : allUsers
  }, [teachersByRole, allUsers])

  const isLoading = teachersLoading || allUsersLoading || yearsLoading || classesLoading || subjectsLoading || assignmentsLoading;

  const filteredSubjects = useMemo(() => {
    const query = subjectFilter.trim().toLowerCase()
    if (!query) return subjects || []
    return (subjects || []).filter((subject: any) => {
      const name = (subject.name || '').toLowerCase()
      const code = (subject.code || '').toLowerCase()
      return name.includes(query) || code.includes(query)
    })
  }, [subjects, subjectFilter])

  const filteredClasses = useMemo(() => {
    const query = classFilter.trim().toLowerCase()
    if (!query) return classes || []
    return (classes || []).filter((classItem: any) =>
      (classItem.name || '').toLowerCase().includes(query)
    )
  }, [classes, classFilter])

  const assignmentKey = (classId: string, subjectId: string) => `${classId}::${subjectId}`

  const handleAssignmentToggle = (classId: string, subjectId: string) => {
    const key = assignmentKey(classId, subjectId)
    const newAssignments = new Set(selectedAssignments)
    if (newAssignments.has(key)) {
      newAssignments.delete(key)
    } else {
      newAssignments.add(key)
    }
    setSelectedAssignments(newAssignments)
  }

  const ensureTeacherRole = async () => {
    if (teachersByRole.some((teacher: any) => teacher.id === selectedTeacher)) {
      return
    }

    const supabase = getSupabaseClient()
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'teacher')
      .single()

    if (roleError || !roleData) {
      throw roleError || new Error("Rôle 'teacher' introuvable")
    }

    const { data: existingRole, error: existingRoleError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', selectedTeacher)
      .eq('role_id', roleData.id)
      .eq('school_id', schoolId)
      .maybeSingle()

    if (existingRoleError) {
      throw existingRoleError
    }

    if (!existingRole) {
      const { data: authData } = await supabase.auth.getUser()
      const { error: insertError } = await supabase.from('user_roles').insert({
        user_id: selectedTeacher,
        role_id: roleData.id,
        school_id: schoolId,
        assigned_by: authData?.user?.id ?? null,
      })

      if (insertError) {
        throw insertError
      }

      toast({
        title: 'Rôle enseignant ajouté',
        description: "Le rôle 'teacher' a été attribué au professeur sélectionné.",
      })
    }
  }

  const handleSubmit = async () => {
    if (!selectedTeacher) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un enseignant',
        variant: 'destructive',
      })
      return
    }

    if (!selectedYear) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner une année scolaire',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      await ensureTeacherRole()

      // Determine what to add and what to remove
      const toAdd: any[] = []
      const toRemove: string[] = []

      // Calculate added assignments
      selectedAssignments.forEach((key) => {
        if (!initialAssignments.has(key)) {
          const [classId, subjectId] = key.split('::')
          toAdd.push({
            schoolId,
            teacherId: selectedTeacher,
            classId,
            subjectId,
            academicYearId: selectedYear,
            hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
          })
        }
      })

      // Calculate removed assignments
      initialAssignments.forEach((id, key) => {
        if (!selectedAssignments.has(key)) {
          toRemove.push(id)
        }
      })

      if (toAdd.length === 0 && toRemove.length === 0) {
        // Even if no add/remove, update hourly rate on existing assignments if changed
        if (hourlyRate) {
          const sb = getSupabaseClient()
          const updatePromises = Array.from(initialAssignments.values()).map((id) =>
            sb
              .from('teacher_assignments')
              .update({ hourly_rate: Number(hourlyRate) })
              .eq('id', id)
          )
          await Promise.all(updatePromises)
          toast({
            title: 'Taux horaire mis à jour',
            description: `Taux de ${hourlyRate} FCFA/h enregistré pour toutes les affectations.`,
          })
        } else {
          toast({
            title: 'Aucun changement',
            description: "Aucune modification n'a été détectée.",
          })
        }
        setIsSubmitting(false)
        return
      }

      // Execute mutations
      const promises = []

      if (toAdd.length > 0) {
        promises.push(createBulkMutation.mutateAsync(toAdd))
      }

      if (toRemove.length > 0) {
        // Delete individually as there is no bulk delete yet
        const deletePromises = toRemove.map((id) => deleteMutation.mutateAsync(id))
        promises.push(Promise.all(deletePromises))
      }

      await Promise.all(promises)

      toast({
        title: 'Mise à jour réussie',
        description: `${toAdd.length} ajout(s), ${toRemove.length} suppression(s).`,
      })

      // State will update automatically via React Query invalidation
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Affectations professeurs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selection inputs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Enseignant *</Label>
            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un enseignant" />
              </SelectTrigger>
              <SelectContent className="bg-white text-slate-900 [&_*]:text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:[&_*]:text-slate-100">
                {teachers.length === 0 ? (
                  <SelectItem
                    value={NO_TEACHER_VALUE}
                    disabled
                    className="text-slate-500 dark:text-slate-400"
                  >
                    Aucun enseignant disponible
                  </SelectItem>
                ) : (
                  teachers.map((teacher: any) => (
                    <SelectItem
                      key={teacher.id}
                      value={teacher.id}
                      className="text-slate-900 dark:text-slate-100"
                    >
                      {(teacher.firstName || teacher.first_name || '').trim() ||
                        (teacher.lastName || teacher.last_name || '').trim() ||
                        teacher.email ||
                        'Enseignant'}
                      {(teacher.firstName || teacher.first_name) &&
                      (teacher.lastName || teacher.last_name)
                        ? ` ${teacher.lastName || teacher.last_name}`
                        : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Année scolaire *</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une année" />
              </SelectTrigger>
              <SelectContent className="bg-white text-slate-900 [&_*]:text-slate-900 dark:bg-slate-900 dark:text-slate-100 dark:[&_*]:text-slate-100">
                {years.map((year) => (
                  <SelectItem
                    key={year.id}
                    value={year.id}
                    className="text-slate-900 dark:text-slate-100"
                  >
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Taux horaire */}
          <div className="space-y-2">
            <Label>Taux horaire (FCFA/h)</Label>
            <Input
              type="number"
              min="0"
              step="500"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="Ex: 5000"
            />
            <p className="text-xs text-muted-foreground">
              Requis pour le calcul de la paie
            </p>
          </div>
        </div>

        {/* Assignments table */}
        {selectedTeacher && selectedYear && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Affectations</h3>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckSquare className="mr-2 h-4 w-4" />
                Enregistrer les modifications
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Filtrer les classes</Label>
                <Input
                  value={classFilter}
                  onChange={(event) => setClassFilter(event.target.value)}
                  placeholder="Ex: 6ème A"
                />
              </div>
              <div className="space-y-2">
                <Label>Filtrer les matières</Label>
                <Input
                  value={subjectFilter}
                  onChange={(event) => setSubjectFilter(event.target.value)}
                  placeholder="Ex: Maths, FRA..."
                />
              </div>
            </div>

            <div className="border rounded-lg">
              <div className="max-h-[420px] overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr className="border-b bg-gray-50 sticky top-0 z-10">
                        <th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 sticky left-0 z-20 bg-gray-50 border-r">
                          Classe
                        </th>
                        {filteredSubjects.map((subject: any) => (
                          <th
                            key={subject.id}
                            className="p-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 border-l md:p-3"
                          >
                            <div className="text-xs font-semibold text-slate-900 md:text-sm">
                              {subject.code || 'Matière'}
                            </div>
                            <div className="mt-1 text-[10px] font-normal text-slate-500 line-clamp-2 md:text-[11px]">
                              {subject.name}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClasses.map((classItem: any) => (
                        <tr key={classItem.id} className="border-b">
                          <td className="p-2 text-sm font-medium text-slate-900 md:p-3 sticky left-0 z-10 bg-white border-r">
                            {classItem.name}
                          </td>
                          {filteredSubjects.map((subject: any) => {
                            const key = assignmentKey(classItem.id, subject.id)
                            const isChecked = selectedAssignments.has(key)
                            return (
                              <td key={subject.id} className="p-3 text-center border-l">
                                <div className="flex items-center justify-center">
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() =>
                                      handleAssignmentToggle(classItem.id, subject.id)
                                    }
                                    aria-label={`Affecter ${subject.name} à ${classItem.name}`}
                                  />
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {(!filteredClasses || filteredClasses.length === 0) && (
              <p className="text-center text-gray-500 py-4">
                Aucune classe ne correspond au filtre.
              </p>
            )}

            {filteredClasses.length > 0 && filteredSubjects.length === 0 && (
              <p className="text-center text-gray-500 py-4">
                Aucune matière ne correspond au filtre.
              </p>
            )}
          </div>
        )}

        {!selectedTeacher && !selectedYear && (
          <div className="text-center text-gray-500 py-8">
            Veuillez sélectionner un enseignant et une année scolaire pour voir les affectations
          </div>
        )}
      </CardContent>
    </Card>
  )
}
