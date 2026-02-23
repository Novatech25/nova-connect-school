import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@novaconnect/data/client/server'
import { createCompleteParent } from '@novaconnect/data/services/createParentRecord'

/**
 * API Route: Create Complete Parent (PERMANENT FIX VERSION)
 *
 * POST /api/parents/create-complete-v2
 *
 * Body: {
 *   email: string;
 *   password: string;
 *   firstName: string;
 *   lastName: string;
 *   schoolId: string;
 *   studentId: string;
 *   relationship: string;
 *   phone?: string;
 *   address?: string;
 *   city?: string;
 *   occupation?: string;
 *   workplace?: string;
 *   isPrimaryContact?: boolean;
 *   isEmergencyContact?: boolean;
 * }
 *
 * Crée un compte parent complet avec:
 * - Auth user (avec role dans user_metadata ET app_metadata)
 * - User record
 * - Parent record
 * - Parent-student relation
 * - User role assignment
 *
 * Cette version utilise les fonctions utilitaires garantissant
 * que toutes les métadonnées sont correctes.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      email,
      password,
      firstName,
      lastName,
      schoolId,
      studentId,
      relationship,
      phone,
      address,
      city,
      occupation,
      workplace,
      isPrimaryContact,
      isEmergencyContact,
    } = body

    // Validation
    if (!email || !password || !firstName || !lastName || !schoolId || !studentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log('[API] Creating complete parent:', {
      email,
      firstName,
      lastName,
      schoolId,
      studentId,
    })

    const adminSupabase = createServiceClient()

    // Vérifier que le parent n'existe pas déjà
    const { data: existingParent } = await adminSupabase
      .from('parents')
      .select('id')
      .eq('email', email)
      .eq('school_id', schoolId)
      .maybeSingle()

    if (existingParent) {
      return NextResponse.json(
        { error: 'Parent with this email already exists in this school' },
        { status: 409 }
      )
    }

    // Obtenir le code de l'école pour user_metadata
    const { data: school } = await adminSupabase
      .from('schools')
      .select('code')
      .eq('id', schoolId)
      .single()

    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 })
    }

    // Créer le compte parent complet avec métadonnées garanties
    const { success, data, error, details } = await createCompleteParent(
      adminSupabase,
      {
        email,
        password,
        firstName,
        lastName,
        schoolId,
        schoolCode: school.code,
      },
      {
        phone,
        address,
        city,
        occupation,
        workplace,
        relationship,
        isPrimaryContact,
        isEmergencyContact,
      },
      {
        isPrimary: isPrimaryContact,
        canPickup: true,
        canViewGrades: true,
        canViewAttendance: true,
      }
    )

    if (!success || error) {
      console.error('[API] Failed to create complete parent:', error)
      return NextResponse.json(
        { error: error || 'Failed to create parent account', details },
        { status: 500 }
      )
    }

    // Créer la relation parent-élève
    const { error: relationError } = await adminSupabase.from('student_parent_relations').insert({
      school_id: schoolId,
      student_id: studentId,
      parent_id: data.parentId,
      relationship,
      is_primary: isPrimaryContact || false,
      can_pickup: true,
      can_view_grades: true,
      can_view_attendance: true,
    })

    if (relationError) {
      console.error('[API] Failed to create parent-student relation:', relationError)
      // Cleanup: supprimer le parent et l'auth user
      await adminSupabase.from('parents').delete().eq('id', data.parentId)
      // L'auth user sera supprimé par le trigger ou manuellement
      return NextResponse.json(
        { error: 'Failed to create parent-student relation', details: relationError },
        { status: 500 }
      )
    }

    console.log('[API] Parent-student relation created')

    return NextResponse.json({
      success: true,
      message: 'Parent account created successfully',
      data: {
        userId: data.userId,
        parentId: data.parentId,
        studentId,
        email,
      },
    })
  } catch (error: any) {
    console.error('[API] Exception creating complete parent:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error', 
        details: error.stack 
      },
      { status: 500 }
    )
  }
}
