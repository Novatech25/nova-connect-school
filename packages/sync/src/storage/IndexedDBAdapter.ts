import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { StorageAdapter } from './types';

interface NovaConnectDB extends DBSchema {
  queue: {
    key: string;
    value: {
      id: string;
      synced: boolean;
      timestamp: number;
      table: string;
      operation: any;
    };
    indexes: {
      'by-synced': boolean;
      'by-timestamp': number;
      'by-table': string;
    };
  };
  sync_metadata: {
    key: string;
    value: {
      key: string;
      value: any;
      timestamp: number;
    };
    indexes: {
      'by-timestamp': number;
    };
  };
  sync_data: {
    key: string;
    value: {
      id: string;
      table: string;
      data: any;
      updated_at: number;
    };
    indexes: {
      'by-table': string;
      'by-updated-at': number;
    };
  };
  conflict_cache: {
    key: string;
    value: {
      id: string;
      table: string;
      recordId: string;
      localData: any;
      serverData: any;
      detectedAt: number;
      resolvedAt?: number;
      resolution?: string;
      resolvedBy?: string;
    };
    indexes: {
      'by-table': string;
      'by-resolved': number;
    };
  };
}

export class IndexedDBAdapter implements StorageAdapter {
  private db: IDBPDatabase<NovaConnectDB> | null = null;
  private dbName = 'novaconnect_offline';
  private dbVersion = 1;
  private initialized = false;
  private fallbackToLocalStorage = false;
  private localStorageCache: Map<string, string> = new Map();

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      this.db = await openDB<NovaConnectDB>(this.dbName, this.dbVersion, {
        upgrade(db) {
          // Create queue store
          if (!db.objectStoreNames.contains('queue')) {
            const queueStore = db.createObjectStore('queue', { keyPath: 'id' });
            queueStore.createIndex('by-synced', 'synced');
            queueStore.createIndex('by-timestamp', 'timestamp');
            queueStore.createIndex('by-table', 'table');
          }

          // Create sync_metadata store
          if (!db.objectStoreNames.contains('sync_metadata')) {
            const metadataStore = db.createObjectStore('sync_metadata', { keyPath: 'key' });
            metadataStore.createIndex('by-timestamp', 'timestamp');
          }

          // Create sync_data store (for pulled records, separate from metadata)
          if (!db.objectStoreNames.contains('sync_data')) {
            const dataStore = db.createObjectStore('sync_data', { keyPath: 'id' });
            dataStore.createIndex('by-table', 'table');
            dataStore.createIndex('by-updated-at', 'updated_at');
          }

          // Create conflict_cache store
          if (!db.objectStoreNames.contains('conflict_cache')) {
            const conflictStore = db.createObjectStore('conflict_cache', { keyPath: 'id' });
            conflictStore.createIndex('by-table', 'table');
            conflictStore.createIndex('by-resolved', 'resolvedAt');
          }
        },
      });

      this.initialized = true;
    } catch (error) {
      console.warn('IndexedDB not available, falling back to localStorage:', error);
      this.fallbackToLocalStorage = true;
      this.initialized = true;

      // Load existing data from localStorage into cache
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('novaconnect_')) {
          const value = localStorage.getItem(key);
          if (value) {
            this.localStorageCache.set(key, value);
          }
        }
      });
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('IndexedDBAdapter not initialized. Call init() first.');
    }
  }

  private getStorePrefix(storeName?: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache'): string {
    return storeName ? `novaconnect_${storeName}_` : 'novaconnect_';
  }

  async get<T>(key: string, storeName?: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache'): Promise<T | null> {
    this.ensureInitialized();

    if (this.fallbackToLocalStorage) {
      const storePrefix = this.getStorePrefix(storeName);
      const value = this.localStorageCache.get(storePrefix + key);
      return value ? JSON.parse(value) : null;
    }

    if (!this.db) return null;

    try {
      const store = storeName || 'sync_metadata';

      if (store === 'sync_metadata') {
        const result = await this.db.get('sync_metadata', key);
        return result ? result.value as T : null;
      } else if (store === 'sync_data') {
        const result = await this.db.get('sync_data', key);
        return result as unknown as T;
      } else {
        // queue or conflict_cache
        const result = await this.db.get(store, key);
        return result as unknown as T;
      }
    } catch (error) {
      console.error('Error getting from IndexedDB:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, storeName?: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache'): Promise<void> {
    this.ensureInitialized();

    if (this.fallbackToLocalStorage) {
      const storePrefix = this.getStorePrefix(storeName);
      const storageKey = storePrefix + key;
      const serialized = JSON.stringify(value);
      this.localStorageCache.set(storageKey, serialized);
      localStorage.setItem(storageKey, serialized);
      return;
    }

    if (!this.db) return;

    try {
      const store = storeName || 'sync_metadata';

      if (store === 'sync_metadata') {
        await this.db.put('sync_metadata', {
          key,
          value,
          timestamp: Date.now(),
        });
      } else if (store === 'sync_data') {
        // Store pulled data with table and timestamp
        await this.db.put('sync_data', {
          id: key,
          table: (value as any).table || 'unknown',
          data: value,
          updated_at: (value as any).updated_at ? new Date((value as any).updated_at).getTime() : Date.now(),
        } as any);
      } else {
        // queue or conflict_cache
        await this.db.put(store, value);
      }
    } catch (error) {
      console.error('Error setting to IndexedDB:', error);
      throw error;
    }
  }

  async remove(key: string, storeName?: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache'): Promise<void> {
    this.ensureInitialized();

    if (this.fallbackToLocalStorage) {
      const storePrefix = this.getStorePrefix(storeName);
      const storageKey = storePrefix + key;
      this.localStorageCache.delete(storageKey);
      localStorage.removeItem(storageKey);
      return;
    }

    if (!this.db) return;

    try {
      const store = storeName || 'sync_metadata';
      await this.db.delete(store, key);
    } catch (error) {
      console.error('Error removing from IndexedDB:', error);
      throw error;
    }
  }

  async clear(storeName?: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache'): Promise<void> {
    this.ensureInitialized();

    if (this.fallbackToLocalStorage) {
      const storePrefix = this.getStorePrefix(storeName);
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(storePrefix)) {
          this.localStorageCache.delete(key);
          localStorage.removeItem(key);
        }
      });
      return;
    }

    if (!this.db) return;

    try {
      const store = storeName || 'sync_metadata';
      await this.db.clear(store);
    } catch (error) {
      console.error('Error clearing IndexedDB:', error);
      throw error;
    }
  }

  async keys(storeName?: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache'): Promise<string[]> {
    this.ensureInitialized();

    if (this.fallbackToLocalStorage) {
      const storePrefix = this.getStorePrefix(storeName);
      return Array.from(this.localStorageCache.keys())
        .filter(key => key.startsWith(storePrefix))
        .map(key => key.replace(storePrefix, ''));
    }

    if (!this.db) return [];

    try {
      const store = storeName || 'sync_metadata';
      const allKeys = await this.db.getAllKeys(store);
      return allKeys.map(k => String(k));
    } catch (error) {
      console.error('Error getting keys from IndexedDB:', error);
      return [];
    }
  }

  async getAll<T>(storeName?: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache'): Promise<T[]> {
    this.ensureInitialized();

    if (this.fallbackToLocalStorage) {
      const values: T[] = [];
      const storePrefix = this.getStorePrefix(storeName);
      this.localStorageCache.forEach((value, key) => {
        if (key.startsWith(storePrefix)) {
          values.push(JSON.parse(value));
        }
      });
      return values;
    }

    if (!this.db) return [];

    try {
      const store = storeName || 'sync_metadata';
      const all = await this.db.getAll(store);

      if (store === 'sync_metadata') {
        return all.map(item => item.value as unknown as T);
      }

      if (store === 'sync_data') {
        return all.map(item => (item as any).data as T);
      }

      return all as unknown as T[];
    } catch (error) {
      console.error('Error getting all from IndexedDB:', error);
      return [];
    }
  }

  async transaction<T>(
    stores: ('queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache')[],
    callback: (tx: any) => Promise<T>
  ): Promise<T> {
    this.ensureInitialized();

    if (this.fallbackToLocalStorage) {
      // For localStorage fallback, just run the callback
      return callback({});
    }

    if (!this.db) throw new Error('Database not initialized');

    try {
      const tx = this.db.transaction(stores, 'readwrite');
      const result = await callback(tx);
      await tx.done;
      return result;
    } catch (error) {
      console.error('Error in transaction:', error);
      throw error;
    }
  }

  async getByIndex<T>(
    storeName: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache',
    indexName: string,
    value: any
  ): Promise<T[]> {
    this.ensureInitialized();

    if (this.fallbackToLocalStorage) {
      return this.getAll<T>(storeName);
    }

    if (!this.db) return [];

    try {
      const store = this.db.transaction(storeName).store;
      const index = store.index(indexName);
      const results = await index.getAll(value);
      return results as unknown as T[];
    } catch (error) {
      console.error('Error getting by index from IndexedDB:', error);
      return [];
    }
  }

  async getByIndexRange<T>(
    storeName: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache',
    indexName: string,
    lowerBound?: any,
    upperBound?: any
  ): Promise<T[]> {
    this.ensureInitialized();

    if (this.fallbackToLocalStorage) {
      return this.getAll<T>(storeName);
    }

    if (!this.db) return [];

    try {
      const store = this.db.transaction(storeName).store;
      const index = store.index(indexName);

      let range;
      if (lowerBound !== undefined && upperBound !== undefined) {
        range = IDBKeyRange.bound(lowerBound, upperBound);
      } else if (lowerBound !== undefined) {
        range = IDBKeyRange.lowerBound(lowerBound);
      } else if (upperBound !== undefined) {
        range = IDBKeyRange.upperBound(upperBound);
      }

      const results = range ? await index.getAll(range) : await index.getAll();
      return results as unknown as T[];
    } catch (error) {
      console.error('Error getting by index range from IndexedDB:', error);
      return [];
    }
  }

  isUsingFallback(): boolean {
    return this.fallbackToLocalStorage;
  }

  async getStoreSize(storeName: 'queue' | 'sync_metadata' | 'conflict_cache'): Promise<number> {
    this.ensureInitialized();

    if (this.fallbackToLocalStorage) {
      return this.localStorageCache.size;
    }

    if (!this.db) return 0;

    try {
      const count = await this.db.count(storeName);
      return count;
    } catch (error) {
      console.error('Error getting store size:', error);
      return 0;
    }
  }
}
