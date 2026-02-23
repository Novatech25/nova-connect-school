-- Local authentication tables for offline mode
-- These tables store users and auth tokens locally

-- Local users table (stores users created offline or synced from cloud)
CREATE TABLE IF NOT EXISTS local_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL,
  school_id TEXT NOT NULL,
  school_code TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_to_cloud INTEGER DEFAULT 0,
  cloud_user_id TEXT,
  FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_local_users_email ON local_users(email);
CREATE INDEX IF NOT EXISTS idx_local_users_school ON local_users(school_id);
CREATE INDEX IF NOT EXISTS idx_local_users_pending_sync ON local_users(synced_to_cloud);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES local_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
