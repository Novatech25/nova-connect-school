import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@novaconnect/data/client/server'

/**
 * API Route: Diagnostic Parent Account
 *
 * GET /api/parents/diagnostic?email=test@example.com
 *
 * Returns complete diagnostic information about a parent account
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 })
  }

  const adminSupabase = createServiceClient()

  // Check auth.users
  const { data: authUserList } = await adminSupabase.auth.admin.listUsers()
  const authUser = authUser.users.find((u: any) => u.email === email)

  // Check users table
  const { data: userRecord } = await adminSupabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  // Check parents table
  const { data: parentRecord } = await adminSupabase
    .from('parents')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  // Check roles
  let userRoles = null
  if (userRecord) {
    const { data: roles } = await adminSupabase
      .from('user_roles')
      .select('*, roles(*)')
      .eq('user_id', userRecord.id)
    userRoles = roles
  }

  // Check student-parent relations
  let studentRelations = null
  if (parentRecord) {
    const { data: relations } = await adminSupabase
      .from('student_parent_relations')
      .select('*, students(*)')
      .eq('parent_id', parentRecord.id)
    studentRelations = relations
  }

  // Compile diagnostic
  const diagnostic = {
    email,
    status: 'complete',

    // Auth User
    authUser: authUser
      ? {
          id: authUser.id,
          email: authUser.email,
          emailConfirmed: !!authUser.email_confirmed_at,
          createdAt: authUser.created_at,
          updatedAt: authUser.updated_at,
          hasUserMetadataRole: authUser.user_metadata?.role === 'parent',
          hasAppMetadataRole: authUser.app_metadata?.role === 'parent',
          userMetadata: authUser.user_metadata,
          appMetadata: authUser.app_metadata,
        }
      : { error: 'User not found in auth.users' },

    // Users Table
    userRecord: userRecord
      ? {
          id: userRecord.id,
          email: userRecord.email,
          firstName: userRecord.first_name,
          lastName: userRecord.last_name,
          schoolId: userRecord.school_id,
        }
      : { error: 'User not found in users table' },

    // Parents Table
    parentRecord: parentRecord
      ? {
          id: parentRecord.id,
          email: parentRecord.email,
          userId: parentRecord.user_id,
          firstName: parentRecord.first_name,
          lastName: parentRecord.last_name,
          relationship: parentRecord.relationship,
          phone: parentRecord.phone,
        }
      : { error: 'Parent record not found' },

    // Roles
    roles: userRoles
      ? {
          count: userRoles.length,
          roles: userRoles.map((r) => ({
            roleName: r.roles?.name,
            schoolId: r.school_id,
          })),
        }
      : { error: 'No roles assigned' },

    // Student Relations
    relations: studentRelations
      ? {
          count: studentRelations.length,
          relations: studentRelations.map((r) => ({
            studentId: r.student_id,
            studentName: r.students
              ? `${r.students.first_name} ${r.students.last_name}`
              : 'Unknown',
            relationship: r.relationship,
            isPrimary: r.is_primary,
          })),
        }
      : { error: 'No student relations' },

    // Recommendations
    recommendations: [] as string[],
  }

  // Add recommendations based on diagnostic
  if (!authUser) {
    diagnostic.recommendations.push('❌ Account not created in auth.users - cannot login')
    diagnostic.status = 'critical'
  } else if (!authUser.email_confirmed_at) {
    diagnostic.recommendations.push('❌ Email not confirmed - need to confirm email')
    diagnostic.status = 'warning'
  } else if (!authUser.user_metadata?.role && !authUser.app_metadata?.role) {
    diagnostic.recommendations.push('❌ Role not in metadata - login redirection will fail')
    diagnostic.status = 'warning'
  }

  if (!userRecord) {
    diagnostic.recommendations.push('⚠️ User record not found in users table')
    diagnostic.status = 'warning'
  }

  if (!parentRecord) {
    diagnostic.recommendations.push('⚠️ Parent record not found in parents table')
    diagnostic.status = 'warning'
  }

  if (!userRoles || userRoles.length === 0) {
    diagnostic.recommendations.push('⚠️ No roles assigned in user_roles table')
    diagnostic.status = 'warning'
  }

  if (diagnostic.recommendations.length === 0) {
    diagnostic.recommendations.push('✅ Account is properly configured')
    diagnostic.status = 'ok'
  }

  return NextResponse.json(diagnostic)
}
