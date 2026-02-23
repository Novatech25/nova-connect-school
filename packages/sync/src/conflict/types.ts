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

export type ConflictResolutionStrategy =
  | 'client-wins'
  | 'server-wins'
  | 'last-write-wins'
  | 'merge'
  | 'manual';

export interface ConflictResolution {
  action: 'keep_local' | 'keep_server' | 'keep_both' | 'merge' | 'manual';
  reason: string;
  data?: any;
  requiresAdminIntervention: boolean;
  message: string;
}

export interface ConflictStrategy {
  resolve(conflict: ConflictRecord): Promise<ConflictResolution>;
  getDescription?(conflict: ConflictRecord): string;
  getSuggestions?(conflict: ConflictRecord): Array<{
    action: string;
    description: string;
    data?: any;
  }>;
}
