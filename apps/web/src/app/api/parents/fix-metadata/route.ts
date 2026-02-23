import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@novaconnect/data/client/server'

/**
 * API Route: Fix Parent Metadata
 *
 * POST /api/parents/fix-metadata
 *
 * Body: { email: string }
 *
 * Fixes app_metadata by copying role from user_metadata
 * WITHOUT changing the password
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const adminSupabase = createServiceClient()

    // Find user by email
    const { data: authUserList } = await adminSupabase.auth.admin.listUsers()
    const authUser = authUserList.users.find((u: any) => u.email === email)

    if (!authUser) {
      return NextResponse.json({ error: 'User not found', email }, { status: 404 })
    }

    console.log('[API] Fixing metadata for:', email)
    console.log('[API] Current user_metadata:', authUser.user_metadata)
    console.log('[API] Current app_metadata:', authUser.app_metadata)

    // Get role from user_metadata
    const role = authUser.user_metadata?.role

    if (!role) {
      return NextResponse.json(
        { error: 'No role found in user_metadata', user_metadata: authUser.user_metadata },
        { status: 400 }
      )
    }

    // Update app_metadata with role (merge with existing)
    const newAppMetadata = {
      ...(authUser.app_metadata || {}),
      role,
      provider: authUser.user_metadata?.provider || 'email',
    }

    console.log('[API] Updating app_metadata to:', newAppMetadata)

    // Update user with new app_metadata
    const { data, error } = await adminSupabase.auth.admin.updateUserById(authUser.id, {
      app_metadata: newAppMetadata,
      email_confirm: true, // Ensure email is confirmed
    })

    if (error) {
      console.error('[API] Error updating metadata:', error)
      return NextResponse.json(
        { error: 'Failed to update metadata', details: error },
        { status: 500 }
      )
    }

    console.log('[API] Metadata fixed successfully for:', email)

    return NextResponse.json({
      success: true,
      message: 'app_metadata fixed successfully',
      email,
      userId: data.user.id,
      previousAppMetadata: authUser.app_metadata,
      newAppMetadata,
    })
  } catch (error: any) {
    console.error('[API] Exception fixing metadata:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
