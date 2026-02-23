"use client";

import { Link } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudentsImportPage() {
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
          <h1 className="text-3xl font-bold">Import Students</h1>
          <p className="text-muted-foreground mt-2">
            Import students and enrollments from Excel or CSV files
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How to Import Students</CardTitle>
          <CardDescription>Follow these steps to import student data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">1. Prepare your file</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Download our template and fill it with your student data. Make sure all required fields are filled.
            </p>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Download Excel Template
            </Button>
          </div>

          <div>
            <h3 className="font-semibold mb-2">2. Required fields</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>First Name (required)</li>
              <li>Last Name (required)</li>
              <li>Matricule (optional, auto-generated if empty)</li>
              <li>Date of Birth (optional)</li>
              <li>Class (optional)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">3. Start import</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Click the button below to start the import wizard
            </p>
            <Link href="/admin/imports?type=students">
              <Button>Import Students Now</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
