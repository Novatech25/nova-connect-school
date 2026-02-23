import { StorageAdapter } from './types';
import { IndexedDBAdapter } from './IndexedDBAdapter';

/**
 * Detect the current runtime environment
 */
export type Environment = 'web' | 'react-native' | 'node' | 'unknown';

function detectEnvironment(): Environment {
  // Check for React Native
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    return 'react-native';
  }

  // Check for Node.js
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node';
  }

  // Check for web browser
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'web';
  }

  return 'unknown';
}

/**
 * LocalStorage adapter as fallback for web
 */
class LocalStorageAdapter implements StorageAdapter {
  private initialized = false;
  private prefix = 'novaconnect_';

  async init(): Promise<void> {
    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('LocalStorageAdapter not initialized. Call init() first.');
    }
  }

  private getStorePrefix(storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): string {
    return storeName ? `${this.prefix}${storeName}_` : this.prefix;
  }

  async get<T>(key: string, storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): Promise<T | null> {
    this.ensureInitialized();
    const storePrefix = this.getStorePrefix(storeName);
    const value = localStorage.getItem(storePrefix + key);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T, storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): Promise<void> {
    this.ensureInitialized();
    const storePrefix = this.getStorePrefix(storeName);
    localStorage.setItem(storePrefix + key, JSON.stringify(value));
  }

  async remove(key: string, storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): Promise<void> {
    this.ensureInitialized();
    const storePrefix = this.getStorePrefix(storeName);
    localStorage.removeItem(storePrefix + key);
  }

  async clear(storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): Promise<void> {
    this.ensureInitialized();
    const keys = Object.keys(localStorage);
    const storePrefix = this.getStorePrefix(storeName);

    keys.forEach(key => {
      if (key.startsWith(storePrefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  async keys(storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): Promise<string[]> {
    this.ensureInitialized();
    const allKeys = Object.keys(localStorage);
    const storePrefix = this.getStorePrefix(storeName);

    return allKeys
      .filter(key => key.startsWith(storePrefix))
      .map(key => key.replace(storePrefix, ''));
  }

  async getAll<T>(storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): Promise<T[]> {
    this.ensureInitialized();
    const values: T[] = [];
    const keys = await this.keys(storeName);
    for (const key of keys) {
      const value = await this.get<T>(key, storeName);
      if (value) values.push(value);
    }
    return values;
  }

  async transaction<T>(
    _stores: ('queue' | 'sync_metadata' | 'conflict_cache')[],
    callback: (tx: any) => Promise<T>
  ): Promise<T> {
    this.ensureInitialized();
    return callback({});
  }
}

/**
 * AsyncStorage adapter for React Native
 */
class AsyncStorageAdapter implements StorageAdapter {
  private initialized = false;
  private AsyncStorage: any;
  private prefix = 'novaconnect_';

  async init(): Promise<void> {
    try {
      // Dynamic import for React Native environment
      this.AsyncStorage = require('@react-native-async-storage/async-storage').default;
      this.initialized = true;
    } catch (error) {
      console.warn('AsyncStorage not available:', error);
      // Fall back to a simple in-memory cache
      this.AsyncStorage = null;
      this.initialized = true;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AsyncStorageAdapter not initialized. Call init() first.');
    }
  }

  private getStorePrefix(storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): string {
    return storeName ? `${this.prefix}${storeName}_` : this.prefix;
  }

  async get<T>(key: string, storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): Promise<T | null> {
    this.ensureInitialized();
    if (!this.AsyncStorage) return null;

    try {
      const storePrefix = this.getStorePrefix(storeName);
      const value = await this.AsyncStorage.getItem(storePrefix + key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error reading from AsyncStorage:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): Promise<void> {
    this.ensureInitialized();
    if (!this.AsyncStorage) return;

    try {
      const storePrefix = this.getStorePrefix(storeName);
      await this.AsyncStorage.setItem(storePrefix + key, JSON.stringify(value));
    } catch (error) {
      console.error('Error writing to AsyncStorage:', error);
      throw error;
    }
  }

  async remove(key: string, storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): Promise<void> {
    this.ensureInitialized();
    if (!this.AsyncStorage) return;

    try {
      const storePrefix = this.getStorePrefix(storeName);
      await this.AsyncStorage.removeItem(storePrefix + key);
    } catch (error) {
      console.error('Error removing from AsyncStorage:', error);
      throw error;
    }
  }

  async clear(storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): Promise<void> {
    this.ensureInitialized();
    if (!this.AsyncStorage) return;

    try {
      const allKeys = await this.AsyncStorage.getAllKeys();
      const storePrefix = this.getStorePrefix(storeName);
      const novaKeys = allKeys.filter((k: string) => k.startsWith(storePrefix));
      await this.AsyncStorage.multiRemove(novaKeys);
    } catch (error) {
      console.error('Error clearing AsyncStorage:', error);
      throw error;
    }
  }

  async keys(storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): Promise<string[]> {
    this.ensureInitialized();
    if (!this.AsyncStorage) return [];

    try {
      const allKeys = await this.AsyncStorage.getAllKeys();
      const storePrefix = this.getStorePrefix(storeName);
      return allKeys
        .filter((k: string) => k.startsWith(storePrefix))
        .map((k: string) => k.replace(storePrefix, ''));
    } catch (error) {
      console.error('Error getting keys from AsyncStorage:', error);
      return [];
    }
  }

  async getAll<T>(storeName?: 'queue' | 'sync_metadata' | 'conflict_cache'): Promise<T[]> {
    this.ensureInitialized();
    if (!this.AsyncStorage) return [];

    try {
      const keys = await this.keys(storeName);
      const storePrefix = this.getStorePrefix(storeName);
      const values = await this.AsyncStorage.multiGet(keys.map(k => storePrefix + k));
      return values
        .filter(([, v]) => v !== null)
        .map(([, v]) => JSON.parse(v));
    } catch (error) {
      console.error('Error getting all from AsyncStorage:', error);
      return [];
    }
  }

  async transaction<T>(
    _stores: ('queue' | 'sync_metadata' | 'conflict_cache')[],
    callback: (tx: any) => Promise<T>
  ): Promise<T> {
    this.ensureInitialized();
    return callback({});
  }
}

/**
 * File-based adapter for Node.js (server-side)
 */
class FileStorageAdapter implements StorageAdapter {
  private initialized = false;
  private storagePath: string;
  private fs: any;
  private cache: Map<string, any> = new Map();

  constructor(storagePath: string = './novaconnect_storage') {
    this.storagePath = storagePath;
  }

  async init(): Promise<void> {
    try {
      this.fs = require('fs').promises;
      // Create storage directory if it doesn't exist
      try {
        await this.fs.mkdir(this.storagePath, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }

      // Load existing data into cache
      const files = await this.fs.readdir(this.storagePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = `${this.storagePath}/${file}`;
          const content = await this.fs.readFile(filePath, 'utf-8');
          const key = file.replace('.json', '');
          this.cache.set(key, JSON.parse(content));
        }
      }

      this.initialized = true;
    } catch (error) {
      console.warn('FileStorage not available:', error);
      this.initialized = true;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('FileStorageAdapter not initialized. Call init() first.');
    }
  }

  private getFilePath(key: string): string {
    return `${this.storagePath}/${key}.json`;
  }

  async get<T>(key: string): Promise<T | null> {
    this.ensureInitialized();
    return this.cache.get(key) || null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.ensureInitialized();
    this.cache.set(key, value);

    if (this.fs) {
      try {
        await this.fs.writeFile(
          this.getFilePath(key),
          JSON.stringify(value, null, 2),
          'utf-8'
        );
      } catch (error) {
        console.error('Error writing to file storage:', error);
      }
    }
  }

  async remove(key: string): Promise<void> {
    this.ensureInitialized();
    this.cache.delete(key);

    if (this.fs) {
      try {
        await this.fs.unlink(this.getFilePath(key));
      } catch (error) {
        // File might not exist
      }
    }
  }

  async clear(): Promise<void> {
    this.ensureInitialized();
    this.cache.clear();

    if (this.fs) {
      try {
        const files = await this.fs.readdir(this.storagePath);
        await Promise.all(
          files.map(file => this.fs.unlink(`${this.storagePath}/${file}`))
        );
      } catch (error) {
        console.error('Error clearing file storage:', error);
      }
    }
  }

  async keys(): Promise<string[]> {
    this.ensureInitialized();
    return Array.from(this.cache.keys());
  }

  async getAll<T>(): Promise<T[]> {
    this.ensureInitialized();
    return Array.from(this.cache.values());
  }

  async transaction<T>(
    _stores: string[],
    callback: () => Promise<T>
  ): Promise<T> {
    this.ensureInitialized();
    return callback();
  }
}

/**
 * Factory function to create the appropriate storage adapter
 */
export async function createStorageAdapter(
  customPath?: string
): Promise<StorageAdapter> {
  const environment = detectEnvironment();
  let adapter: StorageAdapter;

  switch (environment) {
    case 'web':
      adapter = new IndexedDBAdapter();
      await adapter.init();

      // Check if IndexedDB is using fallback
      if ((adapter as IndexedDBAdapter).isUsingFallback()) {
        console.warn('IndexedDB using localStorage fallback');
      }
      break;

    case 'react-native':
      adapter = new AsyncStorageAdapter();
      await adapter.init();
      break;

    case 'node':
      adapter = new FileStorageAdapter(customPath);
      await adapter.init();
      break;

    default:
      // Default to localStorage for unknown environments
      adapter = new LocalStorageAdapter();
      await adapter.init();
      console.warn('Unknown environment, using LocalStorageAdapter');
  }

  return adapter;
}

export { detectEnvironment };
export { IndexedDBAdapter, LocalStorageAdapter, AsyncStorageAdapter, FileStorageAdapter };
