'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ExamSessionsTable } from './components/ExamSessionsTable';
import { CreateExamSessionDialog } from './components/CreateExamSessionDialog';
import { PlusCircle } from 'lucide-react';

export default function ExamsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Examens</h1>
          <p className="text-muted-foreground">
            Planification et gestion des sessions d'examen
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nouvelle Session
        </Button>
      </div>

      <Card className="p-6">
        <ExamSessionsTable />
      </Card>

      <CreateExamSessionDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
