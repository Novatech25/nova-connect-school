'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, MapPin, Users, Building2, Calendar, Settings, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { campusQueries, campusStatisticsQueries } from '@novaconnect/data';
import { getSupabaseClient } from '@novaconnect/data/client';
import Link from 'next/link';

export default function CampusDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const campusId = params.id as string;

  // Fetch campus details
  const { data: campus, isLoading: campusLoading } = useQuery(
    campusQueries.getById(campusId)
  );

  // Fetch campus statistics
  const { data: stats } = useQuery(
    campusStatisticsQueries.getStats(campusId)
  );

  if (campusLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </div>
        <div className="text-center py-8">Chargement...</div>
      </div>
    );
  }

  if (!campus) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </div>
        <Card>
          <CardContent className="text-center py-8">
            Campus non trouvé
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{campus.name}</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Badge variant="outline">{campus.code}</Badge>
              {campus.is_main && <Badge variant="default">Campus Principal</Badge>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/campuses/${campus.id}/access`}>
              <Users className="mr-2 h-4 w-4" />
              Gérer les accès
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/campuses/${campus.id}/edit`}>
              <Settings className="mr-2 h-4 w-4" />
              Modifier
            </Link>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.classes || 0}</div>
            <p className="text-xs text-muted-foreground">sur ce campus</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salles</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.rooms || 0}</div>
            <p className="text-xs text-muted-foreground">disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Professeurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.teachers || 0}</div>
            <p className="text-xs text-muted-foreground">ayant accès</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Étudiants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.students || 0}</div>
            <p className="text-xs text-muted-foreground">inscrits</p>
          </CardContent>
        </Card>
      </div>

      {/* Campus Information */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du Campus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Adresse</p>
              <p className="mt-1">{campus.address || 'Non renseignée'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ville</p>
              <p className="mt-1">{campus.city || 'Non renseignée'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Coordonnées GPS</p>
              <p className="mt-1 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {campus.latitude && campus.longitude ? (
                  <span>
                    {campus.latitude.toFixed(6)}, {campus.longitude.toFixed(6)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Non configuré</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Rayon de validation</p>
              <p className="mt-1">{campus.radius_meters || 200} mètres</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="classes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="classes">
            <Building2 className="mr-2 h-4 w-4" />
            Classes
          </TabsTrigger>
          <TabsTrigger value="teachers">
            <Users className="mr-2 h-4 w-4" />
            Professeurs
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <Calendar className="mr-2 h-4 w-4" />
            Emploi du temps
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="mr-2 h-4 w-4" />
            Rapports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="classes">
          <Card>
            <CardHeader>
              <CardTitle>Classes sur ce campus</CardTitle>
            </CardHeader>
            <CardContent>
              <ClassesList campusId={campusId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teachers">
          <Card>
            <CardHeader>
              <CardTitle>Professeurs avec accès</CardTitle>
            </CardHeader>
            <CardContent>
              <TeachersList campusId={campusId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle>Séances prévues</CardTitle>
            </CardHeader>
            <CardContent>
              <ScheduleList campusId={campusId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Rapports du campus</CardTitle>
            </CardHeader>
            <CardContent>
              <CampusReports campusId={campusId} schoolId={campus.school_id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Component: Classes List
function ClassesList({ campusId }: { campusId: string }) {
  const { data: classes, isLoading } = useQuery({
    queryKey: ['campus_classes', campusId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('campus_id', campusId);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-center py-4">Chargement...</div>;
  if (!classes || classes.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">Aucune classe sur ce campus</div>;
  }

  return (
    <div className="space-y-2">
      {classes.map((cls: any) => (
        <div key={cls.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <p className="font-medium">{cls.name}</p>
            <p className="text-sm text-muted-foreground">{cls.level}</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/classes/${cls.id}`}>Voir</Link>
          </Button>
        </div>
      ))}
    </div>
  );
}

// Component: Teachers List
function TeachersList({ campusId }: { campusId: string }) {
  const { data: teachers, isLoading } = useQuery({
    queryKey: ['campus_teachers', campusId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_campus_access')
        .select(`
          *,
          user:users(id, first_name, last_name, email)
        `)
        .eq('campus_id', campusId)
        .eq('can_access', true);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-center py-4">Chargement...</div>;
  if (!teachers || teachers.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Aucun professeur avec accès à ce campus
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {teachers.map((access: any) => (
        <div key={access.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <p className="font-medium">
              {access.user?.first_name} {access.user?.last_name}
            </p>
            <p className="text-sm text-muted-foreground">{access.user?.email}</p>
          </div>
          <Badge variant="outline">{access.access_type}</Badge>
        </div>
      ))}
    </div>
  );
}

// Component: Schedule List
function ScheduleList({ campusId }: { campusId: string }) {
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['campus_schedule', campusId, startDate],
    queryFn: async () => {
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { data, error } = await supabase
        .from('planned_sessions')
        .select(`
          *,
          class:classes(name),
          teacher:users(first_name, last_name),
          subject:subjects(name),
          room:rooms(name)
        `)
        .eq('campus_id', campusId)
        .gte('session_date', startDate)
        .lte('session_date', endDate)
        .order('session_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Date de début</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-4">Chargement...</div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">
          Aucune séance prévue pour cette période
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.slice(0, 10).map((session: any) => (
            <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">{session.subject?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {session.class?.name} • {session.teacher?.first_name} {session.teacher?.last_name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{session.session_date}</p>
                <p className="text-xs text-muted-foreground">
                  {session.start_time} - {session.end_time}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Component: Campus Reports
function CampusReports({ campusId, schoolId }: { campusId: string; schoolId: string }) {
  const [reportType, setReportType] = useState<'attendance' | 'grades' | 'payments'>('attendance');
  const [generating, setGenerating] = useState(false);

  const generateReport = async () => {
    setGenerating(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('generate-campus-report', {
        body: {
          schoolId,
          campusId,
          reportType,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
        },
      });

      if (error) throw error;
      console.log('Report generated:', data);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant={reportType === 'attendance' ? 'default' : 'outline'}
          onClick={() => setReportType('attendance')}
        >
          Présences
        </Button>
        <Button
          variant={reportType === 'grades' ? 'default' : 'outline'}
          onClick={() => setReportType('grades')}
        >
          Notes
        </Button>
        <Button
          variant={reportType === 'payments' ? 'default' : 'outline'}
          onClick={() => setReportType('payments')}
        >
          Paiements
        </Button>
      </div>

      <Button
        className="w-full"
        onClick={generateReport}
        disabled={generating}
      >
        {generating ? 'Génération...' : 'Générer le rapport'}
      </Button>

      <p className="text-sm text-muted-foreground text-center">
        Rapport des 30 derniers jours
      </p>
    </div>
  );
}
