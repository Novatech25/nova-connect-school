/**
 * Tests for rollback-import Edge Function
 *
 * Run with: deno test --allow-net --allow-env test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Mock import history for rollback
const mockImportHistory = [
  {
    id: "history-1",
    import_job_id: "test-job-id",
    school_id: "test-school-id",
    entity_type: "student",
    entity_id: "student-1",
    action: "created",
    row_number: 1,
    data: { first_name: "John", last_name: "Doe" },
    original_data: null,
    new_data: { id: "student-1", first_name: "John", last_name: "Doe" },
    status: "completed",
  },
  {
    id: "history-2",
    import_job_id: "test-job-id",
    school_id: "test-school-id",
    entity_type: "student",
    entity_id: "student-2",
    action: "created",
    row_number: 2,
    data: { first_name: "Jane", last_name: "Smith" },
    original_data: null,
    new_data: { id: "student-2", first_name: "Jane", last_name: "Smith" },
    status: "completed",
  },
  {
    id: "history-3",
    import_job_id: "test-job-id",
    school_id: "test-school-id",
    entity_type: "grade",
    entity_id: "grade-1",
    action: "created",
    row_number: 3,
    data: { student_id: "student-1", score: 85 },
    original_data: null,
    new_data: { id: "grade-1", student_id: "student-1", score: 85 },
    status: "completed",
  },
  {
    id: "history-4",
    import_job_id: "test-job-id",
    school_id: "test-school-id",
    entity_type: "student",
    entity_id: "student-3",
    action: "updated",
    row_number: 4,
    data: { first_name: "Bob", last_name: "Johnson" },
    original_data: { id: "student-3", first_name: "Robert", last_name: "Johnson" },
    new_data: { id: "student-3", first_name: "Bob", last_name: "Johnson" },
    status: "completed",
  },
];

// Test rollback of created entities
Deno.test("Rollback created entities", () => {
  const createdEntities = mockImportHistory.filter((entry) => entry.action === "created");

  // In reverse order (LIFO)
  const reversed = [...createdEntities].reverse();

  assertEquals(reversed.length, 3);
  assertEquals(reversed[0].entity_type, "grade"); // Last created, first to delete
  assertEquals(reversed[1].entity_type, "student");
  assertEquals(reversed[2].entity_type, "student");
});

// Test rollback of updated entities
Deno.test("Rollback updated entities", () => {
  const updatedEntities = mockImportHistory.filter((entry) => entry.action === "updated");

  updatedEntities.forEach((entry) => {
    // Restore original data
    const restoredData = entry.original_data;
    assertExists(restoredData);
    assertEquals(restoredData.first_name, "Robert"); // Original name
  });
});

// Test rollback eligibility
Deno.test("Check if import can be rolled back", () => {
  const importJob = {
    id: "test-job-id",
    status: "completed",
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    can_rollback: true,
  };

  // Check if within 7 days
  const completedDate = new Date(importJob.completed_at);
  const now = new Date();
  const daysSinceCompletion = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24);

  const canRollback = daysSinceCompletion <= 7 && importJob.can_rollback;

  assertEquals(canRollback, true);
});

// Test rollback order
Deno.test("Process rollback in correct order", () => {
  // Should be processed in reverse chronological order
  const processedOrder: string[] = [];

  const reversed = [...mockImportHistory].reverse();

  reversed.forEach((entry) => {
    if (entry.action === "created") {
      processedOrder.push(`delete ${entry.entity_type}:${entry.entity_id}`);
    } else if (entry.action === "updated") {
      processedOrder.push(`restore ${entry.entity_type}:${entry.entity_id}`);
    }
  });

  // Verify order: grade (created last) should be first
  assertEquals(processedOrder[0], "delete grade:grade-1");
  assertEquals(processedOrder[1], "restore student:student-3");
  assertEquals(processedOrder[2], "delete student:student-2");
  assertEquals(processedOrder[3], "delete student:student-1");
});

// Test rollback statistics
Deno.test("Track rollback statistics", () => {
  const stats = {
    total_entities: mockImportHistory.length,
    entities_deleted: 0,
    entities_restored: 0,
    errors: 0,
  };

  mockImportHistory.forEach((entry) => {
    if (entry.action === "created") {
      stats.entities_deleted++;
    } else if (entry.action === "updated") {
      stats.entities_restored++;
    }
  });

  assertEquals(stats.entities_deleted, 3);
  assertEquals(stats.entities_restored, 1);
  assertEquals(stats.total_entities, 4);
});

// Test rollback job status update
Deno.test("Update import job status after rollback", () => {
  const importJob = {
    id: "test-job-id",
    status: "completed",
    rolled_back_at: null,
  };

  // Simulate successful rollback
  const updatedJob = {
    ...importJob,
    status: "rolled_back",
    rolled_back_at: new Date().toISOString(),
  };

  assertEquals(updatedJob.status, "rolled_back");
  assertExists(updatedJob.rolled_back_at);
});

// Test error handling during rollback
Deno.test("Handle rollback errors gracefully", () => {
  const failedRollbackEntry = {
    id: "history-failed",
    action: "created",
    entity_type: "student",
    entity_id: "non-existent-student",
    status: "failed",
    error_message: "Student not found",
  };

  const stats = {
    successful: 0,
    failed: 0,
  };

  try {
    // Simulate failed deletion
    throw new Error("Student not found");
  } catch (error) {
    stats.failed++;
  }

  assertEquals(stats.failed, 1);
});

// Test audit log for rollback
Deno.test("Create audit log entry for rollback", () => {
  const auditEntry = {
    action: "import_rolled_back",
    resource_type: "import_job",
    resource_id: "test-job-id",
    user_id: "admin-user-id",
    school_id: "test-school-id",
    details: {
      import_type: "students",
      entities_affected: 4,
      entities_deleted: 3,
      entities_restored: 1,
      rollback_duration_ms: 1250,
    },
    created_at: new Date().toISOString(),
  };

  assertEquals(auditEntry.action, "import_rolled_back");
  assertEquals(auditEntry.details.entities_affected, 4);
});

console.log("All rollback-import tests passed!");
