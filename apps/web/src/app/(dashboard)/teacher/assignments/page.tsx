'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter } from 'lucide-react';
import { AssignmentsList } from '@/components/teacher/assignments/assignments-list';
import { useAuthContext } from '@novaconnect/data';

export default function TeacherAssignmentsPage() {
  const { profile } = useAuthContext();

  if (!profile) {
    return null;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Devoirs</h1>
          <p className="text-muted-foreground">
            Gérez les devoirs et suivez les soumissions des élèves
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Créer un devoir
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mes devoirs</CardTitle>
              <CardDescription>
                Liste de tous les devoirs créés
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filtrer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <AssignmentsList teacherId={teacherId} schoolId={schoolId} />
        </CardContent>
      </Card>
    </div>
  );
}
