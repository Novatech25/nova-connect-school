import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PublishRoomAssignmentsRequest {
  sessionDate: string;
  schoolId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify origin for security
    const origin = req.headers.get('Origin');
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://novaconnect.vercel.app',  // Remplacez par votre domaine de production
      'https://www.novaconnect.vercel.app',
    ];
    
    // Allow requests from allowed origins or from same origin (no origin header)
    if (origin && !allowedOrigins.includes(origin)) {
      return new Response(JSON.stringify({ error: 'Unauthorized origin' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sessionDate, schoolId }: PublishRoomAssignmentsRequest = await req.json();

    if (!schoolId || !sessionDate) {
      return new Response(JSON.stringify({ error: 'schoolId and sessionDate are required' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get school configuration
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('settings')
      .eq('id', schoolId)
      .single();

    if (schoolError || !school) {
      return new Response(JSON.stringify({ error: 'School not found' }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dynamicRoomConfig = school.settings?.dynamicRoomAssignment;

    if (!dynamicRoomConfig?.enabled) {
      return new Response(JSON.stringify({ error: 'Dynamic room assignment module is not enabled' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get draft assignments for the date
    const { data: assignments, error: assignmentsError } = await supabase
      .from('room_assignments')
      .select(`
        *,
        assigned_room:rooms(id, name, code, campus_id),
        teacher:users!teacher_id(id, first_name, last_name),
        subject:subjects(id, name, code)
      `)
      .eq('school_id', schoolId)
      .eq('session_date', sessionDate)
      .eq('status', 'draft');

    if (assignmentsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch assignments' }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!assignments || assignments.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        published: 0,
        notificationsSent: 0,
        message: 'No draft assignments found for the given date'
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let publishedCount = 0;
    let notificationsSent = 0;

    // 3. Process each assignment
    for (const assignment of assignments) {
      // Update status to published
      const { error: updateError } = await supabase
        .from('room_assignments')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', assignment.id);

      if (updateError) {
        console.error(`Failed to publish assignment ${assignment.id}:`, updateError);
        continue;
      }

      publishedCount++;

      // 4. Prepare and send notifications
      const notificationChannels = dynamicRoomConfig.notificationChannels;
      const includeFloorPlan = dynamicRoomConfig.includeFloorPlan;

      // Get all students from grouped classes
      const { data: students } = await supabase
        .from('class_enrollments')
        .select('student_id')
        .in('class_id', assignment.grouped_class_ids);

      // Get parents of these students
      const studentIds = students?.map(s => s.student_id) || [];
      const { data: parents } = await supabase
        .from('family_relationships')
        .select('parent_id')
        .in('child_id', studentIds);

      const parentIds = [...new Set(parents?.map(p => p.parent_id) || [])];

      // Build notification message
      const roomName = assignment.assigned_room?.name || 'Non assignée';
      const roomCode = assignment.assigned_room?.code || '';
      const subjectName = assignment.subject?.name || '';
      const teacherName = `${assignment.teacher?.first_name || ''} ${assignment.teacher?.last_name || ''}`.trim();
      const timeRange = `${assignment.start_time} - ${assignment.end_time}`;

      let message = `📍 Salle assignée\n\n`;
      message += `Matière: ${subjectName}\n`;
      message += `Prof: ${teacherName}\n`;
      message += `Heure: ${timeRange}\n`;
      message += `Salle: ${roomName} ${roomCode ? `(${roomCode})` : ''}\n`;

      if (assignment.capacity_status === 'insufficient') {
        message += `\n⚠️ Note: La capacité de la salle est inférieure à l'effectif`;
      }

      if (includeFloorPlan && assignment.assigned_room) {
        message += `\n🗺️ Plan d'accès disponible`;
      }

      // Send in-app notifications
      if (notificationChannels.inApp) {
        const notifications = [];

        // Notify teacher
        notifications.push({
          user_id: assignment.teacher_id,
          type: 'room_assignment',
          title: 'Salle assignée',
          message,
          metadata: {
            room_assignment_id: assignment.id,
            session_date: sessionDate,
            room_id: assignment.assigned_room_id,
          },
        });

        // Notify students
        for (const studentId of studentIds) {
          notifications.push({
            user_id: studentId,
            type: 'room_assignment',
            title: 'Salle assignée',
            message,
            metadata: {
              room_assignment_id: assignment.id,
              session_date: sessionDate,
              room_id: assignment.assigned_room_id,
            },
          });
        }

        // Notify parents
        for (const parentId of parentIds) {
          notifications.push({
            user_id: parentId,
            type: 'room_assignment',
            title: 'Salle assignée - Enfant',
            message,
            metadata: {
              room_assignment_id: assignment.id,
              session_date: sessionDate,
              room_id: assignment.assigned_room_id,
            },
          });
        }

        // Batch insert notifications
        if (notifications.length > 0) {
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert(notifications);

          if (!notificationError) {
            notificationsSent += notifications.length;
          }
        }
      }

      // Send push notifications (if enabled) - Comment 3: Real FCM Integration
      if (notificationChannels.push) {
        const { data: devices } = await supabase
          .from('user_devices')
          .select('user_id, device_token, platform')
          .in('user_id', [assignment.teacher_id, ...studentIds, ...parentIds])
          .eq('push_enabled', true);

        if (devices && devices.length > 0) {
          const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
          if (fcmServerKey) {
            try {
              // Batch send via FCM v1 API (up to 500 tokens)
              const chunks: string[][] = [];
              for (let i = 0; i < devices.length; i += 500) {
                chunks.push(devices.slice(i, i + 500).map(d => d.device_token));
              }

              for (const chunk of chunks) {
                const fcmResponse = await fetch('https://fcm.googleapis.com/v1/projects/' + Deno.env.get('FCM_PROJECT_ID') + '/messages:send', {
                  method: 'POST',
                  headers: {
                    'Authorization': 'Bearer ' + fcmServerKey,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    message: {
                      notification: {
                        title,
                        body: message,
                      },
                      data: {
                        type: 'room_assignment',
                        room_assignment_id: assignment.id,
                        room_id: assignment.assigned_room_id,
                        session_date: sessionDate,
                      },
                      tokens: chunk,
                    },
                  }),
                });

                if (!fcmResponse.ok) {
                  console.error('FCM error:', await fcmResponse.text());
                  // Log failed push attempt
                  await supabase.from('room_assignment_events').insert({
                    school_id: assignment.school_id,
                    room_assignment_id: assignment.id,
                    event_type: 'notification_failed',
                    reason: 'Push notification failed',
                    metadata: {
                      channel: 'push',
                      error: await fcmResponse.text(),
                      device_count: chunk.length,
                    },
                  });
                }
              }
            } catch (error) {
              console.error('Push notification error:', error);
            }
          } else {
            console.warn('FCM_SERVER_KEY not configured - push notifications disabled');
          }
        }
      }

      // Send email notifications (if enabled) - Comment 3: Real Resend Integration
      if (notificationChannels.email) {
        const { data: users } = await supabase
          .from('users')
          .select('id, email, first_name')
          .in('id', [assignment.teacher_id, ...studentIds, ...parentIds])
          .eq('email_notifications_enabled', true);

        if (users && users.length > 0) {
          const emailRecipients = users.filter(u => u.email);
          if (emailRecipients.length > 0) {
            const resendApiKey = Deno.env.get('RESEND_API_KEY');
            if (resendApiKey) {
              try {
                // Batch send via Resend API (up to 100 recipients per batch)
                const batches: string[][] = [];
                for (let i = 0; i < emailRecipients.length; i += 100) {
                  batches.push(emailRecipients.slice(i, i + 100).map(u => u.email));
                }

                for (const batch of batches) {
                  const resendResponse = await fetch('https://api.resend.com/emails/batch', {
                    method: 'POST',
                    headers: {
                      'Authorization': 'Bearer ' + resendApiKey,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      from: 'NovaConnectSchool <notifications@novaconnect.app>',
                      to: batch,
                      subject: title,
                      html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                          <meta charset="utf-8">
                          <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
                            .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
                            .room-info { background: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 10px 0; }
                            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                          </style>
                        </head>
                        <body>
                          <div class="container">
                            <div class="header">
                              <h1>📍 Affectation de Salle</h1>
                            </div>
                            <div class="content">
                              <div class="room-info">
                                <p>${message.replaceAll('\n', '<br>')}</p>
                              </div>
                            </div>
                            <div class="footer">
                              <p>NovaConnectSchool - Votre plateforme scolaire</p>
                            </div>
                          </div>
                        </body>
                        </html>
                      `,
                    }),
                  });

                  if (!resendResponse.ok) {
                    console.error('Resend error:', await resendResponse.text());
                    await supabase.from('room_assignment_events').insert({
                      school_id: assignment.school_id,
                      room_assignment_id: assignment.id,
                      event_type: 'notification_failed',
                      reason: 'Email notification failed',
                      metadata: {
                        channel: 'email',
                        error: await resendResponse.text(),
                        recipient_count: batch.length,
                      },
                    });
                  }
                }
              } catch (error) {
                console.error('Email notification error:', error);
              }
            } else {
              console.warn('RESEND_API_KEY not configured - email notifications disabled');
            }
          }
        }
      }

      // Send SMS notifications (if enabled) - Comment 3: Real Twilio Integration
      if (notificationChannels.sms) {
        const { data: users } = await supabase
          .from('users')
          .select('id, phone, phone_country')
          .in('id', [assignment.teacher_id, ...studentIds, ...parentIds])
          .eq('sms_notifications_enabled', true);

        if (users && users.length > 0) {
          const phoneNumbers = users.filter(u => u.phone).map(u => ({
            number: u.phone_country ? u.phone_country + u.phone : u.phone,
            userId: u.id,
          }));

          if (phoneNumbers.length > 0) {
            const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
            const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
            const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

            if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
              try {
                // Send via Twilio Messages API
                const smsPromises = phoneNumbers.map(({ number, userId }) =>
                  fetch('https://api.twilio.com/2010-04-01/Accounts/' + twilioAccountSid + '/Messages.json', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded',
                      'Authorization': 'Basic ' + btoa(twilioAccountSid + ':' + twilioAuthToken),
                    },
                    body: new URLSearchParams({
                      From: twilioPhoneNumber,
                      To: number,
                      Body: message.substring(0, 160), // SMS limit
                    }),
                  })
                );

                const results = await Promise.allSettled(smsPromises);
                const failures = results.filter(r => r.status === 'rejected');

                if (failures.length > 0) {
                  await supabase.from('room_assignment_events').insert({
                    school_id: assignment.school_id,
                    room_assignment_id: assignment.id,
                    event_type: 'notification_failed',
                    reason: 'SMS notification partially failed',
                    metadata: {
                      channel: 'sms',
                      success_count: results.length - failures.length,
                      failure_count: failures.length,
                    },
                  });
                }
              } catch (error) {
                console.error('SMS notification error:', error);
              }
            } else {
              console.warn('Twilio credentials not configured - SMS notifications disabled');
            }
          }
        }
      }

      // Mark assignment as notified
      await supabase
        .from('room_assignments')
        .update({
          notification_sent: true,
          notified_at: new Date().toISOString(),
        })
        .eq('id', assignment.id);

      // Log publish event
      await supabase.from('room_assignment_events').insert({
        school_id: schoolId,
        room_assignment_id: assignment.id,
        event_type: 'published',
        new_room_id: assignment.assigned_room_id,
        reason: 'Published by school admin',
        metadata: {
          notification_channels: notificationChannels,
          notifications_sent: notificationChannels.inApp ? (1 + studentIds.length + parentIds.length) : 0,
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      published: publishedCount,
      notificationsSent,
      message: `Successfully published ${publishedCount} assignments and sent ${notificationsSent} notifications`
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Error in publish-room-assignments:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
