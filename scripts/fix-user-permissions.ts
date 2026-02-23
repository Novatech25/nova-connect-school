import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from web app
dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPermissions() {
  console.log('🔍 Starting permission diagnostic...');

  // 1. Get School Admin Role ID
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id, name')
    .eq('name', 'school_admin')
    .single();

  if (rolesError || !roles) {
    console.error('❌ Could not find "school_admin" role:', rolesError);
    return;
  }
  const schoolAdminRoleId = roles.id;
  console.log(`🔑 Role "school_admin" ID: ${schoolAdminRoleId}`);

  // 2. Get Default School
  const { data: schools } = await supabase.from('schools').select('id, name').limit(1);
  if (!schools?.length) {
    console.error('❌ No school found');
    return;
  }
  const defaultSchool = schools[0];
  console.log(`🏫 School: ${defaultSchool.name} (${defaultSchool.id})`);

  // 3. Get User (faguimba@gmail.com or all users)
  // For safety, let's target users who have the school_id set (from our previous fix)
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, school_id')
    .eq('school_id', defaultSchool.id);

  if (usersError || !users) {
    console.error('❌ Error fetching users:', usersError);
    return;
  }

  console.log(`👥 Checking ${users.length} users in this school...`);

  for (const user of users) {
    console.log(`\n👤 Checking user: ${user.email} (${user.id})`);

    // Check User Roles
    const { data: userRoles, error: urError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .eq('role_id', schoolAdminRoleId);

    if (urError) {
      console.error('  ❌ Error fetching user_roles:', urError);
      continue;
    }

    const hasCorrectRole = userRoles?.some(ur => ur.school_id === defaultSchool.id);

    if (hasCorrectRole) {
      console.log('  ✅ Permissions OK (School Admin role assigned with correct school_id)');
    } else {
      console.log('  ⚠️ Permissions INVALID. Fixing...');
      
      // If there's a role without school_id or with wrong school_id, delete it first to avoid duplicates if unique constraint exists
      // Or just insert the correct one.
      
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role_id: schoolAdminRoleId,
          school_id: defaultSchool.id
        });

      if (insertError) {
        console.error('  ❌ Failed to assign role:', insertError);
      } else {
        console.log('  ✅ Role assigned successfully!');
      }
    }
  }
}

fixPermissions();
