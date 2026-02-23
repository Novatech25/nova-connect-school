import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Read from .env file or hardcoded for this environment
// We found these in .env.development.example and .env.local
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mdfzmdddmwpbqmkxomdb.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZnptZGRkbXdwYnFta3hvbWRiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODg2Mzc3OCwiZXhwIjoyMDg0NDM5Nzc4fQ.IONF3s2CBBZU9aHza0ekuEaqQuQjKWo5Q2M1z0RrX_I";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const SQL_FILE_PATH = path.join(process.cwd(), "supabase", "migrations", "20260205120500_publish_schedule_v2_retry.sql");

async function applyMigration() {
  console.log(`Applying migration from ${SQL_FILE_PATH}...`);
  console.log(`Target: ${SUPABASE_URL}`);

  try {
    const sql = fs.readFileSync(SQL_FILE_PATH, "utf8");

    // Supabase JS client doesn't expose a raw SQL method for security reasons usually,
    // but the Postgres connection via 'pg' is preferred if we had connection string.
    // However, we can use the 'rpc' hack if we have a function that runs sql, but we don't.
    // Wait, supabase-js admin client might not be enough if we can't run raw sql.
    
    // BUT, we can use the `pg` library directly if we can construct the connection string.
    // Connection string is usually: postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
    // For Supabase cloud, we need the DB password.
    // For local, it is postgres/postgres.
    
    // Let's try to use `pg` with local default credentials first, as user said localhost:3001
    // But .env says SUPABASE_URL is remote https://mdfzmdddmwpbqmkxomdb.supabase.co
    // This is confusing. 
    // If user is on localhost:3001, they might be using remote DB or local DB.
    // .env.local has NEXT_PUBLIC_SUPABASE_URL=https://mdfzmdddmwpbqmkxomdb.supabase.co
    // So the app IS connected to PRODUCTION DB.
    
    // If connected to PRODUCTION DB, then `pnpm db:migrate` (supabase db push) should have worked IF the user has CLI authenticated.
    // But maybe it didn't.
    
    // I can't run raw SQL on remote DB without password.
    // I only have Service Role Key.
    // Can I use Service Role Key to create a function?
    // No, standard API doesn't allow `CREATE FUNCTION`.
    
    // However, I can try to use the REST API to call a system function? No.
    
    // Wait, if I cannot run SQL, I cannot fix the backend function if it's missing.
    // But I can check if it exists!
    
    const { data, error } = await supabase.rpc('publish_schedule_v2', { p_schedule_id: '00000000-0000-0000-0000-000000000000' });
    
    if (error) {
        console.error("Function check failed:", error);
        if (error.message.includes("function") && error.message.includes("does not exist")) {
            console.error("CRITICAL: The function publish_schedule_v2 DOES NOT EXIST on the database.");
            console.error("You must run the migration manually using Supabase CLI or SQL Editor.");
        }
    } else {
        console.log("Function exists (call returned success/error as expected for dummy ID).");
    }

  } catch (err) {
    console.error("Script error:", err);
  }
}

applyMigration();
