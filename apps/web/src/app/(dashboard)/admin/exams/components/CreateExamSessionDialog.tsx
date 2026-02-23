'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCreateExamSession } from '@novaconnect/data';
import { userQueries, academicYearQueries, periodQueries } from '@novaconnect/data';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

interface CreateExamSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateExamSessionDialog({
  open,
  onOpenChange,
}: CreateExamSessionDialogProps) {
  // Fetch current user and school context
  const { data: currentUser } = useQuery(userQueries.getCurrent());
  const { data: currentAcademicYear } = useQuery({
    ...academicYearQueries.getCurrent(currentUser?.school_id || ''),
    enabled: !!currentUser?.school_id,
  });
  const { data: periods } = useQuery({
    ...periodQueries.getAll(currentUser?.school_id || '', currentAcademicYear?.id || ''),
    enabled: !!currentUser?.school_id && !!currentAcademicYear?.id,
  });

  const [formData, setFormData] = useState({
    name: '',
    exam_type: '',
    description: '',
    start_date: '',
    end_date: '',
    academic_year_id: currentAcademicYear?.id || '',
    period_id: '',
    requires_jury: true,
    requires_deliberation: true,
    requires_official_minutes: true,
  });

  // Update academic_year_id when currentAcademicYear loads
  useEffect(() => {
    if (currentAcademicYear?.id && !formData.academic_year_id) {
      setFormData(prev => ({ ...prev, academic_year_id: currentAcademicYear.id }));
    }
  }, [currentAcademicYear?.id]);

  const { mutate: createSession, isPending } = useCreateExamSession();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser?.school_id || !formData.academic_year_id) {
      alert('Contexte scolaire manquant. Veuillez réessayer.');
      return;
    }

    createSession(
      {
        name: formData.name,
        exam_type: formData.exam_type as any,
        description: formData.description || undefined,
        start_date: new Date(formData.start_date),
        end_date: new Date(formData.end_date),
        school_id: currentUser.school_id,
        academic_year_id: formData.academic_year_id,
        period_id: formData.period_id || null,
        requires_jury: formData.requires_jury,
        requires_deliberation: formData.requires_deliberation,
        requires_official_minutes: formData.requires_official_minutes,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setFormData({
            name: '',
            exam_type: '',
            description: '',
            start_date: '',
            end_date: '',
            academic_year_id: currentAcademicYear?.id || '',
            period_id: '',
            requires_jury: true,
            requires_deliberation: true,
            requires_official_minutes: true,
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une session d'examen</DialogTitle>
          <DialogDescription>
            Configurez une nouvelle session d'examen avec toutes les options nécessaires.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Academic Context */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="academic_year_id">Année académique *</Label>
              <Select
                value={formData.academic_year_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, academic_year_id: value, period_id: '' })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner l'année académique" />
                </SelectTrigger>
                <SelectContent>
                  {currentAcademicYear && (
                    <SelectItem value={currentAcademicYear.id}>
                      {currentAcademicYear.name}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="period_id">Période (optionnelle)</Label>
              <Select
                value={formData.period_id || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, period_id: value === 'none' ? '' : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner la période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune période</SelectItem>
                  {periods?.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nom de la session *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Examen de fin de semestre 1"
                required
              />
            </div>

            <div>
              <Label htmlFor="exam_type">Type d'examen *</Label>
              <Select
                value={formData.exam_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, exam_type: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="composition">Composition</SelectItem>
                  <SelectItem value="exam">Examen</SelectItem>
                  <SelectItem value="final_exam">Examen final</SelectItem>
                  <SelectItem value="certification">Certification</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Description détaillée de la session d'examen..."
                rows={3}
              />
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="start_date">Date de début *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="end_date">Date de fin *</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
                required
              />
            </div>
          </div>

          {/* Configuration */}
          <div className="space-y-4">
            <Label>Configuration</Label>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires_jury"
                checked={formData.requires_jury}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    requires_jury: checked as boolean,
                  })
                }
              />
              <Label htmlFor="requires_jury">Requiert un jury</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires_deliberation"
                checked={formData.requires_deliberation}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    requires_deliberation: checked as boolean,
                  })
                }
              />
              <Label htmlFor="requires_deliberation">
                Requiert une délibération
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires_official_minutes"
                checked={formData.requires_official_minutes}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    requires_official_minutes: checked as boolean,
                  })
                }
              />
              <Label htmlFor="requires_official_minutes">
                Requiert des procès-verbaux officiels
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer la session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
