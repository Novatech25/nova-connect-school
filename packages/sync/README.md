# NovaConnect Synchronization System

A comprehensive offline-first synchronization system with conflict resolution, Gateway LAN support, and automatic retry with exponential backoff.

## Features

- **Offline-First Architecture**: Queue operations locally when offline, sync automatically when online
- **IndexedDB Storage**: Persistent storage for web with automatic fallback to localStorage
- **Conflict Resolution**: Type-specific strategies for payments, grades, schedules, and attendance
- **Pull Sync**: Bidirectional sync with cloud (Supabase) and LAN Gateway
- **Gateway Detection**: Automatic mDNS detection and failover to Cloud
- **Exponential Backoff**: Intelligent retry with jitter for network resilience
- **React Hooks**: Easy integration with React applications
- **Admin Dashboard**: Monitor sync status, conflicts, and queue

## Installation

```bash
pnpm install @novaconnect/sync
```

## Quick Start

```typescript
import { createStorageAdapter } from '@novaconnect/sync';
import { OfflineQueue } from '@novaconnect/sync';
import { SyncEngine } from '@novaconnect/sync';

// Initialize storage
const storage = await createStorageAdapter();

// Create queue
const queue = new OfflineQueue(storage);
await queue.init();

// Create sync engine
const syncEngine = new SyncEngine(queue);

// Add operation
await queue.add({
  type: 'create',
  table: 'attendance',
  data: { student_id: '123', status: 'present' },
  priority: 'high',
});

// Sync
const result = await syncEngine.syncBidirectional();
console.log(`Synced ${result.synced} operations`);
```

## Architecture

```
┌─────────────────┐
│   Application   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  React Hooks    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   SyncEngine    │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐  ┌──────────────┐
│ Queue  │  │ Conflict     │
│        │  │ Resolver     │
└────────┘  └──────────────┘
    │              │
    ▼              ▼
┌──────────────────────────┐
│   Storage (IndexedDB)    │
└──────────────────────────┘
    │
    ▼
┌──────────────────────────┐
│  Gateway / Cloud API     │
└──────────────────────────┘
```

## Core Components

### OfflineQueue

Manages offline operations with priority sorting and persistence.

```typescript
const queue = new OfflineQueue(storage);

// Add operation
await queue.add({
  type: 'update',
  table: 'grades',
  data: { id: '123', score: 95 },
  priority: 'high',
  metadata: { userId: 'user123', deviceId: 'device1' },
});

// Get statistics
const stats = await queue.getStats();
console.log(stats);
// { total: 10, synced: 7, unsynced: 3, retryable: 2, failed: 1, byTable: {...} }
```

### SyncEngine

Main synchronization engine with pull sync and retry.

```typescript
const syncEngine = new SyncEngine(queue, gatewayDetector);

// Push local changes
const result = await syncEngine.sync();

// Bidirectional sync (push + pull)
const biResult = await syncEngine.syncBidirectional(['attendance', 'grades']);

// Retry failed operations
await syncEngine.retryFailed();

// Get sync statistics
const stats = await syncEngine.getSyncStats();
```

### Conflict Resolution

Type-specific conflict resolution strategies:

| Data Type | Strategy | Behavior |
|-----------|----------|----------|
| **Payments** | Append-only | Keep both records, detect duplicates |
| **Grades** | Versioning | Compare versions, admin chooses |
| **Schedules** | Versioning | Draft: last-write-wins, Published: manual |
| **Attendance** | Merge | Configurable: teacher_wins / qr_wins / coexist |

```typescript
import { getConflictStrategy } from '@novaconnect/sync';

const strategy = getConflictStrategy('grades');
const resolution = await strategy.resolve(conflict);
```

### Gateway Detection

Automatic LAN Gateway detection with Cloud fallback.

```typescript
import { GatewayDetector } from '@novaconnect/sync';

const detector = new GatewayDetector(schoolId);

detector.onGatewayChange((gateway) => {
  if (gateway) {
    console.log(`Gateway connected: ${gateway.url} (${gateway.latency}ms)`);
    syncEngine.switchToGateway(gateway.url);
  } else {
    console.log('Gateway disconnected, using Cloud');
    syncEngine.switchToCloud();
  }
});
```

## React Hooks

### useOfflineQueue

Manage the offline queue in React components.

```typescript
function MyComponent() {
  const { addOperation, sync, stats, isOnline } = useOfflineQueue();

  const handleMarkAttendance = async () => {
    await addOperation({
      type: 'create',
      table: 'attendance',
      data: { student_id: '123', status: 'present' },
      priority: 'high',
    });
  };

  return (
    <div>
      <button onClick={handleMarkAttendance}>Mark Present</button>
      <button onClick={() => sync()}>Sync Now</button>
      <p>Queue: {stats.unsynced} pending</p>
    </div>
  );
}
```

### useSyncStatus

Monitor sync status in real-time.

```typescript
function SyncIndicator() {
  const { status, mode, gatewayUrl, lastSyncTime, syncProgress } = useSyncStatus();

  return (
    <div>
      <span>Status: {status}</span>
      <span>Mode: {mode}</span>
      {mode === 'gateway' && <span>Gateway: {gatewayUrl}</span>}
      <span>Last sync: {lastSyncTime?.toLocaleString()}</span>
      {syncProgress > 0 && <span>Progress: {syncProgress}%</span>}
    </div>
  );
}
```

### useConflictResolution

Manage conflict resolution.

```typescript
function ConflictPanel() {
  const { conflicts, resolveConflict, autoResolveConflicts } = useConflictResolution();

  return (
    <div>
      <h2>Conflicts ({conflicts.length})</h2>
      {conflicts.map(conflict => (
        <ConflictItem
          key={conflict.id}
          conflict={conflict}
          onResolve={(resolution) => resolveConflict(conflict.id, resolution)}
        />
      ))}
      <button onClick={() => autoResolveConflicts('last-write-wins')}>
        Auto-Resolve All
      </button>
    </div>
  );
}
```

## Configuration

Configure sync behavior:

```typescript
const config: SyncConfig = {
  autoSync: true,
  autoSyncInterval: 30000, // 30 seconds
  retryMaxAttempts: 5,
  retryBaseDelay: 1000, // 1 second
  retryMaxDelay: 300000, // 5 minutes
  gatewayEnabled: true,
  preferredMode: 'gateway',
  tablesToSync: ['attendance', 'grades', 'payments', 'schedules'],
  conflictResolution: {
    attendance: 'teacher_wins',
    payments: 'keep_both',
    grades: 'versioning',
    schedules: 'versioning',
  },
};
```

## Storage Adapters

Automatic storage adapter selection:

- **Web**: IndexedDB with localStorage fallback
- **React Native**: AsyncStorage
- **Node.js**: File-based storage

```typescript
import { createStorageAdapter } from '@novaconnect/sync';

// Automatically detects environment
const storage = await createStorageAdapter();
```

## Testing

```typescript
import { OfflineQueue } from '@novaconnect/sync';

describe('OfflineQueue', () => {
  it('should add and retrieve operations', async () => {
    const queue = new OfflineQueue(mockStorage);
    await queue.init();

    const id = await queue.add({
      type: 'create',
      table: 'test',
      data: { name: 'test' },
    });

    const operation = await queue.getById(id);
    expect(operation).toBeDefined();
    expect(operation?.table).toBe('test');
  });
});
```

## Troubleshooting

### Sync not working

1. Check network status: `navigator.onLine`
2. Verify Gateway connectivity: `detector.testGatewayConnectivity()`
3. Check sync errors in queue stats
4. Review conflict records

### Conflicts not resolving

1. Check conflict resolution strategy for table
2. Review conflict records in IndexedDB `conflict_cache`
3. Manually resolve via admin panel
4. Verify `updated_at` timestamps

### High memory usage

1. Compact old synced operations: `await queuePersistence.compact(7)`
2. Clear synced operations: `await queue.clearSynced()`
3. Check for large metadata in operations

## API Reference

See [API documentation](./docs/api.md) for complete API reference.

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
