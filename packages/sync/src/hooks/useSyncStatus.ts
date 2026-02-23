import { useState, useEffect, useCallback, useRef } from "react";
import { OfflineQueue } from "../queue";
import { SyncEngine, type SyncStatus, type SyncMode } from "../sync";
import { createStorageAdapter } from "../storage";

export function useSyncStatus() {
  const [initialized, setInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? navigator.onLine : true
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMode, setSyncMode] = useState<SyncMode>("cloud");
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [conflictsCount, setConflictsCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState(0);
  const [queueStats, setQueueStats] = useState({
    total: 0,
    synced: 0,
    unsynced: 0,
    retryable: 0,
    failed: 0,
    byTable: {},
  });

  const queueRef = useRef<OfflineQueue | null>(null);
  const syncEngineRef = useRef<SyncEngine | null>(null);
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
        const queue = new OfflineQueue(storage);
        await queue.init();
        queueRef.current = queue;

        // Create sync engine
        const syncEngine = new SyncEngine(queue);
        syncEngineRef.current = syncEngine;

        // Load initial stats
        const stats = await queue.getStats();
        setQueueStats(stats);
        setUnsyncedCount(stats.unsynced);

        // Subscribe to sync status changes
        const unsubscribeStatus = syncEngine.subscribe((status) => {
          setSyncStatus(status);
          if (status === "idle") {
            setSyncProgress(100);
            setLastSyncTime(new Date());
          } else if (status === "syncing") {
            setSyncProgress(0);
          }
        });

        // Subscribe to sync mode changes
        const unsubscribeMode = syncEngine.subscribeToMode((mode) => {
          setSyncMode(mode);
          if (mode === 'gateway') {
            const gatewayInfo = syncEngine.getCurrentMode();
            setGatewayUrl(gatewayInfo === 'gateway' ? 'LAN Gateway' : null);
          } else {
            setGatewayUrl(null);
          }
        });

        setInitialized(true);

        return () => {
          unsubscribeStatus();
          unsubscribeMode();
        };
      } catch (error) {
        console.error("Failed to initialize sync status:", error);
        initializingRef.current = false;
      }
    };

    init();
  }, [initialized]);

  // Update stats periodically
  useEffect(() => {
    if (!initialized || !queueRef.current) return;

    const updateStats = async () => {
      if (queueRef.current) {
        const stats = await queueRef.current.getStats();
        setQueueStats(stats);
        setUnsyncedCount(stats.unsynced);
      }
    };

    updateStats();
    const intervalId = setInterval(updateStats, 5000);

    return () => clearInterval(intervalId);
  }, [initialized]);

  // Listen for online/offline events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      if (syncEngineRef.current) {
        syncEngineRef.current.sync().catch((error) => {
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
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    if (!queueRef.current) return;

    const stats = await queueRef.current.getStats();
    setQueueStats(stats);
    setUnsyncedCount(stats.unsynced);
  }, []);

  // Trigger sync
  const sync = useCallback(async () => {
    if (!syncEngineRef.current) throw new Error("Sync engine not initialized");

    return syncEngineRef.current.sync();
  }, []);

  return {
    initialized,
    isOnline,
    syncStatus,
    syncMode,
    gatewayUrl,
    lastSyncTime,
    unsyncedCount,
    conflictsCount,
    syncProgress,
    queueStats,
    canSync: isOnline && unsyncedCount > 0,
    refresh,
    sync,
  };
}
