// Core sync types
export type SyncMode = 'gateway' | 'cloud' | 'offline';
export type SyncStatus = 'idle' | 'syncing' | 'error';

export type OperationType = 'create' | 'update' | 'delete';
export type OperationStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type ConflictResolutionStrategy =
  | 'client-wins'
  | 'server-wins'
  | 'last-write-wins'
  | 'merge'
  | 'manual';

// Sync event types
export type SyncEventType =
  | 'sync_start'
  | 'sync_complete'
  | 'sync_error'
  | 'conflict_detected'
  | 'gateway_change'
  | 'retry_scheduled'
  | 'operation_synced'
  | 'operation_failed';

export interface SyncEvent {
  id: string;
  type: SyncEventType;
  timestamp: Date;
  data: any;
  table?: string;
  operationId?: string;
}

// Sync metadata
export interface SyncMetadata {
  lastSyncTimestamp: Record<string, Date>;
  syncMode: SyncMode;
  gatewayUrl?: string;
  deviceId: string;
  version: string;
  initialSyncCompleted: boolean;
}

// Conflict record
export interface ConflictRecord {
  id: string;
  table: string;
  recordId: string;
  localData: any;
  serverData: any;
  detectedAt: Date;
  resolvedAt?: Date;
  resolution?: ConflictResolutionStrategy;
  resolvedBy?: string;
}

// Sync statistics
export interface SyncStats {
  total: number;
  synced: number;
  unsynced: number;
  retryable: number;
  failed: number;
  byTable: Record<string, number>;
  mode?: SyncMode;
  status?: SyncStatus;
}

// Queue statistics
export interface QueueStats extends SyncStats {
  oldestOperation?: Date;
  newestOperation?: Date;
  sizeByTable: Record<string, number>;
  statusByTable: Record<string, { synced: number; pending: number; failed: number }>;
  totalRetries: number;
}

// Sync result
export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ operationId: string; error: string }>;
  mode?: SyncMode;
  pullResults?: PullSyncResult[];
}

// Pull sync result
export interface PullSyncResult {
  table: string;
  pulled: number;
  conflicts: number;
  errors: string[];
  lastSyncTimestamp: Date;
}

// Retry schedule
export interface RetrySchedule {
  operationId: string;
  retryCount: number;
  nextRetryAt: Date;
  error: string;
}

// Gateway info
export interface GatewayInfo {
  url: string;
  ip: string;
  port: number;
  schoolId: string;
  lastSeen: Date;
  latency?: number;
}

export type GatewayStatus = 'connected' | 'disconnected' | 'unknown';
export type GatewayHealth = 'healthy' | 'degraded' | 'down';

// Sync configuration
export interface SyncConfig {
  autoSync: boolean;
  autoSyncInterval: number; // milliseconds
  retryMaxAttempts: number;
  retryBaseDelay: number; // milliseconds
  retryMaxDelay: number; // milliseconds
  gatewayEnabled: boolean;
  preferredMode: SyncMode;
  tablesToSync: string[];
  conflictResolution: {
    attendance: 'teacher_wins' | 'qr_wins' | 'coexist' | 'teacher_validates';
    payments: 'keep_both' | 'manual';
    grades: 'versioning' | 'last-write-wins';
    schedules: 'versioning' | 'last-write-wins';
  };
}

// Sync callbacks
export interface SyncCallbacks {
  onSyncStart?: () => void;
  onSyncComplete?: (result: SyncResult) => void;
  onSyncError?: (error: Error) => void;
  onConflictDetected?: (conflict: ConflictRecord) => void;
  onGatewayChange?: (mode: SyncMode) => void;
  onRetryScheduled?: (operationId: string, nextRetry: Date) => void;
  onOperationSynced?: (operationId: string) => void;
  onOperationFailed?: (operationId: string, error: string) => void;
}

// Export all types from sub-modules
export * from '../storage/types';
export * from '../conflict/types';
export * from '../queue/OfflineQueue';
export * from '../sync/SyncEngine';
