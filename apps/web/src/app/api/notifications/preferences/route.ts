import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@novaconnect/data';

// GET - Récupérer les préférences d'un utilisateur
export async function GET(request: NextRequest) {
  try {
    // Créer le client Supabase avec les cookies de session
    const supabase = await createServerClient();

    // Récupérer l'utilisateur authentifié depuis les cookies
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    // Vérifier que l'utilisateur a le droit d'accéder à ces préférences
    if (userId !== user.id) {
      // Vérifier si c'est un admin
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = userRoles?.some((ur: any) =>
        ['super_admin', 'school_admin'].includes(ur.role)
      );

      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Non autorisé à accéder aux préférences de cet utilisateur' },
          { status: 403 }
        );
      }
    }

    // Récupérer les préférences de l'utilisateur
    // RLS s'appliquera automatiquement pour restreindre l'accès
    const { data: preferences, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching preferences:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des préférences' },
        { status: 500 }
      );
    }

    return NextResponse.json({ preferences: preferences || [] });
  } catch (error) {
    console.error('Error in GET /api/notifications/preferences:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// POST - Créer ou mettre à jour les préférences d'un utilisateur
export async function POST(request: NextRequest) {
  try {
    // Créer le client Supabase avec les cookies de session
    const supabase = await createServerClient();

    // Récupérer l'utilisateur authentifié depuis les cookies
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { userId, preferences } = await request.json();

    if (!userId || !preferences) {
      return NextResponse.json(
        { error: 'userId et preferences requis' },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur a le droit de modifier ces préférences
    if (userId !== user.id) {
      // Vérifier si c'est un admin
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = userRoles?.some((ur: any) =>
        ['super_admin', 'school_admin'].includes(ur.role)
      );

      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Non autorisé à modifier les préférences de cet utilisateur' },
          { status: 403 }
        );
      }
    }

    // Supprimer les anciennes préférences
    // RLS permettra la suppression si admin ou même utilisateur
    const { error: deleteError } = await supabase
      .from('notification_preferences')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting old preferences:', deleteError);
      return NextResponse.json(
        { error: 'Erreur lors de la suppression des anciennes préférences' },
        { status: 500 }
      );
    }

    // Insérer les nouvelles préférences
    const preferencesToInsert = preferences.map((pref: any) => ({
      user_id: userId,
      notification_type: pref.notification_type,
      enabled_channels: pref.enabled_channels,
    }));

    const { data: newPreferences, error: insertError } = await supabase
      .from('notification_preferences')
      .insert(preferencesToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting preferences:', insertError);
      return NextResponse.json(
        { error: 'Erreur lors de la sauvegarde des préférences' },
        { status: 500 }
      );
    }

    return NextResponse.json({ preferences: newPreferences });
  } catch (error) {
    console.error('Error in POST /api/notifications/preferences:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
