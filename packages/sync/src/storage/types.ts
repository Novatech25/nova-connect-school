export interface StorageAdapter {
  init(): Promise<void>;
  get<T>(key: string, storeName?: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache'): Promise<T | null>;
  set<T>(key: string, value: T, storeName?: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache'): Promise<void>;
  remove(key: string, storeName?: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache'): Promise<void>;
  clear(storeName?: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache'): Promise<void>;
  keys(storeName?: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache'): Promise<string[]>;
  getAll<T>(storeName?: 'queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache'): Promise<T[]>;
  transaction<T>(
    stores: ('queue' | 'sync_metadata' | 'sync_data' | 'conflict_cache')[],
    callback: (tx: any) => Promise<T>
  ): Promise<T>;
}
