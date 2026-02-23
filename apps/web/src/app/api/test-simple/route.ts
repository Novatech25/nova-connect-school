import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route: Simple Test - Just verify Supabase connection
 *
 * POST /api/test-simple
 *
 * Ultra-simplified version to debug 500 errors
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[SIMPLE TEST] Received:', JSON.stringify(body, null, 2))

    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        {
          error: 'Email and password are required',
        },
        { status: 400 }
      )
    }

    console.log('[SIMPLE TEST] Step 1: Getting service client...')

    // Get the service client
    const { createServiceClient } = await import('@novaconnect/data/client')
    const adminSupabase = createServiceClient()

    console.log('[SIMPLE TEST] Step 2: Service client created')

    console.log('[SIMPLE TEST] Step 3: Testing signInWithPassword...')

    // Test signIn
    const { data: signInData, error: signInError } = await adminSupabase.auth.signInWithPassword({
      email,
      password,
    })

    console.log('[SIMPLE TEST] Step 4: signInWithPassword completed')
    console.log('[SIMPLE TEST]   - Error:', signInError)
    console.log('[SIMPLE TEST]   - Has data:', !!signInData)
    console.log('[SIMPLE TEST]   - Has session:', !!signInData.session)

    if (signInError) {
      console.error('[SIMPLE TEST] signIn failed:', signInError)
      return NextResponse.json(
        {
          error: 'Login failed',
          details: signInError.message,
        },
        { status: 500 }
      )
    }

    if (!signInData.session) {
      console.error('[SIMPLE TEST] No session returned')
      return NextResponse.json(
        {
          error: 'No session returned',
        },
        { status: 500 }
      )
    }

    console.log('[SIMPLE TEST] Step 5: SUCCESS')
    console.log('[SIMPLE TEST]   - User ID:', signInData.user.id)
    console.log('[SIMPLE TEST]   - Email:', signInData.user.email)
    console.log('[SIMPLE TEST]   - Email confirmed:', !!signInData.user.email_confirmed_at)
    console.log('[SIMPLE TEST]   - User metadata role:', signInData.user.user_metadata?.role)
    console.log('[SIMPLE TEST]   - App metadata role:', signInData.user.app_metadata?.role)

    return NextResponse.json({
      success: true,
      message: 'Simple test completed',
      user: {
        id: signInData.user.id,
        email: signInData.user.email,
        emailConfirmed: !!signInData.user.email_confirmed_at,
        userMetadataRole: signInData.user.user_metadata?.role,
        appMetadataRole: signInData.user.app_metadata?.role,
      },
    })
  } catch (error: any) {
    console.error('[SIMPLE TEST] Exception:', error)
    console.error('[SIMPLE TEST] Stack:', error.stack)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
        stack: error.stack,
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Simple test endpoint',
    endpoints: {
      POST: 'Test login with existing credentials',
      GET: 'Check if route is working',
    },
    usage: 'POST with { "email": "...", "password": "..." } to test',
  })
}
