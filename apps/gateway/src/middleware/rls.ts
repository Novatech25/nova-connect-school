import { Context, Next } from 'hono';
import { getUser, isAdmin } from './auth.js';
import type { User } from './auth.js';

// Row-Level Security middleware
// Ensures users can only access data from their school
export const rlsMiddleware = async (c: Context, next: Next) => {
  const user = getUser(c) as User;

  if (!user) {
    return c.json({ error: 'Unauthorized: User not found' }, 401);
  }

  // Super admin can access all schools with explicit school_id
  if (user.role === 'super_admin') {
    const schoolId = c.req.query('schoolId') || c.req.header('X-School-Id');

    if (!schoolId) {
      return c.json({ error: 'School ID required for super admin' }, 400);
    }

    c.set('schoolId', schoolId);
  } else {
    // Regular users: use school_id from their profile
    if (!user.schoolId) {
      return c.json({ error: 'Forbidden: User not associated with a school' }, 403);
    }

    c.set('schoolId', user.schoolId);
  }

  // Set user ID for audit logging
  c.set('userId', user.id);
  c.set('userRole', user.role);

  await next();
};

// Helper to get school ID from context
export function getSchoolId(c: Context): string | undefined {
  return c.get('schoolId');
}

// Helper to get user ID from context
export function getUserId(c: Context): string | undefined {
  return c.get('userId');
}

// Helper to get user role from context
export function getUserRole(c: Context): string | undefined {
  return c.get('userRole');
}
