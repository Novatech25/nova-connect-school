import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@novaconnect/data/client/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
  }

  const adminSupabase = createServiceClient();

  // Check in auth.users
  const { data: authUsers, error: authError } = await adminSupabase.auth.admin.listUsers();

  if (authError) {
    return NextResponse.json({ error: 'Failed to list users', details: authError }, { status: 500 });
  }

  const foundUser = authUsers.users.find((u: any) => u.email === email);

  if (!foundUser) {
    return NextResponse.json({
      message: 'User NOT found in auth.users',
      email,
      totalUsers: authUsers.users.length,
    });
  }

  return NextResponse.json({
    message: 'User FOUND in auth.users',
    email,
    user: {
      id: foundUser.id,
      email: foundUser.email,
      email_confirmed_at: foundUser.email_confirmed_at,
      confirmed_at: foundUser.confirmed_at,
      created_at: foundUser.created_at,
      updated_at: foundUser.updated_at,
      user_metadata: foundUser.user_metadata,
      app_metadata: foundUser.app_metadata,
    },
  });
}
