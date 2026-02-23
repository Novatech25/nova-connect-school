import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@novaconnect/data/client/server'

/**
 * API Route: Test Parent Creation (SIMPLIFIED VERSION)
 *
 * POST /api/test-parent-login
 *
 * Simplified version that:
 * 1. Creates auth user with metadata
 * 2. Immediately retrieves and verifies it
 * 3. Returns detailed diagnostic
 *
 * This version is robust and handles edge cases
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, firstName, lastName, schoolId, studentId, relationship } = body

    console.log('[SIMPLIFIED TEST] Starting test for:', email)
    console.log(
      '[SIMPLIFIED TEST] Input:',
      JSON.stringify({ email, firstName, lastName, schoolId, studentId }, null, 2)
    )

    const adminSupabase = createServiceClient()

    // =========================================
    // STEP 1: Get school code
    // =========================================
    const { data: school, error: schoolError } = await adminSupabase
      .from('schools')
      .select('code')
      .eq('id', schoolId)
      .single()

    if (schoolError || !school) {
      console.error('[SIMPLIFIED TEST] School not found:', schoolError)
      return NextResponse.json(
        {
          success: false,
          error: 'School not found',
          schoolId,
        },
        { status: 404 }
      )
    }

    console.log('[SIMPLIFIED TEST] School code:', school.code)

    // =========================================
    // STEP 2: Create auth user
    // =========================================
    const userMetadata = {
      first_name: firstName,
      last_name: lastName,
      role: 'parent',
      school_code: school.code,
      school_id: schoolId,
      provider: 'email',
      full_name: `${firstName} ${lastName}`,
    }

    const appMetadata = {
      role: 'parent',
      provider: 'email',
      school_id: schoolId,
    }

    console.log('[SIMPLIFIED TEST] Creating auth user with metadata:')
    console.log('[SIMPLIFIED TEST]   user_metadata:', JSON.stringify(userMetadata, null, 2))
    console.log('[SIMPLIFIED TEST]   app_metadata:', JSON.stringify(appMetadata, null, 2))

    const { data: authData, error: createAuthError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
      app_metadata: appMetadata,
    })

    if (createAuthError) {
      console.error('[SIMPLIFIED TEST] Auth user creation FAILED:', createAuthError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create auth user',
          details: createAuthError,
          step: 'create_auth_user',
        },
        { status: 500 }
      )
    }

    const authUserId = authData.user.id
    console.log('[SIMPLIFIED TEST] Auth user created:', authUserId)
    console.log('[SIMPLIFIED TEST] Created at:', authData.user.created_at)

    // =========================================
    // STEP 3: IMMEDIATELY verify user was created correctly
    // =========================================
    console.log('[SIMPLIFIED TEST] Retrieving user for verification...')

    const { data: verifyData, error: verifyError } =
      await adminSupabase.auth.admin.getUserById(authUserId)

    if (verifyError) {
      console.error('[SIMPLIFIED TEST] Verification FAILED:', verifyError)
      return NextResponse.json(
        {
          success: false,
          error: 'User created but verification failed',
          details: verifyError,
          step: 'verify_user',
        },
        { status: 500 }
      )
    }

    const verifyUser = verifyData.user

    console.log('[SIMPLIFIED TEST] User retrieved successfully')
    console.log('[SIMPLIFIED TEST]   Email:', verifyUser.email)
    console.log('[SIMPLIFIED TEST]   Email confirmed at:', verifyUser.email_confirmed_at)
    console.log(
      '[SIMPLIFIED TEST]   user_metadata:',
      JSON.stringify(verifyUser.user_metadata, null, 2)
    )
    console.log(
      '[SIMPLIFIED TEST]   app_metadata:',
      JSON.stringify(verifyUser.app_metadata, null, 2)
    )

    // =========================================
    // STEP 4: Verify metadata
    // =========================================
    const hasUserRole = verifyUser.user_metadata?.role === 'parent'
    const hasAppRole = verifyUser.app_metadata?.role === 'parent'
    const isEmailConfirmed = !!verifyUser.email_confirmed_at

    console.log('[SIMPLIFIED TEST] Metadata verification:')
    console.log('[SIMPLIFIED TEST]   - user_metadata.role present:', hasUserRole)
    console.log('[SIMPLIFIED TEST]   - user_metadata.role value:', verifyUser.user_metadata?.role)
    console.log('[SIMPLIFIED TEST]   - app_metadata.role present:', hasAppRole)
    console.log('[SIMPLIFIED TEST]   - app_metadata.role value:', verifyUser.app_metadata?.role)
    console.log('[SIMPLIFIED TEST]   - Email confirmed:', isEmailConfirmed)

    // =========================================
    // STEP 5: Test login IMMEDIATELY
    // =========================================
    console.log('[SIMPLIFIED TEST] Testing login...')

    const { data: loginData, error: loginError } = await adminSupabase.auth.signInWithPassword({
      email,
      password,
    })

    const loginSuccess = !loginError && !!loginData.session

    console.log('[SIMPLIFIED TEST] Login test result:')
    console.log('[SIMPLIFIED TEST]   - Success:', loginSuccess)
    if (loginError) {
      console.error('[SIMPLIFIED TEST]   - Error:', loginError)
    }

    // =========================================
    // STEP 6: Build results
    // =========================================
    const results = {
      success: loginSuccess,
      testType: 'simplified_parent_creation',
      steps: {
        school_retrieved: !!school,
        auth_user_created: !!authData.user,
        user_retrieved: !!verifyUser,
      },
      authUser: {
        id: authUserId,
        email: verifyUser.email,
        created_at: verifyUser.created_at,
        email_confirmed_at: verifyUser.email_confirmed_at,
      },
      userMetadata: {
        user_metadata: verifyUser.user_metadata,
        app_metadata: verifyUser.app_metadata,
      },
      metadataVerification: {
        has_user_metadata_role: hasUserRole,
        has_app_metadata_role: hasAppRole,
        is_email_confirmed: isEmailConfirmed,
        user_metadata_role_value: verifyUser.user_metadata?.role,
        app_metadata_role_value: verifyUser.app_metadata?.role,
      },
      loginTest: {
        success: loginSuccess,
        error: loginError?.message || null,
        error_code: loginError?.status || null,
      },
    }

    console.log('[SIMPLIFIED TEST] FINAL RESULTS:', JSON.stringify(results, null, 2))

    // =========================================
    // STEP 7: Build diagnostic message
    // =========================================
    let diagnosticMessage = ''

    if (loginSuccess && hasUserRole && hasAppRole && isEmailConfirmed) {
      diagnosticMessage =
        'SUCCESS: All checks passed. Parent account is correctly configured and can login.'
    } else {
      diagnosticMessage = 'ISSUES FOUND:\n'
      if (!hasUserRole) {
        diagnosticMessage += '  - user_metadata.role is missing or incorrect\n'
      }
      if (!hasAppRole) {
        diagnosticMessage += '  - app_metadata.role is missing or incorrect\n'
      }
      if (!isEmailConfirmed) {
        diagnosticMessage += '  - Email is not confirmed\n'
      }
      if (!loginSuccess) {
        diagnosticMessage += `  - Login failed: ${loginError?.message}\n`
      }
    }

    // =========================================
    // STEP 8: Return results
    // =========================================
    return NextResponse.json({
      success: true,
      message: 'Test completed',
      diagnostic: diagnosticMessage,
      results,
      recommendation: loginSuccess
        ? 'Parent can login with provided credentials'
        : 'Fix issues listed in diagnostic. Check Supabase logs for more details.',
    })
  } catch (error: any) {
    console.error('[SIMPLIFIED TEST] Exception:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message,
        stack: error.stack,
      },
      { status: 500 }
    )
  }
}

// GET method for testing route is accessible
export async function GET() {
  return NextResponse.json({
    message: 'GET request successful - route is working',
    version: 'simplified_v2',
    hint: 'Use POST to test parent creation',
  })
}
