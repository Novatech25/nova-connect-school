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

async function debugRLS() {
  console.log('🔍 Debugging RLS Context...');

  // 1. Get current user ID (faguimba@gmail.com)
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, school_id')
    .eq('email', 'faguimba@gmail.com')
    .single();

  if (userError || !users) {
    console.error('❌ User not found:', userError);
    return;
  }
  
  const userId = users.id;
  const userSchoolId = users.school_id;
  console.log(`👤 User: ${users.email} (${userId})`);
  console.log(`🏫 User School ID (in users table): ${userSchoolId}`);

  // 2. Check User Roles
  const { data: userRoles, error: urError } = await supabase
    .from('user_roles')
    .select('*, roles(name)')
    .eq('user_id', userId);

  if (urError) {
    console.error('❌ Error fetching user_roles:', urError);
  } else {
    console.log('🔑 User Roles:', JSON.stringify(userRoles, null, 2));
  }

  // 3. Simulate RLS checks manually
  const isSchoolAdmin = userRoles?.some(ur => ur.roles.name === 'school_admin');
  console.log(`👮 is_school_admin() check: ${isSchoolAdmin}`);

  // 4. Check get_current_user_school_id() logic
  // It selects school_id from users table.
  const calculatedSchoolId = userSchoolId;
  console.log(`🏫 get_current_user_school_id() result: ${calculatedSchoolId}`);

  // 5. Compare with target school ID from logs
  const targetSchoolId = '7ecfd6ce-1e22-40ac-9548-27613f1d43ce'; // From user logs
  console.log(`🎯 Target School ID (from logs): ${targetSchoolId}`);

  if (calculatedSchoolId !== targetSchoolId) {
    console.error(`❌ MISMATCH! The user is linked to school ${calculatedSchoolId} but trying to create for school ${targetSchoolId}`);
    
    // Auto-fix: Update user to the target school
    console.log('🔧 Fixing user school_id to match target...');
    const { error: fixError } = await supabase
      .from('users')
      .update({ school_id: targetSchoolId })
      .eq('id', userId);
      
    if (fixError) console.error('❌ Fix failed:', fixError);
    else console.log('✅ User school_id updated!');

    // Fix role too
    console.log('🔧 Fixing user_role school_id to match target...');
    const { error: fixRoleError } = await supabase
      .from('user_roles')
      .update({ school_id: targetSchoolId })
      .eq('user_id', userId);

    if (fixRoleError) console.error('❌ Fix role failed:', fixRoleError);
    else console.log('✅ User role school_id updated!');

  } else {
    console.log('✅ School IDs match. The problem might be elsewhere.');
  }
}

debugRLS();
