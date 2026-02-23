"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getImportJob } from "@novaconnect/data";
import { CheckCircle, XCircle, Download } from "lucide-react";

interface ImportProgressStepProps {
  importJobId: string;
  onComplete: () => void;
}

export function ImportProgressStep({ importJobId, onComplete }: ImportProgressStepProps) {
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const { data: job } = useQuery({
    queryKey: ['import-job', importJobId],
    queryFn: () => getImportJob(importJobId),
    refetchInterval: (data) => {
      if (data?.status === 'importing') {
        return 2000; // Poll every 2 seconds while importing
      }
      return false;
    },
  });

  useEffect(() => {
    // Stop polling when import is complete
    if (job?.status === 'completed' || job?.status === 'failed') {
      if (pollInterval) clearInterval(pollInterval);
    }
  }, [job?.status, pollInterval]);

  if (!job) return null;

  const progress = job.total_rows > 0 ? (job.imported_rows / job.total_rows) * 100 : 0;

  return (
    <div className="space-y-4 py-4">
      <h3 className="text-lg font-semibold">Step 5: Import Progress</h3>

      {job.status === 'importing' && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                {job.imported_rows} of {job.total_rows} rows imported
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {(job.status === 'completed' || job.status === 'failed') && (
        <Alert variant={job.status === 'completed' ? 'default' : 'destructive'}>
          {job.status === 'completed' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {job.status === 'completed' ? 'Import Completed' : 'Import Failed'}
          </AlertTitle>
          <AlertDescription>
            {job.status === 'completed'
              ? `${job.imported_rows} rows imported successfully. ${job.invalid_rows} rows skipped.`
              : job.error_message || 'An error occurred during import.'
            }
          </AlertDescription>
        </Alert>
      )}

      {job.status === 'completed' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Imported</p>
                  <p className="text-2xl font-bold text-green-600">{job.imported_rows}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Skipped</p>
                  <p className="text-2xl font-bold text-red-600">{job.invalid_rows}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
            <Button onClick={onComplete}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
