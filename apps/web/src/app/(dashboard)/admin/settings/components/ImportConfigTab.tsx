"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useSchools } from "@novaconnect/data";
import { Save, RefreshCw, Download, FileText } from "lucide-react";
import { toast } from "sonner";

interface ImportConfigTabProps {
  schoolId: string;
}

export function ImportConfigTab({ schoolId }: ImportConfigTabProps) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const { schools = [], isLoading } = useSchools();

  const currentSchool = schools.find((s: any) => s.id === schoolId);
  const importConfig = currentSchool?.settings?.api_import || {
    enabled: false,
    maxFileSize: 52428800, // 50MB in bytes
    maxRowsPerImport: 10000,
    quotaMonthly: 100,
  };

  const [config, setConfig] = useState(importConfig);

  useEffect(() => {
    setConfig(importConfig);
  }, [currentSchool?.id]);

  const saveMutation = useMutation({
    mutationFn: async (newConfig: any) => {
      const response = await fetch(`/api/schools/${schoolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            ...(currentSchool?.settings || {}),
            api_import: newConfig,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to save settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      toast.success("Import settings saved successfully");
      setIsSaving(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save settings");
      setIsSaving(false);
    },
  });

  const handleSave = () => {
    setIsSaving(true);
    saveMutation.mutate(config);
  };

  const handleReset = () => {
    setConfig({
      enabled: false,
      maxFileSize: 52428800,
      maxRowsPerImport: 10000,
      quotaMonthly: 100,
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Statut du module d'import</CardTitle>
          <CardDescription>
            Configurez l'import en masse des eleves, notes et emplois du temps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enabled">Activer le module d'import</Label>
              <p className="text-sm text-muted-foreground">
                Autorise les imports en masse depuis Excel/CSV
              </p>
            </div>
            <Switch
              id="enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>

          {config.enabled && (
            <Alert>
              <Badge variant="default" className="mr-2">Actif</Badge>
              <AlertDescription>
                Le module d'import est actif. Vous pouvez importer jusqu'a {config.maxRowsPerImport} lignes par fichier.
              </AlertDescription>
            </Alert>
          )}

          {!config.enabled && (
            <Alert>
              <AlertDescription>
                Le module d'import est desactive. Activez-le pour autoriser les imports.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Limits Card */}
      <Card>
        <CardHeader>
          <CardTitle>Limites d'import</CardTitle>
          <CardDescription>
            Definissez les limites de taille, de lignes et le quota mensuel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maxFileSize">Taille maximale du fichier</Label>
            <Input
              id="maxFileSize"
              type="number"
              value={config.maxFileSize}
              onChange={(e) => setConfig({ ...config, maxFileSize: parseInt(e.target.value) || 0 })}
              disabled={!config.enabled}
            />
            <p className="text-xs text-muted-foreground">
              Actuel : {formatBytes(config.maxFileSize)} (en octets)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxRowsPerImport">Nombre maximal de lignes</Label>
            <Input
              id="maxRowsPerImport"
              type="number"
              value={config.maxRowsPerImport}
              onChange={(e) => setConfig({ ...config, maxRowsPerImport: parseInt(e.target.value) || 0 })}
              disabled={!config.enabled}
            />
            <p className="text-xs text-muted-foreground">
              Nombre maximal de lignes par import
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quotaMonthly">Quota mensuel d'import</Label>
            <Input
              id="quotaMonthly"
              type="number"
              value={config.quotaMonthly}
              onChange={(e) => setConfig({ ...config, quotaMonthly: parseInt(e.target.value) || 0 })}
              disabled={!config.enabled}
            />
            <p className="text-xs text-muted-foreground">
              Nombre maximal d'imports par mois
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Resources Card */}
      <Card>
        <CardHeader>
          <CardTitle>Ressources et documentation</CardTitle>
          <CardDescription>
            Ressources utiles pour utiliser le module d'import
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => window.open("/docs/imports/README.md", "_blank")}
            >
              <FileText className="mr-2 h-4 w-4" />
              Voir la documentation
            </Button>

            <Button
              variant="outline"
              className="justify-start"
              onClick={() => window.open("/docs/imports/templates/students-template.csv", "_blank")}
            >
              <Download className="mr-2 h-4 w-4" />
              Modele eleves
            </Button>

            <Button
              variant="outline"
              className="justify-start"
              onClick={() => window.open("/docs/imports/templates/grades-template.csv", "_blank")}
            >
              <Download className="mr-2 h-4 w-4" />
              Modele notes
            </Button>

            <Button
              variant="outline"
              className="justify-start"
              onClick={() => window.open("/docs/imports/templates/schedules-template.csv", "_blank")}
            >
              <Download className="mr-2 h-4 w-4" />
              Modele emplois du temps
            </Button>
          </div>

          <Alert>
            <AlertDescription>
              <strong>Astuce :</strong> Utilisez les modeles pour respecter le format et les colonnes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleReset} disabled={isSaving}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reinitialiser
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
