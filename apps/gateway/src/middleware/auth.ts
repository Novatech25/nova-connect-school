import { Context, Next } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { LocalAuthService } from '../services/local-auth.js';

export interface User {
  id: string;
  schoolId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

// Authentication middleware with JWT validation via Supabase
export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid authorization header' }, 401);
  }

  const token = authHeader.substring(7);
  const db = c.get('db');
  const jwtSecret = c.get('jwtSecret') || process.env.JWT_SECRET;
  const localAuth = db ? new LocalAuthService(db, jwtSecret) : null;

  // Development mode bypass
  if (process.env.NODE_ENV === 'development' && token === 'dev-token') {
    c.set('user', {
      id: 'dev-user-id',
      schoolId: 'dev-school-id',
      email: 'dev@example.com',
      firstName: 'Dev',
      lastName: 'User',
      role: 'super_admin'
    } as User);
    await next();
    return;
  }

  // Production: Validate JWT with Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (localAuth) {
      try {
        const payload = await localAuth.validateAccessToken(token);
        const localUser = payload.user;
        c.set('user', {
          id: localUser.id,
          schoolId: localUser.school_id,
          email: localUser.email,
          firstName: localUser.first_name,
          lastName: localUser.last_name,
          role: localUser.role,
        } as User);
        await next();
        return;
      } catch (error) {
        return c.json({ error: 'Unauthorized: Invalid token' }, 401);
      }
    }

    return c.json({ error: 'Server configuration error' }, 500);
  }

  try {
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Validate token and get user
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      if (localAuth) {
        try {
          const payload = await localAuth.validateAccessToken(token);
          const localUser = payload.user;
          c.set('user', {
            id: localUser.id,
            schoolId: localUser.school_id,
            email: localUser.email,
            firstName: localUser.first_name,
            lastName: localUser.last_name,
            role: localUser.role,
          } as User);
          await next();
          return;
        } catch (localError) {
          return c.json({ error: 'Unauthorized: Invalid token' }, 401);
        }
      }

      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    // Build User object from Supabase user metadata
    const metadata = (user.user_metadata as any) || {};
    const fallbackSchoolId = c.get('schoolId') || process.env.SCHOOL_ID || '';
    const appUser: User = {
      id: user.id,
      schoolId:
        metadata.schoolId ||
        metadata.school_id ||
        fallbackSchoolId ||
        '',
      email: user.email || '',
      firstName: metadata.firstName || metadata.name || '',
      lastName: metadata.lastName || '',
      role: metadata.role || 'user'
    };

    // Set user on context for RLS middleware
    c.set('user', appUser);

    await next();
  } catch (error: any) {
    console.error('Auth error:', error);
    return c.json({ error: 'Unauthorized: Token validation failed' }, 401);
  }
};

// Helper to get current user from context
export function getUser(c: Context): User | undefined {
  return c.get('user');
}

// Helper to check if user is admin
export function isAdmin(user: User | undefined): boolean {
  return user?.role === 'super_admin' || user?.role === 'admin';
}

// Helper to check if user is teacher
export function isTeacher(user: User | undefined): boolean {
  return user?.role === 'teacher';
}
