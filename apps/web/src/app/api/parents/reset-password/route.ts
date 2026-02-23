import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@novaconnect/data/client/server'

/**
 * API Route: Reset Parent Password
 *
 * POST /api/parents/reset-password
 *
 * Body: { email: string, newPassword: string }
 *
 * Resets the password for a parent account
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, newPassword } = body

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and newPassword are required' }, { status: 400 })
    }

    const adminSupabase = createServiceClient()

    // First, find the user by email
    const { data: authUser, error: listError } = await adminSupabase.auth.admin.listUsers()
    const foundUser = authUser.users.find((u: any) => u.email === email)

    if (!foundUser) {
      return NextResponse.json({ error: 'User not found', email }, { status: 404 })
    }

    // Reset the password
    const { data, error: updateError } = await adminSupabase.auth.admin.updateUserById(
      foundUser.id,
      {
        password: newPassword,
        email_confirm: true,
      }
    )

    if (updateError) {
      console.error('[API] Error resetting password:', updateError)
      return NextResponse.json(
        { error: 'Failed to reset password', details: updateError },
        { status: 500 }
      )
    }

    console.log('[API] Password reset successful for:', email)

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
      userId: data.user.id,
    })
  } catch (error: any) {
    console.error('[API] Exception resetting password:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
