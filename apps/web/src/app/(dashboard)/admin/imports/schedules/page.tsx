"use client";

import Link from 'next/link';
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SchedulesImportPage() {
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
          <h1 className="text-3xl font-bold">Import Schedules</h1>
          <p className="text-muted-foreground mt-2">
            Import class schedules (emploi du temps) from Excel or CSV files
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import Class Schedules</CardTitle>
          <CardDescription>Build your school timetable with automatic conflict detection</CardDescription>
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
              <li>Day of Week (required)</li>
              <li>Start Time (HH:MM format, required)</li>
              <li>End Time (HH:MM format, required)</li>
              <li>Teacher Email (required)</li>
              <li>Class Name (required)</li>
              <li>Subject Code (required)</li>
              <li>Room (optional)</li>
            </ul>
          </div>

          <Link href="/admin/imports?type=schedules">
            <Button>Import Schedule Now</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conflict Detection</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The system will automatically detect scheduling conflicts such as:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
            <li>Teacher assigned to multiple classes at the same time</li>
            <li>Class scheduled for multiple subjects at the same time</li>
            <li>Room double-booked at the same time</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
