import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RotationResult {
  rotatedCount: number
  rotatedQrCodes: Array<{
    qrCodeId: string
    classId: string
    oldToken: string
    newToken: string
    rotatedAt: string
  }>
  errors: string[]
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
    // Verify authentication via service role key or user token (for manual rotation)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Check if this is a service role request (automatic rotation) or user request (manual rotation)
    const isServiceRole = authHeader.includes(serviceRoleKey)

    const supabase = createClient(
      supabaseUrl,
      isServiceRole ? serviceRoleKey : Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Parse request body to check if this is a manual rotation
    const requestBody = await req.json().catch(() => ({}))
    const { forceRotateQrCodeId, reason } = requestBody

    // Manual rotation path (admin/supervisor)
    if (forceRotateQrCodeId) {
      // Verify user is authenticated and has admin/supervisor role
      if (isServiceRole) {
        throw new Error('Manual rotation requires user authentication, not service role')
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error('Invalid user authentication')
      }

      // Fetch the QR code to get school_id
      const { data: qrCode } = await supabase
        .from('qr_class_codes')
        .select('school_id, class_id')
        .eq('id', forceRotateQrCodeId)
        .single()

      if (!qrCode) {
        throw new Error('QR code not found')
      }

      // Verify user has admin/supervisor role
      const { data: userRole } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles (
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('school_id', qrCode.school_id)
        .single()

      const roleName = (userRole as any)?.roles?.name
      if (!['school_admin', 'supervisor'].includes(roleName)) {
        throw new Error('Unauthorized: Only admins and supervisors can manually rotate QR codes')
      }

      // Generate new token and signature for manual rotation
      const timestamp = Date.now()
      const nonce = crypto.randomUUID()

      // Get current generation count
      const { data: currentQr } = await supabase
        .from('qr_class_codes')
        .select('generation_count, rotation_interval_seconds')
        .eq('id', forceRotateQrCodeId)
        .single()

      const generationCount = (currentQr?.generation_count || 0) + 1
      const newQrToken = `premium:${qrCode.school_id}:${qrCode.class_id}:${timestamp}:${nonce}:${generationCount}`

      // Get school secret for signature
      const secret = Deno.env.get('QR_PREMIUM_SECRET') || 'default-premium-secret'
      const newSignature = await generateHMACSignature(newQrToken, secret)

      // Calculate new expiration
      const generatedAt = new Date().toISOString()
      const expiresAt = new Date(
        Date.now() + (currentQr?.rotation_interval_seconds || 60) * 1000
      ).toISOString()

      // Deactivate old QR code
      const { error: deactivateError } = await supabase
        .from('qr_class_codes')
        .update({ is_active: false })
        .eq('id', forceRotateQrCodeId)

      if (deactivateError) {
        throw new Error(`Failed to deactivate old QR code: ${deactivateError.message}`)
      }

      // Insert new QR code
      const { data: newQr, error: insertError } = await supabase
        .from('qr_class_codes')
        .insert({
          school_id: qrCode.school_id,
          class_id: qrCode.class_id,
          qr_token: newQrToken,
          signature: newSignature,
          generated_at: generatedAt,
          expires_at: expiresAt,
          rotation_interval_seconds: currentQr?.rotation_interval_seconds || 60,
          is_active: true,
          generation_count: generationCount,
          metadata: {
            rotation_reason: reason || 'manual',
            previous_qr_id: forceRotateQrCodeId,
            rotated_by: user.id,
          },
        })
        .select('id')
        .single()

      if (insertError || !newQr) {
        throw new Error(`Failed to insert new QR code: ${insertError?.message}`)
      }

      // Log rotation in history
      await supabase.from('qr_rotation_history').insert({
        school_id: qrCode.school_id,
        qr_code_id: newQr.id,
        old_token: '', // Not populated for manual rotation
        new_token: newQrToken,
        rotated_at: generatedAt,
        rotation_reason: reason || 'manual',
        rotated_by: user.id,
        metadata: {
          previous_qr_id: forceRotateQrCodeId,
          rotation_type: 'manual_user_initiated',
        },
      })

      return new Response(
        JSON.stringify({
          success: true,
          qrCodeId: newQr.id,
          message: 'QR code rotated successfully',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Automatic rotation path (service role only)
    if (!isServiceRole) {
      throw new Error('Automatic rotation requires service role authentication')
    }

    console.log('Starting QR code rotation...')

    // Fetch all active QR codes that have expired
    const { data: expiredQrCodes, error: fetchError } = await supabase
      .from('qr_class_codes')
      .select('*')
      .eq('is_active', true)
      .lt('expires_at', new Date().toISOString())

    if (fetchError) {
      console.error('Error fetching expired QR codes:', fetchError)
      throw new Error('Failed to fetch expired QR codes')
    }

    if (!expiredQrCodes || expiredQrCodes.length === 0) {
      console.log('No expired QR codes found')
      return new Response(
        JSON.stringify({
          rotatedCount: 0,
          rotatedQrCodes: [],
          errors: [],
        } as RotationResult),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Found ${expiredQrCodes.length} expired QR codes to rotate`)

    const rotatedQrCodes: RotationResult['rotatedQrCodes'] = []
    const errors: string[] = []
    let rotatedCount = 0

    // Process each expired QR code
    for (const oldQr of expiredQrCodes) {
      try {
        console.log(`Rotating QR code for class ${oldQr.class_id}`)

        // Generate new token and signature with premium marker
        const timestamp = Date.now()
        const nonce = crypto.randomUUID()
        const generationCount = (oldQr.generation_count || 0) + 1
        // Premium format: premium:schoolId:classId:timestamp:nonce:generationCount
        const newQrToken = `premium:${oldQr.school_id}:${oldQr.class_id}:${timestamp}:${nonce}:${generationCount}`

        // Get school secret for signature
        const secret = Deno.env.get('QR_PREMIUM_SECRET') || 'default-premium-secret'
        const newSignature = await generateHMACSignature(newQrToken, secret)

        // Calculate new expiration
        const generatedAt = new Date().toISOString()
        const expiresAt = new Date(
          Date.now() + oldQr.rotation_interval_seconds * 1000
        ).toISOString()

        // Deactivate old QR code
        const { error: deactivateError } = await supabase
          .from('qr_class_codes')
          .update({ is_active: false })
          .eq('id', oldQr.id)

        if (deactivateError) {
          throw new Error(`Failed to deactivate old QR code: ${deactivateError.message}`)
        }

        // Insert new QR code
        const { data: newQr, error: insertError } = await supabase
          .from('qr_class_codes')
          .insert({
            school_id: oldQr.school_id,
            class_id: oldQr.class_id,
            campus_id: oldQr.campus_id,
            qr_token: newQrToken,
            signature: newSignature,
            generated_at: generatedAt,
            expires_at: expiresAt,
            rotation_interval_seconds: oldQr.rotation_interval_seconds,
            is_active: true,
            generation_count: generationCount,
            metadata: {
              ...oldQr.metadata,
              rotation_reason: 'scheduled',
              previous_qr_id: oldQr.id,
            },
          })
          .select()
          .single()

        if (insertError || !newQr) {
          throw new Error(`Failed to insert new QR code: ${insertError?.message}`)
        }

        // Log rotation in history
        const { error: historyError } = await supabase.from('qr_rotation_history').insert({
          school_id: oldQr.school_id,
          qr_code_id: newQr.id,
          old_token: oldQr.qr_token,
          new_token: newQrToken,
          rotated_at: generatedAt,
          rotation_reason: 'scheduled',
          rotated_by: null, // System rotation
          metadata: {
            previous_qr_id: oldQr.id,
            rotation_type: 'automatic_scheduled',
          },
        })

        if (historyError) {
          console.error('Error logging rotation history:', historyError)
          // Continue anyway
        }

        rotatedQrCodes.push({
          qrCodeId: newQr.id,
          classId: oldQr.class_id,
          oldToken: oldQr.qr_token,
          newToken: newQrToken,
          rotatedAt: generatedAt,
        })

        rotatedCount++

        console.log(`Successfully rotated QR code for class ${oldQr.class_id}`)
      } catch (error) {
        const errorMessage = `Failed to rotate QR code for class ${oldQr.class_id}: ${error.message}`
        console.error(errorMessage)
        errors.push(errorMessage)
      }
    }

    // If there were many rotations, consider sending a notification to admins
    if (rotatedCount > 10) {
      console.log(`Large rotation event: ${rotatedCount} QR codes rotated`)
      // TODO: Send notification to school admins about mass rotation
    }

    const result: RotationResult = {
      rotatedCount,
      rotatedQrCodes,
      errors,
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in QR rotation:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to rotate QR codes',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function generateHMACSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(data)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
