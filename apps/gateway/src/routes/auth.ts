import { Hono } from 'hono';
import { z } from 'zod';
import { LocalAuthService } from '../services/local-auth.js';
import { getSchoolId } from '../helpers/context.js';

const auth = new Hono();

// Helper to get LocalAuthService from context
const getLocalAuthService = (c: any) => {
  const db = c.get('db');
  const jwtSecret = c.get('jwtSecret') || process.env.JWT_SECRET;
  return new LocalAuthService(db, jwtSecret);
};

/**
 * POST /api/auth/register
 * Register a new user (offline mode)
 */
auth.post('/register', async (c) => {
  try {
    const db = c.get('db');
    const authService = getLocalAuthService(c);

    const body = await c.req.json();

    // Validate request body
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      role: z.enum(['student', 'parent', 'teacher', 'school_admin', 'accountant', 'supervisor', 'super_admin']),
      schoolCode: z.string().min(1),
    });

    const data = schema.parse(body);

    // Get school_id from school_code
    console.log('🔍 Looking for school with code:', data.schoolCode);

    const school = db.prepare(
      'SELECT id FROM schools WHERE code = ?'
    ).get(data.schoolCode) as any;

    console.log('🔍 School found:', school);

    if (!school) {
      // List all schools for debugging
      const allSchools = db.prepare('SELECT code, id FROM schools').all();
      console.log('❌ School not found. Available schools:', allSchools);
      return c.json({ error: 'Invalid school code' }, 400);
    }

    // Register user
    const result = await authService.registerLocal({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      schoolCode: data.schoolCode,
      schoolId: school.id,
    });

    return c.json({
      user: result.user,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      message: 'User registered successfully (offline mode)',
    });
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return c.json({ error: 'User already exists' }, 409);
    }
    if (error.message.includes('Invalid school code')) {
      return c.json({ error: 'Invalid school code' }, 400);
    }
    console.error('Register error:', error);
    return c.json({ error: error.message || 'Registration failed' }, 500);
  }
});

/**
 * POST /api/auth/login
 * Login with email and password (offline mode)
 */
auth.post('/login', async (c) => {
  try {
    const authService = getLocalAuthService(c);

    const body = await c.req.json();

    // Validate request body
    const schema = z.object({
      email: z.string().email(),
      password: z.string(),
    });

    const data = schema.parse(body);

    // Login user
    const result = await authService.loginLocal(data.email, data.password);

    return c.json({
      user: result.user,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      message: 'Login successful (offline mode)',
    });
  } catch (error: any) {
    if (error.message.includes('Invalid credentials')) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }
    console.error('Login error:', error);
    return c.json({ error: error.message || 'Login failed' }, 500);
  }
});

/**
 * POST /api/auth/logout
 * Logout user (invalidate refresh token)
 */
auth.post('/logout', async (c) => {
  try {
    const authService = getLocalAuthService(c);
    const body = await c.req.json();

    const schema = z.object({
      refresh_token: z.string(),
    });

    const { refresh_token } = schema.parse(body);

    await authService.logout(refresh_token);

    return c.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    return c.json({ error: 'Logout failed' }, 500);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
auth.post('/refresh', async (c) => {
  try {
    const authService = getLocalAuthService(c);
    const body = await c.req.json();

    const schema = z.object({
      refresh_token: z.string(),
    });

    const { refresh_token } = schema.parse(body);

    const result = await authService.refreshAccessToken(refresh_token);

    return c.json(result);
  } catch (error: any) {
    if (error.message.includes('expired') || error.message.includes('invalid')) {
      return c.json({ error: 'Invalid or expired refresh token' }, 401);
    }
    console.error('Refresh error:', error);
    return c.json({ error: 'Token refresh failed' }, 500);
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires valid access token)
 */
auth.get('/me', async (c) => {
  try {
    const authService = getLocalAuthService(c);

    // Get token from Authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'No token provided' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = await authService.validateAccessToken(token);

    return c.json({
      user: payload.user,
      school_id: payload.school_id,
      role: payload.role,
    });
  } catch (error: any) {
    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }
    console.error('Get user error:', error);
    return c.json({ error: 'Failed to get user info' }, 500);
  }
});

/**
 * GET /api/auth/status
 * Check authentication status (without requiring valid token)
 */
auth.get('/status', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        authenticated: false,
        mode: 'offline',
      });
    }

    const authService = getLocalAuthService(c);
    const token = authHeader.substring(7);
    const payload = await authService.validateAccessToken(token);

    return c.json({
      authenticated: true,
      mode: 'offline',
      user: payload.user,
    });
  } catch (error) {
    return c.json({
      authenticated: false,
      mode: 'offline',
    });
  }
});

export default auth;
