"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, FileSpreadsheet, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { redirect } from "next/navigation";
import { useImportJobs, useCreateImportJob, useParseImportFile, useExecuteImport, useRollbackImport } from "@novaconnect/data";
import { ImportFileUpload } from "@/components/admin/imports/import-file-upload";
import { ColumnMappingStep } from "@/components/admin/imports/column-mapping-step";
import { ImportPreviewStep } from "@/components/admin/imports/import-preview-step";
import { ImportProgressStep } from "@/components/admin/imports/import-progress-step";

async function getSchoolId() {
  const user = await getServerUser();
  if (!user?.schoolId) {
    redirect("/login");
  }
  return user.schoolId;
}

export default function ImportsPage() {
  const schoolId = getSchoolId();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedType, setSelectedType] = useState<'students' | 'grades' | 'schedules'>('students');
  const [importJobId, setImportJobId] = useState<string | null>(null);

  const { data: importJobs, isLoading } = useImportJobs(useSchoolId());
  const createMutation = useCreateImportJob();
  const parseMutation = useParseImportFile();
  const executeMutation = useExecuteImport();
  const rollbackMutation = useRollbackImport();

  const handleNewImport = () => {
    setCurrentStep(1);
    setSelectedType('students');
    setImportJobId(null);
    setIsOpen(true);
  };

  const handleTypeSelect = (type: 'students' | 'grades' | 'schedules') => {
    setSelectedType(type);
    setCurrentStep(2);
  };

  const handleFileUploaded = (jobId: string) => {
    setImportJobId(jobId);
    setCurrentStep(3);
  };

  const handleMappingComplete = () => {
    setCurrentStep(4);
  };

  const handlePreviewComplete = () => {
    setCurrentStep(5);
  };

  const handleImportComplete = () => {
    setIsOpen(false);
    setCurrentStep(1);
    setImportJobId(null);
  };

  const handleRollback = async (jobId: string) => {
    if (confirm('Are you sure you want to rollback this import? This will undo all changes.')) {
      await rollbackMutation.mutateAsync(jobId);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'importing':
      case 'parsing':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'previewing':
        return <Badge className="bg-yellow-100 text-yellow-800">Preview</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Imports Excel/CSV</h1>
          <p className="text-muted-foreground mt-2">
            Import students, grades, and schedules from Excel or CSV files
          </p>
        </div>
        <Button onClick={handleNewImport}>
          <Plus className="mr-2 h-4 w-4" />
          New Import
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
          <CardDescription>View and manage your imports</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {importJobs && importJobs.length > 0 ? (
                importJobs.map((job: any) => (
                  <TableRow key={job.id}>
                    <TableCell className="capitalize">{job.import_type}</TableCell>
                    <TableCell>{job.file_name}</TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell>
                      {job.imported_rows} / {job.total_rows}
                    </TableCell>
                    <TableCell>
                      {new Date(job.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {job.can_rollback && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRollback(job.id)}
                          disabled={rollbackMutation.isPending}
                        >
                          Rollback
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No imports found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Import Wizard Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Data</DialogTitle>
            <DialogDescription>
              Follow the steps to import your data
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Select Import Type */}
          {currentStep === 1 && (
            <div className="space-y-4 py-4">
              <h3 className="text-lg font-semibold">Step 1: Select Import Type</h3>
              <div className="grid grid-cols-3 gap-4">
                {(['students', 'grades', 'schedules'] as const).map((type) => (
                  <Card
                    key={type}
                    className={`cursor-pointer transition-colors ${
                      selectedType === type ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => handleTypeSelect(type)}
                  >
                    <CardHeader>
                      <CardTitle className="capitalize">{type}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {type === 'students' && 'Import students and enrollments'}
                        {type === 'grades' && 'Import student grades'}
                        {type === 'schedules' && 'Import class schedules'}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Upload File */}
          {currentStep === 2 && importJobId === null && (
            <ImportFileUpload
              schoolId={schoolId}
              importType={selectedType}
              onUploadComplete={handleFileUploaded}
              onCancel={() => setCurrentStep(1)}
            />
          )}

          {/* Step 3: Column Mapping */}
          {currentStep === 3 && importJobId && (
            <ColumnMappingStep
              importJobId={importJobId}
              onNext={handleMappingComplete}
              onBack={() => setCurrentStep(2)}
            />
          )}

          {/* Step 4: Preview & Validate */}
          {currentStep === 4 && importJobId && (
            <ImportPreviewStep
              importJobId={importJobId}
              onNext={handlePreviewComplete}
              onBack={() => setCurrentStep(3)}
            />
          )}

          {/* Step 5: Import Progress */}
          {currentStep === 5 && importJobId && (
            <ImportProgressStep
              importJobId={importJobId}
              onComplete={handleImportComplete}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
