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

async function alignSchoolAdmin() {
  const targetSchoolId = '7ecfd6ce-1e22-40ac-9548-27613f1d43ce'; // The one from logs
  console.log(`🎯 Aligning School Admin role to: ${targetSchoolId}`);

  // 1. Get User
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'faguimba@gmail.com')
    .single();

  if (userError || !user) {
    console.error('❌ User not found');
    return;
  }
  const userId = user.id;

  // 2. Get School Admin Role ID
  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'school_admin')
    .single();

  if (!role) {
    console.error('❌ Role school_admin not found');
    return;
  }
  const roleId = role.id;

  // 3. Update or Insert
  console.log('🔧 Updating/Inserting user_role...');
  
  // First, try to find existing record
  const { data: existing } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role_id', roleId)
    .single();

  if (existing) {
    // Update
    const { error: updateError } = await supabase
      .from('user_roles')
      .update({ school_id: targetSchoolId })
      .eq('id', existing.id);
      
    if (updateError) console.error('❌ Update failed:', updateError);
    else console.log('✅ Role updated successfully!');
  } else {
    // Insert
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: roleId,
        school_id: targetSchoolId
      });

    if (insertError) console.error('❌ Insert failed:', insertError);
    else console.log('✅ Role inserted successfully!');
  }
}

alignSchoolAdmin();
