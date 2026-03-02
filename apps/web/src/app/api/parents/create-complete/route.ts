import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@novaconnect/data/client/server'

/**
 * API Route: Create Complete Parent Account
 *
 * This endpoint creates a complete parent account with:
 * 1. Auth user (in auth.users)
 * 2. Users record (in users table)
 * 3. Parent record (in parents table)
 * 4. Parent-student relation (in student_parent_relations)
 * 5. Parent role (in user_roles)
 *
 * POST /api/parents/create-complete
 * Body: {
 *   email: string,
 *   password: string,
 *   firstName: string,
 *   lastName: string,
 *   schoolId: string,
 *   studentId: string,
 *   relationship: string,
 *   phone?: string,
 *   address?: string,
 *   city?: string,
 *   occupation?: string,
 *   workplace?: string,
 *   isPrimaryContact?: boolean,
 *   isEmergencyContact?: boolean
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log('[API] Creating complete parent account, received:', {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      studentId: body.studentId,
      relationship: body.relationship,
    })

    const {
      email,
      password,
      firstName,
      lastName,
      schoolId,
      studentId,
      relationship,
      phone = '0000000',
      address,
      city,
      occupation,
      workplace,
      isPrimaryContact = true,
      isEmergencyContact = true,
    } = body

    // Validation
    if (
      !email ||
      !password ||
      !firstName ||
      !lastName ||
      !schoolId ||
      !studentId ||
      !relationship
    ) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: [
            'email',
            'password',
            'firstName',
            'lastName',
            'schoolId',
            'studentId',
            'relationship',
          ],
        },
        { status: 400 }
      )
    }

    const adminSupabase = createServiceClient()

    // Check if user already exists
    const { data: existingUser } = await adminSupabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists', userId: existingUser.id },
        { status: 409 }
      )
    }

    // Check if parent record already exists
    const { data: existingParent } = await adminSupabase
      .from('parents')
      .select('id, email')
      .eq('email', email)
      .eq('school_id', schoolId)
      .maybeSingle()

    if (existingParent) {
      return NextResponse.json(
        {
          error: 'Parent with this email already exists in this school',
          parentId: existingParent.id,
        },
        { status: 409 }
      )
    }

    // Check if student exists
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      return NextResponse.json({ error: 'Student not found', studentId }, { status: 404 })
    }

    // Get parent role ID
    const { data: parentRole } = await adminSupabase
      .from('roles')
      .select('id')
      .eq('name', 'parent')
      .single()

    if (!parentRole) {
      return NextResponse.json({ error: 'Parent role not found in database' }, { status: 500 })
    }

    // Get school code for user metadata
    const { data: school, error: schoolError } = await adminSupabase
      .from('schools')
      .select('code')
      .eq('id', schoolId)
      .single()

    if (schoolError || !school) {
      return NextResponse.json(
        { error: 'School not found or missing code', schoolId },
        { status: 404 }
      )
    }

    // STEP 1: Create auth user using Admin API (same as create-account which works)
    console.log('[API] Creating auth user with metadata:', {
      email,
      firstName,
      lastName,
      role: 'parent',
      school_code: school.code,
      schoolId,
    })

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
      },
      app_metadata: {
        role: 'parent',
        provider: 'email',
        school_id: schoolId,
      },
    })

    if (createAuthError) {
      console.error('[API] Auth user creation failed:', createAuthError)
      return NextResponse.json(
        { 
          error: createAuthError.message || 'Echec de la creation utilisateur (Auth)', 
          details: createAuthError 
        },
        { status: 500 }
      )
    }

    const authUserId = authData.user.id

    console.log('[API] Auth user created with Admin SDK:', authUserId)

    // STEP 2: Wait for trigger to create user record, then fetch it
    // The trigger handle_new_user() automatically creates the user record
    await new Promise((resolve) => setTimeout(resolve, 100))

    const { data: userRecord, error: userError } = await adminSupabase
      .from('users')
      .select('*')
      .eq('id', authUserId)
      .single()

    if (userError || !userRecord) {
      console.error('[API] Failed to fetch user record created by trigger:', userError)
      // Cleanup: delete auth user if user record not found
      await adminSupabase.auth.admin.deleteUser(authUserId)

      return NextResponse.json(
        { error: 'Failed to create user record via trigger', details: userError },
        { status: 500 }
      )
    }

    // STEP 3: Create parent record
    const { data: parentRecord, error: parentError } = await adminSupabase
      .from('parents')
      .insert({
        school_id: schoolId,
        user_id: authUserId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        relationship,
        address,
        city,
        occupation,
        workplace,
        is_primary_contact: isPrimaryContact,
        is_emergency_contact: isEmergencyContact,
      })
      .select()
      .single()

    if (parentError) {
      // Cleanup: delete user and auth user if parent creation fails
      await adminSupabase.from('users').delete().eq('id', authUserId)
      await adminSupabase.auth.admin.deleteUser(authUserId)

      return NextResponse.json(
        { error: 'Failed to create parent record', details: parentError },
        { status: 500 }
      )
    }

    console.log('[API] Parent record created:', parentRecord.id)

    // STEP 4: Create parent-student relation
    console.log('[API] Creating parent-student relation:', {
      school_id: schoolId,
      parent_id: parentRecord.id,
      student_id: studentId,
      relationship,
    })

    const { data: relationRecord, error: relationError } = await adminSupabase
      .from('student_parent_relations')
      .insert({
        school_id: schoolId,
        parent_id: parentRecord.id,
        student_id: studentId,
        relationship,
        is_primary: isPrimaryContact,
        can_pickup: true,
        can_view_grades: true,
        can_view_attendance: true,
      })
      .select()
      .single()

    console.log('[API] Relation creation result:', { relationRecord, relationError })

    if (relationError) {
      console.error('[API] Failed to create parent-student relation:', relationError)
      // Cleanup: delete parent, user and auth user if relation creation fails
      await adminSupabase.from('parents').delete().eq('id', parentRecord.id)
      await adminSupabase.from('users').delete().eq('id', authUserId)
      await adminSupabase.auth.admin.deleteUser(authUserId)

      return NextResponse.json(
        { error: 'Failed to create parent-student relation', details: relationError },
        { status: 500 }
      )
    }

    // STEP 5: Verify parent role was assigned by trigger
    const { data: roleRecord, error: roleCheckError } = await adminSupabase
      .from('user_roles')
      .select('*')
      .eq('user_id', authUserId)
      .eq('role_id', parentRole.id)
      .single()

    if (roleCheckError || !roleRecord) {
      console.warn('[API] Parent role may not be assigned, checking:', roleCheckError)
      // Non-fatal error, continue
    }

    console.log('[API] ✅ Complete parent account created successfully:', {
      authUserId,
      userId: userRecord.id,
      parentId: parentRecord.id,
      relationId: relationRecord.id,
      email,
      hasRole: !!roleRecord,
    })

    return NextResponse.json({
      success: true,
      message: 'Parent account created successfully',
      data: {
        authUserId,
        userId: userRecord.id,
        parentId: parentRecord.id,
        relationId: relationRecord.id,
        email,
      },
    })
  } catch (error: any) {
    console.error('Error creating parent account:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error', 
        details: error.stack 
      },
      { status: 500 }
    )
  }
}
