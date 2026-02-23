"use client";

import { Link } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GradesImportPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/imports">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Imports
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Import Grades</h1>
          <p className="text-muted-foreground mt-2">
            Import student grades from Excel or CSV files
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import Student Grades</CardTitle>
          <CardDescription>Import grades with full validation and workflow support</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">1. Download Template</h3>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Download Excel Template
            </Button>
          </div>

          <div>
            <h3 className="font-semibold mb-2">2. Required fields</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Student Matricule (required)</li>
              <li>Subject Code (required)</li>
              <li>Period Name (required)</li>
              <li>Score (required)</li>
              <li>Max Score (required)</li>
              <li>Grade Type (required)</li>
              <li>Title (required)</li>
            </ul>
          </div>

          <Link href="/admin/imports?type=grades">
            <Button>Import Grades Now</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Important Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Imported grades will be created in <strong>draft</strong> status and must go through the normal approval workflow before being published.
            Make sure students, subjects, and periods already exist in the system before importing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
