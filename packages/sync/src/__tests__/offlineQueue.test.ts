import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { OfflineQueue } from '../queue/OfflineQueue';
import { StorageAdapter } from '../storage/types';

// Mock in-memory StorageAdapter for testing
class InMemoryStorageAdapter implements StorageAdapter {
  private readonly stores: Map<string, Map<string, any>> = new Map();

  async init(): Promise<void> {
    // Initialize stores
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
    // Simple transaction simulation for in-memory storage
    return callback({});
  }
}

describe('OfflineQueue', () => {
  let queue: OfflineQueue;
  let mockStorage: InMemoryStorageAdapter;

  beforeEach(async () => {
    mockStorage = new InMemoryStorageAdapter();
    queue = new OfflineQueue(mockStorage);
    await queue.init();
  });

  afterEach(async () => {
    await queue.clear();
  });

  describe('add', () => {
    it('should add operation to queue', async () => {
      const operation = {
        type: 'create' as const,
        table: 'attendance',
        data: { student_id: 'student-1', status: 'present' },
      };

      const opId = await queue.add(operation);

      const retrieved = await queue.getById(opId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(opId);
      expect(retrieved?.type).toBe('create');
      expect(retrieved?.table).toBe('attendance');
    });

    it('should assign priority to operations', async () => {
      const op1 = {
        type: 'create' as const,
        table: 'attendance',
        data: {},
        priority: 'high' as const,
      };
      const op2 = {
        type: 'update' as const,
        table: 'grades',
        data: {},
        priority: 'normal' as const,
      };

      await queue.add(op1);
      await queue.add(op2);

      const all = await queue.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('getById', () => {
    it('should retrieve operation by id', async () => {
      const operation = {
        type: 'create' as const,
        table: 'attendance',
        data: { student_id: 'student-1' },
      };

      const opId = await queue.add(operation);
      const retrieved = await queue.getById(opId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(opId);
    });

    it('should return null for non-existent operation', async () => {
      const retrieved = await queue.getById('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should retrieve all operations', async () => {
      await queue.add({
        type: 'create' as const,
        table: 'attendance',
        data: {},
      });
      await queue.add({
        type: 'update' as const,
        table: 'grades',
        data: {},
      });
      await queue.add({
        type: 'delete' as const,
        table: 'students',
        data: {},
      });

      const all = await queue.getAll();
      expect(all).toHaveLength(3);
    });

    it('should return empty array when queue is empty', async () => {
      const all = await queue.getAll();
      expect(all).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      await queue.add({
        type: 'create' as const,
        table: 'attendance',
        data: {},
        synced: false,
        retryCount: 0,
      });
      await queue.add({
        type: 'update' as const,
        table: 'grades',
        data: {},
        synced: false,
        retryCount: 5, // Failed
      });

      const stats = await queue.getStats();

      expect(stats.total).toBe(2);
      expect(stats.unsynced).toBe(2);
      expect(stats.failed).toBe(1);
    });

    it('should return zero stats for empty queue', async () => {
      const stats = await queue.getStats();

      expect(stats.total).toBe(0);
      expect(stats.synced).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('priority sorting', () => {
    it('should sort operations by priority', async () => {
      await queue.add({
        type: 'create' as const,
        table: 'attendance',
        data: {},
        priority: 'low' as const,
      });
      await queue.add({
        type: 'update' as const,
        table: 'grades',
        data: {},
        priority: 'high' as const,
      });
      await queue.add({
        type: 'delete' as const,
        table: 'students',
        data: {},
        priority: 'normal' as const,
      });

      const all = await queue.getAll();

      expect(all[0].priority).toBe('high');
      expect(all[1].priority).toBe('normal');
      expect(all[2].priority).toBe('low');
    });
  });

  describe('remove', () => {
    it('should remove operation from queue', async () => {
      const opId = await queue.add({
        type: 'create' as const,
        table: 'attendance',
        data: {},
      });

      await queue.remove(opId);

      const retrieved = await queue.getById(opId);
      expect(retrieved).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all operations', async () => {
      await queue.add({
        type: 'create' as const,
        table: 'attendance',
        data: {},
      });
      await queue.add({
        type: 'update' as const,
        table: 'grades',
        data: {},
      });

      await queue.clear();

      const all = await queue.getAll();
      expect(all).toHaveLength(0);
    });
  });
});
