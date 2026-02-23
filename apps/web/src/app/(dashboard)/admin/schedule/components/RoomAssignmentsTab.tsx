'use client';

import { useState } from 'react';
import {
  useRoomAssignmentsByDate,
  usePublishRoomAssignments,
  useSendRoomAssignmentNotifications,
  useSchoolSettings,
} from '@novaconnect/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Building2,
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  Send,
  Bell,
  Loader2,
  MapPin,
  Info,
} from 'lucide-react';

interface RoomAssignmentsTabProps {
  schoolId: string;
  scheduleId?: string;
}

export function RoomAssignmentsTab({ schoolId, scheduleId }: RoomAssignmentsTabProps) {
  const { toast } = useToast();
  const { data: settings } = useSchoolSettings(schoolId);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: assignments = [], isLoading, refetch } = useRoomAssignmentsByDate(
    schoolId,
    selectedDate
  );

  const publishMutation = usePublishRoomAssignments();
  const notifyMutation = useSendRoomAssignmentNotifications();

  const isEnabled = settings?.dynamicRoomAssignment?.enabled;

  // Filter assignments for this schedule if provided
  const filteredAssignments = scheduleId
    ? assignments.filter((a: any) => {
        // Check if any slot in the assignment belongs to this schedule
        // This is a simplified check - you might need to adjust based on your data structure
        return true; // For now, show all
      })
    : assignments;

  const handlePublish = async () => {
    try {
      const result = await publishMutation.mutateAsync({
        schoolId,
        sessionDate: selectedDate,
      });

      if (result.success) {
        toast({
          title: 'Attributions publiées',
          description: `${result.published} attributions publiées, ${result.notificationsSent} notifications envoyées.`,
        });
        refetch();
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de publier les attributions',
        variant: 'destructive',
      });
    }
  };

  const handleSendReminders = async (window: 60 | 15) => {
    try {
      const result = await notifyMutation.mutateAsync({
        notificationWindow: window,
        sessionDate: selectedDate,
      });

      if (result.success) {
        toast({
          title: 'Rappels envoyés',
          description: `${result.notificationsSent} notifications T-${window} envoyées.`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'envoyer les rappels',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500"><CheckCircle2 className="mr-1 h-3 w-3" /> Publié</Badge>;
      case 'draft':
        return <Badge variant="secondary">Brouillon</Badge>;
      case 'updated':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Mis à jour</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Annulé</Badge>;
      default:
        return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  const getCapacityBadge = (status?: string) => {
    switch (status) {
      case 'optimal':
        return <Badge className="bg-green-500">Optimal</Badge>;
      case 'sufficient':
        return <Badge variant="secondary">Suffisant</Badge>;
      case 'insufficient':
        return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" /> Insuffisant</Badge>;
      default:
        return null;
    }
  };

  if (!isEnabled) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Le module d&apos;attribution automatique des salles n&apos;est pas activé.
          Activez-le dans Paramètres → Attrib. Salles pour utiliser cette fonctionnalité.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with date selection */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Attributions de salles
              </CardTitle>
              <CardDescription>
                Gérez les attributions de salles pour les cours
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label htmlFor="assignmentDate" className="text-sm">
                  Date
                </Label>
                <Input
                  id="assignmentDate"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-auto"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handlePublish}
              disabled={publishMutation.isPending || filteredAssignments.length === 0}
            >
              {publishMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Publier
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSendReminders(60)}
              disabled={notifyMutation.isPending}
            >
              <Bell className="mr-2 h-4 w-4" />
              Rappel T-60
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSendReminders(15)}
              disabled={notifyMutation.isPending}
            >
              <Bell className="mr-2 h-4 w-4" />
              Rappel T-15
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {filteredAssignments.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredAssignments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Publiés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {filteredAssignments.filter((a: any) => a.status === 'published').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Brouillons</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredAssignments.filter((a: any) => a.status === 'draft').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">Insuffisants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {filteredAssignments.filter((a: any) => a.capacity_status === 'insufficient').length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assignments List */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des attributions</CardTitle>
          <CardDescription>
            {format(parseISO(selectedDate), 'EEEE d MMMM yyyy', { locale: fr })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Aucune attribution trouvée pour cette date.</p>
              <p className="text-sm">
                Utilisez le bouton &quot;Calculer les attributions&quot; pour en créer.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAssignments.map((assignment: any) => (
                <div
                  key={assignment.id}
                  className={`rounded-lg border p-4 ${
                    assignment.capacity_status === 'insufficient'
                      ? 'border-red-200 bg-red-50'
                      : 'bg-white'
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Left: Time and Subject */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {assignment.start_time} - {assignment.end_time}
                        </span>
                        {getStatusBadge(assignment.status)}
                      </div>
                      <div className="text-lg font-semibold">
                        {assignment.subject?.name || 'Matière inconnue'}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        Prof: {assignment.teacher?.first_name} {assignment.teacher?.last_name}
                      </div>
                    </div>

                    {/* Middle: Classes and Students */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {assignment.total_students} élèves
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {assignment.grouped_class_ids?.length || 0} classe(s) regroupée(s)
                      </div>
                    </div>

                    {/* Right: Room */}
                    <div className="space-y-1 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {assignment.assigned_room?.name || 'Non assignée'}
                        </span>
                      </div>
                      {assignment.assigned_room?.code && (
                        <div className="text-sm text-muted-foreground">
                          Code: {assignment.assigned_room.code}
                        </div>
                      )}
                      {assignment.assigned_room?.capacity && (
                        <div className="text-sm text-muted-foreground">
                          Capacité: {assignment.assigned_room.capacity}
                        </div>
                      )}
                      <div className="pt-1">
                        {getCapacityBadge(assignment.capacity_status)}
                      </div>
                    </div>
                  </div>

                  {assignment.capacity_status === 'insufficient' && (
                    <div className="mt-3 flex items-center gap-2 rounded-md bg-red-100 p-2 text-sm text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      <span>
                        Capacité insuffisante : {assignment.total_students} élèves pour{' '}
                        {assignment.assigned_room?.capacity || 0} places
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
