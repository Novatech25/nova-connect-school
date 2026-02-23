import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/cron/room-assignment-notify
 *
 * Vercel Cron Job — appelé chaque minute.
 * Détecte automatiquement si la fenêtre T-60 ou T-15 est active
 * et appelle l'Edge Function Supabase pour chaque fenêtre correspondante.
 *
 * Sécurisé par CRON_SECRET (injecté automatiquement par Vercel).
 */
export async function GET(req: NextRequest) {
  // ── Vérification de sécurité ──────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[room-assignment-notify] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Données de base ────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[room-assignment-notify] Supabase env vars missing')
    return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 })
  }

  const now = new Date()
  const sessionDate = now.toISOString().split('T')[0]

  const results: Record<string, any> = {
    timestamp: now.toISOString(),
    sessionDate,
    windows: [],
  }

  /**
   * Fenêtres à traiter :
   * - T-60 : si l'heure actuelle est dans le créneau [X-61, X-59] → cours dans ~60 min
   * - T-15 : si l'heure actuelle est dans le créneau [X-16, X-14] → cours dans ~15 min
   *
   * L'Edge Function gère en interne la correspondance start_time ±1 min,
   * donc on appelle les 2 fenêtres à chaque run. Seuls les cours concernés
   * recevront des notifications (grâce aux champs t60_sent_at / t15_sent_at).
   */
  const windows = [60, 15] as const

  for (const window of windows) {
    try {
      console.log(`[room-assignment-notify] Calling T-${window} for ${sessionDate}`)

      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-room-assignment-notifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
          },
          body: JSON.stringify({
            notificationWindow: window,
            sessionDate,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error(`[room-assignment-notify] T-${window} error:`, data)
        results.windows.push({
          window,
          success: false,
          error: data.error || `HTTP ${response.status}`,
        })
      } else {
        console.log(`[room-assignment-notify] T-${window} success:`, data)
        results.windows.push({
          window,
          success: true,
          notificationsSent: data.notificationsSent ?? 0,
          message: data.message,
        })
      }
    } catch (err: any) {
      console.error(`[room-assignment-notify] T-${window} exception:`, err)
      results.windows.push({
        window,
        success: false,
        error: err.message || String(err),
      })
    }
  }

  const allSuccess = results.windows.every((w: any) => w.success)

  return NextResponse.json(
    { success: allSuccess, ...results },
    { status: allSuccess ? 200 : 207 }
  )
}
