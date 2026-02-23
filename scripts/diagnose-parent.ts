
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Charger les variables d'environnement depuis apps/web/.env
dotenv.config({ path: path.join(process.cwd(), "apps", "web", ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Erreur: Configuration manquante (URL ou SERVICE_KEY).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function diagnoseParent(email: string) {
  console.log(`🔍 Diagnostic pour l'email: ${email}`);
  console.log("---------------------------------------------------");

  // 1. Check Auth User
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error("❌ Erreur listUsers:", authError);
    return;
  }
  
  const authUser = authUsers.users.find(u => u.email === email);
  if (!authUser) {
    console.error("❌ Auth User: NON TROUVÉ");
    return;
  }
  console.log(`✅ Auth User: TROUVÉ (ID: ${authUser.id})`);
  console.log(`   Metadata:`, authUser.user_metadata);
  console.log(`   App Metadata:`, authUser.app_metadata);

  const userId = authUser.id;

  // 2. Check User Record
  const { data: userRecord, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (userError || !userRecord) {
    console.error("❌ Table 'users': NON TROUVÉ ou Erreur", userError);
  } else {
    console.log(`✅ Table 'users': TROUVÉ (School ID: ${userRecord.school_id})`);
  }

  // 3. Check Parent Record
  const { data: parentRecord, error: parentError } = await supabase
    .from("parents")
    .select("*")
    .eq("user_id", userId)
    .single(); // Recherche par user_id car c'est le lien clé

  if (parentError || !parentRecord) {
    console.error("❌ Table 'parents': NON TROUVÉ (via user_id)");
    
    // Essai par email pour voir si le lien est cassé
    const { data: parentByEmail } = await supabase
        .from("parents")
        .select("*")
        .eq("email", email)
        .maybeSingle();
        
    if (parentByEmail) {
        console.warn(`⚠️  Parent trouvé par email mais user_id ne correspond pas ou est null.`);
        console.warn(`    Parent ID: ${parentByEmail.id}, User ID actuel: ${parentByEmail.user_id}, Attendu: ${userId}`);
    }
  } else {
    console.log(`✅ Table 'parents': TROUVÉ (ID: ${parentRecord.id})`);
  }

  // 4. Check User Roles
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("*, roles(name)")
    .eq("user_id", userId);

  if (rolesError) {
    console.error("❌ Table 'user_roles': Erreur", rolesError);
  } else if (!roles || roles.length === 0) {
    console.error("❌ Table 'user_roles': AUCUN RÔLE ASSIGNÉ");
  } else {
    console.log(`✅ Table 'user_roles': ${roles.length} rôle(s) trouvé(s)`);
    roles.forEach(r => console.log(`   - ${r.roles?.name} (School: ${r.school_id})`));
  }

  // 5. Check Student Relations
  if (parentRecord) {
    const { data: relations, error: relError } = await supabase
      .from("student_parent_relations")
      .select("*, students(first_name, last_name)")
      .eq("parent_id", parentRecord.id);

    if (relError) {
      console.error("❌ Table 'student_parent_relations': Erreur", relError);
    } else if (!relations || relations.length === 0) {
      console.error("❌ Table 'student_parent_relations': AUCUNE RELATION TROUVÉE");
    } else {
      console.log(`✅ Table 'student_parent_relations': ${relations.length} relation(s) trouvée(s)`);
      for (const r of relations) {
        console.log(`   - Enfant: ${r.students?.first_name} ${r.students?.last_name} (ID: ${r.student_id})`);
        console.log(`     Type: ${r.relationship}, Primary: ${r.is_primary}`);

        // Check Enrollments for this student
        const { data: enrolls, error: enrollError } = await supabase
            .from("enrollments")
            .select("*")
            .eq("student_id", r.student_id);
            
        if (enrollError) {
            console.error(`     ❌ Enrollments: Erreur`, enrollError);
        } else if (!enrolls || enrolls.length === 0) {
            console.warn(`     ⚠️  Enrollments: AUCUNE INSCRIPTION`);
        } else {
            console.log(`     ✅ Enrollments: ${enrolls.length} inscription(s)`);
            for (const e of enrolls) {
                console.log(`        - Enrollment ID: ${e.id}`);
                console.log(`          Class ID: ${e.class_id}, Year ID: ${e.academic_year_id}`);
                
                // Check Class
                const { data: cls, error: clsError } = await supabase.from('classes').select('id, name, school_id').eq('id', e.class_id).single();
                if (clsError) console.error(`          ❌ Class Error:`, clsError.message);
                else console.log(`          ✅ Class: ${cls.name} (School: ${cls.school_id})`);
                
                // Check Academic Year
                const { data: year, error: yearError } = await supabase.from('academic_years').select('id, name, school_id').eq('id', e.academic_year_id).single();
                if (yearError) console.error(`          ❌ Year Error:`, yearError.message);
                else console.log(`          ✅ Year: ${year.name} (School: ${year.school_id})`);

                // Check access match
                if (cls && cls.school_id !== userRecord.school_id) {
                    console.error(`          ⛔ MISMATCH: Class School (${cls.school_id}) != User School (${userRecord.school_id})`);
                }
            }
        }
      }
    }
  }
}

const email = process.argv[2] || "altmanfather21@gmail.com";
diagnoseParent(email).catch(console.error);
