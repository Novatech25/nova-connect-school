import { useState, useEffect, useCallback, useRef } from "react";
import { ConflictRecord } from '../conflict/types';
import { ConflictResolver } from '../conflict/ConflictResolution';
import { OfflineQueue } from '../queue';
import { createStorageAdapter } from '../storage';

export function useConflictResolution() {
  const [initialized, setInitialized] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const conflictResolverRef = useRef<ConflictResolver | null>(null);
  const initializingRef = useRef(false);

  // Initialize conflict resolver
  useEffect(() => {
    if (initialized || initializingRef.current) return;

    initializingRef.current = true;

    const init = async () => {
      try {
        const storage = await createStorageAdapter();
        const resolver = new ConflictResolver(storage);
        conflictResolverRef.current = resolver;
        setInitialized(true);
      } catch (error) {
        console.error("Failed to initialize conflict resolver:", error);
        initializingRef.current = false;
      }
    };

    init();
  }, [initialized]);

  // Load conflicts
  const loadConflicts = useCallback(async () => {
    if (!conflictResolverRef.current) return;

    setLoading(true);
    try {
      const unresolvedConflicts = await conflictResolverRef.current.getUnresolvedConflicts();
      setConflicts(unresolvedConflicts);
    } catch (error) {
      console.error("Failed to load conflicts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load conflicts on initialization and periodically
  useEffect(() => {
    if (!initialized) return;

    loadConflicts();

    const intervalId = setInterval(loadConflicts, 10000); // Every 10 seconds

    return () => clearInterval(intervalId);
  }, [initialized, loadConflicts]);

  // Resolve a conflict manually
  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'local' | 'server' | 'merge',
    resolvedBy: string,
    mergedData?: any
  ) => {
    if (!conflictResolverRef.current) {
      throw new Error("Conflict resolver not initialized");
    }

    try {
      await conflictResolverRef.current.resolveManually(
        conflictId,
        resolution,
        resolvedBy,
        mergedData
      );

      // Reload conflicts
      await loadConflicts();
    } catch (error) {
      console.error("Failed to resolve conflict:", error);
      throw error;
    }
  }, [loadConflicts]);

  // Auto-resolve conflicts with a specific strategy
  const autoResolveConflicts = useCallback(async (
    strategy: 'client-wins' | 'server-wins' | 'last-write-wins' | 'merge'
  ) => {
    if (!conflictResolverRef.current) {
      throw new Error("Conflict resolver not initialized");
    }

    setLoading(true);
    try {
      const unresolvedConflicts = await conflictResolverRef.current.getUnresolvedConflicts();

      for (const conflict of unresolvedConflicts) {
        await conflictResolverRef.current.resolveManually(
          conflict.id,
          strategy === 'client-wins' ? 'local' : strategy === 'server-wins' ? 'server' : 'merge',
          'system_auto_resolve'
        );
      }

      // Reload conflicts
      await loadConflicts();
    } catch (error) {
      console.error("Failed to auto-resolve conflicts:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadConflicts]);

  // Get conflicts by table
  const getConflictsByTable = useCallback((table: string) => {
    return conflicts.filter(c => c.table === table && !c.resolvedAt);
  }, [conflicts]);

  // Get conflict count
  const conflictsCount = conflicts.filter(c => !c.resolvedAt).length;

  return {
    initialized,
    conflicts,
    conflictsCount,
    loading,
    resolveConflict,
    autoResolveConflicts,
    getConflictsByTable,
    loadConflicts,
  };
}
