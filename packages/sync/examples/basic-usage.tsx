/**
 * Basic usage example for NovaConnect sync system
 *
 * This example demonstrates how to:
 * - Initialize the sync system
 * - Add operations to the offline queue
 * - Sync with the server
 * - Monitor sync status
 */

import { createStorageAdapter } from '@novaconnect/sync';
import { OfflineQueue } from '@novaconnect/sync';
import { SyncEngine } from '@novaconnect/sync';
import { useOfflineQueue } from '@novaconnect/sync';
import { useSyncStatus } from '@novaconnect/sync';

// ============================================
// Example 1: Basic Setup
// ============================================

async function basicSetup() {
  // Step 1: Create storage adapter (auto-detects environment)
  const storage = await createStorageAdapter();

  // Step 2: Create offline queue
  const queue = new OfflineQueue(storage);
  await queue.init();

  // Step 3: Create sync engine
  const syncEngine = new SyncEngine(queue);

  return { queue, syncEngine };
}

// ============================================
// Example 2: Adding Operations
// ============================================

async function addOperations(queue: OfflineQueue) {
  // Add a simple create operation
  const op1Id = await queue.add({
    type: 'create',
    table: 'attendance',
    data: {
      student_id: 'student-123',
      date: new Date().toISOString(),
      status: 'present',
      marked_by: 'teacher-456',
    },
  });

  // Add an update operation with priority
  const op2Id = await queue.add({
    type: 'update',
    table: 'grades',
    data: {
      id: 'grade-789',
      score: 95,
      comment: 'Excellent work',
    },
    priority: 'high', // Will sync before normal/low priority
  });

  // Add operation with metadata for context
  const op3Id = await queue.add({
    type: 'create',
    table: 'lesson_logs',
    data: {
      class_id: 'class-101',
      subject: 'Mathematics',
      topic: 'Algebra',
      date: new Date().toISOString(),
    },
    metadata: {
      userId: 'teacher-456',
      deviceId: 'device-abc',
      schoolId: 'school-xyz',
    },
  });

  console.log('Added operations:', { op1Id, op2Id, op3Id });
}

// ============================================
// Example 3: Syncing
// ============================================

async function performSync(syncEngine: SyncEngine) {
  // Push only (send local changes to server)
  const pushResult = await syncEngine.sync();
  console.log('Push result:', pushResult);
  // {
  //   success: true,
  //   synced: 3,
  //   failed: 0,
  //   errors: []
  // }

  // Bidirectional sync (push + pull)
  const biResult = await syncEngine.syncBidirectional([
    'attendance',
    'grades',
    'payments',
  ]);
  console.log('Bidirectional result:', biResult);
  // {
  //   success: true,
  //   synced: 3,
  //   failed: 0,
  //   errors: [],
  //   pullResults: [...],
  //   mode: 'cloud'
  // }
}

// ============================================
// Example 4: React Component
// ============================================

function AttendanceApp() {
  const { addOperation, sync, isOnline, stats } = useOfflineQueue();
  const { status, mode, gatewayUrl } = useSyncStatus();

  const handleMarkAttendance = async (studentId: string, status: string) => {
    await addOperation({
      type: 'create',
      table: 'attendance',
      data: {
        student_id: studentId,
        date: new Date().toISOString().split('T')[0],
        status,
        marked_by: 'current-user-id',
      },
      priority: 'high',
    });
  };

  const handleSync = async () => {
    const result = await sync();
    if (result.success) {
      alert(`Synced ${result.synced} operations successfully`);
    } else {
      alert(`Sync completed with ${result.failed} errors`);
    }
  };

  return (
    <div className="p-4">
      {/* Status indicator */}
      <div className="mb-4 p-2 bg-gray-100 rounded">
        <p>Status: {status}</p>
        <p>Mode: {mode}</p>
        {mode === 'gateway' && <p>Gateway: {gatewayUrl}</p>}
        <p>Online: {isOnline ? 'Yes' : 'No'}</p>
        <p>Queue: {stats.unsynced} pending</p>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => handleMarkAttendance('student-1', 'present')}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Mark Present
        </button>

        <button
          onClick={() => handleMarkAttendance('student-1', 'absent')}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Mark Absent
        </button>

        <button
          onClick={handleSync}
          disabled={!isOnline || status === 'syncing'}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {status === 'syncing' ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Stats */}
      <div className="mt-4 p-2 bg-gray-100 rounded">
        <h3 className="font-bold">Queue Statistics</h3>
        <p>Total: {stats.total}</p>
        <p>Synced: {stats.synced}</p>
        <p>Pending: {stats.unsynced}</p>
        <p>Failed: {stats.failed}</p>
      </div>
    </div>
  );
}

// ============================================
// Example 5: Monitoring Sync Events
// ============================================

async function monitorSyncEvents(syncEngine: SyncEngine) {
  // Subscribe to sync status changes
  const unsubscribeStatus = syncEngine.subscribe((status) => {
    console.log('Sync status changed:', status);
    if (status === 'idle') {
      console.log('Sync completed successfully');
    } else if (status === 'error') {
      console.log('Sync encountered errors');
    }
  });

  // Subscribe to sync mode changes (Gateway vs Cloud)
  const unsubscribeMode = syncEngine.subscribeToMode((mode) => {
    console.log('Sync mode changed:', mode);
    if (mode === 'gateway') {
      console.log('Using LAN Gateway for faster sync');
    } else {
      console.log('Using Cloud for sync');
    }
  });

  // Auto-sync every 30 seconds
  const stopAutoSync = syncEngine.startAutoSync(30000);

  // Cleanup
  return () => {
    unsubscribeStatus();
    unsubscribeMode();
    stopAutoSync();
  };
}

// ============================================
// Example 6: Error Handling
// ============================================

async function handleErrors(syncEngine: SyncEngine) {
  try {
    const result = await syncEngine.sync();

    if (result.failed > 0) {
      console.error('Some operations failed to sync:');
      result.errors.forEach((error) => {
        console.error(`  - ${error.operationId}: ${error.error}`);
      });

      // Retry failed operations
      const retryResult = await syncEngine.retryFailed();
      console.log('Retry result:', retryResult);
    }
  } catch (error) {
    console.error('Sync failed:', error);

    // Check if it's a network error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('Network error - operations will sync when connection is restored');
    }
  }
}

// Export for use
export {
  basicSetup,
  addOperations,
  performSync,
  AttendanceApp,
  monitorSyncEvents,
  handleErrors,
};
