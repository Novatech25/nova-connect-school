import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from web app
dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';

async function applyDebugFunc() {
  console.log('🔌 Connecting to database...');
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connected!');

    const sql = `
      -- Create a debug function to inspect RLS context from the client perspective
      CREATE OR REPLACE FUNCTION debug_rls_context()
      RETURNS JSONB AS $$
      DECLARE
        current_user_id UUID;
        user_school_id UUID;
        is_admin BOOLEAN;
        jwt_claims JSONB;
      BEGIN
        current_user_id := auth.uid();
        user_school_id := get_current_user_school_id();
        is_admin := is_school_admin();
        jwt_claims := auth.jwt();
        
        RETURN jsonb_build_object(
          'auth_uid', current_user_id,
          'get_current_user_school_id', user_school_id,
          'is_school_admin', is_admin,
          'jwt_claims', jwt_claims,
          'user_role_check', (
            SELECT jsonb_agg(jsonb_build_object('role_id', ur.role_id, 'school_id', ur.school_id, 'role_name', r.name))
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid()
          )
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    console.log('🚀 Applying debug function...');
    await client.query(sql);
    console.log('✅ Function created successfully!');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.end();
  }
}

applyDebugFunc();
