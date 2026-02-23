import { getSupabaseClient } from "../client";

const supabase = getSupabaseClient();

// ── Types ──────────────────────────────────────────────────────────────────

export type BroadcastTargetType = 'all' | 'teachers' | 'students' | 'parents' | 'class' | 'individual';
export type BroadcastChannel = 'in_app' | 'email' | 'sms';
export type BroadcastPriority = 'normal' | 'high' | 'urgent';

export interface BroadcastMessage {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  targetType: BroadcastTargetType;
  targetClassId?: string;
  targetUserIds?: string[];
  channels: BroadcastChannel[];
  priority: BroadcastPriority;
  recipientCount: number;
  readCount: number;
  sentBy: string;
  sentAt: string;
  createdAt: string;
}

export interface SendBroadcastPayload {
  schoolId: string;
  title: string;
  body: string;
  targetType: BroadcastTargetType;
  targetClassId?: string;
  targetUserIds?: string[];
  channels: BroadcastChannel[];
  priority: BroadcastPriority;
  sentBy: string;
  attachmentUrl?: string;
  messageType?: 'announcement' | 'class_message';
}

export interface BroadcastStats {
  totalSent: number;
  totalRead: number;
  totalRecipients: number;
  sentThisMonth: number;
  totalBroadcasts: number;
}

export interface RecipientOption {
  id: string;
  userId: string;
  label: string;
  role: string;
  type?: 'user';
  classId?: string;
  className?: string;
  email?: string;
  phone?: string;
}

// ── Queries ────────────────────────────────────────────────────────────────

export const messagingQueries = {
  /**
   * Get broadcast message history for a school.
   */
  getHistory: (schoolId: string, limit = 50) => ({
    queryKey: ['messaging', 'history', schoolId, limit],
    queryFn: async (): Promise<BroadcastMessage[]> => {
      // We store broadcasts as notifications with type='announcement'
      // grouped by a shared broadcast_id in the data JSON field.
      // We query distinct broadcast_ids to reconstruct the history.
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('school_id', schoolId)
        .eq('type', 'announcement')
        .not('data->broadcast_id', 'is', null)
        .order('sent_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Group by broadcast_id
      const broadcastMap = new Map<string, BroadcastMessage>();
      for (const row of data || []) {
        const rowData = row.data as Record<string, any> | null;
        const broadcastId = rowData?.broadcast_id;
        if (!broadcastId) continue;

        if (!broadcastMap.has(broadcastId)) {
          broadcastMap.set(broadcastId, {
            id: broadcastId,
            schoolId: row.school_id,
            title: row.title,
            body: row.body,
            targetType: rowData?.target_type || 'all',
            targetClassId: rowData?.target_class_id,
            targetUserIds: rowData?.target_user_ids,
            channels: rowData?.channels || ['in_app'],
            priority: rowData?.priority || 'normal',
            recipientCount: 0,
            readCount: 0,
            sentBy: rowData?.sent_by || '',
            sentAt: row.sent_at || row.created_at,
            createdAt: row.created_at,
          });
        }

        const entry = broadcastMap.get(broadcastId)!;
        entry.recipientCount += 1;
        if (row.read_at) entry.readCount += 1;
      }

      const result = Array.from(broadcastMap.values()).slice(0, limit);
      return result;
    },
  }),

  /**
   * Get broadcast stats for a school.
   */
  getStats: (schoolId: string) => ({
    queryKey: ['messaging', 'stats', schoolId],
    queryFn: async (): Promise<BroadcastStats> => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [allRes, readRes, _monthRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('type', 'announcement')
          .not('data->broadcast_id', 'is', null),

        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('type', 'announcement')
          .not('data->broadcast_id', 'is', null)
          .not('read_at', 'is', null),

        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('type', 'announcement')
          .not('data->broadcast_id', 'is', null)
          .gte('created_at', startOfMonth.toISOString()),
      ]);

      const totalSent = allRes.count ?? 0;
      const totalRead = readRes.count ?? 0;

      // Count distinct broadcasts this month
      // Queries to get all broadcast IDs for global and monthly counts
      const [allBroadcastsRes, monthBroadcastsRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('data')
          .eq('school_id', schoolId)
          .eq('type', 'announcement')
          .not('data->broadcast_id', 'is', null),
        
        supabase
          .from('notifications')
          .select('data')
          .eq('school_id', schoolId)
          .eq('type', 'announcement')
          .not('data->broadcast_id', 'is', null)
          .gte('created_at', startOfMonth.toISOString()),
      ]);

      const globalBroadcasts = new Set(
        (allBroadcastsRes.data || []).map((r: Record<string, any>) => r.data?.broadcast_id).filter(Boolean)
      );

      const monthBroadcasts = new Set(
        (monthBroadcastsRes.data || []).map((r: Record<string, any>) => r.data?.broadcast_id).filter(Boolean)
      );

      return {
        totalSent,        // Total individual notifications (for read rate calc)
        totalRead,        // Total individual read notifications
        totalRecipients: totalSent, // Same as totalSent, confusingly named but kept for compatibility
        sentThisMonth: monthBroadcasts.size,
        totalBroadcasts: globalBroadcasts.size,
      };
    },
  }),

  /**
   * Get potential recipients for a broadcast.
   */
  getRecipients: (schoolId: string, targetType: BroadcastTargetType, targetClassId?: string) => ({
    queryKey: ['messaging', 'recipients', schoolId, targetType, targetClassId],
    queryFn: async (): Promise<RecipientOption[]> => {
      // Build queries based on filter
      let teachersQuery = supabase
        .from('user_roles')
        .select(`
          user_id,
          users (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          roles!inner (name)
        `)
        .eq('school_id', schoolId)
        .eq('roles.name', 'teacher');

      let studentsQuery = supabase
        .from('students')
        .select('user_id, first_name, last_name, email, phone, classes(name)')
        .eq('school_id', schoolId)
        .eq('status', 'active');

      let parentsQuery = supabase
        .from('parents')
        .select('user_id, first_name, last_name, email, phone')
        .eq('school_id', schoolId)
        .not('user_id', 'is', null);

      if (targetType === 'class' && targetClassId) {
        // For class, we want students of that class.
        // The simple students query above doesn't filter by class easily without join on enrollments
        // Reworking students query for class filter:
        studentsQuery = supabase
          .from('enrollments')
          .select(`
            student:students!inner (
              user_id,
              first_name,
              last_name,
              email,
              phone,
              classes(name)
            )
          `)
          .eq('school_id', schoolId)
          .eq('class_id', targetClassId)
          .eq('status', 'enrolled') as any;
      }
      
      const finalRecipients: RecipientOption[] = [];

      if (targetType === 'all' || targetType === 'teachers' || targetType === 'individual') {
        const { data } = await teachersQuery;
        if (data) {
          data.forEach((r: any) => {
             if (r.users) {
               finalRecipients.push({
                 id: r.users.id,
                 userId: r.users.id, // Ensure userId is populated
                 label: `${r.users.first_name || ''} ${r.users.last_name || ''}`.trim() || r.users.id,
                 role: 'teacher',
                 email: r.users.email,
                 phone: r.users.phone,
               });
             }
          });
        }
      }

      if (targetType === 'all' || targetType === 'students' || targetType === 'class' || targetType === 'individual') {
        const { data } = await studentsQuery;
         if (data) {
          data.forEach((r: any) => {
             // Handle both direct student query and enrollment query structure for class filter
             const student = targetType === 'class' ? r.student : r;
             if (student && student.user_id) { // Only students with user account
               finalRecipients.push({
                 id: student.user_id,
                 userId: student.user_id, // Ensure userId is populated
                 label: `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.user_id,
                 role: 'student',
                 className: Array.isArray(student.classes) ? student.classes[0]?.name : student.classes?.name,
                 email: student.email,
                 phone: student.phone,
               });
             }
          });
        }
      }
      
      if (targetType === 'all' || targetType === 'parents' || targetType === 'individual') {
        const { data } = await parentsQuery;
        if (data) {
          data.forEach((p: any) => {
             if (p.user_id) {
               finalRecipients.push({
                 id: p.user_id,
                 userId: p.user_id, // Ensure userId is populated
                 label: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.user_id,
                 role: 'parent',
                 email: p.email,
                 phone: p.phone,
               });
             }
          });
        }
      }

      return finalRecipients.sort((a, b) => a.label.localeCompare(b.label));
    },
    enabled: !!schoolId,
  }),

  /**
   * Get available classes for targeting.
   */
  getClasses: (schoolId: string) => ({
    queryKey: ['messaging', 'classes', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          levels ( name )
        `)
        .eq('school_id', schoolId)
        .order('name');

      if (error) throw error;
      
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        grade: c.levels?.name || '',
      }));
    },
  }),

  /**
   * Send a broadcast message — creates a notification for each recipient.
   */
  sendBroadcast: () => ({
    mutationFn: async (payload: SendBroadcastPayload) => {
      const broadcastId = crypto.randomUUID();

      // 1) Resolve recipient user IDs
      let recipientIds: string[] = [];

      if (payload.targetType === 'individual' && payload.targetUserIds?.length) {
        recipientIds = payload.targetUserIds.filter(Boolean);
      } else {
        // Build recipient list based on targeting
        if (payload.targetType === 'teachers' || payload.targetType === 'all') {
          const { data: roleData } = await supabase
            .from('roles')
            .select('id')
            .eq('name', 'teacher')
            .single();

          if (roleData) {
            const { data: teachers } = await supabase
              .from('user_roles')
              .select('user_id')
              .eq('school_id', payload.schoolId)
              .eq('role_id', roleData.id);

            if (teachers) {
              recipientIds.push(...teachers.map((t) => t.user_id).filter(Boolean));
            }
          }
        }

        if (payload.targetType === 'students' || payload.targetType === 'all') {
          const q = supabase
            .from('students')
            .select('user_id')
            .eq('school_id', payload.schoolId)
            .eq('status', 'active');

          const { data: students } = await q;
          if (students) {
            recipientIds.push(...students.map((s) => s.user_id).filter(Boolean));
          }
        }

        if (payload.targetType === 'parents' || payload.targetType === 'all') {
            const { data: parents } = await supabase
            .from('parents')
            .select('user_id')
            .eq('school_id', payload.schoolId)
            .not('user_id', 'is', null);

          if (parents) {
            recipientIds.push(...parents.map((p) => p.user_id).filter(Boolean));
          }
        }

        if (payload.targetType === 'class' && payload.targetClassId) {
          const { data: students } = await supabase
            .from('students')
            .select('user_id')
            .eq('school_id', payload.schoolId)
            .eq('class_id', payload.targetClassId)
            .eq('status', 'active');

          if (students) {
            recipientIds.push(...students.map((s) => s.user_id).filter(Boolean));
          }
        }
      }

      // Deduplicate and filter again just in case
      recipientIds = [...new Set(recipientIds)].filter((id) => !!id);

      if (recipientIds.length === 0) {
        throw new Error('Aucun destinataire trouvé pour cette audience.');
      }

      // 2) Insert notifications in batches
      const batchSize = 100;
      for (let i = 0; i < recipientIds.length; i += batchSize) {
        const batch = recipientIds.slice(i, i + batchSize);
        const notifications = batch.map((userId) => ({
          school_id: payload.schoolId,
          user_id: userId,
          type: 'announcement',
          title: payload.title,
          body: payload.body,
          data: {
            broadcast_id: broadcastId,
            target_type: payload.targetType,
            target_class_id: payload.targetClassId || null,
            sent_by: payload.sentBy,
            channels: payload.channels,
            priority: payload.priority,
            attachment_url: payload.attachmentUrl || null,
            message_type: payload.messageType || 'announcement',
          },
        }));

        const { error } = await supabase.from('notifications').insert(notifications);
        if (error) throw error;
      }

      return {
        broadcastId,
        recipientCount: recipientIds.length,
      };
    },
  }),
};
