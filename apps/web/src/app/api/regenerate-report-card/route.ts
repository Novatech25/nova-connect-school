import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, periodId } = body;

    if (!studentId || !periodId) {
      return NextResponse.json({ error: 'studentId et periodId requis' }, { status: 400 });
    }

    console.log('[API] Régénération bulletin:', { studentId, periodId });

    // Récupérer les credentials depuis les variables d'environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 });
    }

    // Récupérer le token de la requête
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }

    // Appeler directement l'Edge Function
    const functionUrl = `${supabaseUrl}/functions/v1/generate-report-card-pdf`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'x-user-token': token,
      },
      body: JSON.stringify({
        studentId,
        periodId,
        regenerate: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[API] Erreur Edge Function:', data);
      return NextResponse.json({ 
        error: 'Erreur Edge Function',
        details: data,
        status: response.status
      }, { status: 500 });
    }

    console.log('[API] Succès:', data);

    return NextResponse.json({
      success: true,
      message: 'Bulletin régénéré',
      data,
    });

  } catch (error: any) {
    console.error('[API] Erreur:', error);
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error.message 
    }, { status: 500 });
  }
}
