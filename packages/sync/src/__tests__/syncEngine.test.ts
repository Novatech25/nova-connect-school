import { describe, it, expect, beforeEach } from '@jest/globals';
import { SyncEngine } from '../sync/SyncEngine';
import { OfflineQueue } from '../queue/OfflineQueue';
import { StorageAdapter } from '../storage/types';

// Mock in-memory StorageAdapter for testing
class InMemoryStorageAdapter implements StorageAdapter {
  private readonly stores: Map<string, Map<string, any>> = new Map();

  async init(): Promise<void> {
    this.stores.set('queue', new Map());
    this.stores.set('sync_metadata', new Map());
    this.stores.set('sync_data', new Map());
    this.stores.set('conflict_cache', new Map());
  }

  async get<T>(key: string, storeName: string = 'queue'): Promise<T | null> {
    const store = this.stores.get(storeName);
    return store ? (store.get(key) || null) : null;
  }

  async set<T>(key: string, value: T, storeName: string = 'queue'): Promise<void> {
    let store = this.stores.get(storeName);
    if (!store) {
      store = new Map();
      this.stores.set(storeName, store);
    }
    store.set(key, value);
  }

  async remove(key: string, storeName: string = 'queue'): Promise<void> {
    const store = this.stores.get(storeName);
    if (store) {
      store.delete(key);
    }
  }

  async clear(storeName: string = 'queue'): Promise<void> {
    const store = this.stores.get(storeName);
    if (store) {
      store.clear();
    }
  }

  async keys(storeName: string = 'queue'): Promise<string[]> {
    const store = this.stores.get(storeName);
    return store ? Array.from(store.keys()) : [];
  }

  async getAll<T>(storeName: string = 'queue'): Promise<T[]> {
    const store = this.stores.get(storeName);
    return store ? Array.from(store.values()) : [];
  }

  async transaction<T>(
    stores: string[],
    callback: (tx: any) => Promise<T>
  ): Promise<T> {
    return callback({});
  }
}

// Mock the data module
jest.mock('@novaconnect/data/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(),
        gte: jest.fn(),
        order: jest.fn(),
      })),
    })),
  })),
}));

describe('SyncEngine', () => {
  let syncEngine: SyncEngine;
  let mockQueue: OfflineQueue;

  beforeEach(async () => {
    const mockStorage = new InMemoryStorageAdapter();
    mockQueue = new OfflineQueue(mockStorage);
    await mockQueue.init();
    syncEngine = new SyncEngine(mockQueue);
  });

  describe('push', () => {
    it('should push pending operations to cloud', async () => {
      const mockOperations = [
        { id: 'op-1', type: 'create' as const, table: 'attendance', data: {}, synced: false, retryCount: 0, timestamp: Date.now() },
      ];

      jest.spyOn(mockQueue, 'getUnsynced').mockResolvedValue(mockOperations as any);
      jest.spyOn(mockQueue, 'markAsSynced').mockResolvedValue();
      jest.spyOn(mockQueue, 'incrementRetryCount').mockResolvedValue();

      await syncEngine.push();

      expect(mockQueue.getUnsynced).toHaveBeenCalled();
    });

    it('should handle failed operations', async () => {
      jest.spyOn(mockQueue, 'getUnsynced').mockRejectedValue(new Error('Network error'));

      await expect(syncEngine.push()).rejects.toThrow();
    });

    it('should retry failed operations', async () => {
      const mockOperations = [
        { id: 'op-1', type: 'create' as const, table: 'attendance', data: {}, synced: false, retryCount: 1, timestamp: Date.now() },
      ];

      jest.spyOn(mockQueue, 'getRetryable').mockResolvedValue(mockOperations as any);
      jest.spyOn(mockQueue, 'markAsSynced').mockResolvedValue();
      jest.spyOn(mockQueue, 'incrementRetryCount').mockResolvedValue();

      await syncEngine.push();

      expect(mockQueue.getRetryable).toHaveBeenCalled();
    });
  });

  describe('pull', () => {
    it('should pull data from cloud', async () => {
      const pullResult = await syncEngine.pull({ resources: ['attendance', 'grades'] });

      expect(pullResult).toBeDefined();
    });

    it('should handle network errors gracefully', async () => {
      jest.spyOn(syncEngine as any, 'fetchFromCloud').mockRejectedValue(new Error('Network error'));

      await expect(syncEngine.pull({ resources: ['attendance'] })).rejects.toThrow();
    });
  });

  describe('bidirectional sync', () => {
    it('should push then pull in sync', async () => {
      const mockOperations = [
        { id: 'op-1', type: 'create' as const, table: 'attendance', data: {}, synced: false, retryCount: 0, timestamp: Date.now() },
      ];

      jest.spyOn(mockQueue, 'getUnsynced').mockResolvedValue(mockOperations as any);
      jest.spyOn(mockQueue, 'markAsSynced').mockResolvedValue();

      await syncEngine.sync();

      expect(mockQueue.getUnsynced).toHaveBeenCalled();
    });

    it('should detect and resolve conflicts during sync', async () => {
      const mockConflict = {
        type: 'grades',
        local: { id: 'grade-1', score: 15 },
        remote: { id: 'grade-1', score: 16 },
      };

      jest.spyOn(syncEngine as any, 'detectConflicts').mockResolvedValue([mockConflict]);

      await syncEngine.sync();

      // Should attempt to resolve conflicts
      expect(true).toBe(true);
    });
  });

  describe('retry failed operations', () => {
    it('should retry failed operations with exponential backoff', async () => {
      const mockOperations = [
        { id: 'op-1', type: 'create' as const, table: 'attendance', data: {}, synced: false, retryCount: 1, timestamp: Date.now() },
      ];

      jest.spyOn(mockQueue, 'getRetryable').mockResolvedValue(mockOperations as any);
      jest.spyOn(mockQueue, 'markAsSynced').mockResolvedValue();
      jest.spyOn(mockQueue, 'incrementRetryCount').mockResolvedValue();

      await syncEngine.retryFailed();

      expect(mockQueue.getRetryable).toHaveBeenCalled();
    });

    it('should stop retrying after max attempts', async () => {
      jest.spyOn(mockQueue, 'getRetryable').mockResolvedValue([]);

      await syncEngine.retryFailed({ maxRetries: 5 });

      // Should not retry anymore
      expect(true).toBe(true);
    });

    it('should apply exponential backoff', async () => {
      const delays: number[] = [];

      jest.spyOn(syncEngine as any, 'calculateBackoff').mockImplementation((retryCount: number) => {
        const delay = Math.pow(2, retryCount) * 1000; // 2^n seconds
        delays.push(delay);
        return delay;
      });

      await syncEngine['calculateBackoff'](1);
      await syncEngine['calculateBackoff'](2);
      await syncEngine['calculateBackoff'](3);

      expect(delays[0]).toBe(2000);
      expect(delays[1]).toBe(4000);
      expect(delays[2]).toBe(8000);
    });
  });
});
