import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

interface SendPaymentRemindersRequest {
  schoolId?: string;
  studentIds?: string[];
  reminderType?: 'first' | 'second' | 'final' | 'custom';
  dryRun?: boolean;
}

interface ReminderStats {
  totalProcessed: number;
  remindersSent: number;
  remindersFailed: number;
  skipped: number;
  details: Array<{
    studentId: string;
    feeScheduleId: string;
    status: string;
    error?: string;
  }>;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const stats: ReminderStats = {
    totalProcessed: 0,
    remindersSent: 0,
    remindersFailed: 0,
    skipped: 0,
    details: []
  };

  try {
    // For cron jobs, use service role (no auth needed)
    // For manual triggers, verify auth
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (authError || !user) {
        throw new Error('Invalid authorization token');
      }

      // Verify user has permission
      const { data: userData } = await supabase
        .from('users')
        .select('role, school_id')
        .eq('id', user.id)
        .single();

      if (!userData || !['school_admin', 'accountant'].includes(userData.role)) {
        return new Response(
          JSON.stringify({ success: false, message: 'Unauthorized' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const {
      schoolId,
      studentIds,
      reminderType: requestedType,
      dryRun = false
    }: SendPaymentRemindersRequest = await req.json();

    // First, check and update overdue payments
    const { data: updatedCount } = await supabase.rpc('check_overdue_payments');

    // Build query for overdue fee schedules
    let query = supabase
      .from('fee_schedules')
      .select(`
        id,
        school_id,
        student_id,
        academic_year_id,
        fee_type_id,
        amount,
        remaining_amount,
        due_date,
        status,
        students(id, first_name, last_name, user_id),
        fee_types(name, code, schools(name, settings))
      `)
      .eq('status', 'overdue')
      .gt('remaining_amount', 0);

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }

    if (studentIds && studentIds.length > 0) {
      query = query.in('student_id', studentIds);
    }

    const { data: overdueSchedules, error: schedulesError } = await query;

    if (schedulesError) {
      throw schedulesError;
    }

    if (!overdueSchedules || overdueSchedules.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No overdue payments found',
          stats
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each overdue schedule
    for (const schedule of overdueSchedules) {
      stats.totalProcessed++;

      const feeSchedule = schedule as any;
      const student = feeSchedule.students;
      const feeType = feeSchedule.fee_types;
      const school = feeType?.schools;

      try {
        // Get reminder configuration from school settings
        const reminderConfig = school?.settings?.paymentReminders;
        const isEnabled = reminderConfig?.enabled !== false;

        if (!isEnabled && !requestedType) {
          stats.skipped++;
          stats.details.push({
            studentId: feeSchedule.student_id,
            feeScheduleId: feeSchedule.id,
            status: 'skipped',
            error: 'Reminders disabled for school'
          });
          continue;
        }

        // Check if a reminder was recently sent (within cooldown period)
        const cooldownDays = reminderConfig?.cooldownDays || 7;
        const { data: recentReminder } = await supabase
          .from('payment_reminders')
          .select('*')
          .eq('fee_schedule_id', feeSchedule.id)
          .eq('status', 'sent')
          .gte('sent_at', new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000).toISOString())
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentReminder) {
          stats.skipped++;
          stats.details.push({
            studentId: feeSchedule.student_id,
            feeScheduleId: feeSchedule.id,
            status: 'skipped',
            error: `Reminder sent within last ${cooldownDays} days`
          });
          continue;
        }

        // Determine reminder type based on days overdue
        const daysOverdue = Math.floor(
          (Date.now() - new Date(feeSchedule.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        const autoEscalate = reminderConfig?.autoEscalate !== false;
        let reminderType = requestedType || 'first';
        if (!requestedType && autoEscalate) {
          if (daysOverdue >= 30) {
            reminderType = 'final';
          } else if (daysOverdue >= 14) {
            reminderType = 'second';
          } else {
            reminderType = 'first';
          }
        }

        // Prepare message template
        const messageTemplate = reminderConfig?.messageTemplates?.[reminderType] ||
          getDefaultReminderTemplate(reminderType);

        const message = messageTemplate
          .replace('{student_name}', `${student.first_name} ${student.last_name}`)
          .replace('{amount}', `${feeSchedule.remaining_amount.toLocaleString('fr-FR')} FCFA`)
          .replace('{fee_name}', feeType.name)
          .replace('{due_date}', new Date(feeSchedule.due_date).toLocaleDateString('fr-FR'))
          .replace('{days_overdue}', daysOverdue.toString())
          .replace('{school_name}', school.name);

        if (dryRun) {
          stats.details.push({
            studentId: feeSchedule.student_id,
            feeScheduleId: feeSchedule.id,
            status: 'dry_run'
          });
          continue;
        }

        // Determine which channels to use
        const channels = reminderConfig?.channels || ['in_app', 'push'];

        // Send reminder to student
        if (student.user_id) {
          const { error: notifyError } = await supabase.functions.invoke('send-notification', {
            body: {
              notifications: [{
                userId: student.user_id,
                type: 'payment_overdue',
                title: `Rappel de paiement - ${reminderType.toUpperCase()}`,
                body: message,
                data: {
                  feeScheduleId: feeSchedule.id,
                  amount: feeSchedule.remaining_amount,
                  dueDate: feeSchedule.due_date,
                  reminderType
                },
                priority: reminderType === 'final' ? 'urgent' : 'normal',
                channels
              }],
              schoolId: feeSchedule.school_id
            }
          });

          if (notifyError) {
            throw notifyError;
          }
        }

        // Also send to parents if they exist
        const { data: parents } = await supabase
          .from('student_parent_relations')
          .select('parent_id, users!inner(email, first_name, last_name)')
          .eq('student_id', feeSchedule.student_id);

        if (parents && parents.length > 0) {
          for (const parent of parents) {
            const { error: parentNotifyError } = await supabase.functions.invoke('send-notification', {
              body: {
                notifications: [{
                  userId: parent.parent_id,
                  type: 'payment_overdue',
                  title: `Rappel de paiement - ${reminderType.toUpperCase()}`,
                  body: message,
                  data: {
                    feeScheduleId: feeSchedule.id,
                    studentName: `${student.first_name} ${student.last_name}`,
                    amount: feeSchedule.remaining_amount,
                    dueDate: feeSchedule.due_date,
                    reminderType
                  },
                  priority: reminderType === 'final' ? 'urgent' : 'normal',
                  channels
                }],
                schoolId: feeSchedule.school_id
              }
            });

            if (parentNotifyError) {
              console.error('Failed to send reminder to parent:', parentNotifyError);
            }
          }
        }

        // Create payment_reminders record
        await supabase
          .from('payment_reminders')
          .insert({
            school_id: feeSchedule.school_id,
            student_id: feeSchedule.student_id,
            fee_schedule_id: feeSchedule.id,
            reminder_type: reminderType,
            sent_at: new Date().toISOString(),
            sent_via: channels,
            status: 'sent',
            scheduled_for: new Date().toISOString(),
            message_template: message
          });

        stats.remindersSent++;
        stats.details.push({
          studentId: feeSchedule.student_id,
          feeScheduleId: feeSchedule.id,
          status: 'sent'
        });

      } catch (error: any) {
        stats.remindersFailed++;
        stats.details.push({
          studentId: feeSchedule.student_id,
          feeScheduleId: feeSchedule.id,
          status: 'failed',
          error: error.message
        });

        // Log failed reminder
        await supabase
          .from('payment_reminders')
          .insert({
            school_id: feeSchedule.school_id,
            student_id: feeSchedule.student_id,
            fee_schedule_id: feeSchedule.id,
            reminder_type: requestedType || 'first',
            sent_via: [],
            status: 'failed',
            scheduled_for: new Date().toISOString(),
            message_template: error.message
          });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${stats.totalProcessed} overdue payments`,
        stats
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error sending payment reminders:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message,
        stats
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getDefaultReminderTemplate(type: string): string {
  const templates: Record<string, string> = {
    first: 'Bonjour {student_name}, ce rappel aimable pour vous informer que vous avez une facture impayée de {amount} pour {fee_name} (échéance: {due_date}). Merci de régulariser votre situation.',
    second: 'RAPPEL: {student_name}, vous avez toujours un paiement en retard de {amount} pour {fee_name}. Échéance dépassée depuis {days_overdue} jours. Veuillez contacter la comptabilité.',
    final: 'DERNIER AVIS: Paiement en retard de {amount} pour {fee_name}. Veuillez régulariser impérativement sous peine de sanctions. Contact: {school_name}.'
  };
  return templates[type] || templates.first;
}
