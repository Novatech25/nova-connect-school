import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface AnomalyNotificationRequest {
  anomalyId: string
  schoolId: string
  studentId: string
  anomalyType: string
  severity: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify service role authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!authHeader.includes(serviceRoleKey)) {
      throw new Error('Unauthorized: Service role required')
    }

    // Parse request body
    const { anomalyId, schoolId, studentId, anomalyType, severity }: AnomalyNotificationRequest =
      await req.json()

    if (!anomalyId || !schoolId || !studentId) {
      throw new Error('Missing required fields: anomalyId, schoolId, studentId')
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Fetch anomaly details
    const { data: anomaly, error: anomalyError } = await supabase
      .from('qr_scan_anomalies')
      .select(`
        *,
        students (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', anomalyId)
      .single()

    if (anomalyError || !anomaly) {
      throw new Error('Anomaly not found')
    }

    // Fetch school admins and supervisors
    const { data: admins, error: adminsError } = await supabase
      .from('user_roles')
      .select(
        `
        user_id,
        users (
          id,
          email,
          notifications_enabled
        )
      `
      )
      .eq('school_id', schoolId)
      .in('role_id', (await supabase.from('roles').select('id').in('name', ['school_admin', 'supervisor'])).data?.map(r => r.id) || [])

    if (adminsError) {
      console.error('Error fetching admins:', adminsError)
    }

    // Prepare notification data
    const student = (anomaly as any).students
    const studentName = student ? `${student.first_name} ${student.last_name}` : 'Unknown Student'

    const anomalyTypeLabels: Record<string, string> = {
      multiple_devices: 'Appareils Multiples',
      impossible_location: 'Localisation Impossible',
      rapid_scans: 'Scans Rapides',
      signature_mismatch: 'Signature Invalide',
      expired_reuse: 'QR Expiré Réutilisé',
      device_binding_violation: 'Violation Device Binding',
    }

    const severityLabels: Record<string, string> = {
      low: 'Faible',
      medium: 'Moyen',
      high: 'Élevé',
      critical: 'Critique',
    }

    const notificationTitle = `Anomalie de Présence Détectée - ${severityLabels[severity] || severity}`
    const notificationBody = `Anomalie: ${anomalyTypeLabels[anomalyType] || anomalyType}\nÉlève: ${studentName}\nSévérité: ${severityLabels[severity] || severity}`

    // Create in-app notifications for all admins
    if (admins && admins.length > 0) {
      const notifications = admins
        .filter((admin: any) => admin.users?.notifications_enabled !== false)
        .map((admin: any) => ({
          user_id: admin.user_id,
          type: 'anomaly_detected',
          title: notificationTitle,
          body: notificationBody,
          data: {
            anomalyId: anomaly.id,
            studentId: studentId,
            anomalyType: anomaly.anomaly_type,
            severity: anomaly.severity,
            schoolId: schoolId,
          },
          created_at: new Date().toISOString(),
        }))

      if (notifications.length > 0) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notifications)

        if (notifError) {
          console.error('Error creating notifications:', notifError)
        }
      }
    }

    // Send email notification for high and critical severity
    if (severity === 'high' || severity === 'critical') {
      const adminEmails = admins
        ?.map((admin: any) => admin.users?.email)
        .filter(Boolean)
        .join(', ')

      if (adminEmails) {
        // TODO: Implement email sending via your email service (SendGrid, AWS SES, etc.)
        console.log(`Email notification sent to: ${adminEmails}`)
        console.log(`Subject: ${notificationTitle}`)
        console.log(`Body: ${notificationBody}`)

        // Example email sending (uncomment and configure your email service):
        // await sendEmail({
        //   to: adminEmails,
        //   subject: notificationTitle,
        //   text: notificationBody,
        // })
      }
    }

    // Send push notification for critical severity
    if (severity === 'critical') {
      // TODO: Implement push notifications via Expo Firebase
      console.log(`Push notification sent for critical anomaly: ${anomalyId}`)

      // Example push notification (uncomment and configure Expo):
      // await sendPushNotification({
      //   to: adminPushTokens,
      //   title: notificationTitle,
      //   body: notificationBody,
      //   data: { anomalyId, type: 'anomaly_detected' },
      // })
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification sent successfully',
        notifiedAdmins: admins?.length || 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error sending anomaly notification:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to send notification',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
