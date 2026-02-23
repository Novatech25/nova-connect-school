// ============================================================================
// Gateway Routes: Mobile Money
// ============================================================================
// LAN endpoints for Mobile Money with offline support
// Enables payment initiation when internet is unavailable
// ============================================================================

import { Router } from 'express';
import { getSupabaseClient } from '../lib/supabase';
import { MobileMoneyConflictStrategy } from '../sync/strategies/mobileMoneyConflict';

const router = Router();
const supabase = getSupabaseClient();

// ============================================================================
// POST /mobile-money/initiate
// ============================================================================
// Initiates a Mobile Money payment
// - Online: Calls Supabase Edge Function directly
// - Offline: Stores in pending queue for sync when connection restored
// ============================================================================

router.post('/initiate', async (req, res) => {
  try {
    const {
      student_id,
      fee_schedule_id,
      amount,
      phone_number,
      provider_code
    } = req.body;

    // Validate required fields
    if (!student_id || !amount || !phone_number || !provider_code) {
      return res.status(400).json({
        error: 'Missing required fields: student_id, amount, phone_number, provider_code'
      });
    }

    // Get user from session (validated by middleware)
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's school_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', userId)
      .single();

    if (userError || !userData?.school_id) {
      return res.status(400).json({ error: 'User not associated with a school' });
    }

    const schoolId = userData.school_id;

    // Check if online
    const isOnline = req.app.get('isOnline') ?? true;

    if (isOnline) {
      // Online: Call Edge Function directly
      const { data, error } = await supabase.functions.invoke(
        'initiate-mobile-money-payment',
        {
          body: {
            student_id,
            fee_schedule_id,
            amount,
            phone_number,
            provider_code
          }
        }
      );

      if (error) {
        return res.status(400).json({
          error: error.message || 'Failed to initiate payment'
        });
      }

      return res.status(200).json(data);
    } else {
      // Offline: Store in pending queue
      const pendingTransaction = {
        id: crypto.randomUUID(),
        user_id: userId,
        school_id: schoolId,
        student_id,
        fee_schedule_id,
        amount,
        phone_number,
        provider_code,
        status: 'pending_sync',
        created_at: new Date().toISOString(),
        sync_attempts: 0,
        last_sync_attempt: null
      };

      // Store in local database
      const db = req.app.get('db');
      await db.collection('pending_mobile_money').insertOne(pendingTransaction);

      return res.status(202).json({
        success: true,
        message: 'Payment stored locally. Will sync when connection is restored.',
        transaction_id: pendingTransaction.id,
        offline_mode: true
      });
    }
  } catch (error: any) {
    console.error('Error initiating Mobile Money payment:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// ============================================================================
// GET /mobile-money/transactions
// ============================================================================
// Gets Mobile Money transactions
// - Combines local pending transactions + cloud transactions
// ============================================================================

router.get('/transactions', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's school_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('school_id, role')
      .eq('id', userId)
      .single();

    if (userError || !userData?.school_id) {
      return res.status(400).json({ error: 'User not associated with a school' });
    }

    const schoolId = userData.school_id;
    const userRole = userData.role;

    const { status, provider_code, date_from, date_to, limit = 50, offset = 0 } = req.query;

    let transactions: any[] = [];

    // Get local pending transactions
    const db = req.app.get('db');
    const localTransactions = await db.collection('pending_mobile_money')
      .find({
        user_id: userId,
        school_id: schoolId
      })
      .limit(parseInt(limit as string))
      .skip(parseInt(offset as string))
      .toArray();

    // If online, also get cloud transactions
    const isOnline = req.app.get('isOnline') ?? true;
    let cloudTransactions: any[] = [];

    if (isOnline) {
      let query = supabase
        .from('mobile_money_transactions')
        .select(`
          *,
          mobile_money_providers (
            provider_code,
            provider_name
          ),
          students (
            first_name,
            last_name,
            student_id
          ),
          payments (
            receipt_number,
            payment_date
          ),
          fee_schedules (
            fee_type
          )
        `)
        .eq('school_id', schoolId)
        .order('initiated_at', { ascending: false })
        .limit(parseInt(limit as string))
        .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

      // Apply filters for accountants and admins
      if (userRole === 'accountant' || userRole === 'school_admin') {
        // No user filter - can see all school transactions
      } else {
        // Parents/students can only see their own
        query = query.eq('user_id', userId);
      }

      // Apply additional filters
      if (status) {
        query = query.eq('status', status);
      }
      if (provider_code) {
        query = query.eq('mobile_money_providers.provider_code', provider_code);
      }
      if (date_from) {
        query = query.gte('initiated_at', date_from);
      }
      if (date_to) {
        query = query.lte('initiated_at', date_to);
      }

      const { data, error } = await query;

      if (!error && data) {
        cloudTransactions = data;
      }
    }

    // Merge local and cloud transactions
    // Local transactions have priority for same ID (latest sync status)
    const transactionMap = new Map();

    // Add cloud transactions
    cloudTransactions.forEach((t: any) => {
      transactionMap.set(t.id, { ...t, source: 'cloud' });
    });

    // Add/override with local transactions
    localTransactions.forEach((t: any) => {
      transactionMap.set(t.id, { ...t, source: 'local' });
    });

    transactions = Array.from(transactionMap.values())
      .sort((a, b) => new Date(b.created_at || b.initiated_at).getTime() - new Date(a.created_at || a.initiated_at).getTime());

    return res.status(200).json({
      transactions,
      total: transactions.length,
      offline_count: localTransactions.length
    });
  } catch (error: any) {
    console.error('Error fetching Mobile Money transactions:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// ============================================================================
// GET /mobile-money/providers
// ============================================================================
// Gets Mobile Money providers for the school
// - Returns from school config (cached locally)
// ============================================================================

router.get('/providers', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's school_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', userId)
      .single();

    if (userError || !userData?.school_id) {
      return res.status(400).json({ error: 'User not associated with a school' });
    }

    const schoolId = userData.school_id;

    // Try local cache first
    const db = req.app.get('db');
    const cachedProviders = await db.collection('mobile_money_providers_cache')
      .findOne({ school_id: schoolId });

    const isOnline = req.app.get('isOnline') ?? true;

    if (cachedProviders && !isOnline) {
      // Use cache if offline
      return res.status(200).json({
        providers: cachedProviders.providers,
        cached: true,
        cached_at: cachedProviders.cached_at
      });
    }

    if (isOnline) {
      // Fetch from Supabase
      const { data: providers, error } = await supabase
        .from('mobile_money_providers')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('provider_name');

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Update local cache
      await db.collection('mobile_money_providers_cache').updateOne(
        { school_id: schoolId },
        {
          $set: {
            providers,
            cached_at: new Date().toISOString()
          }
        },
        { upsert: true }
      );

      return res.status(200).json({
        providers,
        cached: false
      });
    }

    return res.status(503).json({
      error: 'Service unavailable - no cached data and offline'
    });
  } catch (error: any) {
    console.error('Error fetching Mobile Money providers:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// ============================================================================
// GET /mobile-money/sync
// ============================================================================
// Syncs pending offline transactions to cloud
// Called automatically when connection is restored
// ============================================================================

router.post('/sync', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = req.app.get('db');
    const conflictStrategy = new MobileMoneyConflictStrategy(supabase);

    // Get all pending transactions
    const pendingTransactions = await db.collection('pending_mobile_money')
      .find({
        user_id: userId,
        status: 'pending_sync'
      })
      .toArray();

    if (pendingTransactions.length === 0) {
      return res.status(200).json({
        message: 'No pending transactions to sync',
        synced_count: 0
      });
    }

    let syncedCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    for (const pendingTx of pendingTransactions) {
      try {
        // Try to sync to cloud
        const { data, error } = await supabase.functions.invoke(
          'initiate-mobile-money-payment',
          {
            body: {
              student_id: pendingTx.student_id,
              fee_schedule_id: pendingTx.fee_schedule_id,
              amount: pendingTx.amount,
              phone_number: pendingTx.phone_number,
              provider_code: pendingTx.provider_code
            }
          }
        );

        if (error || !data?.success) {
          throw new Error(error?.message || 'Sync failed');
        }

        // Check for conflicts using strategy
        const conflictResult = await conflictStrategy.resolve(pendingTx, data);

        if (conflictResult.resolved) {
          // Sync successful - remove from pending queue
          await db.collection('pending_mobile_money').deleteOne({
            id: pendingTx.id
          });

          // Store sync log
          await db.collection('mobile_money_sync_log').insertOne({
            pending_transaction_id: pendingTx.id,
            cloud_transaction_id: data.transaction_id,
            synced_at: new Date().toISOString(),
            status: 'success'
          });

          syncedCount++;
        } else {
          // Conflict couldn't be resolved
          await db.collection('pending_mobile_money').updateOne(
            { id: pendingTx.id },
            {
              $set: {
                sync_attempts: pendingTx.sync_attempts + 1,
                last_sync_attempt: new Date().toISOString(),
                conflict_reason: conflictResult.reason
              }
            }
          );

          errors.push({
            transaction_id: pendingTx.id,
            error: conflictResult.reason
          });
          failedCount++;
        }
      } catch (syncError: any) {
        // Update sync attempt count
        await db.collection('pending_mobile_money').updateOne(
          { id: pendingTx.id },
          {
            $set: {
              sync_attempts: pendingTx.sync_attempts + 1,
              last_sync_attempt: new Date().toISOString(),
              last_error: syncError.message
            }
          }
        );

        errors.push({
          transaction_id: pendingTx.id,
          error: syncError.message
        });
        failedCount++;
      }
    }

    return res.status(200).json({
      message: `Sync completed: ${syncedCount} synced, ${failedCount} failed`,
      synced_count: syncedCount,
      failed_count: failedCount,
      errors
    });
  } catch (error: any) {
    console.error('Error syncing Mobile Money transactions:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// ============================================================================
// GET /mobile-money/:id
// ============================================================================
// Gets details of a specific transaction
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's school_id and role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('school_id, role')
      .eq('id', userId)
      .single();

    if (userError || !userData?.school_id) {
      return res.status(400).json({ error: 'User not associated with a school' });
    }

    const schoolId = userData.school_id;
    const userRole = userData.role;

    // Try local pending transactions first
    const db = req.app.get('db');
    const localTransaction = await db.collection('pending_mobile_money')
      .findOne({ id, user_id: userId, school_id: schoolId });

    if (localTransaction) {
      return res.status(200).json({
        ...localTransaction,
        source: 'local'
      });
    }

    // Try cloud transactions
    const isOnline = req.app.get('isOnline') ?? true;
    if (isOnline) {
      const { data: transaction, error } = await supabase
        .from('mobile_money_transactions')
        .select(`
          *,
          mobile_money_providers (
            provider_code,
            provider_name
          ),
          students (
            first_name,
            last_name,
            student_id
          ),
          payments (
            receipt_number,
            payment_date,
            amount
          ),
          fee_schedules (
            fee_type,
            amount_due,
            due_date
          )
        `)
        .eq('id', id)
        .eq('school_id', schoolId)
        .single();

      if (error) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Check access based on role
      if (userRole !== 'accountant' && userRole !== 'school_admin') {
        // Parents/students can only see their own
        if (transaction.user_id !== userId) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }

      return res.status(200).json({
        ...transaction,
        source: 'cloud'
      });
    }

    return res.status(404).json({
      error: 'Transaction not found and offline'
    });
  } catch (error: any) {
    console.error('Error fetching Mobile Money transaction:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

export default router;
