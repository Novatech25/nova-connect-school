import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface GenerateClassQrRequest {
  schoolId: string
  classId: string
  campusId?: string
  rotationIntervalSeconds: number
}

interface GenerateClassQrResponse {
  qrCodeId: string
  qrData: string
  expiresAt: string
  rotationIntervalSeconds: number
  classId: string
  generatedAt: string
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
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Get user from auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const { schoolId, classId, campusId, rotationIntervalSeconds }: GenerateClassQrRequest =
      await req.json()

    // Validate request
    if (!schoolId || !classId || !rotationIntervalSeconds) {
      throw new Error('Missing required fields: schoolId, classId, rotationIntervalSeconds')
    }

    if (rotationIntervalSeconds < 30 || rotationIntervalSeconds > 600) {
      throw new Error('rotationIntervalSeconds must be between 30 and 600')
    }

    // Check if user has admin or supervisor role
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select(
        `
        role_id,
        roles (
          name
        )
      `
      )
      .eq('user_id', user.id)
      .eq('school_id', schoolId)
      .single()

    if (roleError || !userRole) {
      throw new Error('User does not have a role in this school')
    }

    const roleName = (userRole as any).roles?.name
    if (roleName !== 'school_admin' && roleName !== 'supervisor') {
      throw new Error('User must be a school admin or supervisor to generate QR codes')
    }

    // Check premium feature access
    const hasPremiumAccess = await checkPremiumFeature(supabase, schoolId, 'qr_advanced')
    if (!hasPremiumAccess) {
      throw new Error(
        'Premium QR features require an active premium or enterprise license. Please contact support.'
      )
    }

    // Check if module is enabled in school settings
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('enabled_modules, settings')
      .eq('id', schoolId)
      .single()

    if (schoolError || !school) {
      throw new Error('School not found')
    }

    const enabledModules = school.enabled_modules || []
    if (!enabledModules.includes('qr_advanced')) {
      throw new Error(
        'QR Advanced module is not enabled. Please enable it in school settings.'
      )
    }

    const premiumSettings = school.settings?.qrAttendancePremium
    if (!premiumSettings?.classQrEnabled) {
      throw new Error(
        'Class QR generation is not enabled. Please enable it in QR Premium settings.'
      )
    }

    // Deactivate old QR codes for this class
    const { error: deactivateError } = await supabase
      .from('qr_class_codes')
      .update({ is_active: false })
      .eq('class_id', classId)
      .eq('is_active', true)

    if (deactivateError) {
      console.error('Error deactivating old QR codes:', deactivateError)
      // Continue anyway
    }

    // Get generation count for this class
    const { data: lastQr, error: lastQrError } = await supabase
      .from('qr_class_codes')
      .select('generation_count')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const generationCount = (lastQr?.generation_count || 0) + 1

    // Generate QR token and signature with premium marker
    const timestamp = Date.now()
    const nonce = crypto.randomUUID()
    // Add "premium" marker to distinguish from standard QR tokens
    // Standard format: schoolId:codeType:classId:timestamp:randomBytes
    // Premium format: premium:schoolId:classId:timestamp:nonce:generationCount
    const qrToken = `premium:${schoolId}:${classId}:${timestamp}:${nonce}:${generationCount}`

    // Get school secret for signature
    const secret = Deno.env.get('QR_PREMIUM_SECRET') || 'default-premium-secret'
    const signature = await generateHMACSignature(qrToken, secret)

    // Calculate expiration
    const generatedAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + rotationIntervalSeconds * 1000).toISOString()

    // Insert QR code
    const { data: newQr, error: insertError } = await supabase
      .from('qr_class_codes')
      .insert({
        school_id: schoolId,
        class_id: classId,
        campus_id: campusId || null,
        qr_token: qrToken,
        signature: signature,
        generated_at: generatedAt,
        expires_at: expiresAt,
        rotation_interval_seconds: rotationIntervalSeconds,
        is_active: true,
        generation_count: generationCount,
        metadata: {
          generated_by: user.id,
          generated_by_name: user.email,
        },
      })
      .select()
      .single()

    if (insertError || !newQr) {
      console.error('Error inserting QR code:', insertError)
      throw new Error('Failed to generate QR code')
    }

    // Log in audit_logs
    await supabase.from('audit_logs').insert({
      table_name: 'qr_class_codes',
      record_id: newQr.id,
      action: 'INSERT',
      old_data: null,
      new_data: newQr,
      changed_by: user.id,
      changed_at: new Date().toISOString(),
      metadata: {
        action_type: 'generate_premium_qr_class',
        class_id: classId,
        rotation_interval_seconds: rotationIntervalSeconds,
      },
    })

    // Prepare QR data (base64 encoded token + signature)
    // Use btoa for Deno-compatible base64 encoding
    const qrData = btoa(JSON.stringify({ token: qrToken, sig: signature }))

    // Prepare response
    const response: GenerateClassQrResponse = {
      qrCodeId: newQr.id,
      qrData: qrData,
      expiresAt: expiresAt,
      rotationIntervalSeconds: rotationIntervalSeconds,
      classId: classId,
      generatedAt: generatedAt,
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error generating class QR:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate QR code',
      }),
      {
        status: error.message?.includes('Unauthorized') ? 401 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function checkPremiumFeature(
  supabase: any,
  schoolId: string,
  feature: string
): Promise<boolean> {
  // Check license
  const { data: license } = await supabase
    .from('licenses')
    .select('license_type, status, expires_at')
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .gte('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!license) {
    return false
  }

  if (!['premium', 'enterprise'].includes(license.license_type)) {
    return false
  }

  // Check enabled modules
  const { data: school } = await supabase
    .from('schools')
    .select('enabled_modules')
    .eq('id', schoolId)
    .single()

  const enabledModules = school?.enabled_modules || []
  return enabledModules.includes(feature)
}

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
