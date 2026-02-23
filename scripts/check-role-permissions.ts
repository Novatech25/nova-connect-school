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

async function checkAndFixRolePermissions() {
  console.log('🔍 Checking Role Permissions...');

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

  // 2. Define required permissions
  const requiredPermissions = [
    { resource: 'students', action: 'create' },
    { resource: 'students', action: 'read' },
    { resource: 'students', action: 'update' },
    { resource: 'students', action: 'delete' },
    { resource: 'enrollments', action: 'create' },
    { resource: 'enrollments', action: 'read' },
    { resource: 'enrollments', action: 'update' },
    { resource: 'enrollments', action: 'delete' },
    { resource: 'fee_schedules', action: 'create' }, // Important for fees
    { resource: 'fee_types', action: 'create' },     // Important for fee types
  ];

  for (const perm of requiredPermissions) {
    // 2a. Find permission ID
    let { data: permissionData, error: permError } = await supabase
      .from('permissions')
      .select('id')
      .eq('resource', perm.resource)
      .eq('action', perm.action)
      .single();

    if (permError && permError.code !== 'PGRST116') {
      console.error(`❌ Error checking permission ${perm.resource}:${perm.action}`, permError);
      continue;
    }

    // Create permission if it doesn't exist
    if (!permissionData) {
      console.log(`➕ Creating permission: ${perm.resource}:${perm.action}`);
      const { data: newPerm, error: createError } = await supabase
        .from('permissions')
        .insert(perm)
        .select('id')
        .single();
      
      if (createError) {
        console.error(`❌ Failed to create permission ${perm.resource}:${perm.action}`, createError);
        continue;
      }
      permissionData = newPerm;
    }

    if (!permissionData) continue;

    // 2b. Check if linked to role
    const { data: rolePerm, error: rpError } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('role_id', schoolAdminRoleId)
      .eq('permission_id', permissionData.id)
      .single();

    if (!rolePerm) {
      console.log(`🔗 Linking permission ${perm.resource}:${perm.action} to school_admin`);
      const { error: linkError } = await supabase
        .from('role_permissions')
        .insert({
          role_id: schoolAdminRoleId,
          permission_id: permissionData.id
        });
      
      if (linkError) {
        console.error(`❌ Failed to link permission:`, linkError);
      } else {
        console.log(`✅ Linked successfully!`);
      }
    } else {
      console.log(`✅ Permission ${perm.resource}:${perm.action} already linked.`);
    }
  }
}

checkAndFixRolePermissions();
