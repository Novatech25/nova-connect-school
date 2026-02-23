import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Send, MapPin, Users, Calendar } from 'lucide-react'
import { useRoomAssignmentsByDate, useCalculateRoomAssignments, usePublishRoomAssignments } from '@novaconnect/data'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function RoomAssignmentsAdminPage() {
  const params = useParams()
  const schoolId = params?.schoolId as string

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [capacityFilter, setCapacityFilter] = useState<string>('all')
  const [isCalculating, setIsCalculating] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data: assignments, isLoading, refetch } = useRoomAssignmentsByDate(schoolId, selectedDate)
  const calculateMutation = useCalculateRoomAssignments()
  const publishMutation = usePublishRoomAssignments()

  const handleCalculate = async () => {
    setIsCalculating(true)
    setAlert(null)

    try {
      const result = await calculateMutation.mutateAsync({
        schoolId,
        sessionDate: selectedDate,
      })

      if (result.error) {
        setAlert({ type: 'error', text: result.error })
      } else {
        setAlert({
          type: 'success',
          text: `Calculé: ${result.assignmentsCreated} créés, ${result.assignmentsUpdated} mis à jour`,
        })
        refetch()
      }
    } catch (error: any) {
      setAlert({ type: 'error', text: error.message || 'Erreur lors du calcul' })
    } finally {
      setIsCalculating(false)
    }
  }

  const handlePublish = async () => {
    setIsPublishing(true)
    setAlert(null)

    try {
      const result = await publishMutation.mutateAsync({
        schoolId,
        sessionDate: selectedDate,
      })

      if (result.error) {
        setAlert({ type: 'error', text: result.error })
      } else {
        setAlert({
          type: 'success',
          text: `Publié: ${result.published} affectations, ${result.notificationsSent} notifications envoyées`,
        })
        refetch()
      }
    } catch (error: any) {
      setAlert({ type: 'error', text: error.message || 'Erreur lors de la publication' })
    } finally {
      setIsPublishing(false)
    }
  }

  // Filter assignments
  const filteredAssignments = assignments?.filter((assignment) => {
    if (statusFilter !== 'all' && assignment.status !== statusFilter) return false
    if (capacityFilter !== 'all' && assignment.capacity_status !== capacityFilter) return false
    return true
  }) || []

  const draftCount = assignments?.filter(a => a.status === 'draft').length || 0
  const insufficientCount = assignments?.filter(a => a.capacity_status === 'insufficient').length || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MapPin className="h-8 w-8" />
          Affectations de Salles
        </h1>
        <p className="text-muted-foreground mt-2">
          Gérez les affectations automatiques de salles pour les cours
        </p>
      </div>

      {/* Alert */}
      {alert && (
        <Alert variant={alert.type === 'success' ? 'default' : 'destructive'}>
          {alert.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>{alert.text}</AlertDescription>
        </Alert>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Contrôles</CardTitle>
          <CardDescription>Sélectionnez une date et filtrez les affectations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Date</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium mb-2 block">Statut</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="published">Publié</SelectItem>
                  <SelectItem value="updated">Mis à jour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium mb-2 block">Capacité</label>
              <Select value={capacityFilter} onValueChange={setCapacityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="optimal">Optimale</SelectItem>
                  <SelectItem value="sufficient">Suffisante</SelectItem>
                  <SelectItem value="insufficient">Insuffisante</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 items-end">
              <Button
                onClick={handleCalculate}
                disabled={isCalculating}
                variant="outline"
              >
                {isCalculating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <RefreshCw className="h-4 w-4 mr-2" />
                Calculer
              </Button>

              <Button
                onClick={handlePublish}
                disabled={isPublishing || draftCount === 0}
              >
                {isPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="h-4 w-4 mr-2" />
                Publier
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Affectations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredAssignments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">En attente de publication</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              Capacité insuffisante
              {insufficientCount > 0 && <AlertTriangle className="h-4 w-4 text-amber-500" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insufficientCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Assignments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Affectations pour le {format(new Date(selectedDate), 'dd MMMM yyyy', { locale: fr })}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune affectation trouvée pour cette date</p>
              <p className="text-sm mt-2">Cliquez sur "Calculer" pour générer les affectations</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Heure</TableHead>
                  <TableHead>Professeur</TableHead>
                  <TableHead>Matière</TableHead>
                  <TableHead>Classes</TableHead>
                  <TableHead>Effectif</TableHead>
                  <TableHead>Salle</TableHead>
                  <TableHead>Capacité</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">
                      {assignment.startTime} - {assignment.endTime}
                    </TableCell>
                    <TableCell>
                      {assignment.teacher?.first_name} {assignment.teacher?.last_name}
                    </TableCell>
                    <TableCell>{assignment.subject?.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {assignment.grouped_class_ids?.slice(0, 3).map((classId) => (
                          <Badge key={classId} variant="outline" className="text-xs">
                            {classId.slice(0, 8)}
                          </Badge>
                        ))}
                        {assignment.grouped_class_ids?.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{assignment.grouped_class_ids.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {assignment.total_students}
                      </div>
                    </TableCell>
                    <TableCell>
                      {assignment.assigned_room ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-blue-500" />
                          <span>{assignment.assigned_room.name}</span>
                          {assignment.assigned_room.code && (
                            <Badge variant="outline">{assignment.assigned_room.code}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Non assignée</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {assignment.capacity_status === 'optimal' && (
                        <Badge className="bg-green-500">Optimale</Badge>
                      )}
                      {assignment.capacity_status === 'sufficient' && (
                        <Badge className="bg-blue-500">Suffisante</Badge>
                      )}
                      {assignment.capacity_status === 'insufficient' && (
                        <Badge variant="destructive">Insuffisante</Badge>
                      )}
                      {assignment.capacity_margin_percent !== null && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {assignment.capacity_margin_percent.toFixed(1)}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={assignment.status === 'published' ? 'default' : 'secondary'}
                      >
                        {assignment.status === 'draft' && 'Brouillon'}
                        {assignment.status === 'published' && 'Publié'}
                        {assignment.status === 'updated' && 'Mis à jour'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
