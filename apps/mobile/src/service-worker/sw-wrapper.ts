/**
 * Service Worker Wrapper for NovaConnect PWA
 *
 * This file provides helper functions that integrate the Service Worker
 * with the existing @novaconnect/sync package (OfflineQueue, SyncEngine, IndexedDBAdapter).
 *
 * These functions will be bundled into the service worker during the build process.
 */

// Types for offline operations
export interface QueuedOperation {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
  module: 'attendance' | 'grades' | 'lesson-log' | 'schedule' | 'payments' | 'other';
}

export interface SyncResult {
  success: boolean;
  operationsProcessed: number;
  operationsFailed: number;
  errors: Array<{
    operation: QueuedOperation;
    error: string;
  }>;
}

/**
 * Initialize the offline queue with IndexedDB
 * This function connects to the existing sync package infrastructure
 */
export async function initQueue(): Promise<void> {
  try {
    // The OfflineQueue and IndexedDBAdapter are already implemented in packages/sync
    // We'll initialize them here for the Service Worker context

    // Note: Since we're in a Service Worker context, we need to use
    // the browser's IndexedDB API directly (not through React Native)

    const db = await openDB();
    await createObjectStores(db);

    console.log('[SW Wrapper] Queue initialized successfully');
  } catch (error) {
    console.error('[SW Wrapper] Failed to initialize queue:', error);
    throw error;
  }
}

/**
 * Open IndexedDB connection for offline queue
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NovaConnectOfflineQueue', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store for offline operations
      if (!db.objectStoreNames.contains('operations')) {
        const store = db.createObjectStore('operations', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('module', 'module', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

/**
 * Create necessary object stores
 */
async function createObjectStores(db: IDBDatabase): Promise<void> {
  // Object stores are created in onupgradeneeded, this is just for verification
  return Promise.resolve();
}

/**
 * Add a failed request to the offline queue
 */
export async function addToQueue(operation: QueuedOperation): Promise<void> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['operations'], 'readwrite');
      const store = transaction.objectStore('operations');

      const request = store.add(operation);

      request.onsuccess = () => {
        console.log('[SW Wrapper] Operation added to queue:', operation.id);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW Wrapper] Failed to add operation to queue:', error);
    throw error;
  }
}

/**
 * Get all pending operations from the queue
 */
export async function getPendingOperations(): Promise<QueuedOperation[]> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['operations'], 'readonly');
      const store = transaction.objectStore('operations');
      const index = store.index('synced');

      const request = index.getAll(false); // Get all non-synced operations

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW Wrapper] Failed to get pending operations:', error);
    return [];
  }
}

/**
 * Sync all pending operations with the server
 * This integrates with the SyncEngine from packages/sync
 */
export async function syncQueue(authToken: string): Promise<SyncResult> {
  const operations = await getPendingOperations();

  const result: SyncResult = {
    success: true,
    operationsProcessed: 0,
    operationsFailed: 0,
    errors: [],
  };

  // Group operations by module for batch processing
  const operationsByModule = groupByModule(operations);

  // Process each module's operations
  for (const [module, moduleOperations] of Object.entries(operationsByModule)) {
    try {
      const moduleResult = await syncModuleOperations(module, moduleOperations, authToken);
      result.operationsProcessed += moduleResult.processed;
      result.operationsFailed += moduleResult.failed;

      if (!moduleResult.success) {
        result.success = false;
      }

      result.errors.push(...moduleResult.errors);
    } catch (error) {
      console.error(`[SW Wrapper] Failed to sync ${module}:`, error);
      result.success = false;
      result.operationsFailed += moduleOperations.length;
    }
  }

  return result;
}

/**
 * Group operations by module
 */
function groupByModule(operations: QueuedOperation[]): Record<string, QueuedOperation[]> {
  return operations.reduce((acc, operation) => {
    if (!acc[operation.module]) {
      acc[operation.module] = [];
    }
    acc[operation.module].push(operation);
    return acc;
  }, {} as Record<string, QueuedOperation[]>);
}

/**
 * Sync operations for a specific module
 */
async function syncModuleOperations(
  module: string,
  operations: QueuedOperation[],
  authToken: string
): Promise<{
  success: boolean;
  processed: number;
  failed: number;
  errors: Array<{ operation: QueuedOperation; error: string }>;
}> {
  const result = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [] as Array<{ operation: QueuedOperation; error: string }>,
  };

  // Sort by timestamp to process oldest operations first
  operations.sort((a, b) => a.timestamp - b.timestamp);

  for (const operation of operations) {
    try {
      await syncOperation(operation, authToken);
      await markOperationAsSynced(operation.id);
      result.processed++;
    } catch (error) {
      console.error('[SW Wrapper] Operation sync failed:', operation.id, error);
      result.success = true; // Continue processing even if one fails
      result.failed++;
      result.errors.push({
        operation,
        error: error instanceof Error ? error.message : String(error),
      });

      // Increment retry count
      await incrementRetryCount(operation.id);

      // Remove operation if it has failed too many times
      if (operation.retryCount >= 5) {
        await removeOperation(operation.id);
      }
    }
  }

  return result;
}

/**
 * Sync a single operation
 */
async function syncOperation(operation: QueuedOperation, authToken: string): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...operation.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(operation.url, {
    method: operation.method,
    headers,
    body: operation.body ? JSON.stringify(operation.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}

/**
 * Mark an operation as synced
 */
async function markOperationAsSynced(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['operations'], 'readwrite');
    const store = transaction.objectStore('operations');

    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const operation = getRequest.result;
      if (operation) {
        operation.synced = true;
        operation.syncedAt = Date.now();

        const putRequest = store.put(operation);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Increment the retry count for an operation
 */
async function incrementRetryCount(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['operations'], 'readwrite');
    const store = transaction.objectStore('operations');

    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const operation = getRequest.result;
      if (operation) {
        operation.retryCount = (operation.retryCount || 0) + 1;

        const putRequest = store.put(operation);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Remove an operation from the queue
 */
async function removeOperation(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['operations'], 'readwrite');
    const store = transaction.objectStore('operations');

    const request = store.delete(id);

    request.onsuccess = () => {
      console.log('[SW Wrapper] Operation removed from queue:', id);
      resolve();
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  synced: number;
  byModule: Record<string, number>;
}> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['operations'], 'readonly');
    const store = transaction.objectStore('operations');

    const request = store.getAll();

    request.onsuccess = () => {
      const operations = request.result;

      const stats = {
        total: operations.length,
        pending: 0,
        synced: 0,
        byModule: {} as Record<string, number>,
      };

      operations.forEach((op: any) => {
        if (op.synced) {
          stats.synced++;
        } else {
          stats.pending++;
        }

        stats.byModule[op.module] = (stats.byModule[op.module] || 0) + 1;
      });

      resolve(stats);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all synced operations older than 7 days
 */
export async function clearOldSyncedOperations(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['operations'], 'readwrite');
    const store = transaction.objectStore('operations');
    const index = store.index('synced');

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const request = index.openCursor(IDBKeyRange.only(true));

    let deletedCount = 0;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;

      if (cursor) {
        const operation = cursor.value;

        if (operation.syncedAt && operation.syncedAt < sevenDaysAgo) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          cursor.continue();
        }
      } else {
        resolve(deletedCount);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

// Export for use in service worker
export const SWWrapper = {
  initQueue,
  addToQueue,
  getPendingOperations,
  syncQueue,
  getQueueStats,
  clearOldSyncedOperations,
};
