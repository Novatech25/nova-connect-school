import { useState, useEffect, useCallback, useRef } from "react";
import { OfflineQueue, type OfflineOperation, type QueueStats } from "../queue";
import { SyncEngine, type SyncStatus } from "../sync";
import { createStorageAdapter } from "../storage";

export function useOfflineQueue() {
  const [queue, setQueue] = useState<OfflineQueue | null>(null);
  const [syncEngine, setSyncEngine] = useState<SyncEngine | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? navigator.onLine : true
  );
  const [stats, setStats] = useState<QueueStats>({
    total: 0,
    synced: 0,
    unsynced: 0,
    retryable: 0,
    failed: 0,
    byTable: {},
  });
  const [initialized, setInitialized] = useState(false);
  const initializingRef = useRef(false);

  // Initialize queue and sync engine
  useEffect(() => {
    if (initialized || initializingRef.current) return;

    initializingRef.current = true;

    const init = async () => {
      try {
        // Create storage adapter
        const storage = await createStorageAdapter();

        // Create and initialize queue
        const newQueue = new OfflineQueue(storage);
        await newQueue.init();

        // Create sync engine
        const newSyncEngine = new SyncEngine(newQueue);

        setQueue(newQueue);
        setSyncEngine(newSyncEngine);
        setInitialized(true);

        // Load initial stats
        const initialStats = await newQueue.getStats();
        setStats(initialStats);
      } catch (error) {
        console.error("Failed to initialize offline queue:", error);
        initializingRef.current = false;
      }
    };

    init();
  }, [initialized]);

  // Subscribe to sync status changes
  useEffect(() => {
    if (!syncEngine) return;

    const unsubscribe = syncEngine.subscribe(setSyncStatus);
    return unsubscribe;
  }, [syncEngine]);

  // Listen for online/offline events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      if (syncEngine) {
        syncEngine.sync().catch((error) => {
          console.error("Auto-sync failed:", error);
        });
      }
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncEngine]);

  // Add operation to queue
  const addOperation = useCallback(
    async (operation: Omit<OfflineOperation, "id" | "timestamp" | "synced" | "retryCount">) => {
      if (!queue) throw new Error("Queue not initialized");

      const id = await queue.add(operation);

      // Update stats after adding
      const newStats = await queue.getStats();
      setStats(newStats);

      return id;
    },
    [queue]
  );

  // Manually trigger sync
  const sync = useCallback(async () => {
    if (!syncEngine) throw new Error("Sync engine not initialized");

    const result = await syncEngine.sync();

    // Update stats after sync
    if (queue) {
      const newStats = await queue.getStats();
      setStats(newStats);
    }

    return result;
  }, [syncEngine, queue]);

  // Refresh stats
  const refreshStats = useCallback(async () => {
    if (!queue) return;

    const newStats = await queue.getStats();
    setStats(newStats);
  }, [queue]);

  // Clear synced operations
  const clearSynced = useCallback(async () => {
    if (!queue) return;

    await queue.clearSynced();
    const newStats = await queue.getStats();
    setStats(newStats);
  }, [queue]);

  // Retry failed operations
  const retryFailed = useCallback(async () => {
    if (!syncEngine) throw new Error("Sync engine not initialized");

    const result = await syncEngine.retryFailed();

    // Update stats after retry
    if (queue) {
      const newStats = await queue.getStats();
      setStats(newStats);
    }

    return result;
  }, [syncEngine, queue]);

  // Export queue for backup
  const exportQueue = useCallback(async () => {
    if (!queue) throw new Error("Queue not initialized");

    const operations = await queue.getAll();
    return JSON.stringify(operations, null, 2);
  }, [queue]);

  return {
    initialized,
    isOnline,
    syncStatus,
    stats,
    addOperation,
    sync,
    refreshStats,
    clearSynced,
    retryFailed,
    exportQueue,
    queue,
    syncEngine,
  };
}
