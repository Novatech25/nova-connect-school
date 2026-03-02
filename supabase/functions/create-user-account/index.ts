import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the user token from headers
    const authHeader = req.headers.get('Authorization');
    const userToken = req.headers.get('x-user-token') || authHeader?.replace('Bearer ', '');

    if (!userToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token to verify their role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      },
    });

    // Get the current user
    const { data: { user }, error: authCheckError } = await userSupabase.auth.getUser();

    if (authCheckError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is a school_admin or accountant
    const { data: userRoles, error: rolesFetchError } = await userSupabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id);

    console.log('📋 User roles:', { userId: user.id, userRoles, rolesFetchError });

    if (rolesFetchError) {
      console.error('Error fetching user roles:', rolesFetchError);
    }

    // Get role IDs for school_admin and accountant
    const { data: roles } = await userSupabase
      .from('roles')
      .select('id, name')
      .in('name', ['school_admin', 'accountant']);

    console.log('🎭 Available admin roles:', roles);

    const adminRoleIds = roles?.map(r => r.id) || [];

    // Check if user has admin or accountant role
    const hasAdminRole = userRoles?.some(ur => adminRoleIds.includes(ur.role_id));

    console.log('🔒 Permission check:', { userRoleIds: userRoles?.map(ur => ur.role_id), adminRoleIds, hasAdminRole });

    if (!hasAdminRole) {
      console.error('❌ Permission denied for user:', user.id);
      return new Response(
        JSON.stringify({
          error: 'Forbidden: Insufficient permissions',
          details: {
            userId: user.id,
            userRoles: userRoles?.map(ur => ur.role_id),
            adminRoleIds,
            hasAdminRole
          }
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User has admin privileges');

    // Also check user metadata for role (fallback)
    const userRole = user.user_metadata?.role;
    console.log('🔑 User role from metadata:', userRole);

    const hasRoleFromMetadata = userRole === 'school_admin' || userRole === 'accountant';

    if (!hasAdminRole && !hasRoleFromMetadata) {
      console.error('❌ Permission denied for user:', user.id, 'User does not have admin role in either user_roles or user_metadata');
      return new Response(
        JSON.stringify({
          error: 'Forbidden: Insufficient permissions',
          details: {
            userId: user.id,
            userRoleIds: userRoles?.map(ur => ur.role_id),
            adminRoleIds,
            hasAdminRole,
            userMetadataRole: userRole,
            hasRoleFromMetadata
          }
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authorized via', hasAdminRole ? 'user_roles table' : 'user_metadata');

    // Parse request body
    const { email, password, firstName, lastName, role, schoolId, linkedStudentId, linkedParentId } = await req.json();

    // Validate input
    if (!email || !password || !firstName || !lastName || !role || !schoolId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client with service role key
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('🔐 Creating user account:', { email, firstName, lastName, role, schoolId });

    // 1. Create auth user using admin API
    const { data: authData, error: createAuthError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: role,
        linked_student_id: linkedStudentId,
        linked_parent_id: linkedParentId,
      },
    });

    if (createAuthError) {
      console.error('❌ Auth user creation failed:', createAuthError);

      if (createAuthError.message.includes('User already registered')) {
        return new Response(
          JSON.stringify({ error: 'Un compte avec cet email existe déjà.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Erreur lors de la création du compte: ${createAuthError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Auth user created:', authData.user.id);

    // 2. Get role ID
    const { data: roleData, error: roleFetchError } = await adminSupabase
      .from('roles')
      .select('id')
      .eq('name', role)
      .single();

    if (roleFetchError || !roleData) {
      // Clean up auth user
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: `Role not found: ${role}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Role found:', roleData.id);

    // 3. Create user record in public.users table
    const { data: userRecord, error: userRecordError } = await adminSupabase
      .from('users')
      .insert({
        id: authData.user.id,
        school_id: schoolId,
        email: email,
        first_name: firstName,
        last_name: lastName,
        is_active: true,
      })
      .select()
      .single();

    if (userRecordError) {
      console.error('❌ User record creation failed:', userRecordError);

      // Clean up auth user
      await adminSupabase.auth.admin.deleteUser(authData.user.id);

      return new Response(
        JSON.stringify({
          error: `Erreur lors de la création de l'enregistrement utilisateur: ${userRecordError.message}`,
          code: userRecordError.code
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User record created:', userRecord);

    // 4. Assign role in user_roles table
    const { error: roleAssignError } = await adminSupabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role_id: roleData.id,
        school_id: schoolId,
        assigned_by: user.id,
      });

    if (roleAssignError) {
      console.error('⚠️ Role assignment failed:', roleAssignError);
      // Don't fail - user is created but role assignment failed
    } else {
      console.log('✅ Role assigned successfully');
    }

    // 5. Link to student or parent record
    if (role === 'student' && linkedStudentId) {
      const { error: studentUpdateError } = await adminSupabase
        .from('students')
        .update({ user_id: authData.user.id })
        .eq('id', linkedStudentId);

      if (studentUpdateError) {
        console.error('⚠️ Student update failed:', studentUpdateError);
      } else {
        console.log('✅ Student linked to user account');
      }
    }

    if (role === 'parent' && linkedParentId) {
      const { error: parentUpdateError } = await adminSupabase
        .from('parents')
        .update({ user_id: authData.user.id })
        .eq('id', linkedParentId);

      if (parentUpdateError) {
        console.error('⚠️ Parent update failed:', parentUpdateError);
      } else {
        console.log('✅ Parent linked to user account');
      }
    }

    return new Response(
      JSON.stringify({
        user: authData.user,
        userRecord: userRecord,
        email: email,
        password: password, // Return password only once for display
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-user-account function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
