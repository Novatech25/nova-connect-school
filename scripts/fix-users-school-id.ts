import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from web app
dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role to bypass RLS for reading

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFixUsers() {
  console.log('🔍 Checking users without school_id...');

  // 1. Find schools to assign
  const { data: schools, error: schoolsError } = await supabase
    .from('schools')
    .select('id, name')
    .limit(1);

  if (schoolsError) {
    console.error('❌ Error fetching schools:', schoolsError);
    return;
  }

  if (!schools || schools.length === 0) {
    console.error('❌ No schools found in database!');
    return;
  }

  const defaultSchool = schools[0];
  console.log(`🏫 Default school found: ${defaultSchool.name} (${defaultSchool.id})`);

  // 2. Find users without school_id
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, school_id')
    .is('school_id', null);

  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
    return;
  }

  console.log(`👥 Found ${users?.length || 0} users without school_id.`);

  if (users && users.length > 0) {
    for (const user of users) {
      console.log(`🔧 Fixing user: ${user.email} (${user.id})...`);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ school_id: defaultSchool.id })
        .eq('id', user.id);

      if (updateError) {
        console.error(`❌ Failed to update user ${user.email}:`, updateError);
      } else {
        console.log(`✅ User ${user.email} updated with school_id: ${defaultSchool.id}`);
      }
    }
  } else {
    console.log('✅ All users have a school_id.');
  }
}

checkAndFixUsers();
