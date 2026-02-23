#!/usr/bin/env node

/**
 * Script de test pour vérifier l'Edge Function Supabase
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

// Lire les credentials Supabase depuis le .env
function getSupabaseCredentials() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return null;
  }
  
  const env = fs.readFileSync(envPath, 'utf8');
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
  const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
  
  return {
    url: urlMatch ? urlMatch[1].trim() : null,
    key: keyMatch ? keyMatch[1].trim() : null,
  };
}

async function testEdgeFunction() {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║  TEST EDGE FUNCTION SUPABASE                           ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝\n', 'cyan');

  const creds = getSupabaseCredentials();
  if (!creds || !creds.url || !creds.key) {
    log('❌ Credentials Supabase non trouvés dans .env', 'red');
    return;
  }

  log('1. Vérification de la configuration...', 'blue');
  log(`   URL: ${creds.url}`, 'green');
  log(`   Clé: ${creds.key.substring(0, 20)}...`, 'green');

  // Extraire le project ref
  const projectRef = creds.url.match(/https:\/\/([^.]+)/)?.[1];
  if (!projectRef) {
    log('❌ Impossible d\'extraire le project ref', 'red');
    return;
  }

  log(`   Project: ${projectRef}`, 'green');

  // URL de l'Edge Function
  const functionUrl = `https://${projectRef}.supabase.co/functions/v1/generate-report-card-pdf`;
  
  log('\n2. Test de l\'Edge Function...', 'blue');
  log(`   URL: ${functionUrl}`, 'cyan');

  // Test simple avec OPTIONS (vérifie si la fonction existe)
  const options = {
    hostname: `${projectRef}.supabase.co`,
    path: '/functions/v1/generate-report-card-pdf',
    method: 'OPTIONS',
    headers: {
      'Authorization': `Bearer ${creds.key}`,
      'apikey': creds.key,
    },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      log(`   Status: ${res.statusCode}`, res.statusCode === 200 ? 'green' : 'yellow');
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (data) {
          log(`   Réponse: ${data.substring(0, 200)}...`, 'cyan');
        }
        
        log('\n3. Conclusion:', 'blue');
        if (res.statusCode === 200 || res.statusCode === 204) {
          log('   ✅ Edge Function est accessible', 'green');
          log('\n   💡 Pour tester la génération de PDF:', 'yellow');
          log('      1. Allez sur /admin/report-cards', 'cyan');
          log('      2. Cliquez sur un bulletin', 'cyan');
          log('      3. Utilisez le bouton "🧪 TEST - Regénérer via Edge Function"', 'cyan');
        } else {
          log('   ⚠️ Edge Function retourne un code inhabituel', 'yellow');
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      log(`   ❌ Erreur: ${e.message}`, 'red');
      log('\n   💡 Solutions possibles:', 'yellow');
      log('      - Vérifiez votre connexion internet', 'cyan');
      log('      - Vérifiez que l\'Edge Function est déployée:', 'cyan');
      log('        npx supabase functions deploy generate-report-card-pdf', 'cyan');
      resolve();
    });

    req.setTimeout(10000, () => {
      req.destroy();
      log('   ❌ Timeout - Pas de réponse', 'red');
      resolve();
    });

    req.end();
  });
}

testEdgeFunction().then(() => {
  log('\n');
  process.exit(0);
});
