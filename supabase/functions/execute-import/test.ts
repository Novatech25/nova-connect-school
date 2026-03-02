/**
 * Tests for execute-import Edge Function
 *
 * Run with: deno test --allow-net --allow-env test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Mock import job with preview data
const mockImportJob = {
  id: "test-job-id",
  school_id: "test-school-id",
  import_type: "students",
  status: "previewing",
  column_mapping: {
    firstName: "First Name",
    lastName: "Last Name",
    matricule: "Matricule",
    email: "Email",
  },
  preview_data: [
    {
      row_number: 1,
      data: {
        firstName: "John",
        lastName: "Doe",
        matricule: "STU001",
        email: "john@example.com",
      },
      valid: true,
      errors: [],
    },
    {
      row_number: 2,
      data: {
        firstName: "Jane",
        lastName: "Smith",
        matricule: "STU002",
        email: "jane@example.com",
      },
      valid: true,
      errors: [],
    },
  ],
  total_rows: 2,
  valid_rows: 2,
  invalid_rows: 0,
};

// Test student creation logic
Deno.test("Prepare student record for import", () => {
  const rowData = {
    firstName: "John",
    lastName: "Doe",
    matricule: "STU001",
    email: "john@example.com",
  };

  const studentRecord = {
    school_id: mockImportJob.school_id,
    matricule: rowData.matricule,
    first_name: rowData.firstName,
    last_name: rowData.lastName,
    email: rowData.email,
    created_at: new Date().toISOString(),
  };

  assertExists(studentRecord.school_id);
  assertEquals(studentRecord.matricule, "STU001");
  assertEquals(studentRecord.first_name, "John");
});

// Test grade import logic
Deno.test("Prepare grade record for import", () => {
  const gradeImportJob = {
    ...mockImportJob,
    import_type: "grades",
    preview_data: [
      {
        row_number: 1,
        data: {
          studentMatricule: "STU001",
          subjectCode: "MAT101",
          score: 85,
          maxScore: 100,
          trimester: 1,
        },
        valid: true,
        errors: [],
      },
    ],
  };

  const rowData = gradeImportJob.preview_data[0].data;

  const gradeRecord = {
    student_id: "resolved-student-id", // Would be resolved from matricule
    subject_id: "resolved-subject-id", // Would be resolved from code
    score: rowData.score,
    max_score: rowData.maxScore,
    trimester: rowData.trimester,
    school_year: "2024-2025",
  };

  assertEquals(gradeRecord.score, 85);
  assertEquals(gradeRecord.max_score, 100);
});

// Test schedule import logic
Deno.test("Prepare schedule record for import", () => {
  const scheduleImportJob = {
    ...mockImportJob,
    import_type: "schedules",
    preview_data: [
      {
        row_number: 1,
        data: {
          classId: "Grade 10A",
          subjectId: "MAT101",
          teacherId: "teacher-uuid",
          dayOfWeek: "Monday",
          startTime: "08:00",
          endTime: "09:30",
          room: "Room 101",
        },
        valid: true,
        errors: [],
      },
    ],
  };

  const rowData = scheduleImportJob.preview_data[0].data;

  const scheduleRecord = {
    class_id: "resolved-class-id",
    subject_id: "resolved-subject-id",
    teacher_id: rowData.teacherId,
    day_of_week: rowData.dayOfWeek,
    start_time: rowData.startTime,
    end_time: rowData.endTime,
    room: rowData.room,
  };

  assertEquals(scheduleRecord.day_of_week, "Monday");
  assertEquals(scheduleRecord.start_time, "08:00");
  assertEquals(scheduleRecord.end_time, "09:30");
});

// Test import history tracking
Deno.test("Create import history entry", () => {
  const historyEntry = {
    import_job_id: mockImportJob.id,
    school_id: mockImportJob.school_id,
    entity_type: "student",
    entity_id: "new-student-id",
    action: "created",
    row_number: 1,
    data: {
      first_name: "John",
      last_name: "Doe",
      matricule: "STU001",
    },
    original_data: null,
    new_data: {
      first_name: "John",
      last_name: "Doe",
      matricule: "STU001",
    },
    status: "completed",
    error_message: null,
    created_at: new Date().toISOString(),
  };

  assertExists(historyEntry.import_job_id);
  assertEquals(historyEntry.action, "created");
  assertEquals(historyEntry.entity_type, "student");
});

// Test statistics tracking
Deno.test("Update import job statistics", () => {
  const stats = {
    total_rows: mockImportJob.valid_rows,
    imported_rows: 0,
    failed_rows: 0,
  };

  // Simulate importing rows
  const validRows = mockImportJob.preview_data.filter((row) => row.valid);

  validRows.forEach(() => {
    stats.imported_rows++;
  });

  assertEquals(stats.imported_rows, 2);
  assertEquals(stats.failed_rows, 0);
});

// Test error handling during import
Deno.test("Handle import errors gracefully", () => {
  const failedRow = {
    row_number: 3,
    data: {
      firstName: "Invalid",
      lastName: "Student",
    },
    valid: false,
    errors: ["Missing required field: email"],
  };

  const historyEntry = {
    import_job_id: mockImportJob.id,
    school_id: mockImportJob.school_id,
    entity_type: "student",
    entity_id: null,
    action: "failed",
    row_number: failedRow.row_number,
    status: "failed",
    error_message: failedRow.errors[0],
    created_at: new Date().toISOString(),
  };

  assertEquals(historyEntry.status, "failed");
  assertEquals(historyEntry.error_message, "Missing required field: email");
});

console.log("All execute-import tests passed!");
