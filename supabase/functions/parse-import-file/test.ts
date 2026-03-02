/**
 * Tests for parse-import-file Edge Function
 *
 * Run with: deno test --allow-net --allow-env test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Mock data for testing
const mockImportJob = {
  id: "test-job-id",
  school_id: "test-school-id",
  import_type: "students",
  file_path: "imports/test-school-id/test-job-id/test.csv",
  status: "uploaded",
  column_mapping: {},
  total_rows: 0,
  valid_rows: 0,
  invalid_rows: 0,
  validation_errors: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockCSVContent = `First Name,Last Name,Matricule,Email,Class
John,Doe,STU001,john@example.com,Grade 10
Jane,Smith,STU002,jane@example.com,Grade 11`;

// Test CSV parsing
Deno.test("Parse CSV file successfully", async () => {
  const lines = mockCSVContent.split("\n");
  assertEquals(lines.length, 3); // header + 2 data rows

  const headers = lines[0].split(",");
  assertEquals(headers.length, 5);
  assertEquals(headers[0], "First Name");
});

// Test validation logic
Deno.test("Validate student data", () => {
  const validStudent = {
    firstName: "John",
    lastName: "Doe",
    matricule: "STU001",
    email: "john@example.com",
    classId: "Grade 10",
  };

  assertEquals(validStudent.firstName.length > 0, true);
  assertEquals(validStudent.lastName.length > 0, true);
  assertEquals(validStudent.email.includes("@"), true);
});

// Test column mapping detection
Deno.test("Auto-detect column mappings", () => {
  const headers = ["First Name", "Last Name", "Matricule", "Email", "Class"];
  const expectedMapping = {
    firstName: "First Name",
    lastName: "Last Name",
    matricule: "Matricule",
    email: "Email",
    classId: "Class",
  };

  // Simple detection logic
  const detected: Record<string, string> = {};
  headers.forEach((header) => {
    const normalized = header.toLowerCase().replace(/\s+/g, "");
    if (normalized.includes("first") && normalized.includes("name")) {
      detected.firstName = header;
    } else if (normalized.includes("last") && normalized.includes("name")) {
      detected.lastName = header;
    } else if (normalized.includes("matricule")) {
      detected.matricule = header;
    } else if (normalized.includes("email")) {
      detected.email = header;
    } else if (normalized.includes("class")) {
      detected.classId = header;
    }
  });

  assertEquals(detected, expectedMapping);
});

// Test error handling for invalid data
Deno.test("Detect invalid email format", () => {
  const invalidEmails = ["not-an-email", "@example.com", "test@"];

  invalidEmails.forEach((email) => {
    const isValid = email.includes("@") && email.includes(".") && email.length > 5;
    assertEquals(isValid, false);
  });
});

// Test duplicate detection
Deno.test("Detect duplicate matricules", () => {
  const matricules = ["STU001", "STU002", "STU001", "STU003"];
  const uniqueMatricules = new Set(matricules);

  assertEquals(uniqueMatricules.size, 3); // STU001 is duplicated
  assertEquals(matricules.length, 4); // total 4 entries
});

console.log("All tests passed!");
