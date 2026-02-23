"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getImportJob } from "@novaconnect/data";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface ImportPreviewStepProps {
  importJobId: string;
  onNext: () => void;
  onBack: () => void;
}

export function ImportPreviewStep({ importJobId, onNext, onBack }: ImportPreviewStepProps) {
  const { data: job, isLoading } = useQuery({
    queryKey: ['import-job', importJobId],
    queryFn: () => getImportJob(importJobId),
  });

  if (isLoading) {
    return <div>Loading preview...</div>;
  }

  return (
    <div className="space-y-4 py-4">
      <h3 className="text-lg font-semibold">Step 4: Preview & Validate</h3>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Rows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{job?.total_rows}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-600">Valid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{job?.valid_rows}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600">Invalid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{job?.invalid_rows}</div>
          </CardContent>
        </Card>
      </div>

      {job?.validation_errors && job.validation_errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Validation Errors Found</AlertTitle>
          <AlertDescription>
            {job.validation_errors.length} rows have errors and will be skipped during import.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={job?.valid_rows === 0}>
          Start Import ({job?.valid_rows} rows)
        </Button>
      </div>
    </div>
  );
}
