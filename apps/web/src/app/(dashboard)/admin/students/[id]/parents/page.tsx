'use client'

import { use } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Mail, Phone, Users, Loader2, Activity, RefreshCw } from 'lucide-react'
import {
  useCreateParent,
  useCreateStudentParentRelation,
  useDeleteStudentParentRelation,
  useParentsByStudent,
  useStudent,
  useCreateCompleteParent,
} from '@novaconnect/data'
import { useAuthContext } from '@novaconnect/data/providers'
import { createParentSchema, type CreateParent } from '@novaconnect/core'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function StudentParentsPage({ params }: PageProps) {
  const { id: studentId } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { profile, user } = useAuthContext()
  const schoolId =
    profile?.school?.id ||
    profile?.school_id ||
    user?.schoolId ||
    (user as any)?.school_id ||
    ''

  const { data: student, isLoading: isStudentLoading } = useStudent(studentId)
  const { data: parents = [], isLoading: isParentsLoading } = useParentsByStudent(studentId)

  const createParentMutation = useCreateParent()
  const createRelationMutation = useCreateStudentParentRelation()
  const deleteRelationMutation = useDeleteStudentParentRelation()
  const createCompleteParentMutation = useCreateCompleteParent()

  const [showAddForm, setShowAddForm] = useState(false)
  const [createAccount, setCreateAccount] = useState(true)
  const [diagnosticParent, setDiagnosticParent] = useState<any>(null)
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false)
  const [resetPasswordEmail, setResetPasswordEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const form = useForm<CreateParent & { password?: string }>({
    resolver: zodResolver(createParentSchema),
    defaultValues: {
      schoolId,
      firstName: '',
      lastName: '',
      relationship: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      occupation: '',
      workplace: '',
      isPrimaryContact: false,
      isEmergencyContact: false,
      password: '',
    },
  })

  const handleSubmit = async (data: CreateParent & { password?: string }) => {
    if (!student) return

    // Password is required for parent to login
    if (!data.password) {
      toast({
        title: 'Mot de passe requis',
        description: 'Un mot de passe est requis pour creer le compte parent.',
        variant: 'destructive',
      })
      return
    }

    try {
      // Always create complete account with password
      console.log('[Admin Parents] Creating complete parent account for:', data.email)

      const result = await createCompleteParentMutation.mutateAsync({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        schoolId,
        studentId: student.id,
        relationship: data.relationship,
        phone: data.phone,
        address: data.address,
        city: data.city,
        occupation: data.occupation,
        workplace: data.workplace,
        isPrimaryContact: Boolean(data.isPrimaryContact),
        isEmergencyContact: Boolean(data.isEmergencyContact),
      })

      console.log('[Admin Parents] Parent account creation result:', result)

      toast({
        title: 'Compte parent cree',
        description: `Le parent ${data.firstName} ${data.lastName} peut maintenant se connecter avec ${data.email}. Relation ID: ${result.data?.relationId}`,
      })

      form.reset({
        schoolId,
        firstName: '',
        lastName: '',
        relationship: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        occupation: '',
        workplace: '',
        isPrimaryContact: false,
        isEmergencyContact: false,
        password: '',
      })
      setCreateAccount(true)
      setShowAddForm(false)
      await queryClient.invalidateQueries({
        queryKey: ['parents', 'student', studentId],
      })
    } catch (error: any) {
      console.error('[Admin Parents] Error creating parent:', error)

      toast({
        title: 'Erreur lors de la creation',
        description: error?.message || error?.details || "Impossible d'ajouter le parent.",
        variant: 'destructive',
      })
    }
  }

  const handleDeleteRelation = async (relationId: string) => {
    if (!confirm("Supprimer ce parent ?")) return

    try {
      await deleteRelationMutation.mutateAsync(relationId)
      await queryClient.invalidateQueries({
        queryKey: ['parents', 'student', studentId],
      })
      toast({
        title: "Relation supprimee",
        description: "Le parent a ete retire.",
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error?.message || 'Impossible de supprimer la relation.',
        variant: 'destructive',
      })
    }
  }

  const handleRunDiagnostic = async (parentEmail: string) => {
    try {
      const response = await fetch(`/api/parents/diagnostic?email=${encodeURIComponent(parentEmail)}`)
      const data = await response.json()
      setDiagnosticParent(data)
      setShowDiagnosticModal(true)
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error?.message || 'Impossible de recuperer le diagnostic',
        variant: 'destructive',
      })
    }
  }

  const handleResetPassword = async () => {
    setResetLoading(true)
    try {
      const response = await fetch('/api/parents/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: resetPasswordEmail,
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      toast({
        title: 'Mot de passe reinitialise',
        description: `Le mot de passe a ete reinitialise avec succes pour ${resetPasswordEmail}`,
      })

      setResetPasswordEmail('')
      setNewPassword('')
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error?.message || 'Impossible de reinitialiser le mot de passe',
        variant: 'destructive',
      })
    } finally {
      setResetLoading(false)
    }
  }

  if (isStudentLoading || isParentsLoading) {
    return (
      <div className="min-h-full flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!student) {
    return (
      <div className="min-h-full flex items-center justify-center py-16">
        <p className="text-muted-foreground">Eleve introuvable.</p>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Parents & tuteurs</h1>
              <p className="text-muted-foreground mt-1">
                {student.firstName} {student.lastName}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/admin/students/${student.id}/edit`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
            <Button onClick={() => setShowAddForm((prev) => !prev)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un parent
            </Button>
          </div>
        </div>

        <Card className="border-border/60 bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle>Parents associes</CardTitle>
            <CardDescription>Gerez les contacts du foyer.</CardDescription>
          </CardHeader>
          <CardContent>
            {parents.length === 0 ? (
              <p className="text-muted-foreground">Aucun parent associe.</p>
            ) : (
              <ScrollArea className="max-h-[360px] pr-2">
                <div className="space-y-3">
                  {parents.map((relation: any) => (
                    <div key={relation.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">
                              {relation.parent?.firstName} {relation.parent?.lastName}
                            </p>
                            {relation.parent?.isPrimaryContact && (
                              <Badge variant="secondary">Principal</Badge>
                            )}
                            {relation.parent?.isEmergencyContact && (
                              <Badge variant="destructive">Urgence</Badge>
                            )}
                          </div>
                          {relation.relationship && (
                            <p className="text-sm text-muted-foreground">
                              {relation.relationship}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRunDiagnostic(relation.parent?.email)}
                            title="Diagnostiquer le compte"
                          >
                            <Activity className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRelation(relation.id)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {relation.parent?.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            {relation.parent.phone}
                          </div>
                        )}
                        {relation.parent?.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {relation.parent.email}
                          </div>
                        )}
                      </div>

                      {(relation.parent?.occupation || relation.parent?.workplace) && (
                        <p className="mt-2 text-sm">
                          <span className="font-medium">Profession:</span>{' '}
                          {relation.parent.occupation || '?'}
                          {relation.parent.workplace ? ` @ ${relation.parent.workplace}` : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {showAddForm && (
          <Card className="border-border/60 bg-white/80 shadow-sm">
            <CardHeader>
              <CardTitle>Ajouter un parent</CardTitle>
              <CardDescription>
                Renseignez les informations du parent.
                Un compte sera toujours cree avec mot de passe pour permettre la connexion.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="schoolId"
                    render={({ field }) => (
                      <FormItem className="hidden">
                        <FormControl>
                          <Input type="hidden" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prenom *</FormLabel>
                          <FormControl>
                            <Input placeholder="Marie" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom *</FormLabel>
                          <FormControl>
                            <Input placeholder="Diallo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="relationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lien</FormLabel>
                          <FormControl>
                            <Input placeholder="Pere, mere, tuteur" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telephone *</FormLabel>
                          <FormControl>
                            <Input placeholder="+222 12 34 56 78" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="parent@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ville</FormLabel>
                          <FormControl>
                            <Input placeholder="Nouakchott" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mot de passe *</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="MotPasse123!"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1">
                              Le parent pourra changer ce mot de passe apres connexion
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresse</FormLabel>
                        <FormControl>
                          <Input placeholder="Adresse" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="occupation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profession</FormLabel>
                          <FormControl>
                            <Input placeholder="Profession" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="workplace"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Entreprise</FormLabel>
                          <FormControl>
                            <Input placeholder="Entreprise" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <FormField
                      control={form.control}
                      name="isPrimaryContact"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel>Contact principal</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isEmergencyContact"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel>Contact d'urgence</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      disabled={createParentMutation.isPending || createCompleteParentMutation.isPending}
                    >
                      {(createParentMutation.isPending || createCompleteParentMutation.isPending)
                        ? 'Creation en cours...'
                        : 'Creer le compte'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {showDiagnosticModal && diagnosticParent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Diagnostic Compte Parent</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setShowDiagnosticModal(false)}>
                    x
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`p-4 rounded ${
                  diagnosticParent.status === 'ok' ? 'bg-green-50' :
                  diagnosticParent.status === 'warning' ? 'bg-yellow-50' : 'bg-red-50'
                }`}>
                  <p className="font-medium">Statut: {diagnosticParent.status.toUpperCase()}</p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Recommandations:</h3>
                  {diagnosticParent.recommendations.map((rec: string, i: number) => (
                    <p key={i} className="text-sm">{rec}</p>
                  ))}
                </div>

                {diagnosticParent.authUser && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Compte Auth:</h3>
                    <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(diagnosticParent.authUser, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Input
                    placeholder="Email du parent"
                    value={resetPasswordEmail}
                    onChange={(e) => setResetPasswordEmail(e.target.value)}
                  />
                  <Input
                    type="password"
                    placeholder="Nouveau mot de passe"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    onClick={handleResetPassword}
                    disabled={resetLoading || !resetPasswordEmail || !newPassword}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {resetLoading ? '...' : 'Reinitialiser'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
