'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScheduleSlot, getScheduleStats, calculateTeacherWeeklyHours, calculateClassWeeklyHours, groupSlotsByTeacher, groupSlotsByClass } from '@novaconnect/core';
import { useUsers, useClasses, useRooms } from '@novaconnect/data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface ScheduleStatsProps {
  scheduleId: string;
  slots: ScheduleSlot[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function ScheduleStats({ scheduleId, slots }: ScheduleStatsProps) {
  // Fetch related data
  const { data: teachers } = useUsers();
  const { data: classes } = useClasses();
  const { data: rooms } = useRooms();

  // Get unique teacher IDs and class IDs
  const uniqueTeacherIds = useMemo(() => {
    return Array.from(new Set(slots.map((s) => s.teacherId)));
  }, [slots]);

  const uniqueClassIds = useMemo(() => {
    return Array.from(new Set(slots.map((s) => s.classId)));
  }, [slots]);

  // Calculate statistics (need schedule object, but we'll use scheduleId to create a minimal one)
  const stats = useMemo(() => {
    const minimalSchedule = {
      id: scheduleId,
      schoolId: '',
      name: '',
      description: '',
      status: 'draft' as const,
      version: 1,
      academicYearId: '',
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    };
    return getScheduleStats(minimalSchedule, slots);
  }, [scheduleId, slots]);

  // Helper to get display name
  const getTeacherName = (t: any) => {
    if (!t) return 'Inconnu';
    const meta = t.raw_user_meta_data || (t as any).metadata || {};
    const firstName = meta.first_name || meta.firstName || t.firstName || (t as any).first_name;
    const lastName = meta.last_name || meta.lastName || t.lastName || (t as any).last_name;
    
    if (firstName && lastName) return `${firstName} ${lastName}`;
    return firstName || lastName || t.email || 'Professeur sans nom';
  };

  // Teacher hours
  const teacherHours = useMemo(() => {
    return uniqueTeacherIds.map((teacherId) => {
      const hours = calculateTeacherWeeklyHours(teacherId, slots);
      const teacher = teachers?.find((t) => t.id === teacherId);
      return {
        name: teacher ? getTeacherName(teacher) : teacherId,
        hours,
        sessions: slots.filter((s) => s.teacherId === teacherId).length,
      };
    }).sort((a, b) => b.hours - a.hours);
  }, [slots, teachers, uniqueTeacherIds]);

  // Class hours
  const classHours = useMemo(() => {
    return uniqueClassIds.map((classId) => {
      const hours = calculateClassWeeklyHours(classId, slots);
      const classItem = classes?.find((c) => c.id === classId);
      return {
        name: classItem?.name || classId,
        hours,
        sessions: slots.filter((s) => s.classId === classId).length,
      };
    }).sort((a, b) => b.hours - a.hours);
  }, [slots, classes, uniqueClassIds]);

  // Room utilization
  const roomUtilization = useMemo(() => {
    const utilization = new Map<string, number>();
    slots.forEach((slot) => {
      if (slot.roomId) {
        utilization.set(slot.roomId, (utilization.get(slot.roomId) || 0) + 1);
      }
    });

    return Array.from(utilization.entries()).map(([roomId, count]) => {
      const room = rooms?.find((r) => r.id === roomId);
      return {
        name: room?.name || roomId,
        sessions: count,
        capacity: room?.capacity || 0,
      };
    }).sort((a, b) => b.sessions - a.sessions);
  }, [slots, rooms]);

  // Day distribution
  const dayDistribution = useMemo(() => {
    const distribution = new Map<string, number>();
    const dayLabels: Record<string, string> = {
      monday: 'Lundi',
      tuesday: 'Mardi',
      wednesday: 'Mercredi',
      thursday: 'Jeudi',
      friday: 'Vendredi',
      saturday: 'Samedi',
    };

    slots.forEach((slot) => {
      const label = dayLabels[slot.dayOfWeek] || slot.dayOfWeek;
      distribution.set(label, (distribution.get(label) || 0) + 1);
    });

    return Array.from(distribution.entries()).map(([day, count]) => ({
      day,
      sessions: count,
    }));
  }, [slots]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Statistiques de l'emploi du temps</h2>
        <p className="text-sm text-muted-foreground">
          Vue d'ensemble des métriques et de l'occupation
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total créneaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSlots}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total heures hebdomadaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWeeklyHours.toFixed(1)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Professeurs impliqués
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTeachers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Classes concernées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClasses}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teacher hours chart */}
        <Card>
          <CardHeader>
            <CardTitle>Heures par professeur</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={teacherHours.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="hours" fill="#8884d8" name="Heures" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Class hours chart */}
        <Card>
          <CardHeader>
            <CardTitle>Heures par classe</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={classHours.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="hours" fill="#82ca9d" name="Heures" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Day distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par jour</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dayDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sessions" fill="#ffc658" name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Room utilization */}
        <Card>
          <CardHeader>
            <CardTitle>Occupation des salles</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={roomUtilization.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sessions" fill="#ff7300" name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top teachers */}
        <Card>
          <CardHeader>
            <CardTitle>Top professeurs (par heures)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {teacherHours.slice(0, 5).map((teacher, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <span className="font-medium">{teacher.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{teacher.hours.toFixed(1)}h</div>
                    <div className="text-xs text-muted-foreground">{teacher.sessions} créneaux</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top classes */}
        <Card>
          <CardHeader>
            <CardTitle>Top classes (par heures)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {classHours.slice(0, 5).map((classItem, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <span className="font-medium">{classItem.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{classItem.hours.toFixed(1)}h</div>
                    <div className="text-xs text-muted-foreground">{classItem.sessions} créneaux</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
