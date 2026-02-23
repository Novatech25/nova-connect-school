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

async function cleanupRoles() {
  console.log('🧹 Cleaning up user roles...');

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'faguimba@gmail.com')
    .single();

  if (!user) {
    console.error('❌ User not found');
    return;
  }
  const userId = user.id;

  // 1. Get all roles
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('*, roles(name)')
    .eq('user_id', userId);

  if (!userRoles) return;

  console.log('Found roles:', userRoles.map(ur => `${ur.roles.name} (${ur.school_id})`));

  // 2. Identify duplicates or incorrect roles
  // We want to KEEP 'school_admin' linked to the correct school
  // We probably want to REMOVE 'super_admin' if it's causing conflicts, or just deduplicate
  
  const targetSchoolId = '7ecfd6ce-1e22-40ac-9548-27613f1d43ce';

  for (const ur of userRoles) {
    const roleName = ur.roles.name;
    const isSchoolAdmin = roleName === 'school_admin';
    const isSuperAdmin = roleName === 'super_admin';

    // Delete super_admin roles (assuming we want to test school_admin behavior purely)
    // OR delete roles that have null school_id IF we are school_admin
    
    if (isSuperAdmin) {
      console.log(`🗑️ Removing super_admin role ${ur.id}...`);
      await supabase.from('user_roles').delete().eq('id', ur.id);
    }
    
    if (isSchoolAdmin && ur.school_id !== targetSchoolId) {
       console.log(`🗑️ Removing school_admin role for wrong school ${ur.id} (school: ${ur.school_id})...`);
       await supabase.from('user_roles').delete().eq('id', ur.id);
    }
  }
  
  console.log('✅ Cleanup done.');
}

cleanupRoles();
