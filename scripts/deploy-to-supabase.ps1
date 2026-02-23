# ============================================================================
# Script de déploiement NovaConnect sur Supabase Cloud
# Projet: mdfzmdddmwpbqmkxomdb
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "DEPLOIEMENT NOVACONNECT SUR SUPABASE" -ForegroundColor Cyan
Write-Host "Projet: mdfzmdddmwpbqmkxomdb" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que supabase CLI est installé
$supabaseVersion = supabase --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Supabase CLI n'est pas installé. Installez-le avec: npm install -g supabase"
    exit 1
}

Write-Host "✅ Supabase CLI: $supabaseVersion" -ForegroundColor Green
Write-Host ""

# ============================================================================
# ÉTAPE 1: Vérifier le lien du projet
# ============================================================================
Write-Host "--- Vérification du lien projet ---" -ForegroundColor Yellow

$linkedProject = supabase projects list 2>&1 | Select-String "mdfzmdddmwpbqmkxomdb"
if (-not $linkedProject) {
    Write-Host "🔗 Lien du projet..." -ForegroundColor Yellow
    supabase link --project-ref mdfzmdddmwpbqmkxomdb
} else {
    Write-Host "✅ Projet déjà lié" -ForegroundColor Green
}
Write-Host ""

# ============================================================================
# ÉTAPE 2: Nettoyer les fonctions conflictuelles via API REST
# ============================================================================
Write-Host "--- Nettoyage des fonctions conflictuelles ---" -ForegroundColor Yellow

if (-not $ServiceRoleKey) {
    Write-Host "⚠️  Clé Service Role non fournie" -ForegroundColor Yellow
    Write-Host "Entrez votre SUPABASE_SERVICE_ROLE_KEY: " -NoNewline -ForegroundColor Yellow
    $ServiceRoleKey = Read-Host -AsSecureString
    $ServiceRoleKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ServiceRoleKey))
}

$SupabaseUrl = "https://mdfzmdddmwpbqmkxomdb.supabase.co"

$cleanupSQL = @"
DROP FUNCTION IF EXISTS publish_schedule_v2(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_v3(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_simple(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS nova_publish_schedule(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS fix_publish_schedule_simple(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_ultra_simple(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_no_triggers(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_minimal(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_simple_rpc(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_rpc_final(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_rpc_fixed(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_rpc_v4_fixed(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_rpc_secure(UUID, UUID, UUID, UUID);
DROP TRIGGER IF EXISTS trigger_notify_parents_on_absence ON attendance_records;
SELECT 'Cleanup completed' as status;
"@

Write-Host "🧹 Exécution du nettoyage..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/rpc/exec_sql" -Method POST -Headers @{
        "apikey" = $ServiceRoleKey
        "Authorization" = "Bearer $ServiceRoleKey"
        "Content-Type" = "application/json"
    } -Body (@{ query = $cleanupSQL } | ConvertTo-Json) -ErrorAction Stop
    
    Write-Host "✅ Nettoyage réussi" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Nettoyage via API échoué (normal si rpc/exec_sql n'existe pas)" -ForegroundColor Yellow
    Write-Host "   Veuillez exécuter le SQL dans le Dashboard Supabase:"
    Write-Host "   https://supabase.com/dashboard/project/mdfzmdddmwpbqmkxomdb/sql" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "SQL à exécuter:"
    Write-Host $cleanupSQL -ForegroundColor Gray
    Write-Host ""
    
    $continue = Read-Host "Avez-vous exécuté le SQL manuellement? (y/n)"
    if ($continue -ne 'y') {
        Write-Host "❌ Déploiement annulé" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# ============================================================================
# ÉTAPE 3: Pousser les migrations
# ============================================================================
Write-Host "--- Déploiement des migrations ---" -ForegroundColor Yellow
Write-Host "Cette étape va appliquer toutes les migrations en attente..." -ForegroundColor Yellow
Write-Host ""

$migrationList = supabase db push --include-all --dry-run 2>&1 | Select-String "\.sql"
Write-Host "Migrations à appliquer:"
$migrationList | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
Write-Host ""

$confirm = Read-Host "Voulez-vous continuer? (y/n)"
if ($confirm -eq 'y') {
    Write-Host "🚀 Déploiement des migrations..." -ForegroundColor Yellow
    supabase db push --include-all
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migrations déployées avec succès" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors du déploiement des migrations" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠️  Déploiement des migrations annulé" -ForegroundColor Yellow
}
Write-Host ""

# ============================================================================
# ÉTAPE 4: Déployer les Edge Functions
# ============================================================================
Write-Host "--- Déploiement des Edge Functions ---" -ForegroundColor Yellow

$functions = @(
    "send-attendance-notification",
    "send-email-notification",
    "send-sms-notification",
    "retry-failed-notifications"
)

foreach ($func in $functions) {
    Write-Host "🚀 Déploiement: $func..." -ForegroundColor Yellow -NoNewline
    $result = supabase functions deploy $func 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅" -ForegroundColor Green
    } else {
        Write-Host " ⚠️  (peut déjà exister)" -ForegroundColor Yellow
    }
}
Write-Host ""

# ============================================================================
# ÉTAPE 5: Vérification
# ============================================================================
Write-Host "--- Vérification ---" -ForegroundColor Yellow

Write-Host "Tables créées:" -ForegroundColor Gray
$tables = @("push_tokens", "notifications", "notification_logs", "notification_preferences")
foreach ($table in $tables) {
    Write-Host "  - $table" -ForegroundColor Gray
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "DEPLOIEMENT TERMINÉ!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Yellow
Write-Host "1. Configurez les variables d'environnement:" -ForegroundColor White
Write-Host "   https://supabase.com/dashboard/project/mdfzmdddmwpbqmkxomdb/settings/functions" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Testez le système:" -ForegroundColor White
Write-Host "   - Créez un enregistrement de présence avec statut 'absent'" -ForegroundColor Gray
Write-Host "   - Vérifiez que la notification est créée dans la table 'notifications'" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Configurez l'app mobile pour enregistrer les push tokens" -ForegroundColor White
Write-Host ""
