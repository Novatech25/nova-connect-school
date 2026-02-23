import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@novaconnect/data';

// Valeurs par défaut des canaux pour chaque type de notification
const DEFAULT_CHANNELS = {
  grade_posted: ['in_app', 'push', 'email'],
  assignment_added: ['in_app', 'push', 'email'],
  schedule_published: ['in_app', 'push'],
  schedule_updated: ['in_app', 'push'],
  attendance_marked: ['in_app', 'push'],
  hours_validated: ['in_app', 'push', 'email'],
  payroll_payment: ['in_app', 'push', 'email'],
  document_blocked: ['in_app', 'push', 'email', 'sms'],
  payment_overdue: ['in_app', 'push', 'email', 'sms', 'whatsapp'],
};

// POST - Réinitialiser les préférences aux valeurs par défaut
export async function POST(request: NextRequest) {
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

    // Insérer les préférences par défaut
    const preferencesToInsert = Object.entries(DEFAULT_CHANNELS).map(
      ([notification_type, enabled_channels]) => ({
        user_id: userId,
        notification_type,
        enabled_channels,
      })
    );

    const { data: newPreferences, error: insertError } = await supabase
      .from('notification_preferences')
      .insert(preferencesToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting default preferences:', insertError);
      return NextResponse.json(
        { error: 'Erreur lors de la création des préférences par défaut' },
        { status: 500 }
      );
    }

    return NextResponse.json({ preferences: newPreferences });
  } catch (error) {
    console.error('Error in POST /api/notifications/preferences/default:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
