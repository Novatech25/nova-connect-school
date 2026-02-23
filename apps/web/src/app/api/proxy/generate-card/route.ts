import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Dans une route API, on peut récupérer le token directement depuis le header Authorization
  // si le client l'envoie, ce qui est souvent plus fiable que les cookies pour les appels API
  const authHeader = request.headers.get('Authorization');
  let accessToken = authHeader?.replace('Bearer ', '');

  // Si pas de header, on essaie les cookies
  if (!accessToken) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          getAll() {
            return cookieStore.getAll();
          },
          set(name, value, options) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {}
          },
          remove(name, options) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {}
          },
        },
      }
    );
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token;
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Session invalide ou expirée (Proxy)' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
    
    if (!supabaseUrl) {
      console.error('[Proxy] ERROR: NEXT_PUBLIC_SUPABASE_URL is not defined');
      return NextResponse.json(
        { error: 'Server configuration error: Supabase URL not configured' },
        { status: 500 }
      );
    }
    
    const functionUrl = `${supabaseUrl}/functions/v1/generate-student-card-pdf`;

    console.log(`[Proxy] Calling Edge Function: ${functionUrl}`);
    console.log(`[Proxy] Token present: ${accessToken ? 'YES' : 'NO'}`);
    console.log(`[Proxy] Request body:`, body);

    // 3. Appel Serveur à Serveur vers la Edge Function
    // Note: Augmenter le timeout car les Edge Functions peuvent avoir un cold start
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 secondes timeout
    
    let response;
    try {
      response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`, // Relai du token
          'Content-Type': 'application/json',
          // IMPORTANT: On n'envoie PAS les cookies au Edge Function, seulement le header Authorization
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error('[Proxy] Fetch error:', fetchError);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Edge Function timeout', details: 'La fonction a mis trop de temps à répondre (60s)' },
          { status: 504 }
        );
      }
      
      // Si c'est une erreur de connexion, suggérer de vérifier le déploiement
      if (fetchError.message?.includes('fetch failed') || fetchError.message?.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { 
            error: 'Edge Function inaccessible', 
            details: 'Impossible de se connecter à la Edge Function. Vérifiez qu\'elle est déployée avec: supabase functions deploy generate-student-card-pdf',
            originalError: fetchError.message
          },
          { status: 502 }
        );
      }
      
      throw fetchError;
    }

    // 4. Gestion de la réponse
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`[Proxy] Edge Function Error (${response.status}):`, responseText);
      return NextResponse.json(
        { 
          success: false, 
          error: `Erreur Edge Function (${response.status})`, 
          details: responseText 
        },
        { status: response.status }
      );
    }

    // Tenter de parser le JSON si possible
    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch (e) {
      return NextResponse.json({ success: true, data: responseText });
    }

  } catch (error: any) {
    console.error('[Proxy] Internal Error:', error);
    console.error('[Proxy] Error stack:', error.stack);
    console.error('[Proxy] Error cause:', error.cause);
    return NextResponse.json(
      { error: 'Internal Proxy Error', details: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
