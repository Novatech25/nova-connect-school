#!/usr/bin/env node

/**
 * Script de diagnostic pour le système de bulletins
 * Vérifie si le Gateway est configuré et démarré
 */

const http = require('http');
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

function checkGatewayHealth(url, timeout = 3000) {
  return new Promise((resolve) => {
    const req = http.get(`${url}/health`, (res) => {
      resolve({
        online: res.statusCode === 200,
        statusCode: res.statusCode,
      });
    });

    req.on('error', () => {
      resolve({ online: false, statusCode: null });
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      resolve({ online: false, statusCode: null });
    });
  });
}

async function main() {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║  DIAGNOSTIC SYSTÈME DE BULLETINS NOVACONNECT          ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝\n', 'cyan');

  // 1. Vérifier les variables d'environnement
  log('1. Vérification de la configuration...', 'blue');
  
  const webEnvPath = path.join(__dirname, '..', 'apps', 'web', '.env.local');
  const webEnvExists = fs.existsSync(webEnvPath);
  
  const gatewayEnvPath = path.join(__dirname, '..', 'apps', 'gateway', '.env');
  const gatewayEnvExists = fs.existsSync(gatewayEnvPath);

  let gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

  if (webEnvExists) {
    const webEnv = fs.readFileSync(webEnvPath, 'utf8');
    const match = webEnv.match(/NEXT_PUBLIC_GATEWAY_URL=(.+)/);
    if (match) gatewayUrl = match[1].trim();
  }

  log(`   URL Gateway configurée: ${gatewayUrl}`, gatewayUrl ? 'green' : 'yellow');

  // 2. Vérifier si le Gateway est en ligne
  log('\n2. Test de connectivité au Gateway...', 'blue');
  
  const health = await checkGatewayHealth(gatewayUrl);

  if (health.online) {
    log('   ✅ Gateway est EN LIGNE', 'green');
    log(`   URL: ${gatewayUrl}`, 'green');
  } else {
    log('   ❌ Gateway est HORS LIGNE', 'red');
    
    if (!health.statusCode) {
      log('   Erreur: Impossible de se connecter', 'red');
    } else {
      log(`   Status HTTP: ${health.statusCode}`, 'yellow');
    }

    log('\n   💡 SOLUTION:', 'yellow');
    log('   Le Gateway n\'est pas démarré. Pour utiliser le nouveau design:', 'yellow');
    log('');
    log('   1. Ouvrez un nouveau terminal', 'cyan');
    log('   2. Exécutez ces commandes:', 'cyan');
    log('');
    log('      cd apps/gateway', 'cyan');
      
    if (!gatewayEnvExists) {
      log('      cp .env.example .env', 'cyan');
      log('      # Éditez .env avec vos credentials Supabase', 'cyan');
    }
      
    log('      bun install  # Si première fois', 'cyan');
    log('      bun dev', 'cyan');
    log('');
    log('   3. Rechargez cette page', 'cyan');
    log('');
    log('   Alternative: Déployez l\'Edge Function:', 'yellow');
    log('      npx supabase functions deploy generate-report-card-pdf', 'cyan');
  }

  // 3. Vérifier le bucket de stockage
  log('\n3. Vérification du bucket Supabase...', 'blue');
  log('   Bucket: report-cards (vérification manuelle requise)', 'yellow');
  log('   Vérifiez dans Supabase Studio > Storage > report-cards', 'yellow');

  // 4. Résumé
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║  RÉSUMÉ                                                ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');

  if (health.online) {
    log('\n✅ Système prêt ! Le nouveau design sera utilisé.', 'green');
    log('   Les bulletins générés utiliseront le Gateway avec le design professionnel.', 'green');
  } else {
    log('\n⚠️  Système en mode dégradé (Fallback Supabase)', 'yellow');
    log('   - Les bulletins fonctionnent mais avec l\'ancien design', 'yellow');
    log('   - Démarrez le Gateway pour le nouveau design', 'yellow');
  }

  log('\n');
}

main().catch(console.error);
