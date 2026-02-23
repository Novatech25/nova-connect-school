import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@novaconnect/data/client/server'

/**
 * API Route: Test Parent Creation and Login
 *
 * POST /api/parents/test-create-login
 *
 * Tests the complete flow:
 * 1. Create parent account
 * 2. Verify metadata
 * 3. Try to login
 *
 * This helps debug "Invalid login credentials" issues
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { email, password, firstName, lastName, schoolId, studentId, relationship } = body

    console.log('[TEST] Starting parent creation and login test')
    console.log('[TEST] Input:', { email, firstName, lastName, schoolId, studentId })

    const adminSupabase = createServiceClient()

    // =========================================
    // STEP 1: Get school code
    // =========================================
    const { data: school } = await adminSupabase
      .from('schools')
      .select('code')
      .eq('id', schoolId)
      .single()

    if (!school) {
      return NextResponse.json({ error: 'School not found', schoolId }, { status: 404 })
    }

    console.log('[TEST] School code:', school.code)

    // =========================================
    // STEP 2: Create auth user
    // =========================================
    const { data: authData, error: createAuthError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: 'parent',
        school_code: school.code,
        school_id: schoolId,
        provider: 'email',
        full_name: `${firstName} ${lastName}`,
      },
      app_metadata: {
        role: 'parent',
        provider: 'email',
        school_id: schoolId,
      },
    })

    if (createAuthError) {
      console.error('[TEST] Auth user creation FAILED:', createAuthError)
      return NextResponse.json(
        {
          error: 'Failed to create auth user',
          details: createAuthError,
          step: 'create_auth_user',
        },
        { status: 500 }
      )
    }

    const authUserId = authData.user.id
    console.log('[TEST] Auth user CREATED:', authUserId)

    // =========================================
    // STEP 3: Verify auth user was created correctly
    // =========================================
    const { data: verifyUser, error: verifyError } =
      await adminSupabase.auth.admin.getUserById(authUserId)

    if (verifyError) {
      console.error('[TEST] Verification FAILED:', verifyError)
      return NextResponse.json(
        {
          error: 'User created but verification failed',
          details: verifyError,
          step: 'verify_user',
        },
        { status: 500 }
      )
    }

    console.log('[TEST] User verification:')
    console.log('[TEST]   - Email:', verifyUser.user.email)
    console.log('[TEST]   - Email confirmed:', !!verifyUser.user.email_confirmed_at)
    console.log('[TEST]   - user_metadata.role:', verifyUser.user.user_metadata?.role)
    console.log('[TEST]   - app_metadata.role:', verifyUser.user.app_metadata?.role)
    console.log('[TEST]   - Created at:', verifyUser.user.created_at)

    // =========================================
    // STEP 4: Test login with the created credentials
    // =========================================
    console.log('[TEST] Testing login with created credentials...')
    const { data: loginData, error: loginError } = await adminSupabase.auth.signInWithPassword({
      email,
      password,
    })

    const testResults = {
      step: 'test_login',
      loginAttempt: {
        email,
        success: !loginError,
        error: loginError?.message,
        errorDetails: loginError,
      },
      userVerification: {
        hasUserMetadataRole: !!verifyUser.user.user_metadata?.role,
        hasAppMetadataRole: !!verifyUser.user.app_metadata?.role,
        userMetadataRole: verifyUser.user.user_metadata?.role,
        appMetadataRole: verifyUser.user.app_metadata?.role,
        emailConfirmed: !!verifyUser.user.email_confirmed_at,
      },
      authUserCreation: {
        success: true,
        userId: authUserId,
        email: verifyUser.user.email,
        createdAt: verifyUser.user.created_at,
      },
    }

    if (loginError) {
      console.error('[TEST] LOGIN FAILED:', loginError)
      console.error('[TEST] Full test results:', JSON.stringify(testResults, null, 2))

      return NextResponse.json(
        {
          error: 'Login test failed',
          details: loginError,
          testResults,
          recommendation:
            'Check if password was correctly stored. Password might be corrupted during creation.',
        },
        { status: 500 }
      )
    }

    console.log('[TEST] LOGIN SUCCESSFUL!')
    console.log('[TEST] Full test results:', JSON.stringify(testResults, null, 2))

    // =========================================
    // STEP 5: Create parent record and relation (if login successful)
    // =========================================
    const { data: userRecord, error: userError } = await adminSupabase
      .from('users')
      .insert({
        id: authUserId,
        school_id: schoolId,
        email,
        first_name: firstName,
        last_name: lastName,
      })
      .select()
      .single()

    if (userError) {
      console.error('[TEST] User record creation FAILED:', userError)
    } else {
      console.log('[TEST] User record CREATED:', userRecord.id)
    }

    const { data: parentRecord, error: parentError } = await adminSupabase
      .from('parents')
      .insert({
        school_id: schoolId,
        user_id: authUserId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: '0000000',
        relationship: relationship || 'Parent',
        is_primary_contact: true,
        is_emergency_contact: true,
      })
      .select()
      .single()

    if (parentError) {
      console.error('[TEST] Parent record creation FAILED:', parentError)
    } else {
      console.log('[TEST] Parent record CREATED:', parentRecord.id)
    }

    // Get parent role ID
    const { data: roleData } = await adminSupabase
      .from('roles')
      .select('id')
      .eq('name', 'parent')
      .single()

    if (!roleData) {
      console.error('[TEST] Parent role not found')
      return NextResponse.json(
        {
          error: 'Parent role not found in database',
          testResults,
        },
        { status: 500 }
      )
    }

    const { error: roleAssignError } = await adminSupabase.from('user_roles').insert({
      user_id: authUserId,
      role_id: roleData.id,
      school_id: schoolId,
    })

    if (roleAssignError) {
      console.error('[TEST] Role assignment FAILED:', roleAssignError)
    } else {
      console.log('[TEST] Role ASSIGNED')
    }

    // Create relation
    const { error: relationError } = await adminSupabase.from('student_parent_relations').insert({
      school_id: schoolId,
      student_id: studentId,
      parent_id: parentRecord.id,
      relationship: relationship || 'Parent',
      is_primary: true,
      can_pickup: true,
      can_view_grades: true,
      can_view_attendance: true,
    })

    if (relationError) {
      console.error('[TEST] Relation creation FAILED:', relationError)
    } else {
      console.log('[TEST] Relation CREATED')
    }

    // Return success with test results
    return NextResponse.json({
      success: true,
      message: 'Parent account created and login test successful',
      testResults: {
        ...testResults,
        databaseRecords: {
          userRecord: userRecord
            ? { id: userRecord.id, email: userRecord.email }
            : { error: userError?.message },
          parentRecord: parentRecord
            ? { id: parentRecord.id, email: parentRecord.email }
            : { error: parentError?.message },
          roleAssigned: !roleAssignError,
          relationCreated: !relationError,
        },
      },
      recommendation: 'Parent can now login. Use the provided credentials.',
    })
  } catch (error: any) {
    console.error('[TEST] Exception:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}
