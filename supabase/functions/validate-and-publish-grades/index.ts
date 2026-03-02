// Edge Function: Validate and Publish Grades
// Description: Validates and publishes grades with automatic notifications to students and parents

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

// Types for request/response
interface ValidatePublishGradesRequest {
  gradeIds: string[];
  action: 'approve' | 'publish';
  rejectionReason?: string;
}

interface ValidatePublishGradesResponse {
  success: boolean;
  grades?: any[];
  message?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Get user role from database
 */
async function getUserRole(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.role;
}

/**
 * Create notification for users
 */
async function createGradeNotifications(
  supabase: any,
  grades: any[],
  action: 'approve' | 'publish'
): Promise<void> {
  const notifications: any[] = [];

  for (const grade of grades) {
    // If publishing, create notifications for students and parents
    if (action === 'publish') {
      // Get parents of the student
      const { data: parents } = await supabase
        .from('student_parent_relations')
        .select('parent:users!parent_id(id, first_name, notification_preferences)')
        .eq('student_id', grade.student_id);

      // Notification for student
      notifications.push({
        user_id: grade.student_id,
        type: 'grade_published',
        title: `Nouvelle note disponible`,
        body: `Votre note de ${grade.title} en ${grade.subject.name} a été publiée : ${grade.score}/${grade.max_score}`,
        data: {
          gradeId: grade.id,
          subjectId: grade.subject_id,
          classId: grade.class_id,
        },
        read: false,
        created_at: new Date().toISOString(),
      });

      // Notifications for parents
      if (parents) {
        for (const parentRelation of parents) {
          const parent = parentRelation.parent;
          const studentName = `${grade.student.first_name} ${grade.student.last_name}`;

          notifications.push({
            user_id: parent.id,
            type: 'grade_published',
            title: `Nouvelle note pour ${studentName}`,
            body: `Note en ${grade.subject.name} : ${grade.score}/${grade.max_score}`,
            data: {
              gradeId: grade.id,
              studentId: grade.student_id,
              subjectId: grade.subject_id,
            },
            read: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Bulk insert notifications
  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    // 2. Verify user has permission (school_admin or supervisor)
    const userRole = await getUserRole(supabase, user.id);

    if (!userRole || !['school_admin', 'supervisor'].includes(userRole)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Unauthorized. Only school admins and supervisors can perform this action.',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Parse request body
    const { gradeIds, action, rejectionReason }: ValidatePublishGradesRequest =
      await req.json();

    if (!gradeIds || !Array.isArray(gradeIds) || gradeIds.length === 0) {
      throw new Error('Invalid request: gradeIds must be a non-empty array');
    }

    if (!['approve', 'publish'].includes(action)) {
      throw new Error('Invalid action: must be "approve" or "publish"');
    }

    // 4. Fetch grades with full details
    const { data: grades, error: gradesError } = await supabase
      .from('grades')
      .select(
        `
        *,
        student:students(id, first_name, last_name),
        subject:subjects(id, name)
        `
      )
      .in('id', gradeIds);

    if (gradesError) {
      throw gradesError;
    }

    if (!grades || grades.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No grades found with the provided IDs',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 5. Update grades based on action
    let updateData: any = {};

    if (action === 'approve') {
      updateData = {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      };
    } else if (action === 'publish') {
      updateData = {
        status: 'published',
        published_at: new Date().toISOString(),
      };
    }

    const { data: updatedGrades, error: updateError } = await supabase
      .from('grades')
      .update(updateData)
      .in('id', gradeIds)
      .select(`
        *,
        student:students(id, first_name, last_name),
        subject:subjects(id, name)
      `);

    if (updateError) {
      throw updateError;
    }

    // 6. Create notifications if publishing
    if (action === 'publish') {
      await createGradeNotifications(supabase, updatedGrades, action);
    }

    // 7. Return success response
    const response: ValidatePublishGradesResponse = {
      success: true,
      grades: updatedGrades,
      message: `Successfully ${action === 'approve' ? 'approved' : 'published'} ${updatedGrades.length} grade(s)`,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in validate-and-publish-grades:', error);

    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'An unexpected error occurred',
      }),
      {
        status: error.message.includes('Unauthorized') ? 403 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
