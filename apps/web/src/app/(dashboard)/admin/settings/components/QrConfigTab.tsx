'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Loader2, Printer, RefreshCw } from 'lucide-react';
import { useSchoolSettings, useUpdateSchoolSettings, useGenerateQrCode, useClasses, useSchool } from '@novaconnect/data';
import QRCode from 'react-qr-code';
import { qrAttendanceConfigSchema, type QrAttendanceConfig } from '@novaconnect/core/schemas';
import { useToast } from '@/hooks/use-toast';

type GeneratedQrCode = {
  qrCodeId: string;
  qrData: string;
  codeType: 'school_global' | 'class_specific';
  classId: string;
  className: string;
  schoolName: string;
  generatedAt: string;
  expiresAt: string;
  rotationIntervalMinutes: number;
  config: QrAttendanceConfig;
};

export function QrConfigTab({ schoolId }: { schoolId: string }) {
  const { data: settings, isLoading } = useSchoolSettings(schoolId);
  const updateMutation = useUpdateSchoolSettings();
  const generateMutation = useGenerateQrCode();
  const { data: classes = [], isLoading: classesLoading } = useClasses(schoolId);
  const { school } = useSchool(schoolId);
  const { toast } = useToast();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedQrCode[]>([]);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const form = useForm<QrAttendanceConfig>({
    resolver: zodResolver(qrAttendanceConfigSchema),
    defaultValues: {
      enabled: false,
      qrValidityMinutes: 5,
      qrRotationMinutes: 10,
      enableAntiFraud: true,
      requireGpsValidation: true,
      maxScansPerSession: 1,
    },
  });

  useEffect(() => {
    if (settings?.qrAttendance) {
      form.reset(settings.qrAttendance);
    }
  }, [settings, form]);

  const configSnapshot = form.watch();
  const enabled = configSnapshot.enabled;
  const schoolName = school?.name || 'Ecole';
  const selectedClass = useMemo(
    () => classes.find((cls) => cls.id === selectedClassId),
    [classes, selectedClassId]
  );

  const handleSubmit = async (data: QrAttendanceConfig) => {
    try {
      await updateMutation.mutateAsync({
        schoolId,
        settings: { qrAttendance: data },
      });
      toast({ title: "Configuration QR mise à jour avec succès" });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const addGeneratedCode = (code: GeneratedQrCode) => {
    setGeneratedCodes((prev) => {
      const next = prev.filter(
        (item) => !(item.codeType === code.codeType && item.classId === code.classId)
      );
      return [code, ...next];
    });
  };

  const formatDateTime = (value: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('fr-FR');
  };

  const handleGenerateSchool = async () => {
    if (!schoolId) {
      toast({
        title: "Erreur",
        description: "School ID is missing",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await generateMutation.mutateAsync({
        schoolId,
        codeType: 'school_global',
      });
      const currentConfig = form.getValues();
      addGeneratedCode({
        qrCodeId: result.qrCodeId,
        qrData: result.qrData,
        codeType: 'school_global',
        schoolName,
        generatedAt: new Date().toISOString(),
        expiresAt: result.expiresAt,
        rotationIntervalMinutes: result.rotationIntervalMinutes,
        config: currentConfig,
      });
      toast({
        title: "QR code generated",
        description: "School QR is ready to print",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Failed to generate school QR code",
        variant: "destructive",
      });
    }
  };

  const handleGenerateClass = async () => {
    if (!schoolId) {
      toast({
        title: "Erreur",
        description: "School ID is missing",
        variant: "destructive",
      });
      return;
    }
    if (!selectedClassId) {
      toast({
        title: "Erreur",
        description: "Select a class first",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await generateMutation.mutateAsync({
        schoolId,
        codeType: 'class_specific',
        classId: selectedClassId,
      });
      const currentConfig = form.getValues();
      addGeneratedCode({
        qrCodeId: result.qrCodeId,
        qrData: result.qrData,
        codeType: 'class_specific',
        classId: selectedClassId,
        className: selectedClass?.name || 'Classe',
        schoolName,
        generatedAt: new Date().toISOString(),
        expiresAt: result.expiresAt,
        rotationIntervalMinutes: result.rotationIntervalMinutes,
        config: currentConfig,
      });
      toast({
        title: "QR code generated",
        description: "Class QR is ready to print",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Failed to generate class QR code",
        variant: "destructive",
      });
    }
  };

  const handleGenerateAllClasses = async () => {
    if (!schoolId) {
      toast({
        title: "Erreur",
        description: "School ID is missing",
        variant: "destructive",
      });
      return;
    }
    if (!classes || classes.length === 0) {
      toast({
        title: "Erreur",
        description: "No classes available",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAll(true);
    const currentConfig = form.getValues();

    try {
      for (const cls of classes) {
        try {
          const result = await generateMutation.mutateAsync({
            schoolId,
            codeType: 'class_specific',
            classId: cls.id,
          });
          addGeneratedCode({
            qrCodeId: result.qrCodeId,
            qrData: result.qrData,
            codeType: 'class_specific',
            classId: cls.id,
            className: cls.name || 'Classe',
            schoolName,
            generatedAt: new Date().toISOString(),
            expiresAt: result.expiresAt,
            rotationIntervalMinutes: result.rotationIntervalMinutes,
            config: currentConfig,
          });
        } catch (error: any) {
          toast({
            title: "Erreur",
            description: error.message || `Failed for ${cls.name || 'classe'}`,
            variant: "destructive",
          });
        }
      }

      toast({
        title: "QR codes generated",
        description: "All classes processed",
      });
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const handlePrint = () => {
    if (generatedCodes.length === 0) {
      toast({
        title: "No QR codes",
        description: "Generate at least one QR code before printing",
        variant: "destructive",
      });
      return;
    }
    window.print();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="qr-config-controls">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Configuration QR Code
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Activer la présence par QR Code</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Permet aux étudiants de pointer leur présence via un QR Code
                    </p>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {enabled && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="qrValidityMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Validité du QR (minutes) *</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="qrRotationMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rotation du QR (minutes) *</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="maxScansPerSession"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scans max par session *</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enableAntiFraud"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Activer l'anti-fraude</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Détecte les tentatives de fraude (scans multiples, etc.)
                        </p>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requireGpsValidation"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Exiger la validation GPS</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          L'étudiant doit être à l'intérieur du périmètre défini
                        </p>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={updateMutation.isPending}
              >
                Réinitialiser
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Generation et impression
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="qr-config-controls space-y-4">
          {!enabled && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              QR attendance is disabled. Enable it to accept scans.
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">QR g?n?ral (ecole)</p>
                <p className="text-xs text-muted-foreground">
                  A afficher a l'entree principale de l'ecole.
                </p>
              </div>
              <Button
                onClick={handleGenerateSchool}
                disabled={generateMutation.isPending || isGeneratingAll}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generation...
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-4 w-4" />
                    Generer QR g?n?ral
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">QR par classe</p>
                <p className="text-xs text-muted-foreground">
                  A afficher dans chaque salle de classe.
                </p>
              </div>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger disabled={classesLoading}>
                  <SelectValue
                    placeholder={classesLoading ? 'Chargement...' : 'S?lectionner une classe'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!classesLoading && (!classes || classes.length === 0) && (
                <p className="text-xs text-muted-foreground">
                  No classes configured yet.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleGenerateClass}
                  disabled={
                    generateMutation.isPending ||
                    isGeneratingAll ||
                    !selectedClassId
                  }
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Generer QR classe
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerateAllClasses}
                  disabled={generateMutation.isPending || isGeneratingAll}
                >
                  {isGeneratingAll ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generation...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Generer toutes les classes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={generatedCodes.length === 0}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => setGeneratedCodes([])}
              disabled={generatedCodes.length === 0}
            >
              Effacer la liste
            </Button>
          </div>
        </div>

        <div id="qr-print-area" className="space-y-4">
          <div className="qr-print-only rounded-lg border bg-white p-4 shadow-sm">
            <div className="text-center">
              <p className="text-base font-semibold">Affiche QR de presence</p>
              <p className="text-xs text-muted-foreground">
                A fixer sur la porte de la classe pour le scan a l'entree
              </p>
            </div>
          </div>
          {generatedCodes.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No QR code generated yet.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {generatedCodes.map((code) => (
                <div
                  key={`${code.codeType}-${code.classId || 'school'}-${code.qrCodeId}`}
                  className="qr-print-card rounded-lg border bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2 md:w-3/5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Pointage presence
                        </span>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          A afficher sur la porte
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Ecole</p>
                      <p className="text-lg font-semibold">
                        {code.schoolName || schoolName}
                      </p>
                      <p className="text-xs text-muted-foreground">Lieu</p>
                      <p className="text-sm font-medium">
                        {code.codeType === 'school_global'
                          ? "Entree ecole"
                          : `Classe ${code.className || ''}`.trim()}
                      </p>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="text-sm font-medium">
                        {code.codeType === 'school_global' ? 'QR general' : 'QR classe'}
                      </p>

                      <div className="qr-instructions mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md border bg-slate-50 p-3">
                          <p className="text-xs font-semibold text-slate-700">Role du QR</p>
                          <ul className="mt-2 space-y-1 text-xs text-slate-600">
                            <li>• Enregistre l'arrivee en temps reel</li>
                            <li>• Valide l'entree des eleves</li>
                            <li>• Limite les erreurs de pointage</li>
                          </ul>
                        </div>
                        <div className="rounded-md border bg-emerald-50 p-3">
                          <p className="text-xs font-semibold text-emerald-700">Avantages</p>
                          <ul className="mt-2 space-y-1 text-xs text-emerald-700/90">
                            <li>• Scan rapide, sans papier</li>
                            <li>• Suivi automatique de presence</li>
                            <li>• Historique fiable pour l'ecole</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="qr-box rounded-md border bg-white p-3 md:w-2/5">
                      <QRCode value={code.qrData} size={180} level="H" />
                      <p className="mt-2 text-center text-[11px] text-muted-foreground">
                        Scannez a l'entree de la classe
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Validite:</span>{' '}
                      {code.config.qrValidityMinutes} min
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rotation:</span>{' '}
                      {code.rotationIntervalMinutes} min
                    </div>
                    <div>
                      <span className="text-muted-foreground">Anti-fraud:</span>{' '}
                      {code.config.enableAntiFraud ? 'On' : 'Off'}
                    </div>
                    <div>
                      <span className="text-muted-foreground">GPS:</span>{' '}
                      {code.config.requireGpsValidation ? 'Requis' : 'Optionnel'}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Max scans:</span>{' '}
                      {code.config.maxScansPerSession}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expires:</span>{' '}
                      {formatDateTime(code.expiresAt)}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Genere le {formatDateTime(code.generatedAt)}. Usage strictement interne.
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Ne pas partager en dehors de l'ecole.
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    <style>{`
      @media print {
        body * {
          visibility: hidden !important;
        }
        #qr-print-area,
        #qr-print-area * {
          visibility: visible !important;
        }
        #qr-print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .qr-config-controls {
          display: none !important;
        }
        .qr-print-card {
          break-inside: avoid;
          page-break-inside: avoid;
          box-shadow: none !important;
        }
        #qr-print-area {
          margin: 0 !important;
        }
        .qr-print-only {
          display: block !important;
        }
        .qr-box {
          border-color: #d1d5db !important;
        }
      }
      .qr-print-only {
        display: none;
      }
    `}</style>
    </div>
  );
}
