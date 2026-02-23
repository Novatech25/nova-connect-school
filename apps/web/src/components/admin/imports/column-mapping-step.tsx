"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { getImportJob } from "@novaconnect/data";

interface ColumnMappingStepProps {
  importJobId: string;
  onNext: () => void;
  onBack: () => void;
}

export function ColumnMappingStep({ importJobId, onNext, onBack }: ColumnMappingStepProps) {
  const { data: job } = useQuery({
    queryKey: ['import-job', importJobId],
    queryFn: () => getImportJob(importJobId),
  });

  const [mapping, setMapping] = useState<Record<string, string>>(job?.column_mapping || {});

  if (!job) return null;

  const columns = Object.keys(job.column_mapping || {});
  const targetFields = getTargetFields(job.import_type);

  return (
    <div className="space-y-4 py-4">
      <h3 className="text-lg font-semibold">Step 3: Map Columns</h3>
      <p className="text-sm text-muted-foreground">
        Map the columns from your file to the target fields
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File Column</TableHead>
            <TableHead>Target Field</TableHead>
            <TableHead>Preview (First 5 values)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {columns.map((col) => (
            <TableRow key={col}>
              <TableCell className="font-medium">{col}</TableCell>
              <TableCell>
                <Select
                  value={mapping[col] || ''}
                  onValueChange={(value) => setMapping({ ...mapping, [col]: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select field..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Ignore</SelectItem>
                    {targetFields.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {/* Preview would show actual data from parsed rows */}
                Sample data...
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          Continue to Preview
        </Button>
      </div>
    </div>
  );
}

function getTargetFields(importType: string) {
  if (importType === 'students') {
    return [
      { value: 'firstName', label: 'First Name' },
      { value: 'lastName', label: 'Last Name' },
      { value: 'matricule', label: 'Matricule' },
      { value: 'dateOfBirth', label: 'Date of Birth' },
      { value: 'gender', label: 'Gender' },
      { value: 'classId', label: 'Class' },
    ];
  }
  return [];
}
