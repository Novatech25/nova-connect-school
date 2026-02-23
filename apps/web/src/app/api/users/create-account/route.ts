import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createServerClient } from "@novaconnect/data/client/server";
import { createUserAccountSchema } from "@novaconnect/core/schemas";

export async function POST(req: NextRequest) {
  try {
    // 1. Get and validate body with Zod
    const body = await req.json();

    const validationResult = createUserAccountSchema.safeParse(body);

    if (!validationResult.success) {
      console.error('❌ Validation error:', validationResult.error.format());
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { accessToken, email, password, firstName, lastName, role, schoolId, linkedStudentId, linkedParentId } = validationResult.data;

    // 2. Verify the token and get the calling admin user
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      console.error('❌ Unauthorized: Invalid token', authError);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // 3. Check if user has admin or accountant role from user_metadata
    const userRole = user.user_metadata?.role;
    console.log('🔑 User role from metadata:', userRole);

    if (userRole !== 'school_admin' && userRole !== 'accountant') {
      console.error('❌ Permission denied for user:', user.id, 'Role:', userRole);
      return NextResponse.json(
        {
          error: 'Forbidden: Insufficient permissions',
          details: { userId: user.id, userRole }
        },
        { status: 403 }
      );
    }

    console.log('✅ User authorized as', userRole);

    // 4. Create service client with admin privileges
    const adminSupabase = createServiceClient();

    // 5. Fetch school data
    const { data: schoolData, error: schoolError } = await adminSupabase
      .from('schools')
      .select('id, code')
      .eq('id', schoolId)
      .single();

    if (schoolError || !schoolData) {
      console.error('❌ School not found:', schoolError);
      return NextResponse.json(
        { error: 'École introuvable.' },
        { status: 400 }
      );
    }

    console.log('🔐 Creating user account:', { email, firstName, lastName, role, schoolId, schoolCode: schoolData.code });

    // 6. Pre-check: does a user with this email already exist?
    const { data: preCheckUser } = await adminSupabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    let authUser: { id: string; email?: string | null } | null = null;
    let isExistingUser = false;
    let userRecord: any = null;

    if (preCheckUser) {
      // User already exists in public.users — reuse
      console.log('⚠️ User already exists in public.users:', preCheckUser.id);
      authUser = { id: preCheckUser.id, email: preCheckUser.email };
      isExistingUser = true;

      // Fetch the full user record
      const { data: existingRecord } = await adminSupabase
        .from('users')
        .select('*')
        .eq('id', preCheckUser.id)
        .single();
      userRecord = existingRecord;

    } else {
      // 7. Create auth user with MINIMAL metadata to avoid trigger issues
      // We pass school_code and role for the trigger, but if it fails,
      // we handle the fallback manually.
      console.log('🔄 Calling admin.createUser...');
      let authData, createAuthError;
      try {
        const result = await adminSupabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            role: role,
            school_code: schoolData.code,
          },
        });
        authData = result.data;
        createAuthError = result.error;
      } catch (err: any) {
        console.error('❌ Exception in admin.createUser:', err);
        createAuthError = err;
      }

      if (createAuthError) {
        console.warn('⚠️ admin.createUser failed:', createAuthError.message);

        // The trigger may have failed but the auth user might have been created.
        // Or the user already exists in auth but not in public.users.
        // Try to create the auth user WITHOUT the trigger-triggering metadata.
        console.log('🔄 Retrying createUser without school_code metadata (to bypass trigger)...');

        const { data: retryAuthData, error: retryError } = await adminSupabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
          },
        });

        if (retryError) {
          // Check if user truly exists in auth
          const errMsg = retryError.message || '';
          if (errMsg.includes('User already registered')) {
            // User is in auth but not in public.users — lookup by email via auth admin
            console.log('⚠️ User exists in auth. Looking up...');

            // Use listUsers with page size 1 to find the user
            const { data: listData } = await adminSupabase.auth.admin.listUsers({
              page: 1,
              perPage: 1000,
            });

            const foundAuthUser = listData?.users?.find(u => u.email === email);
            if (foundAuthUser) {
              authUser = { id: foundAuthUser.id, email: foundAuthUser.email };
            } else {
              return NextResponse.json(
                { error: 'Un compte auth existe avec cet email mais est introuvable. Contactez le support.' },
                { status: 409 }
              );
            }
          } else {
            console.error('❌ Auth user creation failed (retry):', retryError);
            return NextResponse.json(
              { error: `Erreur lors de la création du compte auth: ${retryError.message}` },
              { status: 500 }
            );
          }
        } else {
          authUser = retryAuthData?.user || null;
        }
      } else {
        authUser = authData?.user || null;
      }

      if (!authUser) {
        return NextResponse.json(
          { error: 'Impossible de créer ou récupérer l\'utilisateur.' },
          { status: 500 }
        );
      }

      // 8. Ensure public.users record exists (trigger may or may not have created it)
      const { data: existingUserRecord } = await adminSupabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (existingUserRecord) {
        userRecord = existingUserRecord;
        console.log('✅ User record already exists (from trigger):', userRecord.id);
      } else {
        // Trigger didn't create the record — create it manually
        console.log('🔧 Creating public.users record manually...');
        const { data: newUserRecord, error: insertUserError } = await adminSupabase
          .from('users')
          .insert({
            id: authUser.id,
            email: email,
            first_name: firstName,
            last_name: lastName,
            school_id: schoolId,
            is_active: true,
          })
          .select()
          .single();

        if (insertUserError) {
          console.error('❌ Failed to create user record:', insertUserError);
          return NextResponse.json(
            { error: `Erreur lors de la création du profil: ${insertUserError.message} (Code: ${insertUserError.code})` },
            { status: 500 }
          );
        }

        userRecord = newUserRecord;
        console.log('✅ User record created manually:', userRecord.id);

        // 9. Assign role manually since trigger didn't do it
        const { data: roleData } = await adminSupabase
          .from('roles')
          .select('id')
          .eq('name', role)
          .single();

        if (roleData) {
          const { error: roleAssignError } = await adminSupabase
            .from('user_roles')
            .insert({
              user_id: authUser.id,
              role_id: roleData.id,
              school_id: schoolId,
              assigned_by: user.id || null, // Ensure not undefined
            });

          if (roleAssignError) {
            console.warn('⚠️ Failed to assign role:', roleAssignError.message);
          } else {
            console.log('✅ Role assigned manually');
          }
        }
      }

      // 10. Ensure user_roles exists even if trigger created the user
      const { data: existingRole } = await adminSupabase
        .from('user_roles')
        .select('id')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (!existingRole) {
        const { data: roleData } = await adminSupabase
          .from('roles')
          .select('id')
          .eq('name', role)
          .single();

        if (roleData) {
          await adminSupabase.from('user_roles').insert({
            user_id: authUser.id,
            role_id: roleData.id,
            school_id: schoolId,
            assigned_by: user.id || null, // Ensure not undefined
          });
          console.log('✅ Role assigned (post-check)');
        }
      }
    }

    console.log('✅ Target Auth User:', authUser!.id, isExistingUser ? '(Existing)' : '(New)');

    // 11. Link to student or parent record
    if (role === 'student' && linkedStudentId) {
      const { error: studentUpdateError } = await adminSupabase
        .from('students')
        .update({ user_id: authUser!.id })
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
        .update({ user_id: authUser!.id })
        .eq('id', linkedParentId);

      if (parentUpdateError) {
        console.error('⚠️ Parent update failed:', parentUpdateError);
      } else {
        console.log('✅ Parent linked to user account');
      }
    }

    // 12. Create audit log (non-blocking)
    try {
      await adminSupabase.from('audit_logs').insert({
        user_id: user.id,
        school_id: schoolId,
        action: 'INSERT',
        entity_type: 'users',
        entity_id: authUser!.id,
        table_name: 'users',
        description: `Created user ${email} via admin API`,
        // Store detailed data in description or structured logging if allowed,
        // but the new schema seems to have limited columns.
        // If metadata is supported (check schema), adding it would be good.
        // The migration 20260214 removed metadata column? 
        // Let's check schema again. Yes, no metadata column in 20260214000003.
        // Wait, migration 20260217 adds handle_new_user and audit_trigger_function
        // which rely on audit_logs having specific columns.
        // My fix for trigger reused the table structure from 20260214.
      });
    } catch (auditError: any) {
      console.warn('⚠️ Failed to create audit log:', auditError?.message);
    }

    console.log('✅ User account creation completed successfully');

    return NextResponse.json({
      user: authUser,
      userRecord: userRecord,
      email: email,
      password: isExistingUser ? undefined : password,
      isExistingUser,
      message: isExistingUser ? 'Compte existant lié avec succès.' : 'Compte créé avec succès.'
    });

  } catch (error: any) {
    console.error('Error in create-user-account API route:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
