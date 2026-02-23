'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useCreateScheduleConstraint, useUpdateScheduleConstraint, useDeleteScheduleConstraint } from '@novaconnect/data';
import { ScheduleConstraint } from '@novaconnect/core';

interface ConstraintsPanelProps {
  schoolId: string;
  constraints: ScheduleConstraint[];
}

const CONSTRAINT_TYPES = [
  { value: 'teacher_conflict', label: 'Conflit professeur' },
  { value: 'room_conflict', label: 'Conflit salle' },
  { value: 'class_conflict', label: 'Conflit classe' },
  { value: 'max_hours_per_day', label: 'Max heures prof/jour' },
  { value: 'max_hours_per_week', label: 'Max heures prof/semaine' },
  { value: 'teacher_availability', label: 'Disponibilite professeur' },
];

export default function ConstraintsPanel({ schoolId, constraints }: ConstraintsPanelProps) {
  const { toast } = useToast();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<ScheduleConstraint | null>(null);
  const [formData, setFormData] = useState({
    type: '',
    config: {},
    priority: 2,
    isActive: true,
    errorMessage: '',
  });

  // Mutations
  const createConstraintMutation = useCreateScheduleConstraint();
  const updateConstraintMutation = useUpdateScheduleConstraint();
  const deleteConstraintMutation = useDeleteScheduleConstraint();

  const handleCreate = () => {
    setEditingConstraint(null);
    setFormData({
      type: '',
      config: {},
      priority: 2,
      isActive: true,
      errorMessage: '',
    });
    setFormDialogOpen(true);
  };

  const handleEdit = (constraint: ScheduleConstraint) => {
    setEditingConstraint(constraint);
    setFormData({
      type: constraint.constraintType,
      config: constraint.constraintConfig || {},
      priority: constraint.priority || 2,
      isActive: constraint.isActive !== false,
      errorMessage: constraint.errorMessage || '',
    });
    setFormDialogOpen(true);
  };

  const handleDelete = async (constraintId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette contrainte ?')) {
      return;
    }

    try {
      await deleteConstraintMutation.mutateAsync(constraintId);

      toast({
        title: 'Contrainte supprimée',
        description: 'La contrainte a été supprimée avec succès.',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingConstraint) {
        await updateConstraintMutation.mutateAsync({
          id: editingConstraint.id,
          constraintType: formData.type as any,
          constraintConfig: formData.config,
          priority: formData.priority,
          isActive: formData.isActive,
          errorMessage: formData.errorMessage || null,
        });

        toast({
          title: 'Contrainte mise à jour',
          description: 'La contrainte a été mise à jour avec succès.',
        });
      } else {
        await createConstraintMutation.mutateAsync({
          schoolId,
          constraintType: formData.type as any,
          constraintConfig: formData.config,
          priority: formData.priority,
          isActive: formData.isActive,
          errorMessage: formData.errorMessage || null,
        });

        toast({
          title: 'Contrainte créée',
          description: 'La contrainte a été créée avec succès.',
        });
      }

      setFormDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateConfig = (key: string, value: any) => {
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contraintes</h2>
          <p className="text-sm text-muted-foreground">
            Configurez les contraintes de validation de l'emploi du temps
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une contrainte
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Configuration</TableHead>
              <TableHead>Priorité</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Message d'erreur</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {constraints.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucune contrainte configurée
                </TableCell>
              </TableRow>
            ) : (
              constraints.map((constraint) => (
                <TableRow key={constraint.id}>
                  <TableCell className="font-medium">
                    {CONSTRAINT_TYPES.find((t) => t.value === constraint.constraintType)?.label ||
                      constraint.constraintType}
                  </TableCell>
                  <TableCell>
                    <pre className="text-xs bg-muted p-2 rounded">
                      {JSON.stringify(constraint.constraintConfig, null, 2)}
                    </pre>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        constraint.priority === 1
                          ? 'destructive'
                          : constraint.priority === 2
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {constraint.priority === 1
                        ? 'Haute'
                        : constraint.priority === 2
                        ? 'Moyenne'
                        : 'Basse'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {constraint.isActive !== false ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {constraint.errorMessage || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(constraint)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(constraint.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Form Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingConstraint ? 'Modifier la contrainte' : 'Ajouter une contrainte'}
            </DialogTitle>
            <DialogDescription>
              Configurez les paramètres de la contrainte de validation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type de contrainte *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  {CONSTRAINT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic config fields based on type */}
            {formData.type === 'teacher_conflict' && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="teacherConflictEnabled"
                  checked={formData.config.enabled ?? true}
                  onCheckedChange={(checked) => updateConfig('enabled', checked)}
                />
                <Label htmlFor="teacherConflictEnabled">Activer la prevention de conflit</Label>
              </div>
            )}

            {formData.type === 'room_conflict' && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="roomConflictEnabled"
                    checked={formData.config.enabled ?? true}
                    onCheckedChange={(checked) => updateConfig('enabled', checked)}
                  />
                  <Label htmlFor="roomConflictEnabled">Activer la prevention de conflit</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="allowDoubleBooking"
                    checked={formData.config.allowDoubleBooking ?? false}
                    onCheckedChange={(checked) => updateConfig('allowDoubleBooking', checked)}
                  />
                  <Label htmlFor="allowDoubleBooking">Autoriser le double-booking</Label>
                </div>
              </div>
            )}

            {formData.type === 'class_conflict' && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="classConflictEnabled"
                  checked={formData.config.enabled ?? true}
                  onCheckedChange={(checked) => updateConfig('enabled', checked)}
                />
                <Label htmlFor="classConflictEnabled">Activer la prevention de conflit</Label>
              </div>
            )}

            {formData.type === 'max_hours_per_day' && (
              <div className="space-y-2">
                <Label htmlFor="maxHoursDay">Max heures par jour</Label>
                <Input
                  id="maxHoursDay"
                  type="number"
                  value={formData.config.maxHours || 6}
                  onChange={(e) => updateConfig('maxHours', parseInt(e.target.value) || 0)}
                />
                <Label htmlFor="breakTime">Pause a exclure (minutes)</Label>
                <Input
                  id="breakTime"
                  type="number"
                  value={formData.config.breakTime || 0}
                  onChange={(e) => updateConfig('breakTime', parseInt(e.target.value) || 0)}
                />
              </div>
            )}

            {formData.type === 'max_hours_per_week' && (
              <div className="space-y-2">
                <Label htmlFor="maxHoursWeek">Max heures par semaine</Label>
                <Input
                  id="maxHoursWeek"
                  type="number"
                  value={formData.config.maxHours || 30}
                  onChange={(e) => updateConfig('maxHours', parseInt(e.target.value) || 0)}
                />
              </div>
            )}

            {formData.type === 'teacher_availability' && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requireAvailability"
                    checked={formData.config.requireAvailability ?? true}
                    onCheckedChange={(checked) => updateConfig('requireAvailability', checked)}
                  />
                  <Label htmlFor="requireAvailability">Verifier la disponibilite</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="allowOverride"
                    checked={formData.config.allowOverride ?? false}
                    onCheckedChange={(checked) => updateConfig('allowOverride', checked)}
                  />
                  <Label htmlFor="allowOverride">Autoriser le contournement</Label>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="priority">Priorite</Label>
              <Select
                value={String(formData.priority)}
                onValueChange={(value) => setFormData({ ...formData, priority: Number(value) })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Haute (1)</SelectItem>
                  <SelectItem value="2">Moyenne (2)</SelectItem>
                  <SelectItem value="3">Basse (3)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Contrainte active</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="errorMessage">Message d'erreur personnalisé</Label>
              <Input
                id="errorMessage"
                value={formData.errorMessage}
                onChange={(e) => setFormData({ ...formData, errorMessage: e.target.value })}
                placeholder="Message affiché en cas de violation..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.type}>
              {editingConstraint ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
