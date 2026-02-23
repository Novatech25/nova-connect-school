import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/cron/room-assignment-calculate
 *
 * Vercel Cron Job — appelé chaque jour à 18h00 UTC.
 * Pré-calcule les attributions de salles pour le lendemain
 * pour toutes les écoles ayant le module activé.
 *
 * Appelle la RPC Postgres `calculate_room_assignments_all_schools_rpc`
 * qui traite toutes les écoles en une seule transaction.
 */
export async function GET(req: NextRequest) {
  // ── Vérification de sécurité ──────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[room-assignment-calculate] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Client Supabase avec Service Role ────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[room-assignment-calculate] Supabase env vars missing')
    return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // ── Date cible : demain ───────────────────────────────────────────
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const sessionDate = tomorrow.toISOString().split('T')[0]

  console.log(`[room-assignment-calculate] Calculating for ${sessionDate}`)

  try {
    // Appel RPC Postgres (traite toutes les écoles en une fois)
    const { data, error } = await supabase.rpc(
      'calculate_room_assignments_all_schools_rpc',
      { p_session_date: sessionDate }
    )

    if (error) {
      console.error('[room-assignment-calculate] RPC error:', error)
      return NextResponse.json(
        { success: false, error: error.message, sessionDate },
        { status: 500 }
      )
    }

    console.log('[room-assignment-calculate] RPC result:', data)

    // Alerte si des écoles ont échoué
    if (data?.schools_failed > 0) {
      console.warn(
        `[room-assignment-calculate] ${data.schools_failed} école(s) en erreur:`,
        data.details?.filter((d: any) => d.status === 'error')
      )
    }

    return NextResponse.json({
      success: true,
      sessionDate,
      schoolsProcessed: data?.schools_processed ?? 0,
      schoolsFailed: data?.schools_failed ?? 0,
      totalSchools: data?.total_schools ?? 0,
      details: data?.details ?? [],
    })
  } catch (err: any) {
    console.error('[room-assignment-calculate] Exception:', err)
    return NextResponse.json(
      { success: false, error: err.message || String(err), sessionDate },
      { status: 500 }
    )
  }
}
