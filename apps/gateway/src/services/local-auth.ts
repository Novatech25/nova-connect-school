import { Database } from '../db/bun-sqlite.js';
import { randomUUID } from 'node:crypto';

interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  school_id: string;
  school_code?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  synced_to_cloud: boolean;
  cloud_user_id?: string;
}

interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  schoolCode: string;
  schoolId: string;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: Omit<User, 'password_hash'>;
}

export class LocalAuthService {
  private db: Database;
  private jwtSecret: string;

  constructor(db: Database, jwtSecret?: string) {
    this.db = db;
    // Use license key or default secret for JWT signing
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
  }

  /**
   * Hash password using SHA-256 (simple for development, use bcrypt in production)
   */
  private hashPassword(password: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Verify password
   */
  private verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  /**
   * Base64URL encode (for JWT)
   */
  private base64UrlEncode(data: string): string {
    return Buffer.from(data)
      .toString('base64')
      .replaceAll(/\+/g, '-')
      .replaceAll(/\//g, '_')
      .replaceAll(/=/g, '');
  }

  /**
   * Base64URL decode
   */
  private base64UrlDecode(data: string): string {
    // Add padding back
    const padded = data + '='.repeat((4 - data.length % 4) % 4);
    // Convert base64url to base64
    const base64 = padded.replaceAll('-', '+').replaceAll('_', '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  }

  /**
   * Generate JWT token
   */
  private async generateToken(payload: any, expiresIn: string): Promise<string> {
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.parseExpiration(expiresIn);

    const tokenPayload = {
      ...payload,
      iat: now,
      exp,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(tokenPayload));

    const data = `${encodedHeader}.${encodedPayload}`;

    const crypto = require('node:crypto');
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(data)
      .digest('base64')
      .replaceAll(/\+/g, '-')
      .replaceAll(/\//g, '_')
      .replaceAll(/=/g, '');

    return `${data}.${signature}`;
  }

  /**
   * Parse expiration time string to seconds
   */
  private parseExpiration(exp: string): number {
    const units: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    const match = exp.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid expiration format');
    }

    const value = Number.parseInt(match[1], 10);
    const unit = match[2];

    return value * units[unit];
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token: string): Promise<any> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verify signature
    const crypto = require('node:crypto');
    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(data)
      .digest('base64')
      .replaceAll(/\+/g, '-')
      .replaceAll(/\//g, '_')
      .replaceAll(/=/g, '');

    if (signature !== expectedSignature) {
      throw new Error('Invalid signature');
    }

    // Decode payload
    const payload = JSON.parse(this.base64UrlDecode(encodedPayload));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return payload;
  }

  /**
   * Generate JWT access token
   */
  private async generateAccessToken(user: User): Promise<string> {
    return this.generateToken(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        school_id: user.school_id,
        type: 'access',
      },
      '1h'
    );
  }

  /**
   * Generate JWT refresh token
   */
  private async generateRefreshToken(userId: string): Promise<string> {
    return this.generateToken(
      {
        sub: userId,
        type: 'refresh',
      },
      '7d'
    );
  }

  /**
   * Register a new user (offline mode)
   * Creates user in local DB and marks for sync
   */
  async registerLocal(data: CreateUserData): Promise<AuthTokens> {
    // Check if user already exists locally
    const existingUser = this.db.prepare(
      'SELECT id FROM local_users WHERE email = ?'
    ).get(data.email) as any;

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Validate school code exists locally
    const school = this.db.prepare(
      'SELECT id FROM schools WHERE code = ?'
    ).get(data.schoolCode) as any;

    if (!school) {
      throw new Error('Invalid school code');
    }

    // Create user with temporary UUID (will be replaced with cloud UUID on sync)
    const tempUserId = `local-${randomUUID()}`;
    const passwordHash = this.hashPassword(data.password);
    const now = new Date().toISOString();

    const user: User = {
      id: tempUserId,
      email: data.email,
      password_hash: passwordHash,
      first_name: data.firstName,
      last_name: data.lastName,
      role: data.role,
      school_id: school.id,
      school_code: data.schoolCode,
      is_active: true,
      created_at: now,
      updated_at: now,
      synced_to_cloud: false, // Mark for sync
    };

    // Insert user into local_users table
    this.db.prepare(`
      INSERT INTO local_users (
        id, email, password_hash, first_name, last_name,
        role, school_id, school_code, is_active,
        created_at, updated_at, synced_to_cloud
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.email,
      user.password_hash,
      user.first_name,
      user.last_name,
      user.role,
      user.school_id,
      user.school_code,
      user.is_active ? 1 : 0,
      user.created_at,
      user.updated_at,
      user.synced_to_cloud ? 1 : 0
    );

    // Log for sync
    this.logUserEvent('create', user.id, {
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      school_id: user.school_id,
      school_code: user.school_code,
    });

    // Generate tokens
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    // Store refresh token
    this.db.prepare(`
      INSERT INTO refresh_tokens (token, user_id, expires_at, created_at)
      VALUES (?, ?, datetime('now', '+7 days'), datetime('now'))
    `).run(refreshToken, user.id);

    // Return user without password
    const { password_hash: _, ...userWithoutPassword } = user;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: userWithoutPassword,
    };
  }

  /**
   * Login with email and password (offline mode)
   */
  async loginLocal(email: string, password: string): Promise<AuthTokens> {
    // Find user in local DB
    const user = this.db.prepare(
      'SELECT * FROM local_users WHERE email = ? AND is_active = 1'
    ).get(email) as User | undefined;

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    if (!this.verifyPassword(password, user.password_hash)) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    // Store refresh token
    this.db.prepare(`
      INSERT INTO refresh_tokens (token, user_id, expires_at, created_at)
      VALUES (?, ?, datetime('now', '+7 days'), datetime('now'))
    `).run(refreshToken, user.id);

    // Return user without password
    const { password_hash: _, ...userWithoutPassword } = user;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: userWithoutPassword,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ access_token: string }> {
    // Verify refresh token
    const payload = await this.verifyToken(refreshToken);

    if (payload.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    // Check if refresh token exists in DB
    const tokenRecord = this.db.prepare(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime("now")'
    ).get(refreshToken) as any;

    if (!tokenRecord) {
      throw new Error('Refresh token expired or invalid');
    }

    // Get user
    const user = this.db.prepare(
      'SELECT * FROM local_users WHERE id = ? AND is_active = 1'
    ).get(payload.sub) as User | undefined;

    if (!user) {
      throw new Error('User not found');
    }

    // Generate new access token
    const accessToken = await this.generateAccessToken(user);

    return { access_token: accessToken };
  }

  /**
   * Logout - invalidate refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    this.db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  }

  /**
   * Get user by ID
   */
  getUserById(userId: string): Omit<User, 'password_hash'> | null {
    const user = this.db.prepare(
      'SELECT * FROM local_users WHERE id = ?'
    ).get(userId) as User | undefined;

    if (!user) {
      return null;
    }

    const { password_hash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Log user creation/update for sync with cloud
   */
  private logUserEvent(eventType: 'create' | 'update', userId: string, userData: any): void {
    const eventData = {
      school_id: userData.school_id,
      event_type: eventType,
      table_name: 'users',
      record_id: userId,
      data: JSON.stringify(userData),
    };

    this.db.prepare(`
      INSERT INTO event_log (school_id, event_type, table_name, record_id, data, created_at, sync_status)
      VALUES (?, ?, ?, ?, ?, datetime('now'), 'pending')
    `).run(
      eventData.school_id,
      eventData.event_type,
      eventData.table_name,
      eventData.record_id,
      eventData.data
    );
  }

  /**
   * Get users pending sync
   */
  getUsersPendingSync(): User[] {
    const users = this.db.prepare(
      'SELECT * FROM local_users WHERE synced_to_cloud = 0'
    ).all() as User[];

    return users;
  }

  /**
   * Mark user as synced to cloud
   */
  markUserAsSynced(localUserId: string, cloudUserId: string): void {
    this.db.prepare(`
      UPDATE local_users
      SET synced_to_cloud = 1,
          cloud_user_id = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(cloudUserId, localUserId);
  }

  /**
   * Update user after cloud sync (update local ID to cloud ID)
   */
  updateUserAfterSync(localUserId: string, cloudUserId: string): void {
    // Update all references to local user ID in other tables
    const tablesToUpdate = [
      'attendance_records',
      'grades',
      'lesson_logs',
      'payments',
    ];

    for (const table of tablesToUpdate) {
      this.db.prepare(`
        UPDATE ${table} SET user_id = ? WHERE user_id = ?
      `).run(cloudUserId, localUserId);
    }

    // Update the user record itself
    this.db.prepare(`
      UPDATE local_users
      SET id = ?,
          synced_to_cloud = 1,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(cloudUserId, localUserId);
  }

  /**
   * Validate access token from request
   */
  async validateAccessToken(token: string): Promise<any> {
    try {
      const payload = await this.verifyToken(token);

      // Check if user still exists and is active
      const user = this.getUserById(payload.sub);

      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      return {
        ...payload,
        user,
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
}
