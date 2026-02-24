/**
 * API Route: Test des Notifications de Présence
 * 
 * Cette route permet de tester manuellement le système de notifications
 * de présence en créant un enregistrement de test.
 * 
 * Usage: POST /api/test/attendance-notification
 * Body: { studentId: string, status: 'absent' | 'late', sessionId: string }
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    
    // Vérifier l'authentification
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }
    
    // Vérifier les rôles (admin ou professeur)
    const userRole = session.user.user_metadata?.role
    const allowedRoles = ['super_admin', 'school_admin', 'teacher']
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: 'Permission refusée' },
        { status: 403 }
      )
    }
    
    // Parser le body
    const body = await request.json()
    const { studentId, status, sessionId } = body
    
    // Validation
    if (!studentId || !status || !sessionId) {
      return NextResponse.json(
        { error: 'Paramètres manquants: studentId, status, sessionId requis' },
        { status: 400 }
      )
    }
    
    if (!['absent', 'late'].includes(status)) {
      return NextResponse.json(
        { error: 'Status invalide: absent ou late attendu' },
        { status: 400 }
      )
    }
    
    // Récupérer les informations de l'élève
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, school_id')
      .eq('id', studentId)
      .single()
    
    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Élève non trouvé', details: studentError },
        { status: 404 }
      )
    }
    
    // Vérifier que l'élève a des parents
    const { data: parents, error: parentsError } = await supabase
      .from('student_parent_relations')
      .select('parent_id')
      .eq('student_id', studentId)
    
    if (parentsError) {
      return NextResponse.json(
        { error: 'Erreur lors de la recherche des parents', details: parentsError },
        { status: 500 }
      )
    }
    
    // Vérifier que la session existe
    const { data: attendanceSession, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('id, school_id')
      .eq('id', sessionId)
      .single()
    
    if (sessionError || !attendanceSession) {
      return NextResponse.json(
        { error: 'Session de présence non trouvée', details: sessionError },
        { status: 404 }
      )
    }
    
    // Créer l'enregistrement de présence
    const { data: record, error: insertError } = await supabase
      .from('attendance_records')
      .insert({
        attendance_session_id: sessionId,
        school_id: attendanceSession.school_id,
        student_id: studentId,
        status: status,
        source: 'teacher_manual',
        marked_by: session.user.id,
        marked_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (insertError) {
      return NextResponse.json(
        { error: 'Erreur lors de la création du record', details: insertError },
        { status: 500 }
      )
    }
    
    // Attendre un peu pour que le trigger et l'Edge Function s'exécutent
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Vérifier que la notification a été créée
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'attendance_marked')
      .contains('data', { attendanceRecordId: record.id })
      .order('created_at', { ascending: false })
    
    // Vérifier les logs
    const { data: logs, error: logsError } = await supabase
      .from('notification_logs')
      .select('*')
      .eq('type', 'attendance_marked')
      .contains('data', { attendanceRecordId: record.id })
      .order('created_at', { ascending: false })
    
    return NextResponse.json({
      success: true,
      message: 'Test de notification exécuté',
      data: {
        record,
        student: {
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          parentCount: parents?.length || 0,
        },
        notifications: notifications || [],
        notificationCount: notifications?.length || 0,
        logs: logs || [],
        logCount: logs?.length || 0,
      },
      summary: {
        parentsLinked: parents?.length || 0,
        notificationsCreated: notifications?.length || 0,
        logsCreated: logs?.length || 0,
      }
    })
    
  } catch (error) {
    console.error('Erreur lors du test de notification:', error)
    return NextResponse.json(
      { error: 'Erreur interne', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}

/**
 * GET: Récupérer les informations pour le test
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    
    // Vérifier l'authentification
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }
    
    // Récupérer quelques élèves avec leurs parents
    const { data: studentsWithParents, error: studentsError } = await supabase
      .from('students')
      .select(`
        id,
        first_name,
        last_name,
        student_parent_relations(parent_id)
      `)
      .limit(10)
    
    if (studentsError) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des élèves', details: studentsError },
        { status: 500 }
      )
    }
    
    // Filtrer les élèves qui ont des parents
    const eligibleStudents = studentsWithParents?.filter(
      s => s.student_parent_relations && s.student_parent_relations.length > 0
    )
    
    // Récupérer les sessions de présence récentes
    const { data: sessions, error: sessionsError } = await supabase
      .from('attendance_sessions')
      .select('id, session_date, status')
      .order('session_date', { ascending: false })
      .limit(10)
    
    return NextResponse.json({
      eligibleStudents: eligibleStudents?.map(s => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        parentCount: s.student_parent_relations?.length || 0,
      })),
      recentSessions: sessions || [],
      instructions: {
        method: 'POST',
        endpoint: '/api/test/attendance-notification',
        body: {
          studentId: 'ID élève',
          status: 'absent | late',
          sessionId: 'ID session',
        },
      },
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    )
  }
}
