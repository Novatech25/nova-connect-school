import { Database } from '../db/bun-sqlite.js';
import { createClient } from '@supabase/supabase-js';
import { EventLogService } from './event-log.js';
import { loadLicenseConfig } from '../config/license.js';

export class SyncEngine {
  private eventLog: EventLogService;
  private supabaseClient: any;
  private supabaseAdminClient: any;  // Client with service_role for admin operations
  private db: Database;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;

  constructor(db: Database, eventLog: EventLogService) {
    this.db = db;
    this.eventLog = eventLog;

    const config = loadLicenseConfig();
    if (config.supabaseUrl && config.supabaseAnonKey) {
      // Regular client for normal operations
      this.supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
    }

    // Create admin client with service_role key for admin operations
    if (config.supabaseUrl && config.supabaseServiceRoleKey) {
      this.supabaseAdminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
    } else if (config.supabaseUrl && config.supabaseAnonKey) {
      console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set - user sync will fail!');
      console.warn('   Set SUPABASE_SERVICE_ROLE_KEY in .env or license.json to enable user sync');
    }
  }

  // Start automatic synchronization
  start(intervalMs = 30000): void {
    if (this.syncInterval) {
      console.warn('Sync already started');
      return;
    }

    console.log(`🔄 Auto-sync started (interval: ${intervalMs}ms)`);

    this.syncInterval = setInterval(async () => {
      if (!this.isSyncing) {
        try {
          this.isSyncing = true;
          await this.syncToCloud();
          await this.syncFromCloud();
        } catch (error) {
          console.error('Sync error:', error);
        } finally {
          this.isSyncing = false;
        }
      }
    }, intervalMs);
  }

  // Stop synchronization
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('🔄 Auto-sync stopped');
    }
  }

  // Push to Supabase Cloud
  async syncToCloud(): Promise<void> {
    if (!this.supabaseClient) {
      console.warn('Supabase client not configured, skipping push sync');
      return;
    }

    const events = this.eventLog.getUnsyncedEvents();

    if (events.length === 0) {
      return;
    }

    console.log(`📤 Syncing ${events.length} events to cloud...`);

    for (const event of events) {
      try {
        const data = JSON.parse(event.data);

        // Special handling for user sync
        if (event.table_name === 'users') {
          await this.syncUserToCloud(event.record_id, data);
          this.eventLog.markAsSynced(event.id);
          continue;
        }

        switch (event.event_type) {
          case 'create':
            await this.supabaseClient.from(event.table_name).insert(data);
            break;

          case 'update':
            await this.supabaseClient
              .from(event.table_name)
              .update(data)
              .eq('id', event.record_id);
            break;

          case 'delete':
            await this.supabaseClient
              .from(event.table_name)
              .delete()
              .eq('id', event.record_id);
            break;
        }

        this.eventLog.markAsSynced(event.id);
        console.log(`✅ Synced: ${event.table_name}/${event.event_type}/${event.record_id}`);
      } catch (error: any) {
        console.error(`❌ Sync failed: ${event.table_name}/${event.record_id}`, error.message);
        this.eventLog.markAsFailed(event.id, error.message);
      }
    }
  }

  // Sync user to cloud with special handling
  private async syncUserToCloud(localUserId: string, userData: any): Promise<void> {
    try {
      // Skip sync if SUPABASE_SERVICE_ROLE_KEY is not set
      if (!this.supabaseAdminClient) {
        console.log(`ℹ️  Skipping user sync (no Supabase admin client configured)`);
        // Mark as synced to avoid retrying
        this.db.prepare(`
          UPDATE local_users
          SET synced_to_cloud = 1,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(localUserId);
        return;
      }

      // Get user from local_users table
      const localUser = this.db.prepare(
        'SELECT * FROM local_users WHERE id = ?'
      ).get(localUserId) as any;

      if (!localUser) {
        throw new Error('Local user not found');
      }

      // Check if already synced
      if (localUser.synced_to_cloud) {
        console.log(`User ${localUserId} already synced to cloud`);
        return;
      }

      // Create user in Supabase Auth using ADMIN client
      const { data: authData, error: authError } = await this.supabaseAdminClient.auth.admin.createUser({
        email: localUser.email,
        password: Math.random().toString(36), // Random password (user will reset)
        email_confirm: true,
        user_metadata: {
          first_name: localUser.first_name,
          last_name: localUser.last_name,
          role: localUser.role,
        },
      });

      if (authError || !authData.user) {
        // If user already exists, mark as synced and continue
        if (authError?.message?.includes('already been registered') ||
            authError?.message?.includes('duplicate') ||
            authError?.message?.includes('Database error')) {
          console.log(`⚠️  User ${localUser.email} already exists in Supabase, skipping sync`);
          this.db.prepare(`
            UPDATE local_users
            SET synced_to_cloud = 1,
                updated_at = datetime('now')
            WHERE id = ?
          `).run(localUserId);
          return;
        }
        throw new Error(`Failed to create auth user: ${authError?.message}`);
      }

      // Create user profile in Supabase Database using ADMIN client
      const { error: profileError } = await this.supabaseAdminClient
        .from('users')
        .insert({
          id: authData.user.id,
          email: localUser.email,
          first_name: localUser.first_name,
          last_name: localUser.last_name,
          school_id: localUser.school_id,
          is_active: true,
        });

      if (profileError) {
        // Rollback auth user if profile creation fails
        await this.supabaseAdminClient.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Failed to create user profile: ${profileError.message}`);
      }

      // Get role_id using ADMIN client
      const { data: roleData } = await this.supabaseAdminClient
        .from('roles')
        .select('id')
        .eq('name', localUser.role)
        .single();

      if (roleData) {
        // Assign role to user using ADMIN client
        await this.supabaseAdminClient.from('user_roles').insert({
          user_id: authData.user.id,
          role_id: roleData.id,
          assigned_by: authData.user.id,
          assigned_at: new Date().toISOString(),
        });
      }

      // Update local user record with cloud user ID
      this.db.prepare(`
        UPDATE local_users
        SET synced_to_cloud = 1,
            cloud_user_id = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(authData.user.id, localUserId);

      console.log(`✅ Synced user ${localUser.email} → cloud ID: ${authData.user.id}`);
    } catch (error: any) {
      console.error(`❌ Failed to sync user ${localUserId}:`, error.message);
      throw error;
    }
  }

  // Pull from Supabase Cloud
  async syncFromCloud(): Promise<void> {
    if (!this.supabaseClient) {
      console.warn('Supabase client not configured, skipping pull sync');
      return;
    }

    const lastSync = this.getLastSyncTimestamp();

    if (!lastSync) {
      console.log('📥 First sync: fetching all data...');
    } else {
      console.log(`📥 Syncing from cloud since ${lastSync}...`);
    }

    // Sync changes for each critical table
    const tables = [
      'attendance_sessions',
      'attendance_records',
      'grades',
      'lesson_logs',
      'enrollments',
      'parents',
      'payments',
      'payment_exemptions',
      'schedules',
      'schools',
      'student_parent_relations',
      'students',
      'users'
    ];

    for (const table of tables) {
      await this.syncTable(table, lastSync);
    }

    this.updateLastSyncTimestamp();
  }

  // Sync a specific table
  private async syncTable(table: string, lastSync?: string): Promise<void> {
    try {
      let query = this.supabaseClient.from(table).select('*');
      const syncColumn = this.getSyncColumn(table);

      if (lastSync) {
        query = query.gt(syncColumn, lastSync);
      }

      query = query.order(syncColumn, { ascending: true }).limit(1000);

      const { data, error } = await query;

      if (error) {
        console.error(`Error syncing ${table}:`, error);
        return;
      }

      if (!data || data.length === 0) {
        return;
      }

      console.log(`📥 Syncing ${data.length} records from ${table}...`);

      for (const record of data) {
        this.upsertLocalRecord(table, record);
      }
    } catch (error: any) {
      console.error(`Error syncing ${table}:`, error.message);
    }
  }

  private getSyncColumn(table: string): string {
    if (table === 'student_parent_relations') {
      return 'created_at';
    }
    return 'updated_at';
  }

  // Upsert record to local database
  private upsertLocalRecord(table: string, record: any): void {
    try {
      const columns = Object.keys(record);
      const placeholders = Object.keys(record).map(() => '?').join(', ');
      const values = Object.values(record).map(v =>
        typeof v === 'object' && v !== null ? JSON.stringify(v) : v
      );

      // Check if record exists
      const existing = this.db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(record.id);

      if (existing) {
        // Update
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        this.db.prepare(`
          UPDATE ${table} SET ${setClause} WHERE id = ?
        `).run(...values, record.id);
      } else {
        // Insert
        this.db.prepare(`
          INSERT INTO ${table} (${columns.join(', ')})
          VALUES (${placeholders})
        `).run(...values);
      }
    } catch (error: any) {
      console.error(`Error upserting record into ${table}:`, error.message);
    }
  }

  // Get last sync timestamp
  private getLastSyncTimestamp(): string | undefined {
    const result = this.db.prepare(`
      SELECT value FROM sync_metadata WHERE key = 'last_sync'
    `).get() as any;

    return result?.value;
  }

  // Update last sync timestamp
  private updateLastSyncTimestamp(): void {
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
      VALUES ('last_sync', ?, datetime('now'))
    `).run(now);
  }

  // Manual sync trigger
  async syncNow(): Promise<void> {
    if (this.isSyncing) {
      console.warn('Sync already in progress');
      return;
    }

    this.isSyncing = true;
    try {
      await this.syncToCloud();
      await this.syncFromCloud();
      console.log('✅ Manual sync completed');
    } finally {
      this.isSyncing = false;
    }
  }

  // Get sync status
  getStatus(): any {
    const stats = this.eventLog.getStats();
    const lastSync = this.getLastSyncTimestamp();

    return {
      ...stats,
      lastSync,
      isSyncing: this.isSyncing
    };
  }
}
