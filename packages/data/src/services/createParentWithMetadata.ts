import { SupabaseClient } from "@supabase/supabase-js";
import { UserRole } from "@novaconnect/core/types";

export interface CreateParentInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  schoolId: string;
  schoolCode?: string;
  role?: UserRole;
}

export interface CreateParentResult {
  success: boolean;
  data?: {
    userId: string;
    user: any;
  };
  error?: string;
  details?: any;
}

/**
 * Crée un compte parent avec TOUTES les métadonnées nécessaires pour la connexion
 *
 * Cette fonction garantit que:
 * 1. Le rôle est dans user_metadata ET app_metadata
 * 2. L'email est confirmé
 * 3. Toutes les données utilisateur sont correctement formatées
 *
 * @param supabase - Supabase Admin client (createServiceClient())
 * @param input - Données pour créer le compte parent
 * @returns Résultat de la création
 */
export async function createParentWithMetadata(
  supabase: SupabaseClient,
  input: CreateParentInput,
): Promise<CreateParentResult> {
  const {
    email,
    password,
    firstName,
    lastName,
    schoolId,
    schoolCode,
    role = "parent",
  } = input;

  console.log("[PARENT] Création du compte parent:", email);

  // Préparer les métadonnées COMPLÈTES
  const userMetadata = {
    first_name: firstName,
    last_name: lastName,
    role,
    school_code: schoolCode,
    school_id: schoolId,
    provider: "email",
    full_name: `${firstName} ${lastName}`,
  };

  const appMetadata = {
    role,
    provider: "email",
    school_id: schoolId,
  };

  console.log("[PARENT] user_metadata:", userMetadata);
  console.log("[PARENT] app_metadata:", appMetadata);

  // Créer l'utilisateur auth avec TOUTES les métadonnées
  const { data: authData, error: createAuthError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Email confirmé automatiquement
      user_metadata: userMetadata,
      app_metadata: appMetadata,
    });

  if (createAuthError) {
    console.error("[PARENT] Erreur création auth user:", createAuthError);
    return {
      success: false,
      error: createAuthError.message || "Failed to create auth user",
      details: createAuthError,
    };
  }

  const authUserId = authData.user.id;
  console.log("[PARENT] Auth user créé:", authUserId);

  // Vérifier que les métadonnées sont correctes
  const { data: createdUser, error: fetchError } =
    await supabase.auth.admin.getUserById(authUserId);

  if (fetchError) {
    console.error("[PARENT] Erreur récupération utilisateur:", fetchError);
    return {
      success: false,
      error: "User created but could not verify metadata",
      details: fetchError,
    };
  }

  const user = createdUser.user;

  // Validation des métadonnées
  const metadataCheck = {
    hasUserRole: user.user_metadata?.role === role,
    hasAppRole: user.app_metadata?.role === role,
    emailConfirmed: !!user.email_confirmed_at,
    hasFirstName: !!user.user_metadata?.first_name,
    hasLastName: !!user.user_metadata?.last_name,
  };

  console.log("[PARENT] Validation métadonnées:", metadataCheck);

  // Si les métadonnées ne sont pas correctes, les mettre à jour
  if (!metadataCheck.hasUserRole || !metadataCheck.hasAppRole) {
    console.warn("[PARENT] Métadonnées incomplètes, correction en cours...");

    const correctedMetadata = {
      ...user.user_metadata,
      role,
    };

    const correctedAppMetadata = {
      ...user.app_metadata,
      role,
      provider: "email",
    };

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      authUserId,
      {
        user_metadata: correctedMetadata,
        app_metadata: correctedAppMetadata,
        email_confirm: true,
      },
    );

    if (updateError) {
      console.error("[PARENT] Erreur correction métadonnées:", updateError);
      return {
        success: false,
        error: "User created but failed to fix metadata",
        details: { originalError: createAuthError, fixError: updateError },
      };
    }

    console.log("[PARENT] Métadonnées corrigées avec succès");
  }

  return {
    success: true,
    data: {
      userId: authUserId,
      user,
      metadataCheck,
    },
  };
}
