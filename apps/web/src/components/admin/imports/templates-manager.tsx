"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useImportTemplates, useCreateImportTemplate, useUpdateImportTemplate, useDeleteImportTemplate } from "@novaconnect/data";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { importTypeSchema } from "@novaconnect/core";

interface TemplatesManagerProps {
  schoolId: string;
  importType?: string;
}

export function TemplatesManager({ schoolId, importType }: TemplatesManagerProps) {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    column_mapping: {},
  });

  const { data: templates, isLoading } = useImportTemplates(schoolId, importType);

  const createMutation = useCreateImportTemplate();
  const updateMutation = useUpdateImportTemplate();
  const deleteMutation = useDeleteImportTemplate();

  const handleOpenDialog = (template?: any) => {
    if (template) {
      setSelectedTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || "",
        column_mapping: template.column_mapping || {},
      });
    } else {
      setSelectedTemplate(null);
      setFormData({
        name: "",
        description: "",
        column_mapping: {},
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (selectedTemplate) {
        await updateMutation.mutateAsync({
          id: selectedTemplate.id,
          data: {
            name: formData.name,
            description: formData.description,
            column_mapping: formData.column_mapping,
          },
        });
      } else {
        await createMutation.mutateAsync({
          school_id: schoolId,
          name: formData.name,
          import_type: importType || "students",
          description: formData.description,
          column_mapping: formData.column_mapping,
        });
      }
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["import-templates"] });
    } catch (error: any) {
      console.error("Error saving template:", error);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      await deleteMutation.mutateAsync(templateId);
      queryClient.invalidateQueries({ queryKey: ["import-templates"] });
    } catch (error: any) {
      console.error("Error deleting template:", error);
    }
  };

  const handleExportTemplate = (template: any) => {
    const dataStr = JSON.stringify(template.column_mapping, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${template.name}-template.json`;
    link.click();
  };

  if (isLoading) {
    return <div>Loading templates...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Import Templates</h3>
          <p className="text-sm text-muted-foreground">
            Manage column mapping templates for {importType || "all imports"}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedTemplate ? "Edit Template" : "Create New Template"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div>
                <Label>Column Mapping (JSON)</Label>
                <Textarea
                  value={JSON.stringify(formData.column_mapping, null, 2)}
                  onChange={(e) => {
                    try {
                      const mapping = JSON.parse(e.target.value);
                      setFormData({ ...formData, column_mapping: mapping });
                    } catch (error) {
                      // Invalid JSON, ignore
                    }
                  }}
                  rows={10}
                  className="font-mono text-sm"
                  placeholder='{"firstName": "First Name", "lastName": "Last Name"}'
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Map file columns to database fields in JSON format
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {selectedTemplate ? "Update" : "Create"} Template
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {templates && templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template: any) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle className="text-base">{template.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {template.description || "No description"}
                </p>
                <div className="text-xs text-muted-foreground mb-4">
                  <p>Type: {template.import_type}</p>
                  <p>Fields: {Object.keys(template.column_mapping || {}).length}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenDialog(template)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportTemplate(template)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Alert>
          <AlertDescription>
            No templates found. Create a template to save column mappings for future imports.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
