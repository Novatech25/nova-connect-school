'use client';

import { useState } from 'react';
import { useAuth, useCardTemplates, useCreateCardTemplate, useUpdateCardTemplate, useDeleteCardTemplate } from '@novaconnect/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Layout, Settings, Eye } from 'lucide-react';

export default function CardTemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  const { data: templates, isLoading } = useCardTemplates(user?.schoolId || '');
  const createTemplate = useCreateCardTemplate();
  const updateTemplate = useUpdateCardTemplate();
  const deleteTemplate = useDeleteCardTemplate();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logoUrl: '',
    backgroundImageUrl: '',
    isDefault: false,
    isActive: true,
    layoutConfig: {
      photoPosition: { x: 10, y: 10, width: 30, height: 40 },
      qrPosition: { x: 130, y: 10, size: 35 },
      textColor: '#000000',
      backgroundColor: '#FFFFFF',
      fontSize: 10,
      fontFamily: 'Helvetica',
      namePosition: { x: 50, y: 20 },
      matriculePosition: { x: 50, y: 30 },
      classPosition: { x: 50, y: 40 },
      schoolNamePosition: { x: 105, y: 55 },
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      logoUrl: '',
      backgroundImageUrl: '',
      isDefault: false,
      isActive: true,
      layoutConfig: {
        photoPosition: { x: 10, y: 10, width: 30, height: 40 },
        qrPosition: { x: 130, y: 10, size: 35 },
        textColor: '#000000',
        backgroundColor: '#FFFFFF',
        fontSize: 10,
        fontFamily: 'Helvetica',
        namePosition: { x: 50, y: 20 },
        matriculePosition: { x: 50, y: 30 },
        classPosition: { x: 50, y: 40 },
        schoolNamePosition: { x: 105, y: 55 },
      },
    });
  };

  const handleCreate = async () => {
    try {
      await createTemplate.mutateAsync({
        schoolId: user?.schoolId || '',
        ...formData,
      });

      toast({
        title: 'Template créé',
        description: 'Le modèle de carte a été créé avec succès',
      });

      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Échec de la création du template',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async () => {
    if (!selectedTemplate) return;

    try {
      await updateTemplate.mutateAsync({
        id: selectedTemplate.id,
        ...formData,
      });

      toast({
        title: 'Template mis à jour',
        description: 'Le modèle de carte a été mis à jour avec succès',
      });

      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      resetForm();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Échec de la mise à jour du template',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce template ?')) return;

    try {
      await deleteTemplate.mutateAsync(id);

      toast({
        title: 'Template supprimé',
        description: 'Le modèle de carte a été supprimé avec succès',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Échec de la suppression du template',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (template: any) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      logoUrl: template.logoUrl || '',
      backgroundImageUrl: template.backgroundImageUrl || '',
      isDefault: template.isDefault,
      isActive: template.isActive,
      layoutConfig: template.layoutConfig,
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Modèles de Cartes</h1>
          <p className="text-muted-foreground">
            Gérer les modèles de cartes scolaires
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau modèle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer un modèle de carte</DialogTitle>
            </DialogHeader>
            <TemplateForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleCreate}
              onCancel={() => {
                setIsCreateDialogOpen(false);
                resetForm();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : !templates || templates.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Layout className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucun modèle de carte trouvé</p>
            <Button
              className="mt-4"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Créer le premier modèle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template: any) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {template.isDefault && (
                      <Badge variant="default">Défaut</Badge>
                    )}
                    {!template.isActive && (
                      <Badge variant="secondary">Inactif</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Preview placeholder */}
                  <div className="aspect-[1.586/1] border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/20">
                    <div className="text-center text-muted-foreground">
                      <Layout className="mx-auto h-8 w-8 mb-2" />
                      <p className="text-sm">Aperçu non disponible</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => openEditDialog(template)}
                    >
                      <Edit className="mr-2 h-3 w-3" />
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {/* Preview */}}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le modèle de carte</DialogTitle>
          </DialogHeader>
          <TemplateForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleUpdate}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setSelectedTemplate(null);
              resetForm();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
}: {
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Nom</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Ex: Modèle Primaire"
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Description du modèle..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="textColor">Couleur du texte</Label>
          <Input
            id="textColor"
            type="color"
            value={formData.layoutConfig.textColor}
            onChange={(e) => setFormData({
              ...formData,
              layoutConfig: { ...formData.layoutConfig, textColor: e.target.value }
            })}
          />
        </div>

        <div>
          <Label htmlFor="backgroundColor">Couleur de fond</Label>
          <Input
            id="backgroundColor"
            type="color"
            value={formData.layoutConfig.backgroundColor}
            onChange={(e) => setFormData({
              ...formData,
              layoutConfig: { ...formData.layoutConfig, backgroundColor: e.target.value }
            })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="fontSize">Taille de police (pt)</Label>
        <Input
          id="fontSize"
          type="number"
          value={formData.layoutConfig.fontSize}
          onChange={(e) => setFormData({
            ...formData,
            layoutConfig: { ...formData.layoutConfig, fontSize: parseInt(e.target.value) }
          })}
          min={6}
          max={20}
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isDefault"
            checked={formData.isDefault}
            onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
          />
          <Label htmlFor="isDefault">Modèle par défaut</Label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          />
          <Label htmlFor="isActive">Actif</Label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button onClick={onSubmit}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
