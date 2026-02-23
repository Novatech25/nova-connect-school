import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@novaconnect/data/client/server'

/**
 * API Route: Check if email exists
 *
 * GET /api/users/check-email?email=test@example.com
 *
 * Returns information about whether the email exists in:
 * - auth.users
 * - users table
 * - parents table
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 })
  }

  const adminSupabase = createServiceClient()

  // Check auth.users
  const { data: authUser, error: authError } = await adminSupabase.auth.admin.listUsers()
  const foundInAuth = authUser.users.find((u: any) => u.email === email)

  // Check users table
  const { data: userRecord, error: userError } = await adminSupabase
    .from('users')
    .select('id, email, first_name, last_name, school_id')
    .eq('email', email)
    .maybeSingle()

  // Check parents table
  const { data: parentRecord, error: parentError } = await adminSupabase
    .from('parents')
    .select('id, email, user_id, first_name, last_name')
    .eq('email', email)
    .maybeSingle()

  return NextResponse.json({
    email,
    foundInAuth: !!foundInAuth,
    authUser: foundInAuth
      ? {
          id: foundInAuth.id,
          email: foundInAuth.email,
          emailConfirmedAt: foundInAuth.email_confirmed_at,
          userMetadata: foundInAuth.user_metadata,
          appMetadata: foundInAuth.app_metadata,
        }
      : null,
    foundInUsers: !!userRecord,
    userRecord,
    foundInParents: !!parentRecord,
    parentRecord,
  })
}
