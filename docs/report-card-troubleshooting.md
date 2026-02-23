# 🔧 Dépannage du Système de Bulletins

## Problème : L'ancien design de PDF s'affiche

Si vous voyez un PDF basique comme celui-ci :
- Pas de bandeau bleu
- Pas de couleurs
- Pas de QR code
- Simple texte noir sur blanc

**→ C'est l'ancien design qui est utilisé.**

---

## Pourquoi cela arrive ?

Le système a **2 façons** de générer les PDF :

```
┌─────────────────┐      ┌──────────────────────┐
│   NOUVEAU       │      │     ANCIEN           │
│   DESIGN        │      │     DESIGN           │
│                 │      │                      │
│  Gateway LAN    │  →   │  Edge Function       │
│  (Bun/jsPDF)    │      │  (Deno/jsPDF)        │
│                 │      │                      │
│  ✅ Couleurs    │      │  ❌ Texte simple     │
│  ✅ QR Code     │      │  ❌ Basique          │
│  ✅ Signatures  │      │                      │
└─────────────────┘      └──────────────────────┘
         ↑
    Préféré mais
    nécessite d'être
    démarré
```

### Ordre de priorité :
1. **Gateway LAN** (nouveau design) - Si disponible
2. **Edge Function Supabase** (ancien design) - Fallback

---

## Solution 1 : Démarrer le Gateway (Recommandé)

### Étape 1 : Vérifier la configuration
```bash
cd apps/gateway
cat .env
```

Si le fichier n'existe pas :
```bash
cp .env.example .env
```

### Étape 2 : Configurer les credentials
Éditez `.env` et ajoutez :
```env
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_KEY=votre-service-role-key
```

### Étape 3 : Démarrer
```bash
bun install  # Si première fois
bun dev
```

Vous devriez voir :
```
[Gateway] Server running on http://localhost:3001
[Gateway] License: active
[Gateway] Sync: ready
```

### Étape 4 : Vérifier
Ouvrez dans le navigateur :
```
http://localhost:3001/health
```

Réponse attendue :
```json
{"status": "healthy", "version": "1.0.0"}
```

---

## Solution 2 : Déployer l'Edge Function (Alternative)

Si vous ne pouvez pas démarrer le Gateway, déployez l'Edge Function avec le nouveau code :

```bash
# Depuis la racine du projet
npx supabase functions deploy generate-report-card-pdf

# Ou si vous avez la CLI
supabase functions deploy generate-report-card-pdf
```

**Note** : Cela nécessite un compte Supabase avec les fonctions activées.

---

## Solution 3 : Forcer l'utilisation du Gateway

### Vérifier que le frontend pointe vers le Gateway

Dans `apps/web/.env.local` :
```env
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001
```

### Vérifier le statut dans l'interface

Un indicateur a été ajouté en haut de la page `/admin/report-cards` :
- 🟢 **Gateway LAN (Nouveau Design)** : Gateway démarré
- 🟠 **Supabase Cloud (Mode Fallback)** : Gateway indisponible

---

## Script de diagnostic

Un script est disponible pour vérifier l'état :

```bash
node scripts/check-report-card-system.js
```

Résultat attendu si Gateway OK :
```
✅ Gateway est EN LIGNE
✅ Système prêt ! Le nouveau design sera utilisé.
```

Résultat si Gateway hors ligne :
```
❌ Gateway est HORS LIGNE
💡 SOLUTION: Démarrez le Gateway avec:
   cd apps/gateway && bun dev
```

---

## Vérifier dans la console du navigateur

Ouvrez la console DevTools (F12) et regardez les logs :

### Si vous voyez :
```
[DEBUG] Gateway URL: http://localhost:3001
[DEBUG] Trying Gateway...
[DEBUG] Gateway success
```
→ Le nouveau design est utilisé ✅

### Si vous voyez :
```
[DEBUG] Gateway URL: http://localhost:3001
[DEBUG] Trying Gateway...
[DEBUG] Trying Edge Function...
[DEBUG] Edge Function success
```
→ Le Gateway a échoué, fallback sur l'ancien design ❌

---

## Problèmes courants

### 1. "bun: command not found"
**Solution** : Installer Bun
```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. "Failed to fetch" ou "NetworkError"
**Cause** : Le Gateway n'est pas démarré ou bloqué par un firewall.

**Solution** :
```bash
# Vérifier si le port est utilisé
lsof -i:3001

# Tuer le processus si besoin
kill -9 $(lsof -t -i:3001)

# Redémarrer
cd apps/gateway && bun dev
```

### 3. "Unauthorized" ou "Invalid token"
**Cause** : Problème d'authentification entre le Web et le Gateway.

**Solution** : Vérifiez que les clés Supabase dans `apps/gateway/.env` sont correctes.

### 4. PDF toujours ancien après régénération
**Cause** : Cache navigateur ou Storage Supabase.

**Solution** :
1. J'ai ajouté un timestamp anti-cache dans le code
2. Forcez le refresh : Ctrl+Shift+R (ou Cmd+Shift+R sur Mac)
3. Videz le cache Storage Supabase si nécessaire

---

## Résumé

| Symptôme | Cause | Solution |
|----------|-------|----------|
| PDF basique, pas de couleurs | Gateway pas démarré | `cd apps/gateway && bun dev` |
| Erreur "Gateway not configured" | Variable d'env manquante | Ajouter `NEXT_PUBLIC_GATEWAY_URL` |
| Erreur 500 | Bug dans le code Gateway | Redémarrer le Gateway |
| "Unauthorized" | Mauvaises clés Supabase | Vérifier `.env` du Gateway |

---

## Besoin d'aide ?

1. Vérifiez les logs du Gateway dans son terminal
2. Vérifiez la console DevTools du navigateur
3. Exécutez le script de diagnostic : `node scripts/check-report-card-system.js`
4. Vérifiez l'indicateur dans l'interface web
