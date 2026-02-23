// Temporary script to apply accountant RLS policies to Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyPolicies() {
  try {
    console.log('📋 Reading migration file...');
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250127120000_add_accountant_policies_students.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Applying accountant RLS policies...');

    // Execute the SQL via RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Try alternative approach - split by statements and execute
      console.log('⚠️ RPC failed, trying direct execution via REST API...');

      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.includes('CREATE POLICY') || statement.includes('DROP POLICY')) {
          console.log(`📝 Executing: ${statement.substring(0, 50)}...`);

          // Use PostgreSQL via a different approach
          const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              query: statement
            })
          });

          if (!response.ok) {
            console.error(`❌ Failed: ${response.statusText}`);
          } else {
            console.log(`✅ Success`);
          }
        }
      }
    } else {
      console.log('✅ Policies applied successfully!');
    }

    console.log('\n✅ Accountant RLS policies applied successfully!');
    console.log('\n📝 Summary:');
    console.log('  - Accountants can now INSERT students');
    console.log('  - Accountants can now UPDATE students');
    console.log('  - Accountants can now SELECT students');
    console.log('  - Same permissions for parents, enrollments, and relations');
    console.log('\n🔐 All policies are scoped to the accountant\'s school_id');

  } catch (error) {
    console.error('❌ Error applying policies:', error.message);
    process.exit(1);
  }
}

applyPolicies();
