"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useCreateImportJob, useUploadImportFile, useParseImportFile, useAuthContext } from "@novaconnect/data";
import type { ImportType } from "@novaconnect/core";

interface ImportFileUploadProps {
  schoolId: string;
  importType: ImportType;
  onUploadComplete: (jobId: string) => void;
  onCancel: () => void;
}

export function ImportFileUpload({
  schoolId,
  importType,
  onUploadComplete,
  onCancel
}: ImportFileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const { user } = useAuthContext();

  const uploadMutation = useUploadImportFile();
  const createJobMutation = useCreateImportJob();
  const parseMutation = useParseImportFile();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !user?.id) return;

    setUploading(true);

    try {
      // Create import job with real user ID
      const job = await createJobMutation.mutateAsync({
        schoolId,
        importType,
        fileName: file.name,
        initiatedBy: user.id
      });

      // Upload file to storage
      await uploadMutation.mutateAsync({
        schoolId,
        importJobId: job.id,
        file
      });

      // Trigger parsing
      setParsing(true);
      await parseMutation.mutateAsync(job.id);

      onUploadComplete(job.id);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const isValidFile = file => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    return validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv');
  };

  return (
    <div className="space-y-4 py-4">
      <h3 className="text-lg font-semibold">Step 2: Upload File</h3>

      <div className="border-2 border-dashed rounded-lg p-8 text-center">
        {file ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <FileSpreadsheet className="h-12 w-12 text-green-600" />
            </div>
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFile(null)}
                disabled={uploading || parsing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {(uploading || parsing) && (
              <div className="space-y-2">
                <Progress value={uploading ? 50 : parsing ? 100 : 0} />
                <p className="text-sm text-muted-foreground">
                  {uploading ? 'Uploading...' : parsing ? 'Parsing file...' : 'Processing...'}
                </p>
              </div>
            )}

            {!uploading && !parsing && (
              <Button onClick={handleUpload} className="w-full">
                <CheckCircle className="mr-2 h-4 w-4" />
                Continue to Column Mapping
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="h-12 w-12 mx-auto text-gray-400" />
            <div>
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">
                    Drag & drop a file here, or click to select
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Excel (.xlsx, .xls) or CSV (max 50MB)
                  </p>
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  disabled={uploading || parsing}
                />
              </Label>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onCancel} disabled={uploading || parsing}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
