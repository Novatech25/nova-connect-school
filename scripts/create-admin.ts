// @ts-ignore
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Charger les variables d'environnement
dotenv.config();

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// Debug: Afficher les clés chargées (masquées partiellement)
console.log("--- Debug Configuration ---");
console.log("SUPABASE_URL:", SUPABASE_URL);
console.log(
  "SUPABASE_SERVICE_KEY:",
  SUPABASE_SERVICE_KEY
    ? `${SUPABASE_SERVICE_KEY.substring(0, 10)}...`
    : "undefined"
);
console.log("---------------------------");

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "❌ Erreur: Les variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises dans le fichier .env"
  );
  console.error(
    "   Assurez-vous d'avoir un fichier .env à la racine avec ces clés."
  );
  process.exit(1);
}

// Option pour ignorer la vérification SSL si nécessaire (pour local dev parfois)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];
  const type = process.argv[4] || "school_admin"; // 'super_admin' ou 'school_admin'

  if (!email || !password) {
    console.log("Usage: bun scripts/create-admin.ts <email> <password> [type]");
    console.log("Types: super_admin (défaut: school_admin)");
    process.exit(1);
  }

  console.log(`⏳ Création du compte ${type} pour ${email}...`);

  // Métadonnées spécifiques selon le rôle
  const metadata: any = {
    first_name: "Admin",
    last_name: "System",
    role: type,
  };

  // Si c'est un admin d'école, on lui donne le code de l'école par défaut pour éviter l'erreur du trigger
  if (type === "school_admin") {
    metadata.school_code = "NOUAK-001";
    console.log(
      "   ℹ️  Association automatique à l'école par défaut (NOUAK-001)"
    );
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirmation
    user_metadata: metadata,
  });

  if (error) {
    console.error("❌ Erreur lors de la création:", error.message);
    if (error.message.includes("Invalid API key")) {
      console.error(
        "\n⚠️  Conseil: Vérifiez que SUPABASE_SERVICE_ROLE_KEY dans le fichier .env est correcte."
      );
      console.error(
        '   Elle doit commencer par "eyJ..." et correspondre à la clé "service_role" (pas "anon").'
      );
    }
    process.exit(1);
  }

  console.log("✅ Compte créé avec succès !");
  console.log(`   ID: ${data.user.id}`);
  console.log(`   Email: ${data.user.email}`);
  console.log(`   Rôle: ${data.user.user_metadata.role}`);

  if (type === "school_admin") {
    console.log(
      "\n👉 Vous pouvez maintenant vous connecter avec ce compte sur http://localhost:3000/login"
    );
  } else if (type === "super_admin") {
    console.log("\n👉 Compte Super Admin prêt.");
  }
}

createAdmin().catch(console.error);
